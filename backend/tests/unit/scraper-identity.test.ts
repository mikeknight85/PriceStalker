import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseUserAgent,
  buildBrandList,
  buildClientHintHeaders,
  buildUserAgentMetadata,
} from '../../src/services/scraper/transport/user-agent';

/**
 * The scrape used to announce two different browsers in one request: the
 * User-Agent came from a setting (seeded as Chrome 146) while Sec-Ch-Ua was
 * hardcoded to Chrome 121 on Windows. No real browser can produce that, and
 * Amazon's WAF answered it with a challenge page served as HTTP 200 -- which is
 * why extraction found no price and auto-mapping rejected the config it had
 * generated from challenge HTML (issues #67, #68).
 *
 * The reporter confirmed it from the other side: setting the User-Agent to
 * Chrome 121 on Windows fixed amazon.com.au, that being the one string which
 * agrees with the hardcoded hints.
 */

const CHROME_146_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
const CHROME_121_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36';
const EDGE_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0';
const FIREFOX_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0';
const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';

/** The major version a Sec-Ch-Ua brand list claims for Chromium. */
function hintVersion(brands: string | null): string | null {
  const m = brands?.match(/"Chromium";v="(\d+)"/);
  return m ? m[1] : null;
}

describe('the invariant that was broken', () => {
  const chromiumAgents = [CHROME_146_WIN, CHROME_121_WIN, CHROME_MAC, CHROME_ANDROID, EDGE_WIN];

  it.each(chromiumAgents)('client hints report the same version as the User-Agent: %s', (ua) => {
    // This single assertion is the whole bug. The old headers hardcoded 121
    // while the seeded UA said 146.
    const uaVersion = ua.match(/Chrom(?:e|ium)\/(\d+)/)![1];
    expect(hintVersion(buildBrandList(parseUserAgent(ua)))).toBe(uaVersion);
  });

  it('would have failed against the old hardcoded header', () => {
    // The literal string that used to ship, checked against the seeded default.
    const wasHardcoded = '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"';
    expect(hintVersion(wasHardcoded)).toBe('121');
    expect(hintVersion(buildBrandList(parseUserAgent(CHROME_146_WIN)))).toBe('146');
  });
});

describe('brand detection', () => {
  it('reads Chrome', () => {
    const id = parseUserAgent(CHROME_146_WIN);
    expect(id.family).toBe('chrome');
    expect(id.majorVersion).toBe('146');
  });

  it('reads Edge rather than the Chrome token it also carries', () => {
    // Every Chromium derivative claims "Chrome" too, so order of checks matters.
    const id = parseUserAgent(EDGE_WIN);
    expect(id.family).toBe('edge');
    expect(id.majorVersion).toBe('138');
  });

  it('reads Firefox', () => {
    expect(parseUserAgent(FIREFOX_WIN).family).toBe('firefox');
  });

  it('reads Safari rather than the Safari token Chrome also carries', () => {
    expect(parseUserAgent(SAFARI_MAC).family).toBe('safari');
    expect(parseUserAgent(CHROME_146_WIN).family).toBe('chrome');
  });

  it('does not guess at something it cannot identify', () => {
    const id = parseUserAgent('curl/8.4.0');
    expect(id.family).toBe('unknown');
    expect(id.supportsClientHints).toBe(false);
  });
});

describe('platform detection', () => {
  it.each([
    [CHROME_146_WIN, 'Windows', false],
    [CHROME_MAC, 'macOS', false],
    [CHROME_ANDROID, 'Android', true],
    [SAFARI_IPHONE, 'iOS', true],
  ])('reads %s as %s', (ua, platform, mobile) => {
    const id = parseUserAgent(ua);
    expect(id.platform).toBe(platform);
    expect(id.mobile).toBe(mobile);
  });

  it('reads Android before Linux, which the same string also contains', () => {
    expect(parseUserAgent(CHROME_ANDROID).platform).toBe('Android');
  });
});

describe('which browsers get client hints at all', () => {
  it('gives them to Chromium', () => {
    expect(parseUserAgent(CHROME_146_WIN).supportsClientHints).toBe(true);
    expect(parseUserAgent(EDGE_WIN).supportsClientHints).toBe(true);
  });

  it('withholds them from Firefox and Safari, which do not send them', () => {
    // Sending Sec-Ch-Ua alongside a Firefox User-Agent describes a browser that
    // does not exist -- a stronger signal than sending nothing.
    expect(parseUserAgent(FIREFOX_WIN).supportsClientHints).toBe(false);
    expect(parseUserAgent(SAFARI_MAC).supportsClientHints).toBe(false);
    expect(buildClientHintHeaders(parseUserAgent(FIREFOX_WIN))).toEqual({});
    expect(buildClientHintHeaders(parseUserAgent(SAFARI_MAC))).toEqual({});
  });
});

describe('the header set', () => {
  it('names the brand matching the User-Agent', () => {
    expect(buildBrandList(parseUserAgent(CHROME_146_WIN))).toContain('"Google Chrome";v="146"');
    expect(buildBrandList(parseUserAgent(EDGE_WIN))).toContain('"Microsoft Edge";v="138"');
    expect(buildBrandList(parseUserAgent(EDGE_WIN))).not.toContain('Google Chrome');
  });

  it('agrees with the User-Agent about the platform', () => {
    expect(buildClientHintHeaders(parseUserAgent(CHROME_MAC))['Sec-Ch-Ua-Platform']).toBe('"macOS"');
    expect(buildClientHintHeaders(parseUserAgent(CHROME_146_WIN))['Sec-Ch-Ua-Platform']).toBe('"Windows"');
  });

  it('agrees with the User-Agent about mobile', () => {
    expect(buildClientHintHeaders(parseUserAgent(CHROME_ANDROID))['Sec-Ch-Ua-Mobile']).toBe('?1');
    expect(buildClientHintHeaders(parseUserAgent(CHROME_146_WIN))['Sec-Ch-Ua-Mobile']).toBe('?0');
  });

  it('sends only the three low-entropy hints', () => {
    // A real browser sends architecture, platform version and full version list
    // only after a server asks with Accept-CH. Volunteering them is another way
    // to stand out.
    expect(Object.keys(buildClientHintHeaders(parseUserAgent(CHROME_146_WIN))).sort())
      .toEqual(['Sec-Ch-Ua', 'Sec-Ch-Ua-Mobile', 'Sec-Ch-Ua-Platform']);
  });
});

describe('Puppeteer metadata', () => {
  it('matches the User-Agent it accompanies', () => {
    const meta = buildUserAgentMetadata(parseUserAgent(CHROME_MAC))!;
    expect(meta.mobile).toBe(false);
    expect(meta.platform).toBe('macOS');
    expect(meta.platformVersion).toBe('10.15.7');
    expect(meta.brands).toContainEqual({ brand: 'Google Chrome', version: '140' });
    expect(meta.fullVersion).toBe('140.0.0.0');
  });

  it('reads an Android platform version', () => {
    expect(buildUserAgentMetadata(parseUserAgent(CHROME_ANDROID))!.platformVersion).toBe('14');
  });

  it('is withheld where the browser sends no hints, so the bare string is used', () => {
    expect(buildUserAgentMetadata(parseUserAgent(FIREFOX_WIN))).toBeUndefined();
    expect(buildUserAgentMetadata(parseUserAgent(SAFARI_MAC))).toBeUndefined();
  });
});
