import React from 'react';
import { Link } from '@tanstack/react-router';

interface SettingsPageHeaderProps {
  title: string;
  backTo?: string;
  backLabel?: string;
}

export const SettingsPageHeader: React.FC<SettingsPageHeaderProps> = ({
  title,
  backTo,
  backLabel = '← Back',
}) => {
  return (
    <div className="settings-header-new">
      {backTo && (
        <Link to={backTo} className="settings-back-new">
          {backLabel}
        </Link>
      )}
      <h1 className="settings-title-new">{title}</h1>
    </div>
  );
};

export default SettingsPageHeader;
