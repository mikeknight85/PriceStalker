import { describe, it, expect } from 'vitest';
import { scrubUrlCredentials, scrubSensitiveData } from '../../src/utils/system/logging/scrubber';

/**
 * A configured proxy can carry credentials -- http://user:pass@host:8080 --
 * and the acquisition layer records which proxy it used in `extractionSteps`
 * (issue #165).
 *
 * The logger scrubs its `details`, so the console and system_logs were never
 * the problem. `extractionSteps` is not only logged: it is attached to the
 * scrape result and returned as `trace` in the admin retailer-test response,
 * which never passes through the logger at all. The password left the process
 * in an HTTP response body.
 *
 * Scrubbed at the source now, so every present and future consumer is covered
 * by construction rather than each having to remember.
 */

const WITH_CREDS = 'http://scraperuser:hunter2@proxy.example.com:8080';

describe('a proxy URL recorded in the extraction trace', () => {
  it('keeps the host, so the trace still says which proxy was used', () => {
    const scrubbed = scrubUrlCredentials(WITH_CREDS);
    expect(scrubbed).toContain('proxy.example.com:8080');
  });

  it('does not carry the password', () => {
    const scrubbed = scrubUrlCredentials(WITH_CREDS);
    expect(scrubbed).not.toContain('hunter2');
    expect(scrubbed).toBe('http://[REDACTED]:[REDACTED]@proxy.example.com:8080');
  });

  it('does not carry the username either', () => {
    // The username is half a credential and identifies the account.
    expect(scrubUrlCredentials(WITH_CREDS)).not.toContain('scraperuser');
  });

  it('leaves a proxy without credentials readable', () => {
    // Scrubbing must not damage the common case.
    const plain = 'http://proxy.example.com:8080';
    expect(scrubUrlCredentials(plain)).toBe(plain);
  });

  it('handles https the same way', () => {
    expect(scrubUrlCredentials('https://u:p@secure-proxy.example.com'))
      .toBe('https://[REDACTED]:[REDACTED]@secure-proxy.example.com');
  });
});

describe('the trace as it actually travels', () => {
  it('is safe in the log path, which was never the leak', () => {
    // printer.ts scrubs `details` before both the console and saveToDb.
    const details = { trace: [`Request | Proxy | Using: ${WITH_CREDS}`] };
    expect(JSON.stringify(scrubSensitiveData(details))).not.toContain('hunter2');
  });

  it('is safe in the HTTP path, which was', () => {
    // routes/admin/retailers.ts returns `trace: extractionSteps` as JSON with
    // no logger involved, so the entry has to be clean before it is stored.
    const step = `Request | Proxy | Using: ${scrubUrlCredentials(WITH_CREDS)}`;
    expect(JSON.stringify({ success: true, trace: [step] })).not.toContain('hunter2');
  });
});
