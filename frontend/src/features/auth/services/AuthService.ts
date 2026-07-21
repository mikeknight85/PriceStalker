import { api } from '../../../api/client';

export const AuthService = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getRegistrationStatus: () =>
    api.get<{ enabled: boolean }>('/auth/registration-status'),
};
