import { ReactNode } from 'react';
import PasswordInput from '../../../components/PasswordInput';
import { CLEAR_SECRET, STORED_SECRET_PLACEHOLDER } from '../notificationSecrets';

interface SecretFieldProps {
  /** Input id, also used as the field name so autofill has something stable. */
  id: string;
  label: string;
  /** Whether the API reports a credential stored for this field. */
  isSet: boolean;
  /**
   * The draft value: `''` keeps the stored credential, `CLEAR_SECRET` removes
   * it, anything else replaces it.
   */
  value: string;
  onChange: (value: string) => void;
  /** Shown only when nothing is stored; a stored one gets the bullets. */
  placeholder?: string;
  /**
   * Render a textarea instead of a masked single-line input, for a credential
   * that is a document rather than a token -- the webhook's header JSON.
   *
   * It is deliberately not masked. The secrecy comes from the API withholding
   * the value, not from hiding it on screen: the box is empty until the user
   * types, and what they type is a JSON document they have to be able to read
   * to get right -- the live validation underneath it is pointless if the text
   * is dots. A one-line token has nothing to proof-read, so that stays masked.
   */
  multiline?: boolean;
  /** Help text and validation messages for this field. */
  children?: ReactNode;
}

/**
 * A write-only credential input (issue #272).
 *
 * The value is never returned by the API, so the box starts empty even for a
 * configured channel. That makes "(set)" and the placeholder the only way to
 * tell a configured channel from an unconfigured one, and it makes removing a
 * credential a deliberate action rather than an empty box -- the same shape
 * `AuthSection` uses for the OIDC client secret.
 *
 * Clearing stays inside the page's Save/Cancel model: it only marks the draft,
 * so Cancel undoes it like any other edit and nothing is written until Save.
 */
export default function SecretField({
  id,
  label,
  isSet,
  value,
  onChange,
  placeholder,
  multiline = false,
  children,
}: SecretFieldProps) {
  const isCleared = value === CLEAR_SECRET;
  const shownPlaceholder = isSet ? STORED_SECRET_PLACEHOLDER : placeholder;

  return (
    <form onSubmit={(e) => e.preventDefault()} className="form-group">
      <label htmlFor={id}>{label}{isSet ? ' (set)' : ''}</label>
      {isCleared ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <em style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            Will be removed on save.
          </em>
          <button type="button" className="btn btn-secondary" onClick={() => onChange('')}>
            Undo
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {multiline ? (
              <textarea
                id={id}
                name={id}
                className="form-control"
                style={{ height: '60px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={shownPlaceholder}
                spellCheck="false"
              />
            ) : (
              <PasswordInput
                secret
                id={id}
                name={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={shownPlaceholder}
                autoComplete="new-password"
              />
            )}
          </div>
          {isSet && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onChange(CLEAR_SECRET)}
              style={{ whiteSpace: 'nowrap' }}
            >
              Clear
            </button>
          )}
        </div>
      )}
      {isSet && (
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Never returned by the API. Leave empty to keep the stored value.
        </span>
      )}
      {children}
    </form>
  );
}
