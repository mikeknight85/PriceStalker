import { api, type RequestOptions } from '../../../api/client';
import { UserProfile } from '../../../types/api';

export const UserAdminService = {
  getUsers: (options?: RequestOptions) => api.get<UserProfile[]>('/admin/users', options),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  updateUser: (id: number, data: Partial<UserProfile> & { password?: string }) => 
    api.put(`/admin/users/${id}`, data),
  setUserAdmin: (id: number, isAdmin: boolean) => 
    api.put(`/admin/users/${id}/admin`, { is_admin: isAdmin }),
  createUser: (email: string, pass: string, isAdmin: boolean, currency?: string, locale?: string, name?: string) =>
    api.post('/admin/users', { email, password: pass, is_admin: isAdmin, currency, locale, name }),
};
