/**
 * The scope vocabulary for system API tokens (issue #217).
 *
 * A system token used to carry no authorisation information at all: auth
 * middleware resolved it to a user id and `adminMiddleware` then asked the
 * database whether that user was an administrator. The admin check was real --
 * this was never an admin bypass -- but it was all-or-nothing, so a token
 * minted to let an uptime monitor read `/api/system/version` could equally call
 * `POST /api/admin/command` with `run-migration`.
 *
 * Scopes close that gap. They describe what a *machine credential* may do; they
 * say nothing about who a human is. A signed-in person is still authorised by
 * `adminMiddleware` and by per-row ownership checks, which is why
 * `requireScope` deliberately does not apply to browser sessions.
 *
 * The vocabulary is kept deliberately short. Every entry below maps to a real
 * mount point in `backend/src/routes/` today -- there are no aspirational
 * scopes beyond the two the MCP ADR reserves, and those are reserved in the
 * ADR, not invented here. See `docs/developer/adr/001-mcp-server.md` §4.1.
 */

/**
 * Full access. What every token issued before the scopes migration holds, and
 * what `ADMIN_API_TOKEN` holds. Deprecated for new tokens: it exists so the
 * grace period in issue #217 does not break anybody's cron job, and it will be
 * retired once legacy tokens have aged out.
 */
export const SCOPE_FULL = '*';

/**
 * The read-only surface in ADR 001 §2.1: tracked items and their price and
 * stock history, plus the read-only administrative diagnostics (system logs,
 * a retailer's selector config, database health).
 */
export const SCOPE_MCP_READ = 'mcp:read';

/**
 * The arbitrary-URL extraction and debug endpoints. Reserved by ADR 001 §2.2
 * and gated on the SSRF guard in issue #165 -- it is wired up here so the
 * endpoints are not reachable by a `mcp:read` token in the meantime.
 */
export const SCOPE_MCP_EXTRACT = 'mcp:extract';

/** Mutating the tracked catalogue: add, rescan, retarget, untrack. */
export const SCOPE_MCP_WRITE = 'mcp:write';

/** Reading instance configuration under `/api/admin`. */
export const SCOPE_ADMIN_READ = 'admin:read';

/**
 * Changing instance configuration under `/api/admin`: users, AI and auth
 * config, retailer selectors, system settings.
 */
export const SCOPE_ADMIN_WRITE = 'admin:write';

/**
 * Operational and destructive actions: `POST /api/admin/command` (which
 * includes `run-migration`) and clearing the system log. Separated from
 * `admin:write` because these are the ones that cannot be undone by editing a
 * field back.
 */
export const SCOPE_ADMIN_SYSTEM = 'admin:system';

export const TOKEN_SCOPES = [
  SCOPE_FULL,
  SCOPE_MCP_READ,
  SCOPE_MCP_EXTRACT,
  SCOPE_MCP_WRITE,
  SCOPE_ADMIN_READ,
  SCOPE_ADMIN_WRITE,
  SCOPE_ADMIN_SYSTEM,
] as const;

export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** Human-readable labels, used by the Admin UI and the token CLI script. */
export const TOKEN_SCOPE_DESCRIPTIONS: Record<TokenScope, string> = {
  [SCOPE_FULL]: 'Full access to every endpoint (legacy and emergency use)',
  [SCOPE_MCP_READ]: 'Read tracked items, price history and read-only diagnostics',
  [SCOPE_MCP_EXTRACT]: 'Run the URL extraction and debug endpoints',
  [SCOPE_MCP_WRITE]: 'Add, rescan and untrack products',
  [SCOPE_ADMIN_READ]: 'Read instance configuration and logs',
  [SCOPE_ADMIN_WRITE]: 'Change instance configuration',
  [SCOPE_ADMIN_SYSTEM]: 'Run operational commands and clear the system log',
};

export const isTokenScope = (value: unknown): value is TokenScope =>
  typeof value === 'string' && (TOKEN_SCOPES as readonly string[]).includes(value);

/** Raised when a caller asks for a scope that does not exist. */
export class InvalidTokenScopeError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenScopeError';
  }
}

/**
 * Validates and de-duplicates a scope list supplied over the API.
 *
 * Unknown scopes are rejected rather than ignored: silently dropping a
 * misspelled scope produces a token that appears to have been granted
 * something it has not, which is the kind of surprise that gets discovered
 * during an incident.
 */
export const parseScopes = (input: unknown): TokenScope[] => {
  if (!Array.isArray(input)) {
    throw new InvalidTokenScopeError('scopes must be an array of scope strings');
  }

  const parsed: TokenScope[] = [];
  for (const entry of input) {
    if (!isTokenScope(entry)) {
      throw new InvalidTokenScopeError(
        `Unknown token scope. Valid scopes are: ${TOKEN_SCOPES.join(', ')}`
      );
    }
    if (!parsed.includes(entry)) {
      parsed.push(entry);
    }
  }

  if (parsed.length === 0) {
    throw new InvalidTokenScopeError('At least one scope is required');
  }

  return parsed;
};

/**
 * Whether a granted scope list satisfies any one of the required scopes.
 *
 * Matching is exact, with `*` as the single wildcard. Namespace wildcards
 * (`admin:*`) are deliberately not implemented: a grant that expands as the
 * vocabulary grows hands a token privileges nobody consented to when it was
 * issued. A route that should accept more than one scope lists them, and the
 * list is an OR.
 *
 * `granted` is typed as `string[]` rather than `TokenScope[]` on purpose --
 * it comes out of a database column that an operator can edit by hand, so an
 * unrecognised value has to mean "satisfies nothing", not a type error.
 */
export const scopesSatisfy = (
  granted: readonly string[] | undefined,
  required: readonly TokenScope[]
): boolean => {
  if (!granted || granted.length === 0) return false;
  if (granted.includes(SCOPE_FULL)) return true;
  return required.some(scope => granted.includes(scope));
};
