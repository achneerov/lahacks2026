import { Link, Navigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useSignup } from '../../signup/SignupContext';

export default function SignupWorldId() {
  const { basics } = useSignup();

  if (!basics) return <Navigate to="/signup" replace />;

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <span style={styles.eyebrow}>Step 2 of 3</span>
        <h1 style={styles.title}>Connect World ID</h1>
        <p style={styles.subtitle}>
          You're signing up as <strong>{basics.role}</strong> with username{' '}
          <strong>{basics.username}</strong>.
        </p>
        <p style={styles.note}>
          The World ID connection step is tracked in issue #3 and will appear here.
        </p>
        <Link to="/signup" style={styles.back}>
          ← Back to step 1
        </Link>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 32,
    border: '1px solid var(--border)',
    borderRadius: 16,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
    textAlign: 'left',
  },
  eyebrow: {
    alignSelf: 'flex-start',
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: { margin: 0, color: 'var(--text-h)', fontSize: 28, lineHeight: 1.15 },
  subtitle: { margin: 0, color: 'var(--text)', fontSize: 15 },
  note: {
    margin: 0,
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--text)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 8,
  },
  back: {
    marginTop: 8,
    fontSize: 14,
    color: 'var(--accent)',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
};
