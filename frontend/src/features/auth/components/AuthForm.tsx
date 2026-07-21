import React, { useState, useEffect, FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthService, beginSsoLogin, PublicAuthConfig } from '../services/AuthService';
import { useTheme } from '../../../context/ThemeContext';
import LoadingSpinner from '../../../components/LoadingSpinner';
import './AuthForm.css';
import Icon from '../../../components/Icon';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (email: string, password: string) => Promise<void>;
}

const AuthForm: React.FC<AuthFormProps> = ({ mode, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [ssoConfig, setSsoConfig] = useState<PublicAuthConfig | null>(null);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  useEffect(() => {
    // Check if registration is enabled
    AuthService.getRegistrationStatus()
      .then(res => setRegistrationEnabled(res.data.enabled))
      .catch(() => setRegistrationEnabled(true)); // Default to true on error

    // 404s when SSO is disabled on the server; that is the normal
    // local-login-only case, not an error worth surfacing.
    AuthService.getPublicAuthConfig()
      .then(res => setSsoConfig(res.data))
      .catch(() => setSsoConfig(null));
  }, []);

  const forceLocal = new URLSearchParams(location.search).get('local') === '1';
  const ssoAvailable = mode === 'login' && !!ssoConfig?.oidc_enabled;
  // policy 'oidc' means SSO-only, so the password form is hidden unless the
  // ?local=1 escape hatch is used -- without it a misconfigured or unreachable
  // identity provider would lock every account out permanently.
  const showLocalForm = !(ssoAvailable && ssoConfig?.policy === 'oidc' && !forceLocal);
  const providerName = ssoConfig?.oidc_provider_name || 'SSO';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await onSubmit(email, password);
    } catch (err) {
      if (err instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const axiosError = err as any;
        setError(axiosError.response?.data?.error || 'An error occurred');
      } else {
        setError('An error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-form-container">
      <button
        className="auth-theme-toggle"
        onClick={toggleTheme}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? <Icon name="moon" /> : <Icon name="sun" />}
      </button>

      <div className="auth-form-card">
        <div className="auth-form-header">
          <img src="/icon.svg" alt="PriceStalker" className="auth-form-logo" />
          <h1 className="auth-form-title">PriceStalker</h1>
          <p className="auth-form-subtitle">
            {mode === 'login'
              ? 'Sign in to track prices'
              : 'Create your account'}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {ssoAvailable && (
          <>
            <button
              type="button"
              className="btn btn-primary auth-sso-button"
              onClick={beginSsoLogin}
            >
              Sign in with {providerName}
            </button>
            {showLocalForm && <div className="auth-sso-divider"><span>or</span></div>}
          </>
        )}

        {showLocalForm && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <LoadingSpinner size="1rem" />
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>
        )}

        {!showLocalForm && (
          <div className="auth-form-footer">
            <Link to="/login?local=1">Sign in with a password instead</Link>
          </div>
        )}

        {showLocalForm && mode === 'login' && registrationEnabled && (
          <div className="auth-form-footer">
            Don't have an account? <Link to={`/register${location.search}`} state={location.state}>Sign up</Link>
          </div>
        )}
        {mode === 'register' && (
          <div className="auth-form-footer">
            Already have an account? <Link to={`/login${location.search}`} state={location.state}>Sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthForm;
