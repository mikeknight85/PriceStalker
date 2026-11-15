import { NotificationSettings } from '../../../models/types';
import { webhookSendsPlainText } from '../../notifications/webhook-headers';
import { isMaskedSecret } from '../../../utils/system/masking';

/**
 * Which per-user notification fields are credentials, and what the API is
 * allowed to do with them (issue #272).
 *
 * `GET /api/settings/notifications` used to return every field verbatim, so a
 * bot token, a Discord webhook URL or an ntfy password appeared in the response
 * body -- and from there in devtools, a HAR attached to a bug report, a screen
 * share, or a reverse proxy that logs bodies. `CLAUDE.md` already settled the
 * rule for secrets: the auth-config endpoint answers `has_client_secret` and
 * never the value. These follow it.
 *
 * ## Why `has_<field>` rather than a masked value
 *
 * The alternative was to answer with `maskSecret`'s `abcd...wxyz`, so the UI
 * could prove something is stored. `has_<field>` was chosen because:
 *
 * - it leaks nothing, where a partial mask still hands over the first and last
 *   four characters of a bot token;
 * - it is the shape `CLAUDE.md` names and `AuthSection` already renders, so
 *   there is one secret-field pattern in the UI rather than two;
 * - nothing masked is ever emitted, so no client can echo a mask back and no
 *   mask can be stored -- the failure mode that #196/#198 were about;
 * - a mask is meaningless for the fields that are not opaque tokens. Masking
 *   `webhook_headers` would hand the UI a mangled JSON document, and
 *   `isMaskedSecret` cannot be used to recognise one coming back, because an
 *   `Accept` header that matches anything is written with asterisks.
 *
 * ## The write side
 *
 * The settings form loads every field into a draft and PUTs the whole draft, so
 * a credential it was never given must not be wiped. An absent field and an
 * empty string therefore both mean "leave what is stored", and removing a
 * credential is the explicit `null`. That is the same contract `AuthSection`
 * uses for the OIDC client secret.
 */

/** A notification field whose value is, or carries, a credential. */
export interface NotificationCredential {
  field: keyof NotificationSettings;
  /**
   * True when the value is an opaque token -- base64url, hex or a
   * dot-separated identifier -- in which case a value carrying a mask marker
   * cannot be a real credential, and `isMaskedSecret` can be used to refuse it
   * on the way to the database.
   *
   * False for URLs and JSON documents, whose legitimate content may contain
   * `*` or `...`. Those are protected by never being emitted in the first
   * place, not by pattern-matching what comes back.
   */
  opaque: boolean;
}

/**
 * Every credential-bearing notification field, as listed in issue #272.
 *
 * A new channel adds its secret fields here. `notification-credential-masking.test.ts`
 * fails for any notification field that looks like a credential and is neither
 * listed here nor explicitly exempted, so a channel added later cannot quietly
 * escape masking.
 */
export const NOTIFICATION_CREDENTIALS = [
  { field: 'telegram_bot_token', opaque: true },
  { field: 'discord_webhook_url', opaque: false },
  { field: 'pushover_user_key', opaque: true },
  { field: 'pushover_app_token', opaque: true },
  { field: 'ntfy_password', opaque: true },
  { field: 'gotify_app_token', opaque: true },
  { field: 'webhook_url', opaque: false },
  { field: 'webhook_headers', opaque: false },
  // apprise-api ships no authentication of its own, so the config key is the
  // only thing standing between a caller and `GET /get/<key>` and
  // `GET /json/urls/<key>`, which read the stored configuration back --
  // every embedded token and password in it. That makes it strictly more
  // powerful than a send-only token like `gotify_app_token`. apprise-api
  // restricts keys to [A-Za-z0-9_-], so a mask marker cannot be one.
  { field: 'apprise_config_key', opaque: true },
  // Apprise service URLs with credentials embedded (`tgram://<token>/...`,
  // `ntfys://user:pass@...`). Not opaque: a URL may legitimately carry `*`.
  { field: 'apprise_urls', opaque: false },
] as const satisfies readonly NotificationCredential[];

/** The name of a credential-bearing notification field. */
export type NotificationCredentialField = typeof NOTIFICATION_CREDENTIALS[number]['field'];

/** Just the names, for callers that only need to ask "is this one secret?". */
export const NOTIFICATION_CREDENTIAL_FIELDS: readonly (keyof NotificationSettings)[] =
  NOTIFICATION_CREDENTIALS.map(credential => credential.field);

/**
 * Whether a notification field holds a credential -- so it is not printed,
 * logged or returned alongside the fields that are safe to show.
 */
export function isNotificationCredentialField(field: keyof NotificationSettings): boolean {
  return NOTIFICATION_CREDENTIAL_FIELDS.includes(field);
}

/** The flags that stand in for the values in an API response. */
export type NotificationCredentialFlags = {
  [K in NotificationCredentialField as `has_${K}`]: boolean;
};

/** Anything a notification field can hold. */
type NotificationFieldValue = NotificationSettings[keyof NotificationSettings];

/**
 * Facts derived from a withheld credential that the UI legitimately needs.
 *
 * A flag saying "something is stored" is not always enough. The generic
 * webhook's headers decide whether its payload template is JSON or plain text,
 * and the settings page checks the template against that before saving (issue
 * #268). With the headers withheld the page could no longer tell, so a
 * perfectly good `text/plain` template was reported as broken JSON -- and
 * because the section has a single Save, that blocked saving *any* channel.
 *
 * The media type is not a credential; the `Authorization` value beside it is.
 * So the answer is derived here, with the same rule the provider sends by, and
 * the duplicate copy of that rule in the frontend goes away.
 */
export interface NotificationSettingsHints {
  /** Whether the stored headers set a non-JSON Content-Type. */
  webhook_sends_plain_text: boolean;
}

/**
 * The notification settings as the API returns them: every requested field,
 * with each credential replaced by `null` and a `has_<field>` flag beside it.
 *
 * The key stays present and null so a client cannot tell "withheld" from
 * "absent" by shape alone and crash on a missing property; the flag is what
 * says whether something is stored.
 */
export type NotificationSettingsView =
  Record<keyof NotificationSettings, NotificationFieldValue | null>
  & NotificationCredentialFlags
  & NotificationSettingsHints;

/** What a stored credential has to look like to count as configured. */
function isCredentialStored(value: NotificationFieldValue | undefined): boolean {
  return typeof value === 'string' && value !== '';
}

/**
 * Builds the API's view of a user's notification settings: the requested
 * fields, with no credential value in any of them.
 *
 * `fields` is passed in rather than owned here so the route keeps the single
 * list of what the endpoint exposes.
 */
export function toNotificationSettingsView(
  settings: NotificationSettings,
  fields: readonly (keyof NotificationSettings)[]
): NotificationSettingsView {
  const view = {} as NotificationSettingsView;

  for (const field of fields) {
    view[field] = settings[field] ?? null;
  }

  // Derived before the values are dropped, and from the stored settings rather
  // than the view, so it cannot read back a credential that has already gone.
  view.webhook_sends_plain_text = webhookSendsPlainText(settings.webhook_headers);

  // Last, and unconditionally, so a credential cannot survive by being listed
  // in `fields` under a name this loop does not revisit.
  for (const { field } of NOTIFICATION_CREDENTIALS) {
    view[field] = null;
    view[`has_${field}`] = isCredentialStored(settings[field]);
  }

  return view;
}

/** What a request body is asking for a single credential field. */
export type CredentialIntent = 'unchanged' | 'clear' | 'replace';

/**
 * Reads one credential field out of a request body.
 *
 * - absent or `''` -> unchanged. The form PUTs the whole draft and starts the
 *   field empty, because the value was never sent to it; an empty box must not
 *   destroy a working channel.
 * - `null` -> clear. Removing a credential is a deliberate action, so it has a
 *   value of its own rather than sharing one with "I did not touch this".
 * - a masked placeholder in an opaque field -> unchanged. Nothing masked is
 *   emitted any more, so this cannot happen from our own UI; it is here so a
 *   stale client, or a user pasting `1234...abcd` off a screenshot, cannot
 *   overwrite a credential with a placeholder (issues #196, #198).
 * - anything else -> replace.
 */
export function credentialIntent(value: unknown, opaque: boolean): CredentialIntent {
  if (value === undefined || value === '') return 'unchanged';
  if (value === null) return 'clear';
  if (opaque && isMaskedSecret(value)) return 'unchanged';
  return 'replace';
}

/**
 * Narrows an untyped request body to the notification fields it actually
 * carries. The one place the endpoint's JSON is turned into typed updates.
 */
export function pickNotificationUpdates(
  body: unknown,
  fields: readonly (keyof NotificationSettings)[]
): Partial<NotificationSettings> {
  const updates: Partial<NotificationSettings> = {};
  if (typeof body !== 'object' || body === null) return updates;

  // A parsed JSON body is an index of unknowns; narrowed once, here, so no
  // caller has to widen it to `any`.
  const source = body as Record<string, unknown>;
  for (const field of fields) {
    const value = source[field];
    if (value === undefined) continue;
    // The columns are TEXT, BOOLEAN and INTEGER and the repository passes
    // whatever arrives as a query parameter, so the value is carried across
    // rather than coerced here.
    Object.assign(updates, { [field]: value });
  }
  return updates;
}

/**
 * Applies the read-back contract above to a set of updates: credential fields
 * the request left alone are dropped, and an explicit clear is normalised to
 * `null`.
 *
 * Returns a copy. The caller's object is the parsed request body, and the log
 * line that follows compares against what was actually written.
 */
export function resolveCredentialUpdates(
  updates: Partial<NotificationSettings>
): Partial<NotificationSettings> {
  const resolved: Partial<NotificationSettings> = { ...updates };

  for (const { field, opaque } of NOTIFICATION_CREDENTIALS) {
    switch (credentialIntent(resolved[field], opaque)) {
      case 'unchanged':
        delete resolved[field];
        break;
      case 'clear':
        resolved[field] = null;
        break;
      case 'replace':
        break;
    }
  }

  return resolved;
}

/**
 * Refuses to let a masked placeholder reach the database.
 *
 * `resolveCredentialUpdates` already drops one, so reaching here means a caller
 * bypassed it. It throws rather than dropping the field, because a credential
 * silently overwritten with `abcd...wxyz` is a channel that stops working with
 * nothing to point at, while a 500 names the field.
 *
 * Only the opaque fields can be checked: `*` and `...` are legitimate content
 * in a URL or a header document, and those never leave the server masked.
 *
 * The message carries the field name and never the value.
 */
export function assertNoMaskedCredentials(updates: Partial<NotificationSettings>): void {
  for (const { field, opaque } of NOTIFICATION_CREDENTIALS) {
    if (!opaque) continue;
    if (isMaskedSecret(updates[field])) {
      throw new Error(`Refusing to store a masked placeholder in ${field}`);
    }
  }
}

/**
 * The names of the fields an update actually changes -- names only, because
 * several of them are credentials and this feeds a log line.
 */
export function changedNotificationFields(
  previous: NotificationSettings,
  updates: Partial<NotificationSettings>
): string[] {
  const keys = Object.keys(updates) as (keyof NotificationSettings)[];
  return keys.filter(key => JSON.stringify(updates[key]) !== JSON.stringify(previous[key]));
}
