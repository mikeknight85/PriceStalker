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
 * Whether the user's headers set a non-JSON Content-Type, which makes the
 * template plain text. The backend decides the same way: JSON is the default,
 * and only a Content-Type that does not mention JSON switches it off.
 */
export function webhookSendsPlainText(headersText: string): boolean {
  if (webhookHeadersProblem(headersText) !== null || !headersText.trim()) return false;
  const headers = JSON.parse(headersText) as Record<string, unknown>;
  const name = Object.keys(headers).find(key => key.toLowerCase() === 'content-type');
  const contentType = name === undefined ? '' : String(headers[name]);
  return contentType !== '' && !/json/i.test(contentType);
}

/**
 * Why the template would not be sent, or null when it is fine, empty, or plain
 * text (which is sent as written and needs no particular shape).
 *
 * Each `{{variable}}` is replaced by text, so one inside a string quietly
 * becomes part of it. One outside a string is not valid JSON once filled in --
 * even `{{current_price}}`, which reads `unavailable` when there is no price --
 * so a bare variable gets its own message rather than the parser's.
 */
export function webhookTemplateProblem(text: string, plainText: boolean): string | null {
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
