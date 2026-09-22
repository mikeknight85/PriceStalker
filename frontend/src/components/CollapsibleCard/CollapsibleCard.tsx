import React from 'react';
import './CollapsibleCard.css';

interface CollapsibleCardProps {
  title: string;
  id: string;
  children: React.ReactNode;
  badge?: string | number;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  /** The expand/collapse chevron. */
  icon?: string;
  /** Optional icon rendered before the title, in place of an emoji prefix. */
  leadingIcon?: React.ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({ 
  title, 
  id, 
  children, 
  badge,
  isExpanded,
  onToggle,
  icon = '▾',
  leadingIcon
}) => {
  return (
    <div className={`pg-collapsible-card ${isExpanded ? 'expanded' : ''}`}>
      <button 
        type="button"
        onClick={() => onToggle(id)}
        className="pg-collapsible-card-header"
      >
        <div className="pg-collapsible-card-title-group">
          {leadingIcon && (
            <span className="pg-collapsible-card-leading-icon">{leadingIcon}</span>
          )}
          <span className="pg-collapsible-card-title">{title}</span>
          {badge !== undefined && <span className="pg-collapsible-card-badge">{badge}</span>}
        </div>
        <span className={`pg-collapsible-card-icon ${isExpanded ? 'rotated' : ''}`}>{icon}</span>
      </button>
      {isExpanded && <div className="pg-collapsible-card-body">{children}</div>}
    </div>
  );
};

export default CollapsibleCard;
