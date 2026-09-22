import { describe, it, expect, afterEach } from 'vitest';
import {
  assertUrlIsSafe,
  isBlockedAddress,
  UnsafeUrlError,
  type AddressResolver,
} from '../../src/utils/system/url-safety';

/**
 * Issue #165, part 3: the administrator endpoints that take a URL from the
 * request body -- retailer config test, debug extract, retailer remap -- fetched
 * whatever they were given. `http://169.254.169.254/latest/meta-data/` and
 * `http://127.0.0.1:5432/` reached services inside the deployment and their
 * answer came back in the HTTP response.
 *
 * DNS is injected throughout so these tests never touch the network, and so a
 * hostname can be made to answer with exactly the records a given case needs.
 */

/** Answers every hostname with the given addresses. */
const resolvesTo = (...addresses: string[]): AddressResolver =>
  async () => addresses.map((address) => ({
    address,
    family: address.includes(':') ? 6 : 4,
  }));

const PUBLIC_RESOLVER = resolvesTo('93.184.216.34');

afterEach(() => {
  delete process.env.ALLOW_INTERNAL_SCRAPING;
});

describe('schemes', () => {
  it('accepts http and https', async () => {
    await expect(assertUrlIsSafe('http://shop.example.com/p/1', { resolver: PUBLIC_RESOLVER })).resolves.toBeInstanceOf(URL);
    await expect(assertUrlIsSafe('https://shop.example.com/p/1', { resolver: PUBLIC_RESOLVER })).resolves.toBeInstanceOf(URL);
  });

  it.each([
    'file:///etc/passwd',
    'ftp://files.example.com/list',
    'gopher://example.com:70/1',
    'data:text/html,<h1>hi</h1>',
  ])('rejects %s', async (url) => {
    await expect(assertUrlIsSafe(url, { resolver: PUBLIC_RESOLVER })).rejects.toThrow(UnsafeUrlError);
  });

  it('answers 400 rather than 500, so the admin sees why', async () => {
    // asyncHandler maps statusCode < 500 to that status with the message.
    const error = await assertUrlIsSafe('file:///etc/passwd').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnsafeUrlError);
    expect((error as UnsafeUrlError).statusCode).toBe(400);
  });

  it('rejects a malformed URL without echoing it back', async () => {
    // The input may carry credentials; the message must not repeat it.
    const error = await assertUrlIsSafe('http://user:hunter2@').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnsafeUrlError);
    expect((error as UnsafeUrlError).message).not.toContain('hunter2');
  });

  it('rejects a missing or non-string URL', async () => {
    await expect(assertUrlIsSafe(undefined)).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlIsSafe(42)).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlIsSafe('   ')).rejects.toThrow(UnsafeUrlError);
  });
});

describe('blocked IPv4 ranges', () => {
  it.each([
    ['loopback', '127.0.0.1'],
    ['loopback, the rest of 127/8', '127.1.2.3'],
    ['RFC1918 10/8', '10.0.0.5'],
    ['RFC1918 172.16/12', '172.16.0.1'],
    ['RFC1918 172.16/12, top of range', '172.31.255.254'],
    ['RFC1918 192.168/16', '192.168.1.1'],
    ['link-local', '169.254.1.1'],
    ['cloud metadata', '169.254.169.254'],
    ['0.0.0.0/8', '0.0.0.0'],
  ])('rejects %s (%s)', (_label, address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    ['a public address', '93.184.216.34'],
    ['just below 172.16/12', '172.15.0.1'],
    ['just above 172.16/12', '172.32.0.1'],
    ['192.167, not 192.168', '192.167.1.1'],
    ['169.253, not 169.254', '169.253.1.1'],
  ])('allows %s (%s)', (_label, address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it('blocks a host whose DNS answer is the metadata endpoint', async () => {
    await expect(
      assertUrlIsSafe('http://metadata.attacker.test/latest/meta-data/', { resolver: resolvesTo('169.254.169.254') })
    ).rejects.toThrow(/internal address/);
  });

  it('blocks a literal internal address without needing DNS at all', async () => {
    const resolver: AddressResolver = async () => {
      throw new Error('the resolver must not be consulted for an IP literal');
    };
    await expect(assertUrlIsSafe('http://127.0.0.1:5432/', { resolver })).rejects.toThrow(UnsafeUrlError);
  });
});

describe('blocked IPv6 ranges', () => {
  it.each([
    ['loopback', '::1'],
    ['unspecified', '::'],
    ['unique-local fc00::/7', 'fd00::1'],
    ['unique-local, fc half', 'fc00::1'],
    ['link-local', 'fe80::1'],
    ['link-local with a zone', 'fe80::1%eth0'],
  ])('rejects %s (%s)', (_label, address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    ['a public address', '2606:4700:4700::1111'],
    ['a public address, fully written out', '2001:0db8:0000:0000:0000:0000:0000:0001'],
  ])('allows %s (%s)', (_label, address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it('sees through an IPv4-mapped IPv6 address', () => {
    // ::ffff:127.0.0.1 is loopback wearing an IPv6 coat -- the obvious bypass
    // for a guard that only understands dotted quads.
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:93.184.216.34')).toBe(false);
  });

  it('blocks a host that resolves to an IPv4-mapped loopback address', async () => {
    await expect(
      assertUrlIsSafe('http://sneaky.example.test/', { resolver: resolvesTo('::ffff:127.0.0.1') })
    ).rejects.toThrow(UnsafeUrlError);
  });

  it('accepts a bracketed public IPv6 literal', async () => {
    await expect(assertUrlIsSafe('http://[2606:4700:4700::1111]/p/1')).resolves.toBeInstanceOf(URL);
  });

  it('rejects a bracketed loopback literal', async () => {
    await expect(assertUrlIsSafe('http://[::1]:8080/')).rejects.toThrow(UnsafeUrlError);
  });
});

describe('a host with several addresses', () => {
  it('is rejected when any one of them is internal', async () => {
    // The resolver picks the record; axios may not pick the one we checked, so
    // a single bad record condemns the host.
    await expect(
      assertUrlIsSafe('http://rebind.example.test/', { resolver: resolvesTo('93.184.216.34', '10.0.0.7') })
    ).rejects.toThrow(/10\.0\.0\.7/);
  });

  it('is allowed when all of them are public', async () => {
    await expect(
      assertUrlIsSafe('http://shop.example.com/p/1', { resolver: resolvesTo('93.184.216.34', '2606:4700::1111') })
    ).resolves.toBeInstanceOf(URL);
  });

  it('is rejected when it cannot be resolved at all', async () => {
    const failing: AddressResolver = async () => { throw new Error('ENOTFOUND'); };
    await expect(assertUrlIsSafe('http://nope.example.test/', { resolver: failing })).rejects.toThrow(/resolve/);
  });

  it('is rejected when the resolver answers with nothing', async () => {
    await expect(assertUrlIsSafe('http://empty.example.test/', { resolver: resolvesTo() })).rejects.toThrow(/resolve/);
  });
});

describe('the ALLOW_INTERNAL_SCRAPING escape hatch', () => {
  it('lets a developer test against localhost', async () => {
    process.env.ALLOW_INTERNAL_SCRAPING = 'true';
    await expect(assertUrlIsSafe('http://127.0.0.1:3000/product')).resolves.toBeInstanceOf(URL);
    await expect(assertUrlIsSafe('http://192.168.1.10/product')).resolves.toBeInstanceOf(URL);
  });

  it('does not waive the scheme check', async () => {
    // The escape hatch is about where the request may go, not what it may be.
    process.env.ALLOW_INTERNAL_SCRAPING = 'true';
    await expect(assertUrlIsSafe('file:///etc/passwd')).rejects.toThrow(UnsafeUrlError);
  });

  it('takes only the exact string "true"', async () => {
    process.env.ALLOW_INTERNAL_SCRAPING = '1';
    await expect(assertUrlIsSafe('http://127.0.0.1:3000/')).rejects.toThrow(UnsafeUrlError);
  });

  it('is off when the variable is absent', async () => {
    await expect(assertUrlIsSafe('http://10.0.0.1/')).rejects.toThrow(UnsafeUrlError);
  });
});

describe('ordinary retailer URLs', () => {
  it('pass untouched, and come back parsed', async () => {
    const parsed = await assertUrlIsSafe('https://www.example-shop.com/p/12345?variant=blue', {
      resolver: PUBLIC_RESOLVER,
    });
    expect(parsed.hostname).toBe('www.example-shop.com');
    expect(parsed.searchParams.get('variant')).toBe('blue');
  });
});
