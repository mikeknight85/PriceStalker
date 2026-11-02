import { describe, it, expect } from 'vitest';
import { NotificationSettings } from '../../types/api';
import {
  CLEAR_SECRET,
  NOTIFICATION_SECRET_FIELDS,
  clearedNotificationSecretInputs,
  notificationSecretFlags,
  notificationSecretUpdates,
  secretDraftText,
} from './notificationSecrets';

/**
 * What the settings form sends for a credential it was never given (#272).
 *
 * The form loads every field into a draft and PUTs the whole draft, so this is
 * the one boundary between "the box is empty because the API withheld the
 * value" and "the box is empty because I want the credential gone". Getting it
 * wrong detaches every configured channel on the first save.
 */

/** A draft with every credential input empty, as a freshly loaded form has. */
function emptyDraft() {
  return clearedNotificationSecretInputs();
}

describe('notificationSecretUpdates', () => {
  it.each(NOTIFICATION_SECRET_FIELDS)('omits %s while its input is empty', (field) => {
    const updates = notificationSecretUpdates(emptyDraft());
    expect(updates[field]).toBeUndefined();
    // Explicitly undefined, not null: JSON.stringify drops the key, and the
    // backend reads an absent field as "leave what is stored".
    expect(JSON.stringify(updates)).not.toContain(field);
  });

  it.each(NOTIFICATION_SECRET_FIELDS)('sends a typed replacement for %s', (field) => {
    const updates = notificationSecretUpdates({ ...emptyDraft(), [field]: 'a-new-credential' });
    expect(updates[field]).toBe('a-new-credential');
  });

  it.each(NOTIFICATION_SECRET_FIELDS)('sends null to remove %s', (field) => {
    const updates = notificationSecretUpdates({ ...emptyDraft(), [field]: CLEAR_SECRET });
    expect(updates[field]).toBeNull();
  });

  it('never lets the clear marker reach the request body', () => {
    // It is a draft-only sentinel. Stored verbatim it would be a credential
    // that cannot work and does not look broken.
    const draft = emptyDraft();
    for (const field of NOTIFICATION_SECRET_FIELDS) draft[field] = CLEAR_SECRET;

    const updates = notificationSecretUpdates(draft);
    expect(JSON.stringify(updates)).not.toContain('clear-stored-credential');
    for (const field of NOTIFICATION_SECRET_FIELDS) {
      expect(updates[field]).toBeNull();
    }
  });

  it('leaves every field it does not own alone', () => {
    const payload = {
      ...emptyDraft(),
      telegram_chat_id: '',
      ntfy_topic: 'deals',
      ...notificationSecretUpdates(emptyDraft()),
    };

    // An empty chat id still means "clear the chat id". Only the credentials
    // read empty as "unchanged", and only because their value is withheld.
    expect(payload.telegram_chat_id).toBe('');
    expect(payload.ntfy_topic).toBe('deals');
  });
});

describe('the fields the form treats as secret', () => {
  it('covers every field the backend withholds', () => {
    // A field the backend withholds and this list omits renders as an empty box
    // with no "(set)" marker and no way to clear it: a field that actively lies
    // about its state. Mirrors NOTIFICATION_CREDENTIALS on the backend.
    expect([...NOTIFICATION_SECRET_FIELDS].sort()).toEqual([
      'apprise_config_key',
      'apprise_urls',
      'discord_webhook_url',
      'gotify_app_token',
      'ntfy_password',
      'pushover_app_token',
      'pushover_user_key',
      'telegram_bot_token',
      'webhook_headers',
      'webhook_url',
    ]);
  });
});

describe('notificationSecretFlags', () => {
  it('reads has_<field> off the response', () => {
    const flags = notificationSecretFlags({
      has_telegram_bot_token: true,
      has_webhook_url: false,
    } as Partial<NotificationSettings>);

    expect(flags.telegram_bot_token).toBe(true);
    expect(flags.webhook_url).toBe(false);
  });

  it('reads an answer with no flags at all as nothing configured', () => {
    // The e2e suite answers unmocked endpoints with `{}`, and so does a
    // misconfigured proxy. Every field then renders as a new one rather than
    // throwing on a missing property.
    for (const settings of [null, undefined, {} as Partial<NotificationSettings>]) {
      const flags = notificationSecretFlags(settings);
      for (const field of NOTIFICATION_SECRET_FIELDS) {
        expect(flags[field]).toBe(false);
      }
    }
  });

  it('does not take a truthy non-boolean for a configured credential', () => {
    const flags = notificationSecretFlags(
      { has_telegram_bot_token: 'yes' } as unknown as Partial<NotificationSettings>
    );
    expect(flags.telegram_bot_token).toBe(false);
  });
});

describe('secretDraftText', () => {
  it('reads a field marked for clearing as holding nothing', () => {
    // The webhook's headers are a credential *and* a document the page
    // validates. Handing the marker to that validator reported it as broken
    // JSON and blocked Save on a deliberate action.
    expect(secretDraftText(CLEAR_SECRET)).toBe('');
    expect(() => JSON.parse(secretDraftText(CLEAR_SECRET) || '{}')).not.toThrow();
  });

  it('leaves anything the user typed alone', () => {
    expect(secretDraftText('')).toBe('');
    expect(secretDraftText('{"Accept": "*/*"}')).toBe('{"Accept": "*/*"}');
  });
});

describe('clearedNotificationSecretInputs', () => {
  it('empties every credential input', () => {
    const inputs = clearedNotificationSecretInputs();
    expect(Object.keys(inputs).sort()).toEqual([...NOTIFICATION_SECRET_FIELDS].sort());
    for (const field of NOTIFICATION_SECRET_FIELDS) {
      expect(inputs[field]).toBe('');
    }
  });
});
