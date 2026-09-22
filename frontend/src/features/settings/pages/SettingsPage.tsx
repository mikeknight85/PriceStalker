import { Link, useNavigate } from '@tanstack/react-router';
import Layout from '../../../layouts/Layout';

// Section Components
import ProfileSection from './ProfileSection';
import RegionalSection from './RegionalSection';
import SecuritySection from './SecuritySection';
import NotificationChannelsSection from './NotificationChannelsSection';
import Icon from '../../../components/Icon';

export type SettingsSection = 'profile' | 'regional' | 'notifications' | 'security';

interface SettingsNavItem {
  value: SettingsSection;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
}

const NAV_ITEMS: SettingsNavItem[] = [
  { value: 'profile', label: 'Profile', icon: 'user' },
  { value: 'regional', label: 'Regional', icon: 'globe' },
  { value: 'notifications', label: 'Notifications', icon: 'bell' },
  { value: 'security', label: 'Security', icon: 'lock' },
];

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
          {NAV_ITEMS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <aside className="settings-sidebar-new">
          <nav className="settings-nav-new">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.value}
                className={`settings-nav-item-new ${activeSection === item.value ? 'active' : ''}`}
                onClick={() => setActiveSection(item.value)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
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
