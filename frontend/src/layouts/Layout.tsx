import React, { ReactNode } from 'react';
import Navbar from './Navbar';
import { NotificationDrawer } from '../features/notifications';
import ParticleBackground from './components/ParticleBackground';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="layout">
      <ParticleBackground />
      <NotificationDrawer />
      <Navbar />

      <main className="main-content">
        <div className="main-content-inner">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
