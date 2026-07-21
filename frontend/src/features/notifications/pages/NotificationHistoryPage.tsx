import { useState, useEffect, useMemo } from 'react';
import Layout from '../../../layouts/Layout';
import { NotificationService } from '../services/NotificationService';
import { NotificationEntry } from '../../../types/api';
import { useAuth } from '../../auth';
import { useToast } from '../../../context/ToastContext';
import { logger } from '../../../utils/logger';

import NotificationFilters from './NotificationFilters';
import NotificationTable from './NotificationTable';
import ActivityLogTable from '../components/ActivityLogTable';
import Pagination from '../../../components/Pagination';
import Tabs, { Tab } from '../../../components/Tabs';

import './NotificationHistoryPage.css';
import Icon from '../../../components/Icon';

export default function NotificationHistory() {
  const { user } = useAuth();
  const { activityLog, clearActivityLog } = useToast();
  const [activeTab, setActiveTab] = useState<'activity' | 'alerts'>('activity');
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (activeTab === 'alerts') {
      fetchNotifications();
    }
  }, [page, activeTab]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await NotificationService.getHistory(page, 20);
      const data = response.data;
      // Alerts are only price/stock/system events
      setNotifications(data.notifications?.filter(n => !['session_activity', 'system_info'].includes(n.type)) || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      logger.error('Failed to fetch notification history', 'Notifications', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      window.dispatchEvent(new CustomEvent('notifications-cleared'));
    } catch (error) {
      logger.error('Failed to mark all as read', 'Notifications', error);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all your alert history?')) return;
    try {
      await NotificationService.deleteAll();
      setNotifications([]);
      setTotalPages(1);
      setPage(1);
      window.dispatchEvent(new CustomEvent('notifications-cleared'));
    } catch (error) {
      logger.error('Failed to clear notifications', 'Notifications', error);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  const historyTabs: Tab[] = [
    { id: 'activity', label: 'Session Activity', icon: <Icon name="fileText" /> },
    { id: 'alerts', label: 'Alert History', icon: <Icon name="bell" /> },
  ];

  const headerActions = (
    <div className="notifications-actions" style={{ display: 'flex', gap: '0.5rem' }}>
      {activeTab === 'activity' ? (
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={clearActivityLog}
          disabled={activityLog.length === 0}
        >
          Clear session
        </button>
      ) : (
        <>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleMarkAllRead}
            disabled={loading || notifications.every(n => n.is_read) || notifications.length === 0}
          >
            Mark all read
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleClearHistory}
            disabled={loading || notifications.length === 0}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            Delete all
          </button>
        </>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="notifications-page">
        <Tabs 
          tabs={historyTabs} 
          activeTab={activeTab} 
          onTabChange={(id) => setActiveTab(id as 'activity' | 'alerts')}
          rightElement={headerActions}
        />

        {activeTab === 'activity' ? (
          <ActivityLogTable activityLog={activityLog} />
        ) : (
          <>
            <NotificationFilters 
              filter={filter} 
              setFilter={setFilter} 
            />

            <NotificationTable 
              notifications={filteredNotifications} 
              loading={loading} 
              userLocale={user?.locale}
            />

            {totalPages > 1 && (
              <Pagination 
                page={page} 
                totalPages={totalPages} 
                setPage={setPage} 
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
