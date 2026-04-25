import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const nav = useNavigate();
  const { setAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, user } = await api.login({ email: email.trim(), password });
      setAuth(token, user);
      nav('/');
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'invalid_credentials'
          ? 'Invalid email or password.'
          : 'Login failed. Please try again.';
      setError(msg);
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
            <h2 style={styles.formTitle}>Access the Platform</h2>
            <p style={styles.formSubtitle}>Welcome back. Enter your enterprise credentials to continue.</p>
          </div>

          <form onSubmit={onSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>CORPORATE EMAIL</label>
              <input
                type="email"
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.input}
              />
            </div>

            <button type="submit" disabled={submitting} style={styles.signInBtn}>
              {submitting ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
            
            {error && <div style={styles.errorBox}>{error}</div>}
          </form>

          <div style={styles.divider}></div>

          <button 
            type="button" 
            onClick={() => nav('/signup')} 
            style={styles.createBtn}
          >
            SIGN UP INSTEAD
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
    backgroundColor: '#000000',
    opacity: 0.75,
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
    color: '#CBD5E1', // slate-300
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
    color: '#94A3B8', // slate-400
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
    backgroundColor: '#F8FAFC', // very light slate/gray
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeft: '1px solid #E2E8F0' // slate-200
  },
  rightContentBox: {
    width: '100%',
    maxWidth: '440px',
    padding: '0 32px'
  },
  formHeader: {
    marginBottom: '40px'
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: 500,
    color: '#1E293B', // slate-800
    margin: '0 0 8px'
  },
  formSubtitle: {
    fontSize: '14px',
    color: '#64748B', // slate-500
    margin: 0
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#1E293B',
    letterSpacing: '0.5px'
  },
  input: {
    width: '100%',
    padding: '16px',
    fontSize: '15px',
    color: '#0F172A',
    backgroundColor: 'white',
    border: '1px solid #CBD5E1', // slate-300
    borderRadius: '999px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  signInBtn: {
    width: '100%',
    marginTop: '8px',
    padding: '16px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer',
    letterSpacing: '0.5px'
  },
  errorBox: {
    padding: '12px',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
    borderRadius: '8px',
    fontSize: '13px',
    textAlign: 'center'
  },
  divider: {
    height: '1px',
    backgroundColor: '#E2E8F0',
    margin: '32px 0'
  },
  createBtn: {
    width: '100%',
    padding: '16px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: 'transparent',
    color: '#1E293B',
    border: '1px solid #CBD5E1',
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
    marginTop: '64px',
    fontSize: '12px',
    color: '#94A3B8'
  },
  dot: {
    fontSize: '10px'
  }
};
