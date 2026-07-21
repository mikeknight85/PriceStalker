import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, ReactNode } from 'react';
import Tabs, { Tab } from '../../../../components/Tabs';
import './DashboardTabs.css';

interface DashboardTabsProps {
  activeTab?: 'products' | 'stats' | 'add';
  onTabChange?: (tab: 'products' | 'stats' | 'add') => void;
  children?: ReactNode;
}

export default function DashboardTabs({ activeTab, onTabChange, children }: DashboardTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  // Persist active tab when it changes
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('dashboard_active_tab', activeTab);
    }
  }, [activeTab]);

  const handleTabClick = (tabId: string) => {
    const tab = tabId as 'products' | 'stats' | 'add';
    if (!isDashboard) {
      localStorage.setItem('dashboard_active_tab', tab);
      navigate('/');
    } else if (onTabChange) {
      onTabChange(tab);
    }
  };

  const dashboardTabs: Tab[] = [
    { id: 'products', label: 'Tracked Products' },
    { id: 'stats', label: 'Insights & Stats' },
    { id: 'add', label: 'Add New Product', className: 'tab-success' },
  ];

  const currentTab = activeTab || 'products';

  return (
    <>
      <div className="dashboard-tabs-desktop">
        <Tabs 
          tabs={dashboardTabs} 
          activeTab={currentTab} 
          onTabChange={handleTabClick}
          rightElement={children}
        />
      </div>
      <div className="dashboard-tabs-mobile">
        <div className="dashboard-mobile-tabs-container">
          <select
            className="dashboard-tabs-select"
            value={currentTab}
            onChange={(e) => handleTabClick(e.target.value)}
          >
            <option value="products">Tracked Products</option>
            <option value="stats">Insights & Stats</option>
            <option value="add">Add Product</option>
          </select>
        </div>
      </div>
    </>
  );
}
