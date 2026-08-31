import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Layout from '../../../layouts/Layout';
import { NotificationService } from '../services/NotificationService';
import { useAuth } from '../../auth';
import { useToast } from '../../../context/ToastContext';

import NotificationFilters from './NotificationFilters';
import NotificationTable from './NotificationTable';
import ActivityLogTable from '../components/ActivityLogTable';
import Pagination from '../../../components/Pagination';
import Tabs, { Tab } from '../../../components/Tabs';

import './NotificationHistoryPage.css';
import Icon from '../../../components/Icon';
import { queryClient } from '../../../api/queryClient';
import { notificationHistoryQuery } from '../../../api/queries';

export default function NotificationHistory() {
  const { user } = useAuth();
  const { activityLog, clearActivityLog } = useToast();
  const [activeTab, setActiveTab] = useState<'activity' | 'alerts'>('activity');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>('all');
  const historyQuery = useQuery({ ...notificationHistoryQuery(page, 20, filter), enabled: activeTab === 'alerts' });
  const notifications = historyQuery.data?.notifications?.filter(n => !['session_activity', 'system_info'].includes(n.type)) ?? [];
  const totalPages = historyQuery.data?.pagination?.totalPages ?? 1;
  const invalidateNotifications = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markAllRead = useMutation({ mutationFn: NotificationService.markAllAsRead, onSuccess: invalidateNotifications });
  // The API has supported marking one notification read all along; only the
  // drawer used it, so on this page the sole option was to mark everything read
  // and lose track of what you had not seen (issue #93).
  const markOneRead = useMutation({ mutationFn: NotificationService.markAsRead, onSuccess: invalidateNotifications });
  const deleteAll = useMutation({ mutationFn: NotificationService.deleteAll, onSuccess: invalidateNotifications });

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      window.dispatchEvent(new CustomEvent('notifications-cleared'));
    } catch { /* keep the cached state untouched after a failed mutation */ }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all your alert history?')) return;
    try {
      await deleteAll.mutateAsync();
      setPage(1);
      window.dispatchEvent(new CustomEvent('notifications-cleared'));
    } catch { /* keep the cached history intact after a failed mutation */ }
  };

  // The server applies the filter, so what comes back is already the filtered
  // set. Filtering again here would re-introduce the bug this replaces: the old
  // client-side filter searched only the loaded page, so selecting one reported
  // nothing beyond the most recent 20 notifications.
  const filteredNotifications = notifications;

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
            disabled={markAllRead.isPending || notifications.every(n => n.is_read) || notifications.length === 0}
          >
            Mark all read
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleClearHistory}
            disabled={deleteAll.isPending || notifications.length === 0}
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
              resultCount={historyQuery.data?.pagination?.totalCount}
              setFilter={(f) => { setFilter(f); setPage(1); }}
            />

            <NotificationTable 
              notifications={filteredNotifications} 
              loading={historyQuery.isLoading}
              userLocale={user?.locale ?? undefined}
              error={historyQuery.isError ? historyQuery.error : undefined}
              onRetry={() => historyQuery.refetch()}
              onMarkRead={(id) => markOneRead.mutate(id)}
              markingId={markOneRead.isPending ? (markOneRead.variables ?? null) : null}
            />

            {!historyQuery.isError && totalPages > 1 && (
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
