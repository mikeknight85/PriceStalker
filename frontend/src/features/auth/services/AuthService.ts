import { api } from '../../../api/client';

export interface PublicAuthConfig {
  policy: 'local' | 'oidc' | 'both';
  oidc_enabled: boolean;
  oidc_provider_name: string | null;
}

export const AuthService = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  getRegistrationStatus: () =>
    api.get<{ enabled: boolean }>('/auth/registration-status'),

  /**
   * Public auth config, used by the login page to decide what to render.
   * 404s when SSO is disabled on the server; callers treat that as
   * "local login only" rather than as an error.
   */
  getPublicAuthConfig: () =>
    api.get<PublicAuthConfig>('/auth/oidc/config/public'),

  /** Fetch the current user with an existing token, after an SSO redirect. */
  getProfile: () => api.get('/profile'),
};

/** Full-page navigation: the OIDC flow is a browser redirect, not an XHR. */
export function beginSsoLogin(): void {
  window.location.href = '/api/auth/oidc/start';
}
