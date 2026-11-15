/**
 * How the generic webhook's headers are read -- in one place.
 *
 * Two callers need the same answer to "does this header document make the
 * payload template plain text?": the provider, which decides how to send the
 * body (issue #268), and the settings endpoint, which tells the UI so the
 * template can be checked before it is saved. The headers are a credential and
 * are not returned to the client (issue #272), so the UI cannot work it out for
 * itself any more -- which is exactly how the rule would have drifted into two
 * copies with different answers.
 *
 * Deliberately dependency-free: the settings view reaches this through the user
 * domain, and a logger or axios import here would drag the notification stack
 * in behind it.
 */

/** Sent unless the user's headers override it, case-insensitively. */
export const DEFAULT_WEBHOOK_CONTENT_TYPE = 'application/json';

/**
 * The user's headers, which must be a JSON object of names to values. An array
 * or a bare string used to be accepted and spread into the headers as garbage
 * (`{"0": ..., "1": ...}`).
 */
export function parseWebhookHeaders(headersStr: string): Record<string, string> {
  const parsed: unknown = JSON.parse(headersStr);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object');
  }
  return Object.fromEntries(Object.entries(parsed).map(([name, value]) => [name, String(value)]));
}

/**
 * The headers a request will actually carry, and how its body is encoded.
 *
 * Throws when the document is not a JSON object, because the alternative --
 * sending anyway -- dropped the user's `Authorization` header and produced a
 * 401 with nothing pointing back at the headers field.
 */
export function resolveWebhookHeaders(headersStr?: string | null): {
  headers: Record<string, string>;
  sendsJson: boolean;
} {
  let headers: Record<string, string> = { 'Content-Type': DEFAULT_WEBHOOK_CONTENT_TYPE };

  if (headersStr) {
    const custom = parseWebhookHeaders(headersStr);
    // Header names are case-insensitive, so a user's `content-type` has to
    // replace ours rather than sit beside it.
    const overridden = new Set(Object.keys(custom).map(name => name.toLowerCase()));
    headers = {
      ...Object.fromEntries(Object.entries(headers).filter(([name]) => !overridden.has(name.toLowerCase()))),
      ...custom,
    };
  }

  const contentType = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
  // Only the media type counts: a parameter such as `profile="json"` on a
  // text/plain header must not switch JSON parsing on.
  const mediaType = (contentType ?? '').split(';')[0].trim().toLowerCase();

  return { headers, sendsJson: !mediaType || mediaType.includes('json') };
}

/**
 * Whether a stored header document means the payload template is plain text.
 *
 * Absent or unreadable headers read as JSON, which is the default the provider
 * falls back to and the shape the UI should check a template against.
 */
export function webhookSendsPlainText(headersStr?: string | null): boolean {
  if (!headersStr || !headersStr.trim()) return false;
  try {
    return !resolveWebhookHeaders(headersStr).sendsJson;
  } catch {
    return false;
  }
}
