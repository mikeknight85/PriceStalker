import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { adminRoute } from '../../../routes/-admin-api';
import Layout from '../../../layouts/Layout';
import Icon from '../../../components/Icon';
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
      <div className="settings-header-new">
        <h1 className="settings-title-new">System Administration</h1>
      </div>

      <div className="settings-container-new">
        <select 
          className="settings-mobile-select"
          value={activeSection}
          onChange={(e) => setActiveSection(e.target.value as AdminSection)}
        >
          <option value="system">System</option>
          <option value="selectors">Global Selectors</option>
          <option value="retailers">Retailers</option>
          <option value="users">Users</option>
          <option value="tokens">API Tokens</option>
          <option value="ai">AI Engine</option>
          <option value="logs">Logs</option>
        </select>

        <aside className="settings-sidebar-new">
          <nav className="settings-nav-new">
            <button className={`settings-nav-item-new ${activeSection === 'system' ? 'active' : ''}`} onClick={() => setActiveSection('system')}><Icon name="settings" /><span>System</span></button>
            <button className={`settings-nav-item-new ${activeSection === 'selectors' ? 'active' : ''}`} onClick={() => setActiveSection('selectors')}><Icon name="search" /><span>Global Selectors</span></button>
            <button className={`settings-nav-item-new ${activeSection === 'retailers' ? 'active' : ''}`} onClick={() => setActiveSection('retailers')}><Icon name="store" /><span>Retailers</span></button>
            <button className={`settings-nav-item-new ${activeSection === 'users' ? 'active' : ''}`} onClick={() => setActiveSection('users')}><Icon name="users" /><span>Users</span></button>
            <button className={`settings-nav-item-new ${activeSection === 'tokens' ? 'active' : ''}`} onClick={() => setActiveSection('tokens')}><Icon name="key" /><span>API Tokens</span></button>
            <button className={`settings-nav-item-new ${activeSection === 'auth' ? 'active' : ''}`} onClick={() => setActiveSection('auth')}><Icon name="shield" /><span>Authentication</span></button>
            <button className={`settings-nav-item-new ${activeSection === 'ai' ? 'active' : ''}`} onClick={() => setActiveSection('ai')}><Icon name="cpu" /><span>AI Engine</span></button>
            <button className={`settings-nav-item-new ${activeSection === 'logs' ? 'active' : ''}`} onClick={() => setActiveSection('logs')}><Icon name="logs" /><span>Logs</span></button>
          </nav>
        </aside>

        <main className="settings-content-new">
          {activeSection === 'system' && <SystemSection />}
          {activeSection === 'selectors' && <GlobalSelectorsSection />}
          {activeSection === 'retailers' && <RetailersSection globalCurrencies={globalCurrencies} initialSearch={retailerSearch} />}
          {activeSection === 'users' && <UsersSection globalCurrencies={globalCurrencies} />}
          {activeSection === 'tokens' && <SystemApiTokensSection />}
          {activeSection === 'auth' && <AuthSection />}
          {activeSection === 'ai' && <AISection />}
          {activeSection === 'logs' && <LogsSection onSearchRetailer={handleSearchRetailer} />}
        </main>
      </div>
    </Layout>
  );
}
