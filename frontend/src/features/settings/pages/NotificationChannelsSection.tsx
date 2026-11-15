import { useState, useEffect } from 'react';
import { ProfileService } from '../services/ProfileService';
import { useToast } from '../../../context/ToastContext';
import LoadingSpinner from '../../../components/LoadingSpinner';
import NotificationChannelCard from '../components/NotificationChannelCard';
import SecretField from '../components/SecretField';
import { queryClient } from '../../../api/queryClient';
import { notificationSettingsQuery, queryKeys } from '../../../api/queries';
import { NotificationSettings } from '../../../types/api';
import { useExpandedSections } from '../../../hooks';
import { webhookHeadersProblem, webhookTemplateFormat, webhookTemplateProblem } from '../webhookJson';
import {
  CLEAR_SECRET,
  clearedNotificationSecretInputs,
  notificationSecretFlags,
  notificationSecretUpdates,
  secretDraftText,
} from '../notificationSecrets';

/*
 * Shown as placeholder text, not prefilled into the fields (issue #92).
 *
 * These used to be the fields' initial values, so a user who opened this page
 * and pressed Save -- without ever intending to write a template -- stored
 * "{{product_name}} has dropped to {{current_price}}!" and received that
 * sentence for every event thereafter, including a product coming back in
 * stock and a product going missing.
 *
 * Left empty, the backend picks wording that matches the event. A template the
 * user actually types still wins, always: the variables to make one
 * event-aware are listed under the field.
 */
const EMAIL_SUBJECT_PLACEHOLDER = 'Leave empty for wording that matches each event';
const EMAIL_BODY_PLACEHOLDER = 'Leave empty for wording that matches each event, or write your own:\n\n{{product_name}}\n{{type}}: {{price}}\n{{product_url}}';
const WEBHOOK_HEADERS_PLACEHOLDER = '{"Authorization": "Bearer ..."}';
const WEBHOOK_TEMPLATE_PLACEHOLDER = '{"title": "{{product_name}}", "body": "{{type}}: {{price}}", "url": "{{product_url}}"}';

interface ChannelSettings {
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_enabled: boolean;
  telegram_message_template: string;
  discord_webhook_url: string;
  discord_enabled: boolean;
  discord_message_template: string;
  pushover_user_key: string;
  pushover_app_token: string;
  pushover_enabled: boolean;
  pushover_message_template: string;
  ntfy_server_url: string;
  ntfy_topic: string;
  ntfy_password: string;
  ntfy_enabled: boolean;
  ntfy_message_template: string;
  gotify_url: string;
  gotify_app_token: string;
  gotify_enabled: boolean;
  gotify_message_template: string;
  apprise_url: string;
  apprise_config_key: string;
  apprise_urls: string;
  apprise_tag: string;
  apprise_enabled: boolean;
  apprise_message_template: string;
  email_enabled: boolean;
  email_to: string;
  email_subject_template: string;
  email_body_template: string;
  webhook_url: string;
  webhook_headers: string;
  webhook_payload_template: string;
  webhook_enabled: boolean;
}

const channelFields: Record<string, (keyof ChannelSettings)[]> = {
  telegram: ['telegram_bot_token', 'telegram_chat_id', 'telegram_enabled', 'telegram_message_template'],
  discord: ['discord_webhook_url', 'discord_enabled', 'discord_message_template'],
  pushover: ['pushover_user_key', 'pushover_app_token', 'pushover_enabled', 'pushover_message_template'],
  ntfy: ['ntfy_server_url', 'ntfy_topic', 'ntfy_password', 'ntfy_enabled', 'ntfy_message_template'],
  gotify: ['gotify_url', 'gotify_app_token', 'gotify_enabled', 'gotify_message_template'],
  apprise: ['apprise_url', 'apprise_config_key', 'apprise_urls', 'apprise_tag', 'apprise_enabled', 'apprise_message_template'],
  email: ['email_enabled', 'email_to', 'email_subject_template', 'email_body_template'],
  webhook: ['webhook_url', 'webhook_headers', 'webhook_payload_template', 'webhook_enabled'],
};

export default function NotificationChannelsSection() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  const [savedSettings, setSavedSettings] = useState<ChannelSettings | null>(null);
  const [draftSettings, setDraftSettings] = useState<ChannelSettings>({
    telegram_bot_token: '', telegram_chat_id: '', telegram_enabled: false, telegram_message_template: '',
    discord_webhook_url: '', discord_enabled: false, discord_message_template: '',
    pushover_user_key: '', pushover_app_token: '', pushover_enabled: false, pushover_message_template: '',
    ntfy_server_url: '', ntfy_topic: '', ntfy_password: '', ntfy_enabled: false, ntfy_message_template: '',
    gotify_url: '', gotify_app_token: '', gotify_enabled: false, gotify_message_template: '',
    apprise_url: '', apprise_config_key: '', apprise_urls: '', apprise_tag: '', apprise_enabled: false, apprise_message_template: '',
    email_enabled: false, email_to: '', email_subject_template: '', email_body_template: '',
    webhook_url: '', webhook_headers: '', webhook_payload_template: '', webhook_enabled: false
  });

  /*
   * Which credentials the API reports stored. They are never returned, so this
   * is all the form knows about them, and the inputs above stay empty until the
   * user types a replacement (issue #272).
   */
  const [secretFlags, setSecretFlags] = useState(notificationSecretFlags(null));

  /*
   * Whether the *stored* webhook headers make the payload template plain text.
   * They are a credential and are not returned, so the server derives this from
   * them; undefined means the answer never arrived and the template is not
   * checked at all (issues #268, #272).
   */
  const [storedWebhookPlainText, setStoredWebhookPlainText] = useState<boolean | undefined>(undefined);

  const { expandedSections, toggleSection } = useExpandedSections({
    telegram: false, discord: false, pushover: false, ntfy: false, gotify: false, apprise: false, email: false, webhook: false
  });

  const isChannelDirty = (id: string): boolean => {
    if (!savedSettings) return false;
    const fields = channelFields[id];
    if (!fields) return false;
    return fields.some(field => draftSettings[field] !== savedSettings[field]);
  };

  const isDirty = savedSettings ? Object.keys(channelFields).some(id => isChannelDirty(id)) : false;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await queryClient.fetchQuery(notificationSettingsQuery());
      const s = res;
      const initial: ChannelSettings = {
        telegram_bot_token: s.telegram_bot_token || '',
        telegram_chat_id: s.telegram_chat_id || '',
        telegram_enabled: !!s.telegram_enabled,
        telegram_message_template: s.telegram_message_template || '',
        discord_webhook_url: s.discord_webhook_url || '',
        discord_enabled: !!s.discord_enabled,
        discord_message_template: s.discord_message_template || '',
        pushover_user_key: s.pushover_user_key || '',
        pushover_app_token: s.pushover_app_token || '',
        pushover_enabled: !!s.pushover_enabled,
        pushover_message_template: s.pushover_message_template || '',
        ntfy_server_url: s.ntfy_server_url || '',
        ntfy_topic: s.ntfy_topic || '',
        ntfy_password: s.ntfy_password || '',
        ntfy_enabled: !!s.ntfy_enabled,
        ntfy_message_template: s.ntfy_message_template || '',
        gotify_url: s.gotify_url || '',
        gotify_app_token: s.gotify_app_token || '',
        gotify_enabled: !!s.gotify_enabled,
        gotify_message_template: s.gotify_message_template || '',
        apprise_url: s.apprise_url || '',
        apprise_config_key: s.apprise_config_key || '',
        apprise_urls: s.apprise_urls || '',
        apprise_tag: s.apprise_tag || '',
        apprise_enabled: !!s.apprise_enabled,
        apprise_message_template: s.apprise_message_template || '',
        email_enabled: !!s.email_enabled,
        email_to: s.email_to || '',
        email_subject_template: s.email_subject_template || '',
        email_body_template: s.email_body_template || '',
        webhook_url: s.webhook_url || '',
        webhook_headers: s.webhook_headers || '',
        webhook_payload_template: s.webhook_payload_template || '',
        webhook_enabled: !!s.webhook_enabled
      };
      setDraftSettings(initial);
      setSavedSettings(initial);
      setSecretFlags(notificationSecretFlags(s));
      setStoredWebhookPlainText(typeof s.webhook_sends_plain_text === 'boolean' ? s.webhook_sends_plain_text : undefined);
    } catch { 
      showToast('Failed to load notification settings', 'error'); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleUpdateField = <K extends keyof ChannelSettings>(field: K, value: ChannelSettings[K]) => {
    setDraftSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // The credential fields go through notificationSecretUpdates, so an
      // untouched one is omitted rather than sent as the blank the form was
      // handed in place of the secret (issue #272).
      const updated = await ProfileService.updateNotificationSettings({
        ...draftSettings,
        ...notificationSecretUpdates(draftSettings),
      });
      queryClient.setQueryData<NotificationSettings>(queryKeys.notificationSettings, updated);
      // What was typed is stored now, so the inputs go back to empty: keeping a
      // credential on screen would re-send it on the next save and undo the
      // point of the API withholding it.
      const persisted = { ...draftSettings, ...clearedNotificationSecretInputs() };
      setDraftSettings(persisted);
      setSavedSettings(persisted);
      setSecretFlags(notificationSecretFlags(updated));
      setStoredWebhookPlainText(
        typeof updated?.webhook_sends_plain_text === 'boolean' ? updated.webhook_sends_plain_text : undefined
      );
      showToast('Notification settings saved', 'success');
    } catch { 
      showToast('Save failed', 'error'); 
    } finally { 
      setIsSaving(false); 
    }
  };


  const handleTest = async (type: string) => {
    setIsTesting(type);
    try {
      if (type === 'telegram') await ProfileService.testTelegram();
      else if (type === 'discord') await ProfileService.testDiscord();
      else if (type === 'pushover') await ProfileService.testPushover();
      else if (type === 'ntfy') await ProfileService.testNtfy();
      else if (type === 'gotify') await ProfileService.testGotify();
      else if (type === 'apprise') await ProfileService.testApprise();
      else if (type === 'webhook') await ProfileService.testWebhook();
      else if (type === 'email') await ProfileService.testEmail();
      showToast('Test notification sent!', 'success');
    } catch { 
      showToast('Test failed', 'error'); 
    } finally { 
      setIsTesting(null); 
    }
  };

  const renderTemplateHelp = () => (
    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--background)', borderRadius: '0.25rem' }}>
      <strong>Available Tags:</strong> <code>{"{{product_name}}"}</code>, <code>{"{{product_url}}"}</code>, <code>{"{{old_price}}"}</code>, <code>{"{{current_price}}"}</code>, <code>{"{{price}}"}</code>, <code>{"{{currency}}"}</code>, <code>{"{{product_id}}"}</code>, <code>{"{{type}}"}</code>, <code>{"{{old_stock_status}}"}</code>, <code>{"{{new_stock_status}}"}</code>, <code>{"{{reason}}"}</code>
      <div style={{ marginTop: '0.375rem' }}>
        One template covers every event, so wording it around a price drop will read
        oddly on a back-in-stock or unavailable alert. Use <code>{"{{type}}"}</code> and{' '}
        <code>{"{{new_stock_status}}"}</code> to describe what happened, or leave the field
        empty to get wording chosen per event.
      </div>
    </div>
  );

  if (isLoading) return <LoadingSpinner centered />;

  // Headers marked for removal hold nothing, so they are read as empty here --
  // and the stored format no longer applies either, because a webhook with no
  // headers sends the default JSON Content-Type.
  const webhookHeadersText = secretDraftText(draftSettings.webhook_headers);
  const webhookHeadersCleared = draftSettings.webhook_headers === CLEAR_SECRET;
  const templateFormat = webhookHeadersCleared
    ? 'json'
    : webhookTemplateFormat(webhookHeadersText, storedWebhookPlainText);
  const headersProblem = webhookHeadersProblem(webhookHeadersText);
  const templateProblem = webhookTemplateProblem(draftSettings.webhook_payload_template, templateFormat);
  // The backend sends nothing for headers or a template it cannot read, so
  // saving one would silently turn the webhook off.
  //
  // It only blocks Save while the webhook card itself is dirty, though. The
  // page has a single Save for every channel, and a problem in a webhook the
  // user has not touched -- a stored template the server's format hint did not
  // arrive for, say -- must not stop them saving a Telegram change.
  const hasWebhookProblem = headersProblem !== null || templateProblem !== null;
  const webhookBlocksSave = hasWebhookProblem && isChannelDirty('webhook');

  return (
    <div className="settings-card">
      <h2 className="settings-card-title">Notification Channels</h2>
      <p className="settings-card-description">
        Configure where you want to receive price drop and stock alerts.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100%, 1fr))', gap: '1rem' }}>
        <NotificationChannelCard 
          title="Telegram Bot" 
          id="telegram" 
          enabled={draftSettings.telegram_enabled}
          onToggle={() => handleUpdateField('telegram_enabled', !draftSettings.telegram_enabled)}
          onTest={() => handleTest('telegram')}
          isTesting={isTesting === 'telegram'}
          isExpanded={expandedSections.telegram}
          onToggleSection={toggleSection}
          isDirty={isChannelDirty('telegram')}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}><strong>Tip:</strong> Start a conversation with your bot (<code>/start</code>) to authorize messages.</p>
          <SecretField id="telegram-bot-token" label="Bot Token" isSet={secretFlags.telegram_bot_token} value={draftSettings.telegram_bot_token} onChange={value => handleUpdateField('telegram_bot_token', value)} placeholder="123456:ABC-DEF..." />
          <div className="form-group">
            <label>Chat ID</label>
            <input type="text" className="form-control" value={draftSettings.telegram_chat_id} onChange={e => handleUpdateField('telegram_chat_id', e.target.value)} placeholder="e.g. 987654321" />
          </div>
          <div className="form-group">
            <label>Message Template</label>
            <textarea className="form-control" style={{ height: '80px', fontSize: '0.8rem' }} value={draftSettings.telegram_message_template} onChange={e => handleUpdateField('telegram_message_template', e.target.value)} placeholder="Optional custom template..." />
            {renderTemplateHelp()}
          </div>
        </NotificationChannelCard>

        <NotificationChannelCard 
          title="Discord Webhook" 
          id="discord" 
          enabled={draftSettings.discord_enabled}
          onToggle={() => handleUpdateField('discord_enabled', !draftSettings.discord_enabled)}
          onTest={() => handleTest('discord')}
          isTesting={isTesting === 'discord'}
          isExpanded={expandedSections.discord}
          onToggleSection={toggleSection}
          isDirty={isChannelDirty('discord')}
        >
          <SecretField id="discord-webhook-url" label="Webhook URL" isSet={secretFlags.discord_webhook_url} value={draftSettings.discord_webhook_url} onChange={value => handleUpdateField('discord_webhook_url', value)} placeholder="https://discord.com/api/webhooks/..." />
          <div className="form-group">
            <label>Message Template</label>
            <textarea className="form-control" style={{ height: '80px', fontSize: '0.8rem' }} value={draftSettings.discord_message_template} onChange={e => handleUpdateField('discord_message_template', e.target.value)} placeholder="Optional custom template..." />
            {renderTemplateHelp()}
          </div>
        </NotificationChannelCard>

        <NotificationChannelCard 
          title="Pushover" 
          id="pushover" 
          enabled={draftSettings.pushover_enabled}
          onToggle={() => handleUpdateField('pushover_enabled', !draftSettings.pushover_enabled)}
          onTest={() => handleTest('pushover')}
          isTesting={isTesting === 'pushover'}
          isExpanded={expandedSections.pushover}
          onToggleSection={toggleSection}
          isDirty={isChannelDirty('pushover')}
        >
          <SecretField id="pushover-user-key" label="User Key" isSet={secretFlags.pushover_user_key} value={draftSettings.pushover_user_key} onChange={value => handleUpdateField('pushover_user_key', value)} placeholder="u..." />
          <SecretField id="pushover-app-token" label="App API Token" isSet={secretFlags.pushover_app_token} value={draftSettings.pushover_app_token} onChange={value => handleUpdateField('pushover_app_token', value)} placeholder="a..." />
          <div className="form-group">
            <label>Message Template</label>
            <textarea className="form-control" style={{ height: '80px', fontSize: '0.8rem' }} value={draftSettings.pushover_message_template} onChange={e => handleUpdateField('pushover_message_template', e.target.value)} placeholder="Optional custom template..." />
            {renderTemplateHelp()}
          </div>
        </NotificationChannelCard>

        <NotificationChannelCard 
          title="ntfy.sh" 
          id="ntfy" 
          enabled={draftSettings.ntfy_enabled}
          onToggle={() => handleUpdateField('ntfy_enabled', !draftSettings.ntfy_enabled)}
          onTest={() => handleTest('ntfy')}
          isTesting={isTesting === 'ntfy'}
          isExpanded={expandedSections.ntfy}
          onToggleSection={toggleSection}
          isDirty={isChannelDirty('ntfy')}
        >
          <div className="form-group">
            <label>Server URL</label>
            <input type="text" className="form-control" value={draftSettings.ntfy_server_url} onChange={e => handleUpdateField('ntfy_server_url', e.target.value)} placeholder="https://ntfy.sh (default)" />
          </div>
          <div className="form-group">
            <label>Topic</label>
            <input type="text" className="form-control" value={draftSettings.ntfy_topic} onChange={e => handleUpdateField('ntfy_topic', e.target.value)} placeholder="my_secret_topic" />
          </div>
          <SecretField id="ntfy-access-token" label="Access Token (Optional)" isSet={secretFlags.ntfy_password} value={draftSettings.ntfy_password} onChange={value => handleUpdateField('ntfy_password', value)} placeholder="tk_..." />
          <div className="form-group">
            <label>Message Template</label>
            <textarea className="form-control" style={{ height: '80px', fontSize: '0.8rem' }} value={draftSettings.ntfy_message_template} onChange={e => handleUpdateField('ntfy_message_template', e.target.value)} placeholder="Optional custom template..." />
            {renderTemplateHelp()}
          </div>
        </NotificationChannelCard>

        <NotificationChannelCard 
          title="Gotify" 
          id="gotify" 
          enabled={draftSettings.gotify_enabled}
          onToggle={() => handleUpdateField('gotify_enabled', !draftSettings.gotify_enabled)}
          onTest={() => handleTest('gotify')}
          isTesting={isTesting === 'gotify'}
          isExpanded={expandedSections.gotify}
          onToggleSection={toggleSection}
          isDirty={isChannelDirty('gotify')}
        >
          <div className="form-group">
            <label>Server URL</label>
            <input type="text" className="form-control" value={draftSettings.gotify_url} onChange={e => handleUpdateField('gotify_url', e.target.value)} placeholder="https://gotify.example.com" />
          </div>
          <SecretField id="gotify-app-token" label="App Token" isSet={secretFlags.gotify_app_token} value={draftSettings.gotify_app_token} onChange={value => handleUpdateField('gotify_app_token', value)} placeholder="A..." />
          <div className="form-group">
            <label>Message Template</label>
            <textarea className="form-control" style={{ height: '80px', fontSize: '0.8rem' }} value={draftSettings.gotify_message_template} onChange={e => handleUpdateField('gotify_message_template', e.target.value)} placeholder="Optional custom template..." />
            {renderTemplateHelp()}
          </div>
        </NotificationChannelCard>

        <NotificationChannelCard
          title="Apprise"
          id="apprise"
          enabled={draftSettings.apprise_enabled}
          onToggle={() => handleUpdateField('apprise_enabled', !draftSettings.apprise_enabled)}
          onTest={() => handleTest('apprise')}
          isTesting={isTesting === 'apprise'}
          isExpanded={expandedSections.apprise}
          onToggleSection={toggleSection}
          isDirty={isChannelDirty('apprise')}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Sends through an <a href="https://github.com/caronc/apprise-api" target="_blank" rel="noopener noreferrer">apprise-api</a> server,
            which reaches any service Apprise supports. Set a config key to use a stored configuration, or leave it empty and list Apprise URLs.
          </p>
          <div className="form-group">
            <label htmlFor="apprise-url">Server URL</label>
            <input id="apprise-url" type="text" className="form-control" value={draftSettings.apprise_url} onChange={e => handleUpdateField('apprise_url', e.target.value)} placeholder="http://apprise:8000" />
          </div>
          <SecretField id="apprise-config-key" label="Config Key" isSet={secretFlags.apprise_config_key} value={draftSettings.apprise_config_key} onChange={value => handleUpdateField('apprise_config_key', value)} placeholder="e.g. homelab">
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Posts to <code>/notify/&lt;key&gt;</code>. Leave empty for stateless mode. apprise-api has no authentication of its own, and this key also reads the stored configuration back, so it is treated as a credential.</span>
          </SecretField>
          <SecretField id="apprise-urls" label="Apprise URLs" isSet={secretFlags.apprise_urls} value={draftSettings.apprise_urls} onChange={value => handleUpdateField('apprise_urls', value)} placeholder="ntfys://topic, tgram://bot/chat">
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Stateless mode only: used when there is no config key. Separate several with commas or spaces.</span>
          </SecretField>
          <div className="form-group">
            <label htmlFor="apprise-tag">Tag</label>
            <input id="apprise-tag" type="text" className="form-control" value={draftSettings.apprise_tag} onChange={e => handleUpdateField('apprise_tag', e.target.value)} placeholder="Optional, e.g. deals" />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Routes the alert to the services carrying this tag within a stored config. Ignored in stateless mode.</span>
          </div>
          <div className="form-group">
            <label>Message Template</label>
            <textarea className="form-control" style={{ height: '80px', fontSize: '0.8rem' }} value={draftSettings.apprise_message_template} onChange={e => handleUpdateField('apprise_message_template', e.target.value)} placeholder="Optional custom template..." />
            {renderTemplateHelp()}
          </div>
        </NotificationChannelCard>

        <NotificationChannelCard
          title="Email Alerts"
          id="email" 
          enabled={draftSettings.email_enabled}
          onToggle={() => handleUpdateField('email_enabled', !draftSettings.email_enabled)}
          onTest={() => handleTest('email')}
          isTesting={isTesting === 'email'}
          isExpanded={expandedSections.email}
          onToggleSection={toggleSection}
          isDirty={isChannelDirty('email')}
        >
          <div className="form-group">
            <label>Recipient Address</label>
            <input type="email" className="form-control" value={draftSettings.email_to} onChange={e => handleUpdateField('email_to', e.target.value)} placeholder="you@example.com" />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>If empty, your profile email will be used.</span>
          </div>
          <div className="form-group">
            <label>Subject Template</label>
            <input type="text" className="form-control" value={draftSettings.email_subject_template} onChange={e => handleUpdateField('email_subject_template', e.target.value)} placeholder={EMAIL_SUBJECT_PLACEHOLDER} />
          </div>
          <div className="form-group">
            <label>Body Template</label>
            <textarea className="form-control" style={{ height: '120px', fontSize: '0.8rem' }} value={draftSettings.email_body_template} onChange={e => handleUpdateField('email_body_template', e.target.value)} placeholder={EMAIL_BODY_PLACEHOLDER} />
            {renderTemplateHelp()}
          </div>
        </NotificationChannelCard>

        <NotificationChannelCard 
          title="Generic Webhook" 
          id="webhook" 
          enabled={draftSettings.webhook_enabled}
          onToggle={() => handleUpdateField('webhook_enabled', !draftSettings.webhook_enabled)}
          onTest={() => handleTest('webhook')}
          isTesting={isTesting === 'webhook'}
          isExpanded={expandedSections.webhook}
          onToggleSection={toggleSection}
          isDirty={isChannelDirty('webhook')}
        >
          <SecretField id="webhook-endpoint-url" label="Endpoint URL (POST)" isSet={secretFlags.webhook_url} value={draftSettings.webhook_url} onChange={value => handleUpdateField('webhook_url', value)} placeholder="https://api.example.com/alerts" />
          <SecretField multiline id="webhook-headers" label="Headers" isSet={secretFlags.webhook_headers} value={draftSettings.webhook_headers} onChange={value => handleUpdateField('webhook_headers', value)} placeholder={WEBHOOK_HEADERS_PLACEHOLDER}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Optional, as a JSON object. <code>Content-Type: application/json</code> is sent by default. Headers usually carry an <code>Authorization</code> value, so they are treated as a credential: typing here replaces the whole document.</span>
            {headersProblem && <span role="alert" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--danger)' }}>Fix before saving: {headersProblem}</span>}
          </SecretField>
          <div className="form-group">
            <label htmlFor="webhook-payload-template">Payload Template{templateFormat === 'unknown' ? '' : templateFormat === 'plain-text' ? ' (plain text)' : ' (JSON)'}</label>
            <textarea id="webhook-payload-template" className="form-control" style={{ height: '120px', fontSize: '0.8rem', fontFamily: 'monospace' }} value={draftSettings.webhook_payload_template} onChange={e => handleUpdateField('webhook_payload_template', e.target.value)} placeholder={WEBHOOK_TEMPLATE_PLACEHOLDER} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Leave empty to send the standard JSON payload with product details. Values are escaped for you, so keep every variable inside quotes: <code>{'"{{product_name}}"'}</code>. To send plain text instead, set a non-JSON <code>Content-Type</code> header (e.g. <code>{'{"Content-Type": "text/plain"}'}</code>) and write the template as text.</span>
            {templateProblem && <span role="alert" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--danger)' }}>Fix before saving: {templateProblem}</span>}
            {renderTemplateHelp()}
          </div>
        </NotificationChannelCard>
      </div>

      <div className="settings-actions">
        {webhookBlocksSave && <span role="alert" style={{ fontSize: '0.75rem', color: 'var(--danger)', marginRight: 'auto' }}>Fix the Generic Webhook fields to save.</span>}
        <button type="button" className="btn btn-secondary" onClick={() => savedSettings && setDraftSettings(savedSettings)} disabled={!isDirty || isSaving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isDirty || isSaving || webhookBlocksSave}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
