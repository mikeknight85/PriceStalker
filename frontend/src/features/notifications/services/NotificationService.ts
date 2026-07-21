import { api } from '../../../api/client';
import { NotificationEntry } from '../../../types/api';

export const NotificationService = {
  getHistory: (page: number = 1, limit: number = 20) =>
    api.get<{ notifications: NotificationEntry[], pagination: { page: number, limit: number, totalCount: number, totalPages: number } }>(`/notifications/history?page=${page}&limit=${limit}`),
  
  getRecent: (limit: number = 10) =>
    api.get<{ notifications: NotificationEntry[], unreadCount: number }>(`/notifications/recent?limit=${limit}`),
  
  markAsRead: (id: number) => api.post(`/notifications/${id}/read`),
  
  markAllAsRead: () => api.post('/notifications/read-all'),
  
  deleteAll: () => api.delete('/notifications/all'),
  
  getUnreadCount: () => api.get<{ count: number }>('/notifications/count'),
};
