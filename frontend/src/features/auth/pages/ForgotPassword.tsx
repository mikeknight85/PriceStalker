import { useState, FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { AuthService } from '../services/AuthService';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { apiErrorMessage } from '../../../api/error';
import '../components/AuthForm.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await AuthService.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not process the request'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-form-container">
      <div className="auth-form-card">
        <div className="auth-form-header">
          <img src="/icon.svg" alt="PriceStalker" className="auth-form-logo" />
          <h1 className="auth-form-title">Reset Password</h1>
          <p className="auth-form-subtitle">
            Enter your account email and we'll send you a reset link.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {sent ? (
          <div className="alert alert-success">
            If that email belongs to an account, a reset link is on its way.
            The link is valid for 1 hour.
          </div>
        ) : (
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
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={isLoading}
            >
              {isLoading ? <LoadingSpinner size="1rem" /> : 'Send Reset Link'}
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
