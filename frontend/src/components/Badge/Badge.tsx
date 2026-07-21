import React from 'react';
import './Badge.css';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary' | 'outline' | 'deal' | 'member';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'small' | 'medium';
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'secondary', 
  size = 'medium',
  icon,
  className = '',
  style
}) => {
  return (
    <span 
      className={`pg-badge-v2 badge-${variant} badge-${size} ${className}`}
      style={style}
    >
      {icon && <span className="badge-icon">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;
