import { api, type RequestOptions } from '../../../api/client';
import { NotificationEntry } from '../../../types/api';

export const NotificationService = {
  /**
   * The filter is sent to the server rather than applied to the result.
   *
   * Filtering the loaded page searched only the most recent 20 notifications,
   * so an empty result read as "you have none" when it meant "none on this
   * page" (issue #93). The count returned alongside is the filtered total.
   */
  getHistory: (page: number = 1, limit: number = 20, filter: string = 'all', options?: RequestOptions) =>
    api.get<{
      notifications: NotificationEntry[],
      pagination: { page: number, limit: number, totalCount: number, totalPages: number },
      filter: string,
    }>('/notifications/history', {
      ...options,
      params: { ...options?.params, page, limit, filter },
    }),
  
  getRecent: (limit: number = 10, options?: RequestOptions) =>
    api.get<{ notifications: NotificationEntry[], unreadCount: number }>('/notifications/recent', { ...options, params: { ...options?.params, limit } }),
  
  markAsRead: (id: number) => api.post(`/notifications/${id}/read`),
  
  markAllAsRead: () => api.post('/notifications/read-all'),
  
  deleteAll: () => api.delete('/notifications/all'),
  
  getUnreadCount: () => api.get<{ count: number }>('/notifications/count'),
};
