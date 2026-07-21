import React from 'react';
import './CollapsibleCard.css';

interface CollapsibleCardProps {
  title: string;
  id: string;
  children: React.ReactNode;
  badge?: string | number;
  isExpanded?: boolean;
  expandedSections?: Record<string, boolean>;
  onToggle: (id: string) => void;
  icon?: string;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({ 
  title, 
  id, 
  children, 
  badge, 
  isExpanded,
  expandedSections, 
  onToggle,
  icon = '▾'
}) => {
  const expanded = isExpanded !== undefined ? isExpanded : (expandedSections ? expandedSections[id] : false);

  return (
    <div className={`pg-collapsible-card ${expanded ? 'expanded' : ''}`}>
      <button 
        type="button"
        onClick={() => onToggle(id)}
        className="pg-collapsible-card-header"
      >
        <div className="pg-collapsible-card-title-group">
          <span className="pg-collapsible-card-title">{title}</span>
          {badge !== undefined && <span className="pg-collapsible-card-badge">{badge}</span>}
        </div>
        <span className={`pg-collapsible-card-icon ${expanded ? 'rotated' : ''}`}>{icon}</span>
      </button>
      {expanded && <div className="pg-collapsible-card-body">{children}</div>}
    </div>
  );
};

export default CollapsibleCard;
