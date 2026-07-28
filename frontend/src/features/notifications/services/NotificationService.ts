import { api, type RequestOptions } from '../../../api/client';
import { NotificationEntry } from '../../../types/api';

export const NotificationService = {
  getHistory: (page: number = 1, limit: number = 20, options?: RequestOptions) =>
    api.get<{ notifications: NotificationEntry[], pagination: { page: number, limit: number, totalCount: number, totalPages: number } }>('/notifications/history', {
      ...options,
      params: { ...options?.params, page, limit },
    }),
  
  getRecent: (limit: number = 10, options?: RequestOptions) =>
    api.get<{ notifications: NotificationEntry[], unreadCount: number }>('/notifications/recent', { ...options, params: { ...options?.params, limit } }),
  
  markAsRead: (id: number) => api.post(`/notifications/${id}/read`),
  
  markAllAsRead: () => api.post('/notifications/read-all'),
  
  deleteAll: () => api.delete('/notifications/all'),
  
  getUnreadCount: () => api.get<{ count: number }>('/notifications/count'),
};
