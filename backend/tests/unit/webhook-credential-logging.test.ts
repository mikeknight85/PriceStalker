import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { post: vi.fn().mockResolvedValue({ status: 200, data: {} }) },
}));

// Hoisted, because `vi.mock`'s factory runs before the imports below.
const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../../src/utils/system/logger', () => ({ logger }));

import axios from 'axios';
import type { NotificationPayload } from '../../src/services/notifications/types';
import { WebhookProvider } from '../../src/services/notifications/providers/webhook';

/**
 * What the generic webhook provider writes to the log (issue #272).
 *
 * Its URL and its headers are both credentials: the URL commonly carries a
 * token in its path or query, and the headers usually carry an `Authorization`
 * value. The log goes to `logs/backend.log` and the `system_logs` table, and
 * `scrubber.ts` only redacts URL credentials out of an Error -- not arbitrary
 * secret text, and not a credential interpolated into a message.
 */

const post = axios.post as unknown as ReturnType<typeof vi.fn>;

const payload: NotificationPayload = {
  productName: 'Acceptance Product',
  productUrl: 'https://shop.example.com/p/1',
  type: 'back_in_stock',
  productId: 1,
};

const SECRET_URL = 'https://hooks.example.com/services/T000/B000/SECRET-webhook-token';

function loggedText(): string {
  return [...logger.info.mock.calls, ...logger.error.mock.calls, ...logger.warn.mock.calls]
    .flat()
    .map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}\n${arg.stack ?? ''}` : String(arg)))
    .join('\n');
}

beforeEach(() => {
  vi.clearAllMocks();
  post.mockResolvedValue({ status: 200, data: {} });
});

describe('the webhook provider does not log its credentials', () => {
  it('does not name the endpoint URL on a successful send', async () => {
    expect(await new WebhookProvider(SECRET_URL).send(payload)).toBe(true);

    const logged = loggedText();
    expect(logged).toContain('Notify | Webhook | Sent');
    expect(logged).not.toContain(SECRET_URL);
    expect(logged).not.toContain('SECRET-webhook-token');
  });

  it('names the parse failure rather than quoting the headers', async () => {
    // A JSON.parse message quotes a window of the input, so an unquoted header
    // value used to put part of the credential into the log.
    const headers = '{"Authorization": Bearer SECRET-header-token}';
    expect(await new WebhookProvider(SECRET_URL, headers).send(payload)).toBe(false);
    expect(post).not.toHaveBeenCalled();

    const logged = loggedText();
    expect(logged).toContain('Headers are not a valid JSON object');
    expect(logged).toContain('SyntaxError');
    expect(logged).not.toContain('SECRET-header-token');
    expect(logged).not.toContain('Bearer');
  });

  it('names the parse failure rather than quoting the payload template', async () => {
    // The template carries interpolated values, which come from scraped
    // retailer text.
    expect(await new WebhookProvider(SECRET_URL, null, '{"title": {{product_name}}').send(payload)).toBe(false);

    const logged = loggedText();
    expect(logged).toContain('Payload template is not valid JSON');
    expect(logged).toContain('SyntaxError');
    expect(logged).not.toContain('Acceptance Product');
  });

  it('still reports a headers document that is JSON but not an object', async () => {
    expect(await new WebhookProvider(SECRET_URL, '[1, 2]').send(payload)).toBe(false);
    expect(loggedText()).toContain('Headers are not a valid JSON object');
  });

  it('does not leak the URL through the failure path either', async () => {
    post.mockRejectedValueOnce(new Error('Request failed with status code 401'));
    expect(await new WebhookProvider(SECRET_URL).send(payload)).toBe(false);
    expect(loggedText()).not.toContain('SECRET-webhook-token');
  });
});
