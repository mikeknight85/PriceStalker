import { api } from '../../../api/client';
import { UserProfile } from '../../../types/api';

export const UserAdminService = {
  getUsers: () => api.get<UserProfile[]>('/admin/users'),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  updateUser: (id: number, data: Partial<UserProfile> & { password?: string }) => 
    api.put(`/admin/users/${id}`, data),
  setUserAdmin: (id: number, isAdmin: boolean) => 
    api.put(`/admin/users/${id}/admin`, { is_admin: isAdmin }),
  createUser: (email: string, pass: string, isAdmin: boolean, currency?: string, locale?: string) => 
    api.post('/admin/users', { email, password: pass, is_admin: isAdmin, currency, locale }),
};
