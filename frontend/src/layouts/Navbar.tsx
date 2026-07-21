import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { useTheme } from '../context/ThemeContext';
import { NotificationBell } from '../features/notifications';
import UserDropdown from './UserDropdown';

const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <img src="/icon.svg" alt="" className="navbar-brand-icon" />
          <span className="navbar-brand-text">
            <span>Price</span>
            <span className="navbar-brand-ghost">Stalker</span>
          </span>
        </Link>

        <div className="navbar-user">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {user && <NotificationBell />}
          {user && <UserDropdown />}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
