import React from 'react';
import { CollapsibleCard, ToggleSwitch } from '../../admin/components';
import LoadingSpinner from '../../../components/LoadingSpinner';

interface NotificationChannelCardProps {
  title: string;
  id: string;
  enabled: boolean;
  onToggle: () => void;
  onTest: () => Promise<void>;
  isTesting: boolean;
  expandedSections: Record<string, boolean>;
  onToggleSection: (id: string) => void;
  children: React.ReactNode;
  badge?: string;
}

export default function NotificationChannelCard({
  title,
  id,
  enabled,
  onToggle,
  onTest,
  isTesting,
  expandedSections,
  onToggleSection,
  children,
  badge
}: NotificationChannelCardProps) {
  return (
    <CollapsibleCard 
      title={title} 
      id={id} 
      badge={badge || (enabled ? 'Active' : 'Disabled')} 
      expandedSections={expandedSections} 
      onToggle={onToggleSection}
    >
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: 'var(--surface)', 
          padding: '0.75rem', 
          borderRadius: '0.5rem', 
          border: '1px solid var(--border)',
          marginBottom: '1rem'
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Enable Channel</span>
          <ToggleSwitch active={enabled} onToggle={onToggle} />
        </div>

        <div className={enabled ? '' : 'opacity-50 pointer-events-none'} style={{ transition: 'opacity 0.2s' }}>
          {children}

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={onTest} 
              disabled={isTesting || !enabled}
              style={{ width: 'auto' }}
            >
              {isTesting ? <LoadingSpinner size="14px" /> : 'Send Test Notification'}
            </button>
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
