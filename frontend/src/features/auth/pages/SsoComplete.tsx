// Landing page the OIDC callback redirects the browser to after exchanging the
// authorization code. The backend puts the JWT in the URL fragment (#token=...)
// because fragments are never sent to the server, keeping the token out of
// access logs and Referer headers.
//
// On load: parse the fragment, hand the token to AuthContext, then navigate to
// the dashboard on success or show the failure reason.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './SsoComplete.css';

export default function SsoComplete() {
  const navigate = useNavigate();
  const { completeOidcLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const err = params.get('error');
    const token = params.get('token');

    // Clear the fragment straight away so the token is not left in the URL bar
    // and a refresh cannot replay it.
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
      .catch((e) => setError(e instanceof Error ? e.message : 'Sign-in failed'));
  }, [completeOidcLogin, navigate]);

  // Detecting this specific failure lets us link straight to the toggle that
  // fixes it, rather than leaving the admin to hunt for it.
  const needsEmailVerifiedFix = !!error && error.toLowerCase().includes('email_verified');

  return (
    <div className="sso-complete-page">
      <div className="sso-complete-card">
        <img src="/icon.svg" alt="PriceStalker" className="sso-complete-logo" />
        {error ? (
          <>
            <h1>Sign-in failed</h1>
            <p className="sso-complete-error">{error}</p>
            <div className="sso-complete-actions">
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
            <h1>Signing you in…</h1>
            <p className="sso-complete-muted">Verifying your identity.</p>
          </>
        )}
      </div>
    </div>
  );
}
