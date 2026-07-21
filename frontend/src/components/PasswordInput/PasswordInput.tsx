import { useState, InputHTMLAttributes } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  allowReveal?: boolean;
}

export default function PasswordInput({ style, allowReveal = true, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        autoComplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
        spellCheck="false"
        {...props}
        type={visible && allowReveal ? 'text' : 'password'}
        style={{
          ...style,
          width: '100%',
          paddingRight: allowReveal ? '2.5rem' : '0.75rem',
          boxSizing: 'border-box',
        }}
      />
      {allowReveal && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVisible(!visible);
          }}
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: visible ? 'var(--primary)' : 'var(--text-muted)',
            zIndex: 10,
          }}
          title={visible ? 'Hide' : 'Show'}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? (
            // Eye-off icon (hidden)
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            // Eye icon (visible)
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
