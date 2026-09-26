/**
 * Derives a request identity from one User-Agent string (issues #67, #68).
 *
 * The headers used to be half configurable and half hardcoded:
 *
 *   User-Agent  <- system setting `default_user_agent`, or a retailer override
 *   Sec-Ch-Ua   <- the literal string '"Google Chrome";v="121"', always
 *
 * The seeded default is Chrome 146. So out of the box, every request announced
 * Chrome 146 in the User-Agent and Chrome 121 in the client hints -- a
 * twenty-five version contradiction that no real browser can produce, sent to
 * every retailer on every scrape. Amazon's WAF answered it with a challenge
 * page served as HTTP 200, which is why extraction found no price and
 * auto-mapping then rejected the config it generated from challenge HTML.
 *
 * The reporter confirmed this from the other end: setting the User-Agent to
 * Chrome 121 on Windows fixed amazon.com.au. That is the one string that
 * happens to agree with the hardcoded hints, which is the proof rather than a
 * coincidence.
 *
 * A per-retailer `user_agent` override was worse still: it got the same
 * hardcoded Chrome-on-Windows hints, so configuring a Safari or Android UA for
 * a retailer produced a browser that has never existed.
 *
 * Everything is now derived from the one string, and a UA whose brand does not
 * support client hints gets none -- inventing them for Firefox or Safari is
 * itself the tell.
 */

export type BrandFamily = 'chrome' | 'edge' | 'opera' | 'firefox' | 'safari' | 'unknown';

export interface UserAgentIdentity {
  userAgent: string;
  family: BrandFamily;
  /** Major version, as a string because that is what the hint carries. */
  majorVersion: string | null;
  /**
   * Major version of the Chromium underneath, from the Chrome/ token. The same
   * as majorVersion for Chrome and Edge; Opera numbers itself separately, so
   * OPR/136 runs on Chromium 152.
   */
  chromiumVersion: string | null;
  /** The `Sec-CH-UA-Platform` value, quoted form without the quotes. */
  platform: string;
  mobile: boolean;
  /** True when this browser actually sends User-Agent Client Hints. */
  supportsClientHints: boolean;
}

/**
 * The GREASE brand Chromium sends alongside the real ones, and the order of
 * the list, both follow the major version. Chromium takes the brand's two
 * punctuation characters and its version, and the position of each entry,
 * from fixed tables indexed by the major
 * (components/embedder_support/user_agent_utils.cc,
 * GetGreasedUserAgentBrandVersion and GetRandomOrder).
 *
 * So Chrome 146 sends "Chromium";v="146", "Not-A.Brand";v="24",
 * "Google Chrome";v="146", and a fixed GREASE entry in a fixed position is
 * visible to a server on every major where the tables give something else.
 */
const GREASE_CHARS = [' ', '(', ':', '-', '.', '/', ')', ';', '=', '?', '_'];
const GREASE_VERSIONS = ['8', '99', '24'];

/** Entry i of [GREASE, Chromium, own brand] goes to position ORDERS[major % 6][i]. */
const ORDERS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

export function greaseBrand(major: number): { brand: string; version: string } {
  const n = GREASE_CHARS.length;
  return {
    brand: `Not${GREASE_CHARS[major % n]}A${GREASE_CHARS[(major + 1) % n]}Brand`,
    version: GREASE_VERSIONS[major % GREASE_VERSIONS.length],
  };
}

function detectPlatform(ua: string): { platform: string; mobile: boolean } {
  // Order matters: an Android UA also contains "Linux", and an iPad UA in
  // desktop mode contains "Macintosh".
  if (/Android/i.test(ua)) return { platform: 'Android', mobile: true };
  if (/iPhone|iPod/i.test(ua)) return { platform: 'iOS', mobile: true };
  if (/iPad/i.test(ua)) return { platform: 'iOS', mobile: false };
  if (/CrOS/i.test(ua)) return { platform: 'Chrome OS', mobile: false };
  if (/Windows/i.test(ua)) return { platform: 'Windows', mobile: false };
  if (/Macintosh|Mac OS X/i.test(ua)) return { platform: 'macOS', mobile: false };
  if (/Linux|X11/i.test(ua)) return { platform: 'Linux', mobile: false };
  return { platform: 'Unknown', mobile: false };
}

function detectBrand(ua: string): { family: BrandFamily; majorVersion: string | null } {
  // Checked before Chrome: every Chromium derivative also claims "Chrome".
  const edge = ua.match(/Edg(?:e|A|iOS)?\/(\d+)/);
  if (edge) return { family: 'edge', majorVersion: edge[1] };

  const opera = ua.match(/OPR\/(\d+)/);
  if (opera) return { family: 'opera', majorVersion: opera[1] };

  const firefox = ua.match(/Firefox\/(\d+)/);
  if (firefox) return { family: 'firefox', majorVersion: firefox[1] };

  const chrome = ua.match(/Chrome\/(\d+)/);
  if (chrome) return { family: 'chrome', majorVersion: chrome[1] };

  // Safari last: Chrome and Edge UAs both end in a Safari token.
  const safari = ua.match(/Version\/(\d+)[\d.]*\s+Safari\//);
  if (safari) return { family: 'safari', majorVersion: safari[1] };

  return { family: 'unknown', majorVersion: null };
}

export function parseUserAgent(userAgent: string): UserAgentIdentity {
  const ua = userAgent.trim();
  const { family, majorVersion } = detectBrand(ua);
  const { platform, mobile } = detectPlatform(ua);

  // Firefox and Safari do not implement User-Agent Client Hints. Sending them
  // anyway announces a browser that cannot exist.
  const isChromium = family === 'chrome' || family === 'edge' || family === 'opera';

  const chromium = isChromium ? ua.match(/Chrome\/(\d+)/) : null;
  const chromiumVersion = chromium ? chromium[1] : null;

  return {
    userAgent: ua,
    family,
    majorVersion,
    chromiumVersion,
    platform,
    mobile,
    supportsClientHints: isChromium && majorVersion !== null && chromiumVersion !== null,
  };
}

/**
 * The brands in the order Chromium sends them: GREASE, "Chromium" at the
 * Chromium major, and the browser's own brand at its own major.
 */
function orderedBrands(identity: UserAgentIdentity): { brand: string; version: string }[] | null {
  if (!identity.supportsClientHints || !identity.majorVersion || !identity.chromiumVersion) return null;

  let own: string;
  switch (identity.family) {
    case 'chrome': own = 'Google Chrome'; break;
    case 'edge': own = 'Microsoft Edge'; break;
    case 'opera': own = 'Opera'; break;
    default: return null;
  }

  const major = Number(identity.chromiumVersion);
  const list = [
    greaseBrand(major),
    { brand: 'Chromium', version: identity.chromiumVersion },
    { brand: own, version: identity.majorVersion },
  ];
  const placed: { brand: string; version: string }[] = new Array(list.length);
  ORDERS[major % ORDERS.length].forEach((pos, i) => { placed[pos] = list[i]; });
  return placed;
}

/**
 * The `Sec-CH-UA` brand list for an identity, or null where the browser sends
 * none.
 *
 * Chromium lists the GREASE brand, "Chromium" and its own brand, with the
 * versions the User-Agent carries, in the order the major version dictates.
 */
export function buildBrandList(identity: UserAgentIdentity): string | null {
  const brands = orderedBrands(identity);
  if (!brands) return null;
  return brands.map(b => `"${b.brand}";v="${b.version}"`).join(', ');
}

/**
 * Client-hint headers consistent with the User-Agent, or none.
 *
 * Only the three low-entropy hints are sent. The rest -- architecture,
 * platform version, full version list -- are only sent by a real browser after
 * a server asks for them with `Accept-CH`, so volunteering them unprompted is
 * another way to stand out.
 */
export function buildClientHintHeaders(identity: UserAgentIdentity): Record<string, string> {
  const brands = buildBrandList(identity);
  if (!brands) return {};

  return {
    'Sec-Ch-Ua': brands,
    'Sec-Ch-Ua-Mobile': identity.mobile ? '?1' : '?0',
    'Sec-Ch-Ua-Platform': `"${identity.platform}"`,
  };
}

/**
 * Puppeteer's `userAgentMetadata`, so an overridden UA in the browser scraper
 * carries matching client hints.
 *
 * Without it, `page.setUserAgent(ua)` changes the string while Chrome keeps
 * emitting hints from its own build -- the same contradiction the HTTP path
 * had, arrived at from the other direction.
 */
export function buildUserAgentMetadata(identity: UserAgentIdentity) {
  const brands = orderedBrands(identity);
  if (!brands) return undefined;

  return {
    brands,
    fullVersion: `${identity.chromiumVersion}.0.0.0`,
    platform: identity.platform,
    platformVersion: platformVersionFor(identity),
    architecture: identity.mobile ? '' : 'x86',
    model: '',
    mobile: identity.mobile,
  };
}

/**
 * A platform version consistent with the UA string.
 *
 * Only used for the browser path's metadata, where Chrome will answer an
 * `Accept-CH` request for it. A blank value where we cannot tell is better
 * than a confident wrong one.
 */
function platformVersionFor(identity: UserAgentIdentity): string {
  const ua = identity.userAgent;

  const windows = ua.match(/Windows NT (\d+\.\d+)/);
  if (windows) {
    // Chrome reports Windows 10 and 11 as platform versions 10.0 and 13.0+
    // respectively, both behind "Windows NT 10.0" in the UA. 10.0 is the safe
    // reading of that string.
    return windows[1] === '10.0' ? '10.0.0' : `${windows[1]}.0`;
  }

  const mac = ua.match(/Mac OS X (\d+)[._](\d+)(?:[._](\d+))?/);
  if (mac) return `${mac[1]}.${mac[2]}.${mac[3] || '0'}`;

  const android = ua.match(/Android (\d+(?:\.\d+)*)/);
  if (android) return android[1];

  return '';
}
