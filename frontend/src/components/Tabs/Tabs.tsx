import React from 'react';
import './Tabs.css';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  rightElement?: React.ReactNode;
}

const Tabs: React.FC<TabsProps> = ({ 
  tabs, 
  activeTab, 
  onTabChange, 
  className = '',
  rightElement
}) => {
  return (
    <div className={`tabs-container ${className}`}>
      <div className="tabs-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''} ${tab.className || ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      {rightElement && <div className="tabs-right">{rightElement}</div>}
    </div>
  );
};

export default Tabs;
