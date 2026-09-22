import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { logger } from './logger';
import { scrubUrlCredentials } from './logging/scrubber';

/**
 * Guard against server-side request forgery (issue #165).
 *
 * Several administrator endpoints take a URL from the request body and fetch
 * it -- the retailer config test, the debug extractor and the retailer remap.
 * Without a check, `http://169.254.169.254/latest/meta-data/` or
 * `http://127.0.0.1:5432/` reaches whatever is listening inside the deployment
 * and the response comes back in the HTTP reply. Administrator-only narrows
 * the exposure; it does not close it, because the point of the guard is that
 * the server's own network position is not the caller's to borrow.
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

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface UrlSafetyOptions {
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

  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const defaultResolver: AddressResolver = async (hostname: string) => {
  // `verbatim` keeps the resolver's own ordering; we check every record
  // regardless, so ordering only matters for what axios will later pick.
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family }));
};

/**
 * True when an IPv4 address sits in a range that must never be reached from a
 * user-supplied URL.
 *
 * Beyond the ranges the issue calls for (loopback, RFC1918, link-local and
 * 0.0.0.0/8) this also rejects carrier-grade NAT, benchmarking, multicast and
 * reserved space: none of them is a retailer, and all of them are reachable
 * from inside a typical deployment.
 */
function isBlockedIPv4(address: string): boolean {
  const octets = address.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    // Not a shape we understand -- refuse rather than guess.
    return true;
  }

  const [a, b] = octets;

  if (a === 0) return true;                        // 0.0.0.0/8  "this network"
  if (a === 10) return true;                       // 10.0.0.0/8 RFC1918
  if (a === 127) return true;                      // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true;         // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC1918
  if (a === 192 && b === 168) return true;         // 192.168.0.0/16 RFC1918
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true;                       // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved + broadcast

  return false;
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

/** True when an IPv6 address is loopback, unspecified, link-local, unique-local, multicast, or maps onto a blocked IPv4 address. */
function isBlockedIPv6(address: string): boolean {
  const bytes = toIPv6Bytes(address);
  if (!bytes || bytes.length !== 16) return true;

  const leadingZeros = bytes.slice(0, 10).every((byte) => byte === 0);

  // ::ffff:a.b.c.d -- an IPv4 address wearing an IPv6 coat. Also ::a.b.c.d,
  // the deprecated IPv4-compatible form, which resolvers still accept.
  if (leadingZeros && ((bytes[10] === 0xff && bytes[11] === 0xff) || (bytes[10] === 0 && bytes[11] === 0))) {
    const mapped = bytes.slice(12).join('.');
    // `::` and `::1` fall out of this as 0.0.0.0 and 0.0.0.1, both blocked by
    // the 0.0.0.0/8 rule, so they need no separate case.
    return isBlockedIPv4(mapped);
  }

  if ((bytes[0] & 0xfe) === 0xfc) return true;                  // fc00::/7 unique-local
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (bytes[0] === 0xff) return true;                           // ff00::/8 multicast

  return false;
}

/**
 * True when an IP literal belongs to a range a user-supplied URL must not
 * reach. An input that is not an IP address at all is treated as blocked --
 * callers only ever pass resolver output, so anything else is a surprise.
 */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  return true;
}

function internalTargetsAllowed(options: UrlSafetyOptions): boolean {
  if (options.allowInternal !== undefined) return options.allowInternal;
  return process.env[ESCAPE_HATCH_ENV] === 'true';
}

/**
 * Validates a user-supplied URL before anything outbound is attempted.
 *
 * Throws `UnsafeUrlError` (HTTP 400) when the URL is malformed, uses a scheme
 * other than http/https, or resolves to an address inside the deployment. The
 * scheme check is absolute; the address check can be waived with
 * `ALLOW_INTERNAL_SCRAPING=true` for developers testing against localhost.
 *
 * Returns the parsed URL so callers that need its parts do not parse twice.
 */
export async function assertUrlIsSafe(rawUrl: unknown, options: UrlSafetyOptions = {}): Promise<URL> {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw new UnsafeUrlError('A URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    // Deliberately does not echo the input back: it may carry credentials.
    throw new UnsafeUrlError('That is not a valid URL.');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    logger.warn(
      `Security | Blocked URL | Disallowed scheme ${parsed.protocol} | ${scrubUrlCredentials(parsed.toString())}`,
      'Security'
    );
    throw new UnsafeUrlError(`Only http and https URLs can be fetched (got "${parsed.protocol.replace(':', '')}").`);
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
      throw new UnsafeUrlError(`Could not resolve the host "${hostname}".`);
    }
    if (!addresses || addresses.length === 0) {
      throw new UnsafeUrlError(`Could not resolve the host "${hostname}".`);
    }
  }

  // Every record has to pass. A host that answers with one public and one
  // internal address is a rebinding attack waiting to be picked on the second
  // lookup, so one bad record condemns the lot.
  const blocked = addresses.find((entry) => isBlockedAddress(entry.address));
  if (blocked) {
    logger.warn(
      `Security | Blocked URL | Host ${hostname} resolves to internal address ${blocked.address}`,
      'Security'
    );
    throw new UnsafeUrlError(
      `"${hostname}" resolves to an internal address (${blocked.address}), which cannot be fetched. ` +
      `Set ${ESCAPE_HATCH_ENV}=true to allow internal targets in a development environment.`
    );
  }

  return parsed;
}
