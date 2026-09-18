import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { adminRoute } from '../../../routes/-admin-api';
import Layout from '../../../layouts/Layout';
import SettingsPageHeader from '../../../components/SettingsPageHeader';
import Icon from '../../../components/Icon';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { currenciesQuery } from '../../../api/queries';

// Section Components
import SystemSection from '../components/sections/SystemSection';
import GlobalSelectorsSection from '../components/sections/GlobalSelectorsSection';
import RetailersSection from '../components/sections/RetailersSection';
import UsersSection from '../components/sections/UsersSection';
import AISection from '../components/sections/AISection';
import LogsSection from '../components/sections/LogsSection';
import SystemApiTokensSection from '../components/sections/SystemApiTokensSection';
import AuthSection from '../components/sections/AuthSection';

export type AdminSection = 'system' | 'selectors' | 'retailers' | 'users' | 'ai' | 'logs' | 'tokens' | 'auth';

interface AdminNavItem {
  value: AdminSection;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
}

const NAV_ITEMS: AdminNavItem[] = [
  { value: 'system', label: 'System', icon: 'settings' },
  { value: 'selectors', label: 'Extraction Rules', icon: 'search' },
  { value: 'retailers', label: 'Retailers', icon: 'store' },
  { value: 'users', label: 'Users', icon: 'users' },
  { value: 'tokens', label: 'API Tokens', icon: 'key' },
  { value: 'auth', label: 'Authentication', icon: 'shield' },
  { value: 'ai', label: 'AI Engine', icon: 'cpu' },
  { value: 'logs', label: 'Logs', icon: 'logs' },
];

export default function Admin({ activeSection }: { activeSection: AdminSection }) {
  const navigate = useNavigate();
  const { retailer } = adminRoute.useSearch();
  
  const [retailerSearch, setRetailerSearch] = useState(retailer || '');
  const currenciesResult = useQuery(currenciesQuery());
  const globalCurrencies = currenciesResult.data ?? [];

  const setActiveSection = (section: AdminSection) => {
    navigate({ to: `/admin/${section}` });
  };

  useEffect(() => {
    setRetailerSearch(retailer || '');
  }, [retailer]);

  const handleSearchRetailer = (domain: string) => {
    navigate({ to: '/admin/retailers', search: { retailer: domain } });
  };

  return (
    <Layout>
      <SettingsPageHeader title="System Administration" />

      <div className="settings-container-new">
        <select 
          className="settings-mobile-select"
          value={activeSection}
          onChange={(e) => setActiveSection(e.target.value as AdminSection)}
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
          <ErrorBoundary section={`admin-${activeSection}`}>
            {activeSection === 'system' && <SystemSection />}
            {activeSection === 'selectors' && <GlobalSelectorsSection />}
            {activeSection === 'retailers' && <RetailersSection globalCurrencies={globalCurrencies} initialSearch={retailerSearch} />}
            {activeSection === 'users' && <UsersSection globalCurrencies={globalCurrencies} />}
            {activeSection === 'tokens' && <SystemApiTokensSection />}
            {activeSection === 'auth' && <AuthSection />}
            {activeSection === 'ai' && <AISection />}
            {activeSection === 'logs' && <LogsSection onSearchRetailer={handleSearchRetailer} />}
          </ErrorBoundary>
        </main>
      </div>
    </Layout>
  );
}
