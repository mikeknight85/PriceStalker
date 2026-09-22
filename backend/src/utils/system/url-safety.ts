import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { logger } from './logger';
import { scrubUrlCredentials } from './logging/scrubber';

/**
 * Guard against server-side request forgery (issue #165).
 *
 * Several endpoints take a URL from the request body and fetch it -- the
 * retailer config test, the debug extractor, the retailer remap, and adding a
 * product. Without a check, `http://169.254.169.254/latest/meta-data/` or
 * `http://127.0.0.1:5432/` reaches whatever is listening inside the deployment
 * and the response comes back in the HTTP reply.
 *
 * Two policies, because the two kinds of caller are not the same:
 *
 * - `block-all-private` (the default, used by the administrator tools) refuses
 *   every internal address. Nothing an administrator tests against a retailer
 *   lives on the container network.
 *
 * - `allow-private-lan` (used by the product paths, which any signed-in user
 *   can reach) refuses only what can never be a shop: loopback, link-local --
 *   which is what 169.254.169.254, the cloud instance metadata endpoint, sits
 *   in -- 0.0.0.0/8, multicast and reserved space. RFC1918 and CGNAT
 *   addresses are allowed through, because a self-hoster tracking a shop at
 *   192.168.1.50 is doing something legitimate and used to be able to.
 *
 * The asymmetry is the point: fetching cloud instance metadata is never a
 * price-tracking action, while fetching a private LAN address plausibly is.
 * This closes the credential-theft vector without breaking existing installs.
 *
 * Known limitation -- TOCTOU: this resolves the hostname, checks the
 * addresses, and then hands the original URL to axios/puppeteer, which resolve
 * it again. A hostname whose DNS record flips between the two lookups (DNS
 * rebinding), or a public host that redirects to an internal one, still gets
 * through. Closing that needs a custom agent that pins the checked address for
 * the life of the connection and re-checks every redirect hop. This guard
 * stops the direct attacks -- literal internal addresses and hostnames that
 * plainly resolve to them -- and nothing more; do not read it as complete.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Bypass for developers and self-hosters testing against a LAN or localhost target. */
const ESCAPE_HATCH_ENV = 'ALLOW_INTERNAL_SCRAPING';

/**
 * How strict the address check is. Spelled out at every call site rather than
 * defaulted silently, so which policy applies is readable where it matters.
 */
export type UrlSafetyPolicy = 'block-all-private' | 'allow-private-lan';

/** Why a URL was refused. Lets a caller treat "does not resolve" differently from "must not be fetched". */
export type UnsafeUrlReason = 'invalid' | 'scheme' | 'unresolvable' | 'blocked-address';

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface UrlSafetyOptions {
  /** Defaults to the stricter `block-all-private`. */
  policy?: UrlSafetyPolicy;
  /** Injected in tests so the checks never depend on real DNS. */
  resolver?: AddressResolver;
  /** Overrides the environment escape hatch; used by tests. */
  allowInternal?: boolean;
}

/**
 * Carries `statusCode` so `asyncHandler` answers 400 with this message rather
 * than swallowing it into a generic 500 (see utils/system/route-helpers.ts).
 */
export class UnsafeUrlError extends Error {
  readonly statusCode = 400;
  readonly reason: UnsafeUrlReason;

  constructor(message: string, reason: UnsafeUrlReason) {
    super(message);
    this.name = 'UnsafeUrlError';
    this.reason = reason;
  }
}

const defaultResolver: AddressResolver = async (hostname: string) => {
  // `verbatim` keeps the resolver's own ordering; we check every record
  // regardless, so ordering only matters for what axios will later pick.
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family }));
};

/**
 * What an address is, as far as this guard cares.
 *
 * - `internal`: never reachable from a user-supplied URL, under any policy.
 * - `lan`: a private network address -- refused by `block-all-private`,
 *   allowed by `allow-private-lan`.
 * - `invalid`: not a shape we understand; refused, because guessing is worse.
 */
type AddressClass = 'public' | 'lan' | 'internal' | 'invalid';

function classifyIPv4(address: string): AddressClass {
  const octets = address.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return 'invalid';
  }

  const [a, b] = octets;

  if (a === 0) return 'internal';                          // 0.0.0.0/8  "this network"
  if (a === 127) return 'internal';                        // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return 'internal';           // 169.254.0.0/16 link-local -- cloud metadata lives here
  if (a === 198 && (b === 18 || b === 19)) return 'internal'; // 198.18.0.0/15 benchmarking
  if (a >= 224) return 'internal';                         // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved + broadcast

  if (a === 10) return 'lan';                              // 10.0.0.0/8 RFC1918
  if (a === 172 && b >= 16 && b <= 31) return 'lan';       // 172.16.0.0/12 RFC1918
  if (a === 192 && b === 168) return 'lan';                // 192.168.0.0/16 RFC1918
  if (a === 100 && b >= 64 && b <= 127) return 'lan';      // 100.64.0.0/10 CGNAT

  return 'public';
}

/**
 * Expands an IPv6 address to its sixteen bytes, or returns null if it cannot
 * be parsed. Handles `::` compression, an embedded IPv4 tail
 * (`::ffff:127.0.0.1`) and a zone suffix (`fe80::1%eth0`).
 */
function toIPv6Bytes(address: string): number[] | null {
  const withoutZone = address.split('%')[0];

  let head = withoutZone;
  let tailBytes: number[] = [];

  const lastColon = withoutZone.lastIndexOf(':');
  if (lastColon !== -1) {
    const tail = withoutZone.slice(lastColon + 1);
    if (tail.includes('.')) {
      if (isIP(tail) !== 4) return null;
      tailBytes = tail.split('.').map((part) => Number(part));
      head = withoutZone.slice(0, lastColon);
      // `::ffff:1.2.3.4` leaves a trailing colon behind; keep the `::` intact.
      if (head.endsWith(':') && !head.endsWith('::')) head = head.slice(0, -1);
      if (head === '') head = '::';
    }
  }

  const groupsWanted = (16 - tailBytes.length) / 2;
  const doubleColon = head.indexOf('::');

  let groups: string[];
  if (doubleColon === -1) {
    groups = head === '' ? [] : head.split(':');
    if (groups.length !== groupsWanted) return null;
  } else {
    const before = head.slice(0, doubleColon);
    const after = head.slice(doubleColon + 2);
    const left = before === '' ? [] : before.split(':');
    const right = after === '' ? [] : after.split(':');
    const missing = groupsWanted - left.length - right.length;
    if (missing < 0) return null;
    groups = [...left, ...new Array<string>(missing).fill('0'), ...right];
  }

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    const value = parseInt(group, 16);
    bytes.push((value >> 8) & 0xff, value & 0xff);
  }

  return [...bytes, ...tailBytes];
}

function classifyIPv6(address: string): AddressClass {
  const bytes = toIPv6Bytes(address);
  if (!bytes || bytes.length !== 16) return 'invalid';

  const leadingZeros = bytes.slice(0, 10).every((byte) => byte === 0);

  // ::ffff:a.b.c.d -- an IPv4 address wearing an IPv6 coat. Also ::a.b.c.d,
  // the deprecated IPv4-compatible form, which resolvers still accept. Both
  // are classified as the IPv4 address they carry, so neither policy can be
  // walked around by rewriting the address.
  if (leadingZeros && ((bytes[10] === 0xff && bytes[11] === 0xff) || (bytes[10] === 0 && bytes[11] === 0))) {
    // `::` and `::1` fall out of this as 0.0.0.0 and 0.0.0.1, both `internal`
    // under the 0.0.0.0/8 rule, so they need no separate case.
    return classifyIPv4(bytes.slice(12).join('.'));
  }

  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return 'internal'; // fe80::/10 link-local
  if (bytes[0] === 0xff) return 'internal';                              // ff00::/8 multicast

  // fc00::/7 unique-local is the IPv6 RFC1918: a real LAN a self-hoster may
  // run a shop on, so it follows the same policy as 10/8 rather than being
  // refused outright.
  if ((bytes[0] & 0xfe) === 0xfc) return 'lan';

  return 'public';
}

function classifyAddress(address: string): AddressClass {
  const family = isIP(address);
  if (family === 4) return classifyIPv4(address);
  if (family === 6) return classifyIPv6(address);
  return 'invalid';
}

/**
 * True when an IP literal must not be reached under the given policy. Callers
 * only ever pass resolver output, so anything that is not an IP address at all
 * counts as blocked.
 */
export function isBlockedAddress(address: string, policy: UrlSafetyPolicy = 'block-all-private'): boolean {
  const addressClass = classifyAddress(address);
  if (addressClass === 'public') return false;
  if (addressClass === 'lan') return policy === 'block-all-private';
  return true;
}

function internalTargetsAllowed(options: UrlSafetyOptions): boolean {
  if (options.allowInternal !== undefined) return options.allowInternal;
  return process.env[ESCAPE_HATCH_ENV] === 'true';
}

/**
 * The message the caller's user sees. An administrator is debugging a fetch
 * and wants the address and the escape hatch; someone adding a product to
 * track is not, and does not need the deployment's internal addressing
 * described back to them either.
 */
function describeBlockedAddress(hostname: string, address: string, policy: UrlSafetyPolicy): string {
  if (policy === 'block-all-private') {
    return `"${hostname}" resolves to an internal address (${address}), which cannot be fetched. ` +
      `Set ${ESCAPE_HATCH_ENV}=true to allow internal targets in a development environment.`;
  }
  return `That address cannot be tracked. "${hostname}" points at this server itself rather than at a shop's website.`;
}

/**
 * Validates a user-supplied URL before anything outbound is attempted.
 *
 * Throws `UnsafeUrlError` (HTTP 400) when the URL is malformed, uses a scheme
 * other than http/https, does not resolve, or resolves to an address the
 * policy forbids. The scheme check is absolute under both policies; the
 * address check can be waived entirely with `ALLOW_INTERNAL_SCRAPING=true` for
 * developers testing against localhost.
 *
 * Returns the parsed URL so callers that need its parts do not parse twice.
 */
export async function assertUrlIsSafe(rawUrl: unknown, options: UrlSafetyOptions = {}): Promise<URL> {
  const policy: UrlSafetyPolicy = options.policy ?? 'block-all-private';

  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw new UnsafeUrlError('A URL is required.', 'invalid');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    // Deliberately does not echo the input back: it may carry credentials.
    throw new UnsafeUrlError('That is not a valid URL.', 'invalid');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    logger.warn(
      `Security | Blocked URL | Disallowed scheme ${parsed.protocol} | ${scrubUrlCredentials(parsed.toString())}`,
      'Security'
    );
    throw new UnsafeUrlError(
      `Only http and https URLs can be fetched (got "${parsed.protocol.replace(':', '')}").`,
      'scheme'
    );
  }

  if (internalTargetsAllowed(options)) {
    return parsed;
  }

  // `URL.hostname` brackets an IPv6 literal; the resolver wants it bare.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  let addresses: ResolvedAddress[];
  if (isIP(hostname) !== 0) {
    addresses = [{ address: hostname, family: isIP(hostname) }];
  } else {
    const resolver = options.resolver ?? defaultResolver;
    try {
      addresses = await resolver(hostname);
    } catch {
      throw new UnsafeUrlError(`Could not resolve the host "${hostname}".`, 'unresolvable');
    }
    if (!addresses || addresses.length === 0) {
      throw new UnsafeUrlError(`Could not resolve the host "${hostname}".`, 'unresolvable');
    }
  }

  // Every record has to pass. A host that answers with one public and one
  // internal address is a rebinding attack waiting to be picked on the second
  // lookup, so one bad record condemns the lot.
  const blocked = addresses.find((entry) => isBlockedAddress(entry.address, policy));
  if (blocked) {
    logger.warn(
      `Security | Blocked URL | Host ${hostname} resolves to internal address ${blocked.address} (policy ${policy})`,
      'Security'
    );
    throw new UnsafeUrlError(describeBlockedAddress(hostname, blocked.address, policy), 'blocked-address');
  }

  return parsed;
}
