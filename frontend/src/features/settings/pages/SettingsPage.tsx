import { Link, useNavigate } from '@tanstack/react-router';
import Layout from '../../../layouts/Layout';

// Section Components
import ProfileSection from './ProfileSection';
import RegionalSection from './RegionalSection';
import SecuritySection from './SecuritySection';
import NotificationChannelsSection from './NotificationChannelsSection';
import Icon from '../../../components/Icon';

export type SettingsSection = 'profile' | 'regional' | 'notifications' | 'security';

export default function Settings({ activeSection }: { activeSection: SettingsSection }) {
  const navigate = useNavigate();

  const setActiveSection = (section: SettingsSection) => {
    navigate({ to: `/settings/${section}` });
  };

  return (
    <Layout>
      <div className="settings-header-new">
        <Link to="/products" className="settings-back-new">← Back to Products</Link>
        <h1 className="settings-title-new">Account Settings</h1>
      </div>

      <div className="settings-container-new">
        <select 
          className="settings-mobile-select"
          value={activeSection}
          onChange={(e) => setActiveSection(e.target.value as SettingsSection)}
        >
          <option value="profile">Profile</option>
          <option value="regional">Regional</option>
          <option value="notifications">Notifications</option>
          <option value="security">Security</option>
        </select>

        <aside className="settings-sidebar-new">
          <nav className="settings-nav-new">
            <button className={`settings-nav-item-new ${activeSection === 'profile' ? 'active' : ''}`} onClick={() => setActiveSection('profile')}>
              <Icon name="user" /><span>Profile</span>
            </button>
            <button className={`settings-nav-item-new ${activeSection === 'regional' ? 'active' : ''}`} onClick={() => setActiveSection('regional')}>
              <Icon name="globe" /><span>Regional</span>
            </button>
            <button className={`settings-nav-item-new ${activeSection === 'notifications' ? 'active' : ''}`} onClick={() => setActiveSection('notifications')}>
              <Icon name="bell" /><span>Notifications</span>
            </button>
            <button className={`settings-nav-item-new ${activeSection === 'security' ? 'active' : ''}`} onClick={() => setActiveSection('security')}>
              <Icon name="lock" /><span>Security</span>
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
