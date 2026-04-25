import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api, type SignupRole } from '../../lib/api';
import { useSignup } from '../../signup/SignupContext';

const ROLES: { value: SignupRole; title: string; subtitle: string }[] = [
  {
    value: 'Applicant',
    title: 'Applicant',
    subtitle: "I'm looking for my next role.",
  },
  {
    value: 'Recruiter',
    title: 'Recruiter',
    subtitle: "I'm hiring verified humans.",
  },
];

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupBasics() {
  const nav = useNavigate();
  const { basics, setBasics, setPassword } = useSignup();

  const [email, setEmail] = useState(basics?.email ?? '');
  const [username, setUsername] = useState(basics?.username ?? '');
  const [pw, setPw] = useState('');
  const [role, setRole] = useState<SignupRole>(basics?.role ?? 'Applicant');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const localValid =
    EMAIL_RE.test(email.trim()) &&
    USERNAME_RE.test(username.trim()) &&
    pw.length >= 8;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!localValid) {
      setError('Please fix the highlighted fields and try again.');
      return;
    }

    setSubmitting(true);
    try {
      const checked = await api.signupCheckBasics({
        email: email.trim(),
        username: username.trim(),
        password: pw,
        role,
      });
      setBasics({ email: checked.email, username: checked.username, role: checked.role });
      setPassword(pw);
      nav('/signup/world-id');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? errorMessage(err.code, err.detail)
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.eyebrow}>Step 1 of 3</span>
          <h1 style={styles.title}>Create your account</h1>
          <p style={styles.subtitle}>
            Start with the basics. We'll set up World ID verification next.
          </p>
        </header>

        <form onSubmit={onSubmit} style={styles.form} noValidate>
          <label style={styles.label}>
            <span style={styles.labelText}>Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alex.chneerov"
              minLength={3}
              maxLength={32}
              required
              style={styles.input}
            />
            <span style={styles.hint}>3–32 chars. Letters, numbers, dot, underscore, hyphen.</span>
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              style={styles.input}
            />
            <span style={styles.hint}>Minimum 8 characters.</span>
          </label>

          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>I am signing up as a</legend>
            <div style={styles.roleGrid}>
              {ROLES.map((r) => {
                const active = role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    style={{
                      ...styles.roleCard,
                      ...(active ? styles.roleCardActive : null),
                    }}
                    aria-pressed={active}
                  >
                    <span style={styles.roleTitle}>{r.title}</span>
                    <span style={styles.roleSubtitle}>{r.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <div role="alert" style={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!localValid || submitting}
            style={{
              ...styles.primary,
              ...((!localValid || submitting) ? styles.primaryDisabled : null),
            }}
          >
            {submitting ? 'Checking…' : 'Continue'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.footerLink}>
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

function errorMessage(code: string, detail?: string): string {
  switch (code) {
    case 'email_taken':
      return 'That email is already registered.';
    case 'username_taken':
      return 'That username is taken.';
    case 'invalid_email':
      return 'Please enter a valid email address.';
    case 'invalid_username':
      return 'Username must be 3–32 chars (letters, numbers, dot, underscore, hyphen).';
    case 'password_too_short':
      return 'Password must be at least 8 characters.';
    case 'invalid_role':
      return 'Please choose Applicant or Recruiter.';
    case 'missing_fields':
      return 'Please fill out all fields.';
    default:
      return detail || 'Something went wrong. Please try again.';
  }
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
    gap: 28,
    padding: 32,
    border: '1px solid var(--border)',
    borderRadius: 16,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
    textAlign: 'left',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
  },
  eyebrow: {
    display: 'inline-block',
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
  title: {
    margin: 0,
    color: 'var(--text-h)',
    fontSize: 28,
    lineHeight: 1.15,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  labelText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-h)',
  },
  input: {
    appearance: 'none',
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    fontSize: 15,
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
  },
  hint: {
    fontSize: 12,
    color: 'var(--text)',
  },
  fieldset: {
    border: 0,
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  legend: {
    padding: 0,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-h)',
  },
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  roleCard: {
    appearance: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '14px 16px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    transition: 'border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
    color: 'var(--text)',
    font: 'inherit',
  },
  roleCardActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-bg)',
    boxShadow: '0 0 0 3px var(--accent-bg)',
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  roleSubtitle: {
    fontSize: 12,
    color: 'var(--text)',
    lineHeight: 1.4,
  },
  error: {
    padding: '10px 12px',
    fontSize: 13,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 8,
  },
  primary: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '14px 24px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    borderRadius: 12,
    transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
  },
  primaryDisabled: {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
  footer: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text)',
    textAlign: 'center',
  },
  footerLink: {
    color: 'var(--accent)',
    fontWeight: 500,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
};
