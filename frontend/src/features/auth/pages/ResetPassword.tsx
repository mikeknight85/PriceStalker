import { useState, FormEvent } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { AuthService } from '../services/AuthService';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { apiErrorMessage } from '../../../api/error';
import '../components/AuthForm.css';

export default function ResetPassword() {
  const location = useRouterState({ select: (state) => state.location });
  const token = new URLSearchParams(location.searchStr).get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setIsLoading(true);
    try {
      await AuthService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reset the password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-form-container">
      <div className="auth-form-card">
        <div className="auth-form-header">
          <img src="/icon.svg" alt="PriceStalker" className="auth-form-logo" />
          <h1 className="auth-form-title">Choose a New Password</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!token ? (
          <div className="alert alert-error">
            This reset link is missing its token. Open the link from your email,
            or request a new one.
          </div>
        ) : done ? (
          <div className="alert alert-success">
            Password updated. You can now sign in with your new password.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="password">New Password</label>
              <input
                type="password"
                id="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>
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
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={isLoading}
            >
              {isLoading ? <LoadingSpinner size="1rem" /> : 'Set New Password'}
            </button>
          </form>
        )}

        <div className="auth-form-footer">
          <Link to="/login">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
