import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../features/auth';
import { useQuery } from '@tanstack/react-query';
import { systemVersionQuery } from '../api/queries';

/**
 * What is actually running, under the logout button.
 *
 * The backend reports its version at runtime; the frontend knows its own from
 * build time. Normally they match and one line is shown. When they do not, both
 * are -- frontend and backend ship as separate images, so a half-finished
 * deploy leaves them disagreeing, and that is exactly the moment this line is
 * worth having.
 *
 * If the backend cannot be reached the frontend's own version is still shown,
 * because "unknown" would be less useful than the half we are certain of.
 */
const VersionLine: React.FC = () => {
  const { data } = useQuery(systemVersionQuery());
  const backend = data?.version;
  const frontend = __APP_VERSION__;
  const mismatch = backend && backend !== frontend;

  return (
    <div className="user-dropdown-version">
      {mismatch ? (
        <span title="The frontend and backend are running different versions, which usually means a deploy did not finish.">
          ui v{frontend} &middot; api v{backend}
        </span>
      ) : (
        <span>v{frontend}</span>
      )}
    </div>
  );
};

const UserDropdown: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsDropdownOpen(false);
    logout();
    navigate({ to: '/login' });
  };

  if (!user) return null;

  return (
    <div className="user-dropdown" ref={dropdownRef}>
      <button
        className={`user-dropdown-trigger ${isDropdownOpen ? 'open' : ''}`}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <span className="user-dropdown-avatar">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </span>
        <span className="user-dropdown-email">{user.name || user.email}</span>
        <svg
          className="user-dropdown-arrow"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>
      {isDropdownOpen && (
        <div className="user-dropdown-menu">
          <Link
            to="/settings/profile"
            className="user-dropdown-menu-item"
            onClick={() => setIsDropdownOpen(false)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Profile
          </Link>
          {user?.is_admin && (
            <>
              <Link
                to="/admin/system"
                className="user-dropdown-menu-item"
                onClick={() => setIsDropdownOpen(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Admin
              </Link>
              <Link
                to="/admin/debug"
                className="user-dropdown-menu-item"
                onClick={() => setIsDropdownOpen(false)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                Debug
              </Link>
            </>
          )}
          <div className="user-dropdown-divider" />
          <button
            className="user-dropdown-menu-item danger"
            onClick={handleLogout}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
          <VersionLine />
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
