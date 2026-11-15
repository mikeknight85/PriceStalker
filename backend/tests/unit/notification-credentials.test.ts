import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { NotificationSettings } from '../../src/models/types';
import { maskSecret } from '../../src/utils/system/masking';
import {
  NOTIFICATION_CREDENTIALS,
  assertNoMaskedCredentials,
  credentialIntent,
  isNotificationCredentialField,
  pickNotificationUpdates,
  resolveCredentialUpdates,
  toNotificationSettingsView,
} from '../../src/services/domain/user/notification-credentials';
import { userSettingsRepository } from '../../src/services/domain/user/repositories/user-settings.repository';
import {
  resolveWebhookHeaders,
  webhookSendsPlainText,
} from '../../src/services/notifications/webhook-headers';

/**
 * Notification channel credentials are write-only over the API (issue #272).
 *
 * `GET /api/settings/notifications` used to answer with every channel's
 * credential in plaintext, and the settings form read them back and PUT the
 * whole object. Two things therefore have to hold at once, and they pull
 * against each other:
 *
 * - no credential value may leave the server, for any channel, ever;
 * - a form that was handed no credential must not overwrite one with the blank
 *   it was given instead.
 *
 * The second is the part that silently destroys data, so most of what follows
 * is about the write path.
 */

const getNotificationSettings = vi.fn();
const updateNotificationSettings = vi.fn();

vi.mock('../../src/models', () => ({
  userRepository: {
    getNotificationSettings: (...args: unknown[]) => getNotificationSettings(...args),
    updateNotificationSettings: (...args: unknown[]) => updateNotificationSettings(...args),
  },
}));

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock('../../src/utils/system/logger', () => ({ logger }));

const sendTestNotification = vi.fn();
const testGotifyConnection = vi.fn();
vi.mock('../../src/services/notifications/index', () => ({
  sendTestNotification: (...args: unknown[]) => sendTestNotification(...args),
  testGotifyConnection: (...args: unknown[]) => testGotifyConnection(...args),
}));

const { NOTIFICATION_FIELDS, default: notificationsRouter } =
  await import('../../src/routes/settings/notifications');
const notificationTestsRouter = (await import('../../src/routes/settings/notification-tests')).default;

const CREDENTIAL_FIELDS = NOTIFICATION_CREDENTIALS.map(credential => credential.field);
const OPAQUE_FIELDS = NOTIFICATION_CREDENTIALS.filter(c => c.opaque).map(c => c.field);

/**
 * A distinct, recognisable value per credential field, derived from the
 * catalogue so a channel added later is covered without touching this.
 */
function storedCredentials(): Record<string, string> {
  return Object.fromEntries(
    CREDENTIAL_FIELDS.map(field => [field, `SECRET-value-for-${field}`])
  );
}

/**
 * Stored settings with every credential populated. `Partial` still checks each
 * field name and type; the widening happens once, here.
 */
function storedSettings(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return {
    telegram_chat_id: '987654321',
    telegram_enabled: true,
    ntfy_topic: 'deals',
    ntfy_username: 'reader',
    gotify_url: 'https://gotify.example',
    smtp_host: 'smtp.example',
    smtp_port: 587,
    email_to: 'me@example.test',
    ...storedCredentials(),
    ...overrides,
  } as NotificationSettings;
}

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as express.Request & { userId?: number }).userId = 7;
  next();
});
app.use('/api/settings/notifications/test', notificationTestsRouter);
app.use('/api/settings/notifications', notificationsRouter);
const server = app.listen(0);
const { port } = server.address() as AddressInfo;

afterAll(() => {
  server.close();
});

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

/** The updates the repository was asked to write on the most recent call. */
function writtenUpdates(): Partial<NotificationSettings> {
  expect(updateNotificationSettings).toHaveBeenCalledTimes(1);
  return updateNotificationSettings.mock.calls[0][1] as Partial<NotificationSettings>;
}

beforeEach(() => {
  vi.clearAllMocks();
  getNotificationSettings.mockResolvedValue(storedSettings());
  updateNotificationSettings.mockImplementation(async (_id: number, updates: Partial<NotificationSettings>) =>
    storedSettings(updates)
  );
});

describe('the credential catalogue', () => {
  /**
   * Fields that look like a credential and deliberately are not. A channel
   * added later has to classify its fields: either in NOTIFICATION_CREDENTIALS,
   * or here with a reason. The test below is what forces the choice, so that a
   * new channel's secret cannot escape masking by nobody noticing.
   */
  const DELIBERATELY_PUBLIC = new Set<string>([
    // The address of a self-hosted server, which carries no authority on its
    // own: both channels keep their credential in a field of its own
    // (`ntfy_password`, `gotify_app_token`). Unlike the Discord and generic
    // webhook URLs, knowing these does not let anyone send anything.
    'ntfy_server_url',
    'gotify_url',
    // The apprise-api base URL. `apprise_config_key` beside it is the
    // credential, and it is classified as one.
    'apprise_url',
  ]);

  /** Names that read as a credential. Deliberately broad. */
  const LOOKS_LIKE_A_CREDENTIAL = /token|password|secret|_key$|_keys$|_url$|_urls$|_headers$/;

  it('classifies every notification field that reads like a credential', () => {
    const unclassified = NOTIFICATION_FIELDS.filter(field =>
      LOOKS_LIKE_A_CREDENTIAL.test(field) &&
      !CREDENTIAL_FIELDS.includes(field) &&
      !DELIBERATELY_PUBLIC.has(field)
    );

    expect(unclassified).toEqual([]);
  });

  it('lists only fields the endpoint actually exposes', () => {
    // A typo here would mask nothing and silently do no harm, which is worse
    // than failing.
    for (const field of CREDENTIAL_FIELDS) {
      expect(NOTIFICATION_FIELDS).toContain(field);
    }
  });

  it('covers every credential-bearing field issue #272 lists', () => {
    for (const field of [
      'telegram_bot_token',
      'discord_webhook_url',
      'pushover_user_key',
      'pushover_app_token',
      'ntfy_password',
      'gotify_app_token',
      'webhook_url',
      'webhook_headers',
    ]) {
      expect(CREDENTIAL_FIELDS).toContain(field);
      expect(isNotificationCredentialField(field as keyof NotificationSettings)).toBe(true);
    }
  });

  it('treats the Apprise config key as a credential, not just the URL list (#271)', () => {
    // apprise-api ships no authentication. The config key is the whole of
    // `POST /notify/<key>` *and* `GET /get/<key>` / `GET /json/urls/<key>`,
    // which read the stored configuration back with every token and password
    // embedded in it -- strictly more than a send-only Gotify token grants.
    expect(isNotificationCredentialField('apprise_config_key')).toBe(true);
    expect(isNotificationCredentialField('apprise_urls')).toBe(true);
    // The server address carries no authority on its own.
    expect(isNotificationCredentialField('apprise_url')).toBe(false);
    expect(isNotificationCredentialField('apprise_tag')).toBe(false);

    // apprise-api restricts keys to [A-Za-z0-9_-], so a mask marker cannot be
    // one; an Apprise URL may legitimately contain an asterisk.
    const byField = new Map(NOTIFICATION_CREDENTIALS.map(c => [c.field, c.opaque]));
    expect(byField.get('apprise_config_key')).toBe(true);
    expect(byField.get('apprise_urls')).toBe(false);
  });

  it('does not treat the fields beside a credential as secret', () => {
    for (const field of ['telegram_chat_id', 'ntfy_topic', 'ntfy_username', 'gotify_url', 'smtp_host', 'email_to']) {
      expect(isNotificationCredentialField(field as keyof NotificationSettings)).toBe(false);
    }
  });
});

describe('GET returns no credential value', () => {
  it('answers has_<field> instead of the value, for every channel', async () => {
    const { status, body } = await call('GET', '/api/settings/notifications');
    expect(status).toBe(200);

    const serialised = JSON.stringify(body);
    for (const [field, secret] of Object.entries(storedCredentials())) {
      expect(serialised).not.toContain(secret);
      expect(body[field]).toBeNull();
      expect(body[`has_${field}`]).toBe(true);
    }
  });

  it('reports a credential that is absent or empty as not set', async () => {
    getNotificationSettings.mockResolvedValue(
      storedSettings({ telegram_bot_token: null, ntfy_password: '' })
    );

    const { body } = await call('GET', '/api/settings/notifications');
    expect(body.has_telegram_bot_token).toBe(false);
    expect(body.has_ntfy_password).toBe(false);
    expect(body.has_gotify_app_token).toBe(true);
  });

  it('still returns the fields that are not credentials', async () => {
    const { body } = await call('GET', '/api/settings/notifications');
    expect(body.telegram_chat_id).toBe('987654321');
    expect(body.ntfy_topic).toBe('deals');
    expect(body.gotify_url).toBe('https://gotify.example');
    expect(body.smtp_port).toBe(587);
  });

  it('keeps the enabled defaults it had before', async () => {
    getNotificationSettings.mockResolvedValue(
      storedSettings({ telegram_enabled: null as unknown as boolean, smtp_port: null as unknown as number })
    );

    const { body } = await call('GET', '/api/settings/notifications');
    expect(body.telegram_enabled).toBe(true);
    expect(body.smtp_port).toBe(25);
  });
});

describe('the derived webhook format hint (#268 regression)', () => {
  /*
   * `webhook_headers` is a credential and is withheld, but
   * `webhook_payload_template` is not and comes back in full. Without a hint
   * the settings page could no longer tell a plain-text webhook from a JSON
   * one, reported a perfectly good text/plain template as broken JSON, and --
   * because the section has one Save for every channel -- stopped the user
   * saving a Telegram change until they emptied the template.
   */

  it('says the template is plain text when the stored headers say so', async () => {
    getNotificationSettings.mockResolvedValue(
      storedSettings({ webhook_headers: '{"Content-Type": "text/plain"}' })
    );

    const { body } = await call('GET', '/api/settings/notifications');
    expect(body.webhook_sends_plain_text).toBe(true);
    // And still says nothing about what is in them.
    expect(body.webhook_headers).toBeNull();
    expect(body.has_webhook_headers).toBe(true);
  });

  it('says JSON for JSON headers, for headers with no Content-Type, and for none at all', async () => {
    for (const headers of [
      '{"Content-Type": "application/json"}',
      '{"Content-Type": "application/vnd.api+json"}',
      '{"Authorization": "Bearer abc"}',
      '',
      null,
    ]) {
      getNotificationSettings.mockResolvedValue(storedSettings({ webhook_headers: headers }));
      const { body } = await call('GET', '/api/settings/notifications');
      expect(body.webhook_sends_plain_text).toBe(false);
    }
  });

  it('reads the Content-Type the way the provider does', async () => {
    // Case-insensitive name, parameters ignored, and a document that cannot be
    // parsed falls back to the JSON default the provider also falls back to.
    const cases: [string, boolean][] = [
      ['{"content-type": "text/plain"}', true],
      ['{"CONTENT-TYPE": "application/x-www-form-urlencoded"}', true],
      ['{"Content-Type": "text/plain; profile=\\"json\\""}', true],
      ['{"Content-Type": "application/problem+json; charset=utf-8"}', false],
      ['{"Content-Type": broken', false],
      ['[1, 2]', false],
    ];

    for (const [headers, expected] of cases) {
      expect(webhookSendsPlainText(headers)).toBe(expected);
      getNotificationSettings.mockResolvedValue(storedSettings({ webhook_headers: headers }));
      const { body } = await call('GET', '/api/settings/notifications');
      expect(body.webhook_sends_plain_text).toBe(expected);
    }
  });

  it('comes back on the PUT response too, so the page does not go blind after a save', async () => {
    const { body } = await call('PUT', '/api/settings/notifications', {
      webhook_headers: '{"Content-Type": "text/plain"}',
    });

    expect(body.webhook_sends_plain_text).toBe(true);
    expect(body.webhook_headers).toBeNull();
  });

  it('is the same rule the provider sends by', () => {
    // One copy, next to the code that acts on it. The provider and the hint
    // disagreeing is what would put the regression back.
    const headers = '{"Content-Type": "text/plain"}';
    expect(resolveWebhookHeaders(headers).sendsJson).toBe(!webhookSendsPlainText(headers));
    expect(resolveWebhookHeaders(null).sendsJson).toBe(true);
    expect(resolveWebhookHeaders('{"content-type": "text/csv"}').headers).toEqual({
      'content-type': 'text/csv',
    });
  });
});

describe('PUT preserves a credential the request did not change', () => {
  it('writes nothing for a credential sent back empty, which is what the form holds', async () => {
    // The form loads every field into a draft and PUTs the whole draft. The
    // credential fields are empty because the API never gave them a value;
    // treating that as "clear" would detach every configured channel on the
    // first save of an unrelated setting.
    const body: Record<string, unknown> = { telegram_chat_id: '123' };
    for (const field of CREDENTIAL_FIELDS) body[field] = '';

    const { status } = await call('PUT', '/api/settings/notifications', body);
    expect(status).toBe(200);

    const written = writtenUpdates();
    for (const field of CREDENTIAL_FIELDS) {
      expect(written).not.toHaveProperty(field);
    }
    expect(written.telegram_chat_id).toBe('123');
  });

  it('writes nothing for a credential the request leaves out', async () => {
    await call('PUT', '/api/settings/notifications', { telegram_chat_id: '123' });

    const written = writtenUpdates();
    for (const field of CREDENTIAL_FIELDS) {
      expect(written).not.toHaveProperty(field);
    }
  });

  it.each(OPAQUE_FIELDS)('writes nothing for a masked placeholder in %s', async (field) => {
    // Nothing masked is emitted any more, so a placeholder can only come from a
    // stale client or a user pasting one off a screenshot. Either way it is not
    // a credential (issues #196, #198).
    const stored = storedCredentials()[field];
    await call('PUT', '/api/settings/notifications', { [field]: maskSecret(stored) });

    expect(updateNotificationSettings).not.toHaveBeenCalled();
  });

  it('reports success and changes nothing when every named field was an untouched credential', async () => {
    const body = Object.fromEntries(CREDENTIAL_FIELDS.map(field => [field, '']));

    const { status, body: response } = await call('PUT', '/api/settings/notifications', body);
    expect(status).toBe(200);
    expect(updateNotificationSettings).not.toHaveBeenCalled();
    expect(response.has_telegram_bot_token).toBe(true);
  });

  it('rejects a body that names no notification field at all', async () => {
    const { status } = await call('PUT', '/api/settings/notifications', { nonsense: 1 });
    expect(status).toBe(400);
    expect(updateNotificationSettings).not.toHaveBeenCalled();
  });
});

describe('PUT changes a credential when the request means to', () => {
  it.each(CREDENTIAL_FIELDS)('stores a new value for %s', async (field) => {
    await call('PUT', '/api/settings/notifications', { [field]: 'a-brand-new-credential' });

    expect(writtenUpdates()[field]).toBe('a-brand-new-credential');
  });

  it.each(CREDENTIAL_FIELDS)('removes %s when the request sends null', async (field) => {
    // Clearing has a value of its own because empty already means "leave it".
    await call('PUT', '/api/settings/notifications', { [field]: null });

    expect(writtenUpdates()[field]).toBeNull();
  });

  it('accepts header JSON containing asterisks as a real value', async () => {
    // `isMaskedSecret` matches any string containing `*`, so a header set that
    // matches anything would be dropped as a placeholder if the marker test
    // were applied to the fields that are not opaque tokens.
    const headers = '{"Accept": "*/*", "Authorization": "Bearer abc"}';
    await call('PUT', '/api/settings/notifications', { webhook_headers: headers });

    expect(writtenUpdates().webhook_headers).toBe(headers);
  });

  it('never echoes the new credential back in the response', async () => {
    const { body } = await call('PUT', '/api/settings/notifications', {
      telegram_bot_token: 'a-brand-new-credential',
    });

    expect(JSON.stringify(body)).not.toContain('a-brand-new-credential');
    expect(body.telegram_bot_token).toBeNull();
    expect(body.has_telegram_bot_token).toBe(true);
  });

  it('logs the names of the fields that changed and none of their values', async () => {
    await call('PUT', '/api/settings/notifications', {
      telegram_bot_token: 'a-brand-new-credential',
      telegram_chat_id: '987654321',
    });

    const logged = logger.info.mock.calls.map(args => String(args[0])).join('\n');
    expect(logged).toContain('telegram_bot_token');
    expect(logged).not.toContain('a-brand-new-credential');
    // Unchanged, so not reported.
    expect(logged).not.toContain('telegram_chat_id');
  });
});

describe('a masked value cannot be persisted', () => {
  it.each(OPAQUE_FIELDS)('is refused by the repository for %s, before any query', async (field) => {
    // The last gate. `resolveCredentialUpdates` already drops a placeholder, so
    // reaching here means a caller bypassed it -- a background job, a script, or
    // the next endpoint someone writes. It throws rather than quietly dropping
    // the field: a channel broken by `abcd...wxyz` in its token has nothing to
    // point at.
    await expect(
      userSettingsRepository.updateNotificationSettings(1, { [field]: 'abcd...wxyz' })
    ).rejects.toThrow(new RegExp(field));

    await expect(
      userSettingsRepository.updateNotificationSettings(1, { [field]: '********' })
    ).rejects.toThrow(new RegExp(field));
  });

  it('names the field and not the value', () => {
    expect(() => assertNoMaskedCredentials({ telegram_bot_token: 'abcd...wxyz' }))
      .toThrow('Refusing to store a masked placeholder in telegram_bot_token');
  });

  it('recognises everything maskSecret can produce', () => {
    // The pair has to stay in step, or a mask resolved correctly on one path is
    // stored verbatim on another -- the bug behind #196/#198.
    for (const length of [1, 4, 7, 8, 9, 40]) {
      const secret = 'k'.repeat(length);
      const masked = maskSecret(secret);
      expect(masked).not.toBeNull();
      expect(() => assertNoMaskedCredentials({ telegram_bot_token: masked })).toThrow();
    }
  });

  it('lets a real credential through', () => {
    expect(() => assertNoMaskedCredentials(storedCredentials())).not.toThrow();
    expect(() => assertNoMaskedCredentials({ telegram_bot_token: '111111:ABC-DEF_ghi' })).not.toThrow();
  });
});

describe('the read-write contract in isolation', () => {
  it('reads the three intents off one field', () => {
    expect(credentialIntent(undefined, true)).toBe('unchanged');
    expect(credentialIntent('', true)).toBe('unchanged');
    expect(credentialIntent('abcd...wxyz', true)).toBe('unchanged');
    expect(credentialIntent(null, true)).toBe('clear');
    expect(credentialIntent('a-real-token', true)).toBe('replace');
    // Not an opaque token: a marker in the value proves nothing.
    expect(credentialIntent('{"Accept": "*/*"}', false)).toBe('replace');
  });

  it('leaves the fields that are not credentials exactly as they arrived', () => {
    const resolved = resolveCredentialUpdates({
      telegram_chat_id: '',
      ntfy_topic: null,
      telegram_enabled: false,
      smtp_port: 25,
    });

    // An empty string still clears a chat id. Only credentials read it as
    // "unchanged", and only because their value is withheld on the way out.
    expect(resolved).toEqual({
      telegram_chat_id: '',
      ntfy_topic: null,
      telegram_enabled: false,
      smtp_port: 25,
    });
  });

  it('does not mutate the request body it is handed', () => {
    const updates = { telegram_bot_token: '', telegram_chat_id: '1' };
    resolveCredentialUpdates(updates);
    expect(updates.telegram_bot_token).toBe('');
  });

  it('takes only the known fields off an untyped body', () => {
    expect(pickNotificationUpdates({ telegram_chat_id: '1', nonsense: 2 }, NOTIFICATION_FIELDS))
      .toEqual({ telegram_chat_id: '1' });
    expect(pickNotificationUpdates(null, NOTIFICATION_FIELDS)).toEqual({});
    expect(pickNotificationUpdates('nonsense', NOTIFICATION_FIELDS)).toEqual({});
  });

  it('withholds a credential from the view even if it is asked for twice', () => {
    const view = toNotificationSettingsView(storedSettings(), [
      ...NOTIFICATION_FIELDS,
      'telegram_bot_token',
    ]);
    expect(view.telegram_bot_token).toBeNull();
    expect(view.has_telegram_bot_token).toBe(true);
  });
});

describe('the test-notification endpoints still have the real credentials', () => {
  it('sends with the stored settings, not anything from the request', async () => {
    sendTestNotification.mockResolvedValue(true);

    const { status } = await call('POST', '/api/settings/notifications/test/telegram', {});
    expect(status).toBe(200);
    expect(sendTestNotification).toHaveBeenCalledWith(
      'telegram',
      expect.objectContaining({ telegram_bot_token: storedCredentials().telegram_bot_token })
    );
  });

  it('does not log the webhook URL, which is itself the credential', async () => {
    sendTestNotification.mockResolvedValue(true);

    await call('POST', '/api/settings/notifications/test/webhook', {});

    const logged = logger.info.mock.calls.map(args => String(args[0])).join('\n');
    expect(logged).toContain('webhook Test');
    expect(logged).not.toContain(storedCredentials().webhook_url);
  });

  it('still names a chat id or a topic, which are not credentials', async () => {
    sendTestNotification.mockResolvedValue(true);

    await call('POST', '/api/settings/notifications/test/ntfy', {});

    const logged = logger.info.mock.calls.map(args => String(args[0])).join('\n');
    expect(logged).toContain('to deals');
  });
});

describe('the Gotify connection test, which takes credentials in the body', () => {
  beforeEach(() => {
    testGotifyConnection.mockResolvedValue({ success: true });
  });

  it('resolves the stored token when the client has none to send', async () => {
    // The client is never given the token any more, so this is the normal case
    // for an already-configured server.
    const { status } = await call('POST', '/api/settings/notifications/test/gotify/connection', {
      url: 'https://gotify.example',
      app_token: '',
    });

    expect(status).toBe(200);
    expect(testGotifyConnection).toHaveBeenCalledWith(
      'https://gotify.example',
      storedCredentials().gotify_app_token
    );
  });

  it('resolves the stored token behind a masked placeholder too', async () => {
    await call('POST', '/api/settings/notifications/test/gotify/connection', {
      url: 'https://gotify.example',
      app_token: maskSecret(storedCredentials().gotify_app_token),
    });

    expect(testGotifyConnection).toHaveBeenCalledWith(
      'https://gotify.example',
      storedCredentials().gotify_app_token
    );
  });

  it('uses the token the user typed in preference to the stored one', async () => {
    await call('POST', '/api/settings/notifications/test/gotify/connection', {
      url: 'https://elsewhere.example',
      app_token: 'A-typed-token',
    });

    expect(testGotifyConnection).toHaveBeenCalledWith('https://elsewhere.example', 'A-typed-token');
  });

  it('does not send the stored token to a server other than the stored one', async () => {
    // Otherwise this endpoint would read a withheld credential back out, by
    // having it delivered to an address of the caller's choosing.
    const { status } = await call('POST', '/api/settings/notifications/test/gotify/connection', {
      url: 'https://attacker.example',
      app_token: '',
    });

    expect(status).toBe(400);
    expect(testGotifyConnection).not.toHaveBeenCalled();
  });

  it('still asks for a URL', async () => {
    const { status } = await call('POST', '/api/settings/notifications/test/gotify/connection', {
      app_token: 'A-typed-token',
    });

    expect(status).toBe(400);
    expect(testGotifyConnection).not.toHaveBeenCalled();
  });
});
