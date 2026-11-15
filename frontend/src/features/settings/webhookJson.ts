/**
 * Checks for the Generic Webhook's Headers and Payload Template fields.
 *
 * They mirror what the backend does at send time (`providers/webhook.ts`): a
 * template that cannot be read as JSON, or headers that are not a JSON object,
 * stop the alert from being sent at all. Catching that here, before Save, is
 * what keeps a user from saving a webhook that silently drops every alert.
 */

const VARIABLE = /\{\{\s*\w+\s*\}\}/g;

/** Why the headers would be rejected, or null when they are fine or empty. */
export function webhookHeadersProblem(text: string): string | null {
  if (!text.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return e instanceof Error ? e.message : 'Not valid JSON';
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'Must be a JSON object, e.g. {"Authorization": "Bearer ..."}';
  }
  return null;
}

/**
 * Whether the headers being typed set a non-JSON Content-Type, which makes the
 * template plain text.
 *
 * This answers for the *draft* only -- live feedback while the user edits, which
 * cannot come from the server. The stored headers are a credential and are not
 * returned (issue #272), so their answer arrives as `webhook_sends_plain_text`
 * from `services/notifications/webhook-headers.ts`, which is the copy of this
 * rule the provider actually sends by. `webhookTemplateFormat` picks between
 * the two.
 */
export function webhookSendsPlainText(headersText: string): boolean {
  if (webhookHeadersProblem(headersText) !== null || !headersText.trim()) return false;
  const headers = JSON.parse(headersText) as Record<string, unknown>;
  const name = Object.keys(headers).find(key => key.toLowerCase() === 'content-type');
  const contentType = name === undefined ? '' : String(headers[name]);
  // Only the media type counts, not its parameters (`text/plain; profile="json"`).
  const mediaType = contentType.split(';')[0].trim().toLowerCase();
  return mediaType !== '' && !mediaType.includes('json');
}

/**
 * Whether the payload template is plain text, JSON, or not knowable.
 *
 * 'unknown' exists because the headers are a credential and are not returned by
 * the API (issue #272). On a freshly loaded page the Headers field is empty for
 * a configured webhook, so there is nothing local to read the Content-Type off.
 */
export type WebhookTemplateFormat = 'json' | 'plain-text' | 'unknown';

/**
 * Which format the template should be checked against.
 *
 * The draft wins whenever it has content, because the user is editing the
 * headers and the answer has to follow what they type. Only when it is empty
 * does the server's `webhook_sends_plain_text` answer -- derived from the
 * stored headers with the same media-type rule the provider sends by.
 *
 * A missing hint is 'unknown' rather than a guess: a stale backend, a
 * misconfigured proxy and the e2e suite's `{}` all arrive that way, and
 * reporting a stored template as broken on the strength of a missing field is
 * what turned this into a user-visible regression the first time.
 */
export function webhookTemplateFormat(
  headersText: string,
  storedSendsPlainText: boolean | undefined
): WebhookTemplateFormat {
  if (headersText.trim()) {
    return webhookSendsPlainText(headersText) ? 'plain-text' : 'json';
  }
  if (storedSendsPlainText === undefined) return 'unknown';
  return storedSendsPlainText ? 'plain-text' : 'json';
}

/**
 * Why the template would not be sent, or null when it is fine, empty, or not
 * being checked (plain text is sent as written; an unknown format is not
 * something to fail a save over).
 *
 * Each `{{variable}}` is replaced by text, so one inside a string quietly
 * becomes part of it. One outside a string is not valid JSON once filled in --
 * even `{{current_price}}`, which reads `unavailable` when there is no price --
 * so a bare variable gets its own message rather than the parser's.
 */
export function webhookTemplateProblem(
  text: string,
  format: WebhookTemplateFormat | boolean
): string | null {
  const plainText = typeof format === 'boolean' ? format : format !== 'json';
  if (plainText || !text.trim()) return null;
  try {
    JSON.parse(text.replace(VARIABLE, 'x'));
    return null;
  } catch (e) {
    try {
      JSON.parse(text.replace(VARIABLE, '0'));
      return 'Put each {{variable}} inside quotes, e.g. "{{product_name}}".';
    } catch {
      return e instanceof Error ? e.message : 'Not valid JSON';
    }
  }
}
