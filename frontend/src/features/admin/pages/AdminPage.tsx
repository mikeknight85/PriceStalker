import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import Layout from '../../../layouts/Layout';
import { useAuth } from '../../auth';
import Icon from '../../../components/Icon';
import { SharedService } from '../../../services/SharedService';
import { GlobalCurrency } from '../../../types/api';

// Section Components
import SystemSection from '../components/sections/SystemSection';
import GlobalSelectorsSection from '../components/sections/GlobalSelectorsSection';
import RetailersSection from '../components/sections/RetailersSection';
import UsersSection from '../components/sections/UsersSection';
import AISection from '../components/sections/AISection';
import LogsSection from '../components/sections/LogsSection';
import SystemApiTokensSection from '../components/sections/SystemApiTokensSection';
import AuthSection from '../components/sections/AuthSection';

type AdminSection = 'system' | 'selectors' | 'retailers' | 'users' | 'ai' | 'logs' | 'tokens' | 'auth';

export default function Admin() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = (searchParams.get('tab') as AdminSection) || 'system';
  
  const [globalCurrencies, setGlobalCurrencies] = useState<GlobalCurrency[]>([]);
  const [retailerSearch, setRetailerSearch] = useState('');

  const setActiveSection = (tab: AdminSection) => {
    setSearchParams({ tab });
  };

  useEffect(() => {
    fetchGlobalData();
  }, []);

  const fetchGlobalData = async () => {
    try {
      const res = await SharedService.getCurrencies();
      setGlobalCurrencies(res.data || []);
    } catch (err) {
      console.error('Failed to fetch global currencies:', err);
    }
  };

  const handleSearchRetailer = (domain: string) => {
    setRetailerSearch(domain);
    setActiveSection('retailers');
  };

  if (!user?.is_admin) return <Navigate to="/" replace />;

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
