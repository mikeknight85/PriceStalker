// Landing page the OIDC callback redirects the browser to after successfully
// exchanging the authorization code. The backend puts the JWT in the URL
// hash (#token=...) because hash fragments never hit the server — keeping
// the short-lived token out of access logs.
//
// On load: parse the hash, hand the token off to AuthContext, navigate to /
// on success or show the error message on failure.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function SsoComplete() {
  const navigate = useNavigate();
  const { completeOidcLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const err = params.get('error');
    const token = params.get('token');

    // Clear the hash immediately so the token isn't visible in the URL bar
    // any longer than necessary, and so a refresh doesn't re-use it.
    history.replaceState(null, '', window.location.pathname);

    if (err) {
      setError(err);
      return;
    }

    if (!token) {
      setError('No token received from identity provider. Please retry.');
      return;
    }

    completeOidcLogin(token)
      .then(() => navigate('/', { replace: true }))
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Sign-in failed';
        setError(message);
      });
  }, [completeOidcLogin, navigate]);

  // Specific-error detection lets us surface a one-click deep link to the
  // exact admin toggle rather than making the admin hunt for it.
  const needsEmailVerifiedFix =
    !!error && error.toLowerCase().includes('email_verified');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          borderRadius: '1rem',
          boxShadow: 'var(--shadow-lg)',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <img
          src="/icon.svg"
          alt="PriceStalker"
          style={{ width: 64, height: 64, marginBottom: '0.5rem' }}
        />
        {error ? (
          <>
            <h1 style={{ marginBottom: '0.5rem' }}>Sign-in failed</h1>
            <p style={{ color: 'var(--danger)', marginBottom: '1.5rem' }}>{error}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {needsEmailVerifiedFix && (
                <Link to="/settings?section=auth" className="btn btn-primary">
                  Open Authentication settings
                </Link>
              )}
              <Link
                to="/login?local=1"
                className={needsEmailVerifiedFix ? 'btn btn-secondary' : 'btn btn-primary'}
              >
                Back to login
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 style={{ marginBottom: '0.5rem' }}>Signing you in…</h1>
            <p style={{ color: 'var(--muted)' }}>Verifying your identity.</p>
          </>
        )}
      </div>
    </div>
  );
}
