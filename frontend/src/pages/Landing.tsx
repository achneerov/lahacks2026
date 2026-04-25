import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const nav = useNavigate();

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <span style={styles.eyebrow}>Welcome</span>
        <h1 style={styles.title}>
          Hire humans.<br />
          <span style={styles.titleAccent}>Verified, end to end.</span>
        </h1>
        <p style={styles.subtitle}>
          A modern hiring platform built on proof of personhood. Sign up to get
          started in seconds.
        </p>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={() => nav('/register')}
            style={styles.primary}
            onMouseEnter={(e) => {
              (e.currentTarget.style.transform = 'translateY(-1px)');
              (e.currentTarget.style.boxShadow = 'var(--shadow)');
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.style.transform = 'translateY(0)');
              (e.currentTarget.style.boxShadow = 'none');
            }}
          >
            Get Started
          </button>
          <button
            type="button"
            onClick={() => nav('/login')}
            style={styles.secondary}
          >
            Already have an account? <span style={styles.secondaryAccent}>Sign in</span>
          </button>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    boxSizing: 'border-box',
  },
  hero: {
    maxWidth: 720,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 24,
  },
  eyebrow: {
    display: 'inline-block',
    padding: '6px 14px',
    fontSize: 13,
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
    lineHeight: 1.05,
  },
  titleAccent: {
    color: 'var(--accent)',
  },
  subtitle: {
    maxWidth: 540,
    margin: 0,
    color: 'var(--text)',
    fontSize: 18,
    lineHeight: 1.5,
  },
  actions: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  primary: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '18px 44px',
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    borderRadius: 12,
    minWidth: 240,
    transition: 'transform 120ms ease, box-shadow 120ms ease',
  },
  secondary: {
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '8px 12px',
    fontSize: 14,
    color: 'var(--text)',
  },
  secondaryAccent: {
    color: 'var(--accent)',
    fontWeight: 500,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
};
