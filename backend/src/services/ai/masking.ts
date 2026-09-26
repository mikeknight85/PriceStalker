/**
 * What a masked credential looks like -- in one place (issues #196, #198).
 *
 * With `REDACT_API_KEYS=true`, `getAISettings` hands the admin UI a masked form
 * of every stored provider key, and the UI hands that same masked form back
 * when it saves a section, tests a connection or syncs a model list. Both
 * directions have to agree on one question: "is this string a placeholder, or a
 * real credential?"
 *
 * It had drifted into three answers -- `'...'` only, `'...'` or `'***'`, and
 * `'...'` or `'*'` -- which is how a short key masked as `********` could be
 * resolved correctly by a connection test and then sent verbatim to the
 * provider's API by the model refresh in the same session.
 *
 * `maskSecret` and `isMaskedSecret` are a pair and must stay in step: every
 * string `maskSecret` can return has to be recognised by `isMaskedSecret`. A
 * unit test asserts exactly that, so a change to the mask format cannot quietly
 * break detection.
 */

/**
 * Markers that mean "masked". Neither can occur in a real provider API key --
 * those are base64url, hex or dot-separated identifiers, never asterisks, and
 * never an elision.
 */
const MASK_MARKERS = ['...', '*'] as const;

/** Replaces a short key wholesale: four-and-four would leave nothing hidden. */
const MASK_WHOLESALE = '********';

/** Below this length, keeping the first and last four characters reveals the key. */
const MIN_LENGTH_FOR_PARTIAL_MASK = 8;

/**
 * The value an API response may carry in place of a stored credential.
 * Returns null for an absent one, so "nothing is stored" stays distinguishable
 * from "something is stored and is being withheld".
 */
export function maskSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  if (secret.length < MIN_LENGTH_FOR_PARTIAL_MASK) return MASK_WHOLESALE;
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
}

/**
 * True only for a string that carries a mask marker.
 *
 * An absent or empty credential is deliberately **not** masked. "Missing" and
 * "withheld" are different states and callers answer them differently: a
 * missing key is a 400, a withheld one is resolved from storage. Folding the
 * two together would turn every credential-less request into a test of
 * whatever happens to be saved.
 */
export function isMaskedSecret(value: unknown): boolean {
  if (typeof value !== 'string' || value === '') return false;
  return MASK_MARKERS.some((marker) => value.includes(marker));
}
