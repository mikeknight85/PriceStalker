# SSO / OIDC — Design Document

Target release: **v1.2.0**. Feature branch: `feature/sso`.

## Goals

- Let PriceStalker act as an OIDC Relying Party against any compliant provider
  (Authentik, Keycloak, Google, Okta, Auth0, etc.) using the standard
  **Authorization Code + PKCE** flow.
- Coexist with the existing local email/password system — admin picks a policy.
- Safe, incremental rollout: ship off-by-default, flip on once verified in prod.

## Non-goals (v1.2.0)

- Single Logout (SLO) against the IdP — local logout only for now.
- SAML. Only OIDC.
- Multiple simultaneous OIDC providers — one provider at a time.
- Group → role mapping from provider claims — all OIDC users start as regular
  users; admin promotes manually (admin-of-first-sight rule below handles the
  initial admin).
- SCIM user provisioning — JIT only.

## Decisions (answered by project owner)

| # | Question | Decision |
|---|----------|----------|
| 1 | First-admin on fresh install | **First person to log in (any method) auto-becomes admin.** Row count check in the users table at login time. |
| 2 | Traefik Authentik middleware | **Remove it.** The app takes over OIDC directly so the fork is usable by anyone, not just users with Authentik in front. |
| 3 | User invitation model | **JIT only.** Admin grants access in the IdP; user shows up via OIDC; PriceStalker auto-creates them. No pre-provisioning. |
| 4 | Logout behavior | **Local session logout only** for v1.2.0. SLO can come later. |

## User-visible scope

### Admin policy options

Configured in **Settings → Authentication** (admin only):

- **Local only** — current behavior. OIDC UI hidden on login page. Default for upgrades, so nothing changes for existing users until the admin opts in.
- **OIDC only** — login page only shows "Sign in with {provider name}". Local password form hidden. Local users can't log in (but still exist in the DB for admin-recovery purposes — see "break-glass" below).
- **Both** — login page shows local form **and** SSO button. User chooses.

### JIT provisioning

When an OIDC user arrives for the first time:

1. Exchange code → get ID token + userinfo.
2. Verify `email_verified` claim is `true` (hard-block if the provider doesn't set this — we rely on it for safe auto-link).
3. Look up existing user by `oidc_subject` (stable ID). If found → log them in.
4. Else look up by email. If found → link: set `oidc_subject` on that record, log them in. This covers the "admin already had a local account" case.
5. Else create a new user with `auth_provider='oidc'`, `password_hash=NULL`, email + name from claims.
6. If this is the **very first** user in the DB → also set `is_admin=true`.

Admin can toggle JIT off if they want to pre-provision users manually in a future version; for v1.2.0 JIT defaults on when OIDC is enabled.

### Break-glass local access

Even in `OIDC only` policy mode, local users with `is_admin=true` must still be able to log in via email/password. Without this, a misconfigured IdP locks out the owner forever. Implementation: policy check treats `(is_admin && password_hash IS NOT NULL)` as always eligible for local login. Documented in admin UI as "admin fallback".

## Technical architecture

### Flow (Authorization Code + PKCE)

```
Browser                 PriceStalker API           Authentik / IdP
   │                          │                          │
   │ click "Sign in with SSO" │                          │
   │────────────────────────▶│                          │
   │                          │ discovery + gen           │
   │                          │ code_verifier/state/nonce │
   │                          │ store in short-lived      │
   │                          │ server-side session       │
   │ 302 redirect to IdP      │                          │
   │◀─────────────────────────│                          │
   │────────────────────────────────────────────────────▶│
   │                          │              authenticate │
   │◀────────────────────────────────────────────────────│
   │ 302 back to /api/auth/oidc/callback?code=&state=     │
   │─────────────────────────▶│                          │
   │                          │ verify state              │
   │                          │ exchange code+verifier    │
   │                          │────────────────────────▶│
   │                          │       id_token+userinfo  │
   │                          │◀────────────────────────│
   │                          │ verify ID token (JWKS)    │
   │                          │ verify nonce              │
   │                          │ lookup / JIT-create user  │
   │                          │ issue our own JWT         │
   │ 302 to /auth/sso-complete#token=<jwt>                │
   │◀─────────────────────────│                          │
   │ JS reads hash, stores in localStorage, clears hash,  │
   │ redirects to /                                       │
```

Why the hash fragment, not query string: hash is never sent to the server,
keeping the short-lived JWT out of access logs.

### Backend

**Library**: [`openid-client`](https://github.com/panva/node-openid-client) v5.x.
Mature, spec-correct, handles discovery, PKCE, JWKS caching, ID token
validation. Pin v5.x for CommonJS compatibility (v6+ is ESM-only).

**New routes** (all under `/api/auth/oidc`):

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET`  | `/config/public` | none | Returns `{ enabled, policy, providerName }` — used by the login page to decide what to render |
| `GET`  | `/start` | none | Initiates flow: generates PKCE + state + nonce, stores server-side, 302 to IdP |
| `GET`  | `/callback` | none | IdP redirects here with `code` + `state`. Verifies, exchanges, issues JWT, 302 to frontend with `#token=` |

**Admin routes** under `/api/admin/auth` (existing admin middleware):

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/` | Read current config (client_secret redacted) |
| `PUT`  | `/` | Update config |
| `POST` | `/test-discovery` | Hit the issuer's `.well-known/openid-configuration` and return success/error — lets admin verify the issuer URL before saving |

**Short-lived flow state storage**: we need to persist the `code_verifier`, `state`, and `nonce` between the initial redirect and the callback. Options:
- Server-side Map with expiry — simple, lost on restart (acceptable, worst case user re-clicks).
- Redis / DB — overkill for this size.

Going with in-process Map keyed by `state`, entries expire after 10 minutes. Single backend replica (current reality) means this just works. If multi-replica becomes a concern we migrate to Redis.

### Data model changes

New columns on `users` (idempotent migration in `backend/src/index.ts`):

```sql
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'local' NOT NULL;
ALTER TABLE users ADD COLUMN oidc_subject TEXT;
ALTER TABLE users ADD COLUMN oidc_issuer TEXT;
CREATE UNIQUE INDEX users_oidc_sub_idx ON users(oidc_issuer, oidc_subject) WHERE oidc_subject IS NOT NULL;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;  -- OIDC users have no password
```

New table `auth_config` (single row, admin-only):

```sql
CREATE TABLE IF NOT EXISTS auth_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
  policy VARCHAR(20) NOT NULL DEFAULT 'local',  -- 'local' | 'oidc' | 'both'
  oidc_enabled BOOLEAN NOT NULL DEFAULT false,
  oidc_provider_name TEXT,                 -- display label, e.g. "Authentik"
  oidc_issuer_url TEXT,
  oidc_client_id TEXT,
  oidc_client_secret TEXT,                 -- stored plain, never returned via API
  oidc_scopes TEXT NOT NULL DEFAULT 'openid profile email',
  oidc_jit_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO auth_config (id) VALUES (1) ON CONFLICT DO NOTHING;
```

Secret handling: `oidc_client_secret` is read-write server-side only. API GET returns a boolean `has_secret` instead of the value. API PUT accepts a new secret or `null` to keep the existing one. Admin UI shows `••••••` with a "Change secret" action.

### Frontend

**New route**: `/auth/sso-complete` — reads `#token=` from URL hash, stores in `localStorage`, clears hash, navigates to `/`. Unprotected (pre-auth page).

**Login page** (`AuthForm.tsx`) fetches `/api/auth/oidc/config/public` on mount:

- `policy === 'local'` → current form as-is
- `policy === 'oidc'` → only the "Sign in with {providerName}" button. Small "admin sign-in" link at the bottom that reveals the local form (break-glass).
- `policy === 'both'` → both, with a visual divider

**Settings → Authentication** (admin-only panel):

- Policy select
- OIDC enabled toggle
- Provider name input
- Issuer URL input + "Test discovery" button
- Client ID
- Client secret (write-only field; placeholder shows `••••••` if one is already saved)
- Scopes (advanced section, collapsed)
- JIT provisioning toggle
- Save button

### Security requirements

- **PKCE** (S256) — mandatory, not optional.
- **State** parameter — 32 bytes, cryptographically random, bound to the flow entry.
- **Nonce** — 32 bytes, included in ID token claims, verified on callback.
- **ID token signature** — verified against the provider's JWKS (openid-client handles this).
- **`email_verified` claim required** — reject callbacks where the provider doesn't assert email verification.
- **HTTPS-only** — the redirect URI must be `https://...`. Handled by Traefik, no code change needed.
- **Open redirect protection** — `redirect_uri` is fixed in IdP config, not user-supplied.
- **Feature flag** — `ENABLE_SSO=false` env var gates all OIDC routes entirely. Ships off by default in v1.2.0.

### Config surface

| Env var | Purpose | Default |
|---------|---------|---------|
| `ENABLE_SSO` | Master kill switch for all OIDC routes | `false` |
| `OIDC_REDIRECT_URI_OVERRIDE` | Override the auto-derived redirect URI (useful for testing behind reverse proxies) | auto: `{PUBLIC_URL}/api/auth/oidc/callback` |
| `PUBLIC_URL` | Base URL of the app — used to build the redirect URI | `http://localhost` |

Everything else (issuer URL, client ID, client secret, scopes, policy, JIT toggle) is in the DB so admins can change it without redeploying.

## Migration path

### For Mike's deployment

1. Deploy v1.2.0 with `ENABLE_SSO=false` — zero behavior change, local login still works.
2. Set `ENABLE_SSO=true`, redeploy. SSO routes come alive but policy defaults to `local`, so the login page is unchanged.
3. In Authentik, create an **OIDC Provider** + **Application** for PriceStalker. Redirect URI: `https://priceghost.ikessler.ch/api/auth/oidc/callback`.
4. In PriceStalker Settings → Authentication: paste issuer URL, client ID, client secret. Hit "Test discovery". Enable OIDC. Keep policy `both` for safety.
5. Log out, verify "Sign in with Authentik" button appears, click it, complete flow. Verify identity linking (should link to your existing admin account by email).
6. Once confident, flip policy to `oidc` (with break-glass admin still available on local).
7. Remove the Traefik Authentik middleware label from the frontend service. Users now hit PriceStalker's login page directly; OIDC click goes to Authentik.

### For other deployers

Same sequence, just with their own IdP. The feature flag and the `local` default policy mean nothing breaks on upgrade — deliberate action is required to turn SSO on.

## Rollout phases

| Phase | Scope | Commits | PR review gate |
|-------|-------|---------|----------------|
| 0 | This doc | 1 | ⬅ we are here |
| 1 | Backend: deps, DB migrations, auth_config model, admin config endpoints, test-discovery endpoint | 2-3 | Type-check passes, admin config persists |
| 2 | Backend: `/start` + `/callback` routes, JIT provisioning, identity linking, feature flag | 3-4 | Can complete flow against a test Authentik app |
| 3 | Frontend: `sso-complete` route, login page `oidc/config/public` fetch, conditional SSO button | 2 | Login page renders correctly per policy |
| 4 | Frontend: Settings → Authentication admin panel | 2 | Admin can configure end-to-end |
| 5 | End-to-end test against prod Authentik with policy `both`, preview image deployed as parallel stack on swarm | 0-1 | Manual verification |
| 6 | Merge to main, cut v1.2.0, ship | — | — |

## Open questions / risks

- **Clock skew on ID token validation** — openid-client allows some tolerance; default 60s should be fine, document if not.
- **Email collision at JIT time** — two users in the IdP with the same email claim. We're email-linking, so second user would try to link to first's row. Mitigation: unique constraint on `email` already exists in the schema, second creation throws, we surface "email already in use with a different identity" error.
- **Admin locks themselves out** — if an admin enables `oidc only` policy with a misconfigured IdP AND has no local admin with a password set, they're locked out. Break-glass (local admin with password can always log in) mitigates this. Admin UI should warn when enabling `oidc only` mode if no local admin has a password set.
- **openid-client ESM vs CommonJS** — noted above; pinning v5.x.
- **Single-process flow state** — noted above; in-process Map works for one replica. If we ever scale horizontally, migrate to Redis/DB.

## Future work (post-v1.2.0)

Items deliberately out of scope for the initial release, roughly in priority
order:

- **Single Logout (SLO)** — when the admin logs out of the IdP, PriceStalker
  should invalidate their JWT too. Today the two sessions are decoupled: an
  IdP logout doesn't reach into PriceStalker's localStorage. Implementation
  path: back-channel logout endpoint at `/api/auth/oidc/backchannel-logout`,
  session-ID tracking in JWTs, a server-side session store (probably a new
  `user_sessions` table — the in-memory flow-state Map won't cut it for this),
  and Authentik/other IdP configuration. Target: **v1.3.0**.
- **Silent auth (prompt=none)** — in `both` policy mode, attempt a background
  OIDC auth on page load to discover if the user already has an IdP session.
  If yes, auto-sign-in; if no, show the regular login page. Complementary to
  SLO — together they make the SSO feel truly seamless.
- **Shorter JWT lifetime for OIDC users** — 7 days is fine for local users;
  OIDC users could plausibly have shorter JWTs (e.g. 8h) to tighten the gap
  until SLO lands. Simple to implement, worth doing if v1.3.0 slips.
- **Group → role mapping from provider claims** — map an IdP group (e.g.
  `pricestalker-admins`) to the `is_admin` flag so admin privileges survive
  JIT without manual promotion. Requires a new admin UI for the mapping rules.
- **Multiple simultaneous providers** — schema already leaves room (per-user
  `oidc_issuer`). Admin UI only supports one for v1.2.0.
- **Email change handling** — if an OIDC user's email changes in the IdP,
  currently we don't update PriceStalker's record. Needs a "refresh from
  provider on sign-in" pass that updates (name, email) from the latest claims.
- **PKCE-only / public client support** — we require a client secret today.
  Public-client flows (no secret) would let purely frontend or mobile
  deployments work.

## Rejected alternatives

- **Trusted header SSO** (e.g. rely on Traefik/Authentik's `X-Forwarded-User`). Simpler but non-portable — only works for deployers who have Authentik / similar in front. Rejected because the goal is "anyone can deploy this".
- **SAML**. More enterprise than self-hosters typically want, much more protocol surface. OIDC covers 95% of modern IdPs. Not doing it.
- **Multiple simultaneous providers**. YAGNI for v1.2.0. Schema leaves room (`oidc_issuer` per user) but admin UI only supports one.
- **Group → role mapping from provider claims**. Future work. For now, first-user-wins admin handles the initial case and admins promote further users manually.
