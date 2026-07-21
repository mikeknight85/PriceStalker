import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../../../layouts/Layout';

// Section Components
import ProfileSection from './ProfileSection';
import RegionalSection from './RegionalSection';
import SecuritySection from './SecuritySection';
import NotificationChannelsSection from './NotificationChannelsSection';

type SettingsSection = 'profile' | 'regional' | 'notifications' | 'security';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = (searchParams.get('tab') as SettingsSection) || 'profile';

  const setActiveSection = (tab: SettingsSection) => {
    setSearchParams({ tab });
  };

  return (
    <Layout>
      <div className="settings-header-new">
        <Link to="/" className="settings-back-new">← Back to Dashboard</Link>
        <h1 className="settings-title-new">Account Settings</h1>
      </div>

      <div className="settings-container-new">
        <select 
          className="settings-mobile-select"
          value={activeSection}
          onChange={(e) => setActiveSection(e.target.value as SettingsSection)}
        >
          <option value="profile">👤 Profile</option>
          <option value="regional">🌍 Regional</option>
          <option value="notifications">🔔 Notifications</option>
          <option value="security">🔒 Security</option>
        </select>

        <aside className="settings-sidebar-new">
          <nav className="settings-nav-new">
            <button className={`settings-nav-item-new ${activeSection === 'profile' ? 'active' : ''}`} onClick={() => setActiveSection('profile')}>
              <span>👤 Profile</span>
            </button>
            <button className={`settings-nav-item-new ${activeSection === 'regional' ? 'active' : ''}`} onClick={() => setActiveSection('regional')}>
              <span>🌍 Regional</span>
            </button>
            <button className={`settings-nav-item-new ${activeSection === 'notifications' ? 'active' : ''}`} onClick={() => setActiveSection('notifications')}>
              <span>🔔 Notifications</span>
            </button>
            <button className={`settings-nav-item-new ${activeSection === 'security' ? 'active' : ''}`} onClick={() => setActiveSection('security')}>
              <span>🔒 Security</span>
            </button>
          </nav>
        </aside>

        <main className="settings-content-new">
          {activeSection === 'profile' && <ProfileSection />}
          {activeSection === 'regional' && <RegionalSection />}
          {activeSection === 'security' && <SecuritySection />}
          {activeSection === 'notifications' && <NotificationChannelsSection />}
        </main>
      </div>
    </Layout>
  );
}
