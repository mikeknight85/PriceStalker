import { NotificationSettings } from '../../types/api';

/**
 * The notification channel credentials, and what the settings form is allowed
 * to say about them (issue #272).
 *
 * `GET /settings/notifications` no longer returns these values -- it answers
 * `has_<field>` instead, the same way the auth-config endpoint answers
 * `has_client_secret`. So the inputs start empty even for a configured channel,
 * and the form has to be explicit about which of three things it means:
 *
 * - empty          -> keep the stored credential. The field is omitted from the
 *                     PUT entirely, so the whole-draft save cannot wipe a
 *                     working channel with the blank it was handed.
 * - text typed in  -> replace the stored credential with it.
 * - `CLEAR_SECRET` -> remove the stored credential, sent as `null`.
 *
 * `notificationSecretUpdates` is the only place a draft becomes a request body,
 * so `CLEAR_SECRET` cannot reach the API and a credential cannot be overwritten
 * with a placeholder. `notificationSecrets.test.ts` enumerates the fields and
 * asserts exactly that, for every field, so a channel added later is covered.
 */

/**
 * The credential fields this form edits. Mirrors `NOTIFICATION_CREDENTIALS` in
 * `backend/src/services/domain/user/notification-credentials.ts`: a field the
 * backend withholds and this list omits renders as an empty box with no "(set)"
 * marker and no way to clear it, which is a field actively lying about its
 * state.
 */
export const NOTIFICATION_SECRET_FIELDS = [
  'telegram_bot_token',
  'discord_webhook_url',
  'pushover_user_key',
  'pushover_app_token',
  'ntfy_password',
  'gotify_app_token',
  'apprise_config_key',
  'apprise_urls',
  'webhook_url',
  'webhook_headers',
] as const;

export type NotificationSecretField = typeof NOTIFICATION_SECRET_FIELDS[number];

/** The secret half of the form's draft. */
export type NotificationSecretDraft = { [K in NotificationSecretField]: string };

/**
 * Draft-only marker for "remove the stored credential on save".
 *
 * A separate value is needed because empty already means "leave it alone", and
 * a user who means to detach a channel has to be able to say so. It holds a NUL
 * byte, which cannot be typed into an input, pasted from a credential or
 * produced by the API -- and `notificationSecretUpdates` turns it into `null`
 * before anything is sent, so it never leaves the browser.
 */
export const CLEAR_SECRET = '\u0000clear-stored-credential';

/** Placeholder for a field whose credential is stored and withheld. */
export const STORED_SECRET_PLACEHOLDER = '••••••• (leave empty to keep existing)';

/**
 * Which credentials the server says are stored.
 *
 * Reads the `has_<field>` flags defensively: an unmocked endpoint answers `{}`
 * and a stale backend answers without them, and "not set" is the right reading
 * of both -- the field then behaves exactly as it does for a new user.
 */
export function notificationSecretFlags(
  settings: Partial<NotificationSettings> | null | undefined
): Record<NotificationSecretField, boolean> {
  const flags = {} as Record<NotificationSecretField, boolean>;
  for (const field of NOTIFICATION_SECRET_FIELDS) {
    flags[field] = settings ? settings[`has_${field}`] === true : false;
  }
  return flags;
}

/**
 * What to send for each credential field: nothing when it is untouched, `null`
 * when the user asked for it to be removed, the typed value otherwise.
 *
 * Spread over the rest of the draft, so the whole-form save keeps working while
 * the credentials follow the write-only contract.
 */
export function notificationSecretUpdates(
  draft: NotificationSecretDraft
): Partial<Record<NotificationSecretField, string | null>> {
  const updates: Partial<Record<NotificationSecretField, string | null>> = {};
  for (const field of NOTIFICATION_SECRET_FIELDS) {
    const value = draft[field];
    if (value === CLEAR_SECRET) {
      updates[field] = null;
    } else if (value === '') {
      updates[field] = undefined;
    } else {
      updates[field] = value;
    }
  }
  return updates;
}

/**
 * What a secret draft field means as *content*, for anything that reasons about
 * the value rather than sending it: a field marked for clearing holds nothing.
 *
 * The webhook's headers are both a credential and a document the settings page
 * validates (issue #268). Handing the clear marker to that validator reported
 * it as broken JSON and -- since a marked field makes its card dirty -- blocked
 * Save on a perfectly deliberate action.
 */
export function secretDraftText(value: string): string {
  return value === CLEAR_SECRET ? '' : value;
}

/**
 * Every credential input back to empty.
 *
 * Used after a successful save: what was typed is now stored, and leaving it in
 * the field would both re-send it on the next save and put a credential back on
 * screen that the API deliberately stopped returning.
 */
export function clearedNotificationSecretInputs(): NotificationSecretDraft {
  const inputs = {} as NotificationSecretDraft;
  for (const field of NOTIFICATION_SECRET_FIELDS) {
    inputs[field] = '';
  }
  return inputs;
}
