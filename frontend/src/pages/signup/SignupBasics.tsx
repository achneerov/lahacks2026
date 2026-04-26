import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

  function quickFill() {
    setEmail('testuser@example.com');
    setUsername('testuser');
    setPw('password123');
    setRole('Applicant');
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (e.ctrlKey && e.shiftKey && key === 'f') {
        e.preventDefault();
        quickFill();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    <div className="landing-page" style={styles.pageContainer}>
      
      {/* LEFT PANEL: Branding & Philosophy */}
      <div style={styles.leftPanel}>
        <div style={styles.leftOverlay}></div>
        <div style={styles.leftContent}>
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}>
              <span style={styles.logoRingMid}></span>
              <span style={styles.logoRingInner}></span>
            </div>
            <span style={styles.logoText}>Impulse</span>
          </div>

          <div style={styles.heroTextContainer}>
            <h1 style={styles.heroTitle}>Objective Precision in Talent Acquisition.</h1>
            <p style={styles.heroSubtitle}>
              Deploy high-performance AI agents to bridge the gap between enterprise needs and global talent pools.
            </p>
          </div>

          <div style={styles.statsRow}>
            <div style={styles.statBlock}>
              <div style={styles.statLabel}>VERIFIED USERS</div>
              <div style={styles.statValue}>42,000+</div>
            </div>
            <div style={styles.statBlock}>
              <div style={styles.statLabel}>AI PRECISION</div>
              <div style={styles.statValue}>99.8%</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Authentication Form */}
      <div style={styles.rightPanel}>
        <div style={styles.rightContentBox}>
          
          <div style={styles.formHeader}>
            <span style={styles.stepEyebrow}>Step 1 of 4</span>
            <h2 style={styles.formTitle}>Initialize Profile</h2>
            <p style={styles.formSubtitle}>Set up your foundational credentials. We'll handle World ID verification next.</p>
          </div>

          <form onSubmit={onSubmit} style={styles.form} noValidate>
            
            <div style={styles.inputGroup}>
              <label style={styles.label}>USERNAME</label>
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
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>CORPORATE EMAIL</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>PASSWORD</label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                minLength={8}
                required
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>ACCOUNT TYPE</label>
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
                      <span style={{...styles.roleTitle, color: active ? '#ffffff' : 'var(--text-h)'}}>{r.title}</span>
                      <span style={{...styles.roleSubtitle, color: active ? 'rgba(255,255,255,0.82)' : 'var(--text)'}}>{r.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={!localValid || submitting} 
              style={{
                ...styles.signInBtn,
                ...((!localValid || submitting) ? styles.disabledBtn : null)
              }}
            >
              {submitting ? 'PROCESSING...' : 'CONTINUE TO VERIFICATION'}
            </button>
            
            {error && <div style={styles.errorBox}>{error}</div>}
          </form>

          <div style={styles.divider}></div>

          <button 
            type="button" 
            onClick={() => nav('/login')} 
            style={styles.createBtn}
          >
            SIGN IN INSTEAD
          </button>

          <div style={styles.footerLinks}>
            <span>Privacy Policy</span>
            <span style={styles.dot}>•</span>
            <span>Service Terms</span>
            <span style={styles.dot}>•</span>
            <span>SOC2 Compliance</span>
          </div>

        </div>
      </div>
    </div>
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

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    fontFamily: 'Inter, system-ui, sans-serif',
    margin: 0,
    overflow: 'hidden'
  },
  
  // LEFT PANEL
  leftPanel: {
    flex: '1.2',
    position: 'relative',
    backgroundImage: 'url("/images/office.png")', // the darker office
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    flexDirection: 'column'
  },
  leftOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'var(--brand-ink)',
    opacity: 0.78,
  },
  leftContent: {
    position: 'relative',
    zIndex: 1,
    padding: '48px 64px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    color: 'white'
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoRingMid: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    position: 'absolute',
    boxSizing: 'border-box'
  },
  logoRingInner: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    position: 'absolute',
    boxSizing: 'border-box'
  },
  logoText: {
    fontSize: '20px',
    fontWeight: 500,
    letterSpacing: '-0.5px'
  },
  heroTextContainer: {
    maxWidth: '480px',
    marginBottom: '80px'
  },
  heroTitle: {
    fontSize: '28px',
    fontWeight: 400,
    margin: '0 0 24px',
    lineHeight: 1.3,
    color: 'white'
  },
  heroSubtitle: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.6,
    margin: 0
  },
  statsRow: {
    display: 'flex',
    gap: '64px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: '32px'
  },
  statLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: '1px',
    marginBottom: '8px'
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 400
  },

  // RIGHT PANEL
  rightPanel: {
    flex: '1',
    backgroundColor: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeft: '1px solid var(--border)',
    overflowY: 'auto'
  },
  rightContentBox: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px 32px'
  },
  formHeader: {
    marginBottom: '32px'
  },
  stepEyebrow: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--accent-warm)',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '8px'
  },
  formTitle: {
    fontSize: '22px',
    fontWeight: 500,
    color: 'var(--text-h)',
    margin: '0 0 8px'
  },
  formSubtitle: {
    fontSize: '14px',
    color: 'var(--text)',
    margin: 0,
    lineHeight: 1.5
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-h)',
    letterSpacing: '0.5px'
  },
  input: {
    width: '100%',
    padding: '16px',
    fontSize: '15px',
    color: 'var(--text-h)',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '999px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  roleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  roleCard: {
    appearance: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '16px 24px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    transition: 'all 0.2s ease',
  },
  roleCardActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent)',
    boxShadow: 'var(--shadow)',
  },
  roleTitle: {
    fontSize: '14px',
    fontWeight: 600,
  },
  roleSubtitle: {
    fontSize: '12px',
    lineHeight: 1.4,
  },
  signInBtn: {
    width: '100%',
    marginTop: '12px',
    padding: '16px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: 'var(--brand-ink)',
    color: '#fff',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    transition: 'opacity 0.2s'
  },
  disabledBtn: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  errorBox: {
    padding: '12px',
    backgroundColor: 'var(--danger-bg)',
    color: 'var(--danger)',
    border: '1px solid var(--danger-border)',
    borderRadius: '8px',
    fontSize: '13px',
    textAlign: 'center'
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border)',
    margin: '24px 0'
  },
  createBtn: {
    width: '100%',
    padding: '16px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: 'transparent',
    color: 'var(--text-h)',
    border: '1px solid var(--border)',
    borderRadius: '999px',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    transition: 'all 0.2s'
  },
  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    marginTop: '40px',
    fontSize: '12px',
    color: 'var(--text)'
  },
  dot: {
    fontSize: '10px'
  }
};
