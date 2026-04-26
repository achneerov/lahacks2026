import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  IDKitRequestWidget,
  type IDKitResult,
} from '@worldcoin/idkit';
import { ApiError, api, type WorldIdContext } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useSignup } from '../../signup/SignupContext';

export default function SignupWorldId() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const { basics, password, setWorldIdResult, reset } = useSignup();

  const [ctx, setCtx] = useState<WorldIdContext | null>(null);
  const [open, setOpen] = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoOpenedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (ctx && !autoOpenedRef.current && !submitting) {
      autoOpenedRef.current = true;
      setOpen(true);
    }
  }, [ctx, submitting]);

  useEffect(() => {
    if (!basics) return;
    let cancelled = false;
    setLoadingCtx(true);
    setError(null);
    api
      .worldIdContext()
      .then((fresh) => {
        if (cancelled) return;
        setCtx(fresh);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof ApiError
            ? `Could not start World ID flow: ${e.detail || e.code}`
            : 'Could not start World ID flow.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingCtx(false);
      });
    return () => {
      cancelled = true;
    };
  }, [basics]);

  if (!basics && !completedRef.current) return <Navigate to="/signup" replace />;
  if (!basics) return null;

  const isApplicant = basics.role === 'Applicant';

  function startVerification() {
    setError(null);
    if (!ctx) return;
    setOpen(true);
  }

  async function handleSuccess(result: IDKitResult) {
    setWorldIdResult(result);

    if (isApplicant) {
      setSubmitting(true);
      try {
        await api.checkWorldId({ world_id_result: result });
        nav('/signup/profile');
      } catch (e) {
        setError(
          e instanceof ApiError
            ? errorMessage(e.code, e.detail)
            : 'Something went wrong. Please try again.'
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const currentBasics = basics;
    if (!currentBasics || !password) {
      setError('Your signup session expired. Please start over from step 1.');
      return;
    }

    setSubmitting(true);
    try {
      const { token, user } = await api.register({
        email: currentBasics.email,
        username: currentBasics.username,
        password,
        role: currentBasics.role,
        world_id_result: result,
      });
      completedRef.current = true;
      setAuth(token, user);
      nav('/', { replace: true });
      reset();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? errorMessage(e.code, e.detail)
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const verifyDisabled = !ctx || loadingCtx || submitting;

  return (
    <div className="landing-page" style={styles.pageContainer}>
      <div style={styles.leftPanel}>
        <div style={styles.leftOverlay} />
        <div style={styles.leftContent}>
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}>
              <span style={styles.logoRingMid}></span>
              <span style={styles.logoRingInner}></span>
            </div>
            <span style={styles.logoText}>Impulse</span>
          </div>
          <div style={styles.heroTextContainer}>
            <h1 style={styles.heroTitle}>Verify once. Hire with confidence.</h1>
            <p style={styles.heroSubtitle}>
              World ID ties your account to a unique human, reducing spam and fraud across the network.
            </p>
          </div>
          <div style={styles.statsRow}>
            <div>
              <div style={styles.statLabel}>VERIFIED USERS</div>
              <div style={styles.statValue}>42,000+</div>
            </div>
            <div>
              <div style={styles.statLabel}>AI PRECISION</div>
              <div style={styles.statValue}>99.8%</div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.rightPanel}>
        <div style={styles.rightContentBox}>
          <div style={styles.stepRow}>
            <span style={styles.stepEyebrow}>
              {isApplicant ? 'Step 2 of 4' : 'Step 2 of 2'}
            </span>
            <div style={styles.stepSegments} aria-hidden>
              <div style={{ ...styles.stepSeg, ...styles.stepSegOn }} />
              <div style={{ ...styles.stepSeg, ...styles.stepSegCurrent }} />
              {isApplicant && <div style={styles.stepSeg} />}
              {isApplicant && <div style={styles.stepSeg} />}
            </div>
            <div style={styles.formHeader}>
              <h1 style={styles.formTitle}>Verify with World ID</h1>
              <p style={styles.formLead}>
                You&apos;re signing up as <strong style={{ color: 'var(--text-h)', fontWeight: 600 }}>{basics.role}</strong> with username{' '}
                <strong style={{ color: 'var(--text-h)', fontWeight: 600 }}>{basics.username}</strong>.
              </p>
            </div>
          </div>

          <p style={styles.callout}>
            {isApplicant
              ? 'After verifying, you’ll fill out your applicant profile and add any supporting documents to finish signup.'
              : 'After verifying, your recruiter account is created and you’ll go to your home view.'}
          </p>

          {!password && (
            <div role="alert" style={styles.warning}>
              Your password isn&apos;t in this session—go back to step 1 and re-enter it before verifying.
            </div>
          )}

          {error && <div role="alert" style={styles.error}>{error}</div>}

          <div style={styles.actionCol}>
            <button
              type="button"
              onClick={startVerification}
              disabled={verifyDisabled}
              style={{ ...styles.primary, ...(verifyDisabled ? styles.primaryDisabled : null) }}
            >
              {submitting
                ? 'CREATING ACCOUNT…'
                : loadingCtx
                ? 'PREPARING…'
                : 'VERIFY WITH WORLD ID'}
            </button>
            <Link to="/signup" style={styles.back}>
              ← Back to step 1
            </Link>
          </div>

          <div style={styles.footerLinks}>
            <span>Privacy Policy</span>
            <span style={styles.dot}>•</span>
            <span>Service Terms</span>
            <span style={styles.dot}>•</span>
            <span>SOC2 Compliance</span>
          </div>
        </div>
      </div>

      {ctx && (
        <IDKitRequestWidget
          app_id={ctx.app_id}
          action={ctx.action}
          rp_context={ctx.rp_context}
          allow_legacy_proofs={true}
          open={open}
          onOpenChange={setOpen}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

function errorMessage(code: string, detail?: string): string {
  switch (code) {
    case 'email_taken':
      return 'That email is already registered.';
    case 'username_taken':
      return 'That username is taken.';
    case 'world_id_already_used':
      return 'This World ID is already linked to another account.';
    case 'world_id_failed':
      return `World ID verification failed${detail ? `: ${detail}` : ''}.`;
    case 'password_too_short':
      return 'Password must be at least 8 characters.';
    case 'invalid_role':
      return 'Please choose a valid role.';
    case 'missing_fields':
      return 'Please fill out all fields.';
    default:
      return detail || code;
  }
}

const styles: Record<string, CSSProperties> = {
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
  leftOverlay: { position: 'absolute', inset: 0, backgroundColor: 'var(--brand-ink)', opacity: 0.78 },
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
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRingMid: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    position: 'absolute',
    boxSizing: 'border-box',
  },
  logoRingInner: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    position: 'absolute',
    boxSizing: 'border-box',
  },
  logoText: { fontSize: '20px', fontWeight: 500, letterSpacing: '-0.5px' },
  heroTextContainer: { maxWidth: '480px', marginBottom: '80px' },
  heroTitle: { fontSize: '28px', fontWeight: 400, margin: '0 0 24px', lineHeight: 1.3, color: 'white' },
  heroSubtitle: { fontSize: '16px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.6, margin: 0 },
  statsRow: {
    display: 'flex',
    gap: '64px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: '32px',
  },
  statLabel: { fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '1px', marginBottom: '8px' },
  statValue: { fontSize: '20px', fontWeight: 400 },
  rightPanel: {
    flex: '1',
    minWidth: 0,
    minHeight: 0,
    backgroundColor: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeft: '1px solid var(--border)',
    overflow: 'auto',
  },
  rightContentBox: { width: '100%', maxWidth: '440px', padding: '40px 32px 48px', boxSizing: 'border-box' },
  stepRow: { marginBottom: '24px' },
  stepEyebrow: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--accent-warm)',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '10px',
  },
  stepSegments: { display: 'flex', gap: 6, marginBottom: 8 },
  stepSeg: { flex: 1, height: 3, background: 'var(--border)', borderRadius: 2 },
  stepSegOn: { background: 'var(--brand-ink)' },
  stepSegCurrent: { background: 'var(--accent-warm)' },
  formHeader: { marginBottom: 0 },
  formTitle: { fontSize: '22px', fontWeight: 500, color: 'var(--text-h)', margin: '0 0 10px', letterSpacing: '-0.3px' },
  formLead: { fontSize: '14px', color: 'var(--text)', margin: 0, lineHeight: 1.6 },
  callout: {
    margin: '0 0 20px',
    padding: '16px 18px',
    fontSize: '13px',
    lineHeight: 1.5,
    color: 'var(--text)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
  },
  warning: {
    marginBottom: 16,
    padding: '14px 16px',
    fontSize: '13px',
    lineHeight: 1.45,
    color: 'var(--warning)',
    background: 'var(--warning-bg)',
    border: '1px solid var(--warning-border)',
    borderRadius: 12,
  },
  error: {
    marginBottom: 16,
    padding: '12px 14px',
    fontSize: '13px',
    color: 'var(--danger)',
    background: 'var(--danger-bg)',
    border: '1px solid var(--danger-border)',
    borderRadius: 12,
  },
  actionCol: { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 },
  back: { fontSize: '14px', fontWeight: 500, color: 'var(--accent)', textAlign: 'center', textDecoration: 'none' },
  primary: {
    appearance: 'none',
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    padding: '16px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent-warm)',
    borderRadius: '999px',
    letterSpacing: '0.5px',
    fontFamily: 'inherit',
  },
  primaryDisabled: { cursor: 'not-allowed', opacity: 0.5 },
  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 40,
    fontSize: 12,
    color: 'var(--text)',
  },
  dot: { fontSize: 10 },
};
