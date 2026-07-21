import { api } from '../../../api/client';
import { 
  SystemSettings, 
  SystemApiToken, 
  CreateSystemApiTokenResponse 
} from '../../../types/api';

export const AdminSystemService = {
  getDebugStatus: () => api.get<{ enabled: boolean }>('/admin/debug/status'),
  getSystemSettings: () => api.get<SystemSettings>('/admin/settings'),
  updateSystemSettings: (settings: Partial<SystemSettings>) => api.put<SystemSettings>('/admin/settings', settings),
  testSearXNG: (url: string) => api.post<{ success: boolean; message: string; error?: string }>('/admin/command', { command: 'test-searxng', params: { url } }),
  executeCommand: (command: string, params?: any) => api.post('/admin/command', { command, params }),

  // Logs
  getLogs: (params: { page?: number; limit?: number; level?: string; context?: string; search?: string }) => 
    api.get<any>('/admin/logs', { params }),
  deleteLogs: (ids: number[]) => api.delete('/admin/logs', { data: { ids } }),
  clearLogs: (level?: string, context?: string) => api.delete('/admin/logs/clear', { params: { level, context } }),

  // System API Tokens
  getSystemApiTokens: () => api.get<SystemApiToken[]>('/admin/system-tokens'),
  createSystemApiToken: (data: { label: string; description?: string; expires_at?: string }) => 
    api.post<CreateSystemApiTokenResponse>('/admin/system-tokens', data),
  deleteSystemApiToken: (id: number) => api.delete(`/admin/system-tokens/${id}`),
};
