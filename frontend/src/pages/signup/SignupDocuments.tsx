import { type CSSProperties } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import UploadedDocsManager from '../../components/UploadedDocsManager';

export default function SignupDocuments() {
  const nav = useNavigate();
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: 32 }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'Applicant') return <Navigate to="/" replace />;

  return (
    <div style={layout.pageContainer}>
      <div style={layout.leftPanel}>
        <div style={layout.leftOverlay} />
        <div style={layout.leftContent}>
          <div style={layout.logoRow}>
            <div style={layout.logoIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <span style={layout.logoText}>AegisTalent</span>
          </div>
          <div style={layout.heroTextContainer}>
            <h1 style={layout.heroTitle}>Give your AI agent something to cite.</h1>
            <p style={layout.heroSubtitle}>
              Upload your school transcripts and letters of recommendation as
              PDFs. We extract the text so the agent that represents you in
              applications can quote them by name — not invent them.
            </p>
          </div>
          <div style={layout.statsRow}>
            <div>
              <div style={layout.statLabel}>PARSED LOCALLY</div>
              <div style={layout.statValue}>Text only</div>
            </div>
            <div>
              <div style={layout.statLabel}>YOU CONTROL</div>
              <div style={layout.statValue}>Add or remove anytime</div>
            </div>
          </div>
        </div>
      </div>

      <div style={layout.rightPanel}>
        <div style={layout.rightContentBox}>
          <div style={s.panelHeader}>
            <span style={s.panelStepCounter}>Almost done · Optional step</span>
            <h1 style={s.panelTitle}>Upload supporting documents</h1>
            <p style={s.panelSubtitle}>
              Optional. You can do this now or later from your profile.
            </p>
          </div>

          <div style={s.body}>
            <UploadedDocsManager variant="plain" />
          </div>

          <div style={s.navRow}>
            <button
              type="button"
              style={s.secondary}
              onClick={() => nav('/', { replace: true })}
            >
              Skip for now
            </button>
            <button
              type="button"
              style={{ ...s.primary, ...s.primaryFlex }}
              onClick={() => nav('/', { replace: true })}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const layout: Record<string, CSSProperties> = {
  pageContainer: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    minHeight: '100vh',
    maxHeight: '100vh',
    fontFamily: 'Inter, system-ui, sans-serif',
    margin: 0,
    overflow: 'hidden',
  },
  leftPanel: {
    flex: '1.2',
    alignSelf: 'stretch',
    position: 'relative',
    backgroundImage: 'url("/images/office.png")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
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
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    color: 'white',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoIcon: {
    width: '32px',
    height: '32px',
    backgroundColor: 'white',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: '20px', fontWeight: 500, letterSpacing: '-0.5px' },
  heroTextContainer: { maxWidth: '480px', marginBottom: '80px' },
  heroTitle: {
    fontSize: '28px',
    fontWeight: 400,
    margin: '0 0 24px',
    lineHeight: 1.3,
    color: 'white',
  },
  heroSubtitle: {
    fontSize: '16px',
    color: '#CBD5E1',
    lineHeight: 1.6,
    margin: 0,
  },
  statsRow: {
    display: 'flex',
    gap: '64px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: '32px',
  },
  statLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#94A3B8',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  statValue: { fontSize: '20px', fontWeight: 400 },
  rightPanel: {
    flex: '1',
    minWidth: 0,
    minHeight: 0,
    backgroundColor: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderLeft: '1px solid #E2E8F0',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  rightContentBox: {
    width: '100%',
    maxWidth: '600px',
    padding: '40px 32px 56px',
    boxSizing: 'border-box',
    minHeight: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
};

const s: Record<string, CSSProperties> = {
  panelHeader: { marginBottom: 18 },
  panelStepCounter: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#3B82F6',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  panelTitle: {
    fontSize: '22px',
    fontWeight: 500,
    color: '#1E293B',
    margin: '0 0 6px',
    letterSpacing: '-0.3px',
  },
  panelSubtitle: {
    fontSize: '14px',
    color: '#64748B',
    margin: 0,
    lineHeight: 1.55,
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 20,
    padding: '20px 22px',
    marginBottom: 16,
  },
  navRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'stretch',
    marginTop: 'auto',
    paddingTop: 14,
  },
  secondary: {
    appearance: 'none',
    cursor: 'pointer',
    padding: '16px 22px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#0F172A',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '999px',
    fontFamily: 'inherit',
    letterSpacing: '0.5px',
    flex: '0 0 auto',
    minWidth: 140,
  },
  primary: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '16px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    background: '#0F172A',
    borderRadius: '999px',
    letterSpacing: '0.5px',
    fontFamily: 'inherit',
  },
  primaryFlex: { flex: 1 },
};
