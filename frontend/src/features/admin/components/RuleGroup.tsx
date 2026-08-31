import { ReactNode } from 'react';

/**
 * A labelled band of related rule cards.
 *
 * Both extraction screens previously listed every selector list as a sibling in
 * storage order, which told an administrator what the fields are called but not
 * what they are for. Grouping them by the job they do -- product information,
 * pricing, availability -- is what makes either screen navigable.
 */
export function RuleGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: '1.75rem' }}>
      <h3
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          margin: '0 0 0.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem', maxWidth: '70ch' }}>
          {description}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{children}</div>
    </section>
  );
}

/**
 * States an ordering the scraper actually applies. Both the rule precedence and
 * the stock detection order are real behaviour that is currently documented
 * nowhere a user will look, and not knowing the first one is what makes a
 * learned site-specific selector silently beating a working generic one so hard
 * to diagnose.
 */
export function PriorityNote({ label, steps }: { label: string; steps: string[] }) {
  return (
    <div
      style={{
        background: 'rgba(var(--primary-rgb), 0.06)',
        borderLeft: '3px solid var(--primary)',
        borderRadius: '0 0.35rem 0.35rem 0',
        padding: '0.6rem 0.85rem',
        margin: '0 0 1rem',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
      }}
    >
      <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '0.15rem' }}>{label}</strong>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
        {steps.map((step, i) => (
          <span key={step} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
            {step}
            {i < steps.length - 1 && <span aria-hidden="true">&rarr;</span>}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Sits under a rule card to say what the field is for, in one sentence. */
export function FieldHelp({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0', maxWidth: '70ch' }}>
      {children}
    </p>
  );
}
