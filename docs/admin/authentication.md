# PriceStalker Authentication & Single Sign-On (SSO) Guide

PriceStalker supports instance-wide Single Sign-On (SSO) using OpenID Connect (OIDC) with standard **Authorization Code + PKCE** flow alongside traditional email/password authentication.

This guide details environment setup, identity provider configuration (Authentik, Keycloak, Google, Okta, Auth0, etc.), sign-in policies, and emergency recovery.

---

## 1. Overview & Key Capabilities

- **Standard OIDC Relying Party**: Compatible with any OIDC-compliant provider.
- **Authorization Code + PKCE**: Cryptographically secured against interception and CSRF attacks.
- **Just-In-Time (JIT) Provisioning**: Auto-creates accounts upon first successful SSO login.
- **Automatic Account Linking**: Seamlessly links an existing local account if the verified SSO email matches.
- **Configurable Sign-in Policies**: Support local-only, SSO-only, or hybrid login modes.
- **Break-Glass Local Recovery**: Prevents admin lockout if the external identity provider is misconfigured or unreachable.
- **Zero-Downtime Admin UI**: Configure OIDC issuer, credentials, and policies in the Admin UI without restarting containers.

---

## 2. Environment Configuration

To enable OIDC capabilities, configure the following environment variables in your `.env` or container environment:

| Variable | Description | Example / Default |
|:---|:---|:---|
| `ENABLE_SSO` | Master switch for all OIDC routes. Must be set to `"true"` for OIDC endpoints to become active. | `true` |
| `PUBLIC_URL` | The public base URL of your PriceStalker instance. Used to generate the default callback redirect URI. | `https://pricestalker.example.com` |
| `OIDC_REDIRECT_URI_OVERRIDE` | Optional override if your external redirect URI differs from `${PUBLIC_URL}/api/auth/oidc/callback` (e.g. behind custom proxies). | *(Empty)* |

> [!IMPORTANT]
> Enabling SSO requires **both** `ENABLE_SSO=true` in the environment **and** the OIDC toggle enabled in the Admin UI. Enabling one without the other intentionally leaves OIDC inactive.

---

## 3. Configuring Your Identity Provider (IdP)

When registering PriceStalker in your identity provider (e.g. Authentik, Keycloak, Google Cloud, Okta, Authelia):

1. **Client Type**: Confidential (requires a client secret) or Web Application.
2. **Redirect / Callback URI**:
   ```
   https://<your-pricestalker-domain>/api/auth/oidc/callback
   ```
3. **Allowed Scopes**:
   ```
   openid profile email
   ```
4. **Email Verification**:
   Ensure your provider asserts the `email_verified: true` claim. PriceStalker requires this claim to prevent account hijacking during automatic email linking.

---

## 4. Admin UI Configuration

Once `ENABLE_SSO=true` is set and the container restarted, navigate to **Admin → Authentication** in the web UI.

### Settings Reference

| Field | Description |
|:---|:---|
| **Sign-in Policy** | Choose login availability: `Local only`, `OIDC only`, or `Both`. |
| **Enable OIDC** | Master toggle to activate or deactivate SSO logins. |
| **Provider Name** | Display label shown on the login button (e.g. `Authentik`, `Keycloak`, `Google`). |
| **Issuer URL** | The base URL of your identity provider (e.g. `https://auth.example.com/application/o/pricestalker/`). |
| **Test Discovery** | Validates the Issuer URL against its `.well-known/openid-configuration` endpoint before saving. |
| **Client ID** | The OAuth2 client identifier from your IdP. |
| **Client Secret** | The OAuth2 client secret. Secrets are write-only over the API and masked in the UI. |
| **JIT Provisioning** | Automatically create local user accounts on first SSO login. |

---

## 5. Sign-in Policies & Account Linking

### Sign-in Policy Options
- **Both (Default Recommended)**: The login page presents both the local email/password form and the "Sign in with {Provider}" button.
- **OIDC only**: The login page hides the local form and only displays the SSO button.
- **Local only**: SSO is disabled; only standard email/password authentication is available.

### JIT Provisioning & Account Resolution
When a user authenticates through OIDC:
1. **Existing SSO User**: Matches `(oidc_issuer, oidc_subject)`. Logs in immediately.
2. **Existing Local Account**: Matches `email` where `email_verified: true`. Automatically links `oidc_subject` to the existing account.
3. **New User (JIT Enabled)**: Creates a new user record with `password_hash = NULL` and attributes from claims.
4. **First User in Database**: If the database contains zero users, the first user to log in (via local or OIDC) is automatically granted `is_admin = true`.

---

## 6. Break-Glass Local Admin Access

If you enable **OIDC only** policy and your identity provider becomes unavailable or misconfigured, administrators can still access the instance using local credentials:

1. Navigate to the login page (`/login`).
2. Click the **Admin Fallback** / local sign-in link at the bottom of the page to reveal the email/password form.
3. Enter local credentials for an account that has `is_admin = true` and a password set.

> [!NOTE]
> Standard users without administrative privileges cannot use the local login form when the policy is set to `OIDC only`.

---

## 7. Technical Architecture & Authorization Flow

```
Browser                       PriceStalker API                     Identity Provider (IdP)
   │                                 │                                      │
   │── Click "Sign in with SSO" ────▶│                                      │
   │                                 │── Generate PKCE (code_verifier)     │
   │                                 │   Generate state & nonce             │
   │                                 │   Store in short-lived memory        │
   │◀── 302 Redirect to IdP ─────────│                                      │
   │                                                                        │
   │────────────────────── Authenticate & Consent ─────────────────────────▶│
   │◀───────────────────── 302 Redirect with Code & State ──────────────────│
   │                                                                        │
   │── 302 to /api/auth/oidc/callback?code=...&state=... ──────────────────▶│
   │                                 │                                      │
   │                                 │── Verify state & match PKCE ────────▶│
   │                                 │   Exchange Code for Tokens           │
   │                                 │◀── Return ID Token & UserInfo ───────│
   │                                 │                                      │
   │                                 │── Verify ID Token (JWKS)             │
   │                                 │   Verify nonce & email_verified      │
   │                                 │   Resolve / JIT-provision user       │
   │                                 │   Issue PriceStalker JWT session     │
   │◀── 302 to /auth/sso-complete#token=<jwt> ──────────────────────────────│
   │                                 │                                      │
   │── Read #token from URL hash ───▶│                                      │
   │   Store in localStorage         │                                      │
   │   Clear hash & redirect to /    │                                      │
```

---

## 8. Related Documentation

- **[Environment Variables](../developer/ENVIRONMENT_VARIABLES.md)**: Details on `ENABLE_SSO` and `PUBLIC_URL`.
- **[Admin Help Portal](README.md)**: Main administration documentation index.
- **[General Admin Guide](admin_guide.md)**: Overview of the administration dashboard.
