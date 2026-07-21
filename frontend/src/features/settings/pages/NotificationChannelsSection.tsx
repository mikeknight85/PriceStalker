import { useState, useEffect } from 'react';
import { ProfileService } from '../services/ProfileService';
import { useToast } from '../../../context/ToastContext';
import PasswordInput from '../../../components/PasswordInput';
import LoadingSpinner from '../../../components/LoadingSpinner';
import NotificationChannelCard from '../components/NotificationChannelCard';

const DEFAULT_EMAIL_SUBJECT = 'Price Ghost Alert: {{product_name}}';
const DEFAULT_EMAIL_BODY = 'Hi,\n\n{{product_name}} has dropped to {{current_price}}!\n\nView it here: {{product_url}}';

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
  email_enabled: boolean;
  email_to: string;
  email_subject_template: string;
  email_body_template: string;
  webhook_url: string;
  webhook_enabled: boolean;
}

export default function NotificationChannelsSection() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  const [draftSettings, setDraftSettings] = useState<ChannelSettings>({
    telegram_bot_token: '', telegram_chat_id: '', telegram_enabled: false, telegram_message_template: '',
    discord_webhook_url: '', discord_enabled: false, discord_message_template: '',
    pushover_user_key: '', pushover_app_token: '', pushover_enabled: false, pushover_message_template: '',
    ntfy_server_url: '', ntfy_topic: '', ntfy_password: '', ntfy_enabled: false, ntfy_message_template: '',
    gotify_url: '', gotify_app_token: '', gotify_enabled: false, gotify_message_template: '',
    email_enabled: false, email_to: '', email_subject_template: DEFAULT_EMAIL_SUBJECT, email_body_template: DEFAULT_EMAIL_BODY,
    webhook_url: '', webhook_enabled: false
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    telegram: false, discord: false, pushover: false, ntfy: false, gotify: false, email: false, webhook: false
  });

  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await ProfileService.getNotificationSettings();
      const s = res.data;
      setDraftSettings({
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
        email_enabled: !!s.email_enabled,
        email_to: s.email_to || '',
        email_subject_template: s.email_subject_template || DEFAULT_EMAIL_SUBJECT,
        email_body_template: s.email_body_template || DEFAULT_EMAIL_BODY,
        webhook_url: s.webhook_url || '',
        webhook_enabled: !!s.webhook_enabled
      });
    } catch { 
      showToast('Failed to load notification settings', 'error'); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleUpdateField = (field: keyof ChannelSettings, value: any) => {
    setDraftSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await ProfileService.updateNotificationSettings(draftSettings);
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
      <strong>Available Tags:</strong> <code>{"{{product_name}}"}</code>, <code>{"{{product_url}}"}</code>, <code>{"{{old_price}}"}</code>, <code>{"{{current_price}}"}</code>, <code>{"{{currency}}"}</code>, <code>{"{{product_id}}"}</code>
    </div>
  );

  if (isLoading) return <LoadingSpinner centered />;

  return (
    <div className="settings-card">
      <h2 className="settings-card-title">Notification Channels</h2>
      <p className="text-muted mb-4" style={{ fontSize: '0.875rem' }}>
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
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        >
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}><strong>Tip:</strong> Start a conversation with your bot (<code>/start</code>) to authorize messages.</p>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="telegram-bot-token">Bot Token</label>
            <PasswordInput id="telegram-bot-token" name="telegram-bot-token" value={draftSettings.telegram_bot_token} onChange={e => handleUpdateField('telegram_bot_token', e.target.value)} placeholder="123456:ABC-DEF..." autoComplete="new-password" />
          </form>
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
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        >
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="discord-webhook-url">Webhook URL</label>
            <PasswordInput id="discord-webhook-url" name="discord-webhook-url" value={draftSettings.discord_webhook_url} onChange={e => handleUpdateField('discord_webhook_url', e.target.value)} placeholder="https://discord.com/api/webhooks/..." autoComplete="new-password" />
          </form>
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
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        >
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="pushover-user-key">User Key</label>
            <PasswordInput id="pushover-user-key" name="pushover-user-key" value={draftSettings.pushover_user_key} onChange={e => handleUpdateField('pushover_user_key', e.target.value)} placeholder="u..." autoComplete="new-password" />
          </form>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="pushover-app-token">App API Token</label>
            <PasswordInput id="pushover-app-token" name="pushover-app-token" value={draftSettings.pushover_app_token} onChange={e => handleUpdateField('pushover_app_token', e.target.value)} placeholder="a..." autoComplete="new-password" />
          </form>
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
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        >
          <div className="form-group">
            <label>Server URL</label>
            <input type="text" className="form-control" value={draftSettings.ntfy_server_url} onChange={e => handleUpdateField('ntfy_server_url', e.target.value)} placeholder="https://ntfy.sh (default)" />
          </div>
          <div className="form-group">
            <label>Topic</label>
            <input type="text" className="form-control" value={draftSettings.ntfy_topic} onChange={e => handleUpdateField('ntfy_topic', e.target.value)} placeholder="my_secret_topic" />
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="ntfy-access-token">Access Token (Optional)</label>
            <PasswordInput id="ntfy-access-token" name="ntfy-access-token" value={draftSettings.ntfy_password} onChange={e => handleUpdateField('ntfy_password', e.target.value)} placeholder="tk_..." autoComplete="new-password" />
          </form>
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
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        >
          <div className="form-group">
            <label>Server URL</label>
            <input type="text" className="form-control" value={draftSettings.gotify_url} onChange={e => handleUpdateField('gotify_url', e.target.value)} placeholder="https://gotify.example.com" />
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="gotify-app-token">App Token</label>
            <PasswordInput id="gotify-app-token" name="gotify-app-token" value={draftSettings.gotify_app_token} onChange={e => handleUpdateField('gotify_app_token', e.target.value)} placeholder="A..." autoComplete="new-password" />
          </form>
          <div className="form-group">
            <label>Message Template</label>
            <textarea className="form-control" style={{ height: '80px', fontSize: '0.8rem' }} value={draftSettings.gotify_message_template} onChange={e => handleUpdateField('gotify_message_template', e.target.value)} placeholder="Optional custom template..." />
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
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        >
          <div className="form-group">
            <label>Recipient Address</label>
            <input type="email" className="form-control" value={draftSettings.email_to} onChange={e => handleUpdateField('email_to', e.target.value)} placeholder="you@example.com" />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>If empty, your profile email will be used.</span>
          </div>
          <div className="form-group">
            <label>Subject Template</label>
            <input type="text" className="form-control" value={draftSettings.email_subject_template} onChange={e => handleUpdateField('email_subject_template', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Body Template</label>
            <textarea className="form-control" style={{ height: '120px', fontSize: '0.8rem' }} value={draftSettings.email_body_template} onChange={e => handleUpdateField('email_body_template', e.target.value)} />
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
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        >
          <form onSubmit={(e) => e.preventDefault()} className="form-group">
            <label htmlFor="webhook-endpoint-url">Endpoint URL (POST)</label>
            <PasswordInput id="webhook-endpoint-url" name="webhook-endpoint-url" value={draftSettings.webhook_url} onChange={e => handleUpdateField('webhook_url', e.target.value)} placeholder="https://api.example.com/alerts" autoComplete="new-password" />
          </form>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sends a standard JSON payload with product details.</span>
        </NotificationChannelCard>
      </div>

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={fetchSettings}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save All Channels'}
        </button>
      </div>
    </div>
  );
}
