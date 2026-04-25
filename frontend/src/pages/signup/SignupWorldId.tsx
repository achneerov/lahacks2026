import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  IDKitRequestWidget,
  CredentialRequest,
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

  if (!basics) return <Navigate to="/signup" replace />;

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
      setAuth(token, user);
      reset();
      nav('/', { replace: true });
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
    <main style={styles.page}>
      <section style={styles.card}>
        <span style={styles.eyebrow}>Step 2 of 3</span>
        <h1 style={styles.title}>Verify with World ID</h1>
        <p style={styles.subtitle}>
          You're signing up as <strong>{basics.role}</strong> with username{' '}
          <strong>{basics.username}</strong>.
        </p>
        <p style={styles.note}>
          {isApplicant
            ? 'After verifying, you will continue to step 3 to fill out your applicant profile.'
            : 'After verifying, your recruiter account will be created and you will be taken to your home view.'}
        </p>

        {!password && (
          <div role="alert" style={styles.warning}>
            Your password isn't in this session — go back to step 1 and re-enter it
            before verifying.
          </div>
        )}

        {error && (
          <div role="alert" style={styles.error}>
            {error}
          </div>
        )}

        <div style={styles.actions}>
          <Link to="/signup" style={styles.back}>
            ← Back to step 1
          </Link>
          <button
            type="button"
            onClick={startVerification}
            disabled={verifyDisabled}
            style={{
              ...styles.primary,
              ...(verifyDisabled ? styles.primaryDisabled : null),
            }}
          >
            {submitting
              ? 'Creating account…'
              : loadingCtx
              ? 'Preparing…'
              : 'Verify with World ID'}
          </button>
        </div>
      </section>

      {ctx && (
        <IDKitRequestWidget
          app_id={ctx.app_id}
          action={ctx.action}
          rp_context={ctx.rp_context}
          allow_legacy_proofs={false}
          constraints={CredentialRequest('proof_of_human')}
          open={open}
          onOpenChange={setOpen}
          onSuccess={handleSuccess}
        />
      )}
    </main>
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
  warning: {
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--text-h)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 8,
  },
  error: {
    padding: '10px 12px',
    fontSize: 13,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 8,
  },
  actions: {
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  back: {
    fontSize: 14,
    color: 'var(--accent)',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  primary: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '12px 20px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    borderRadius: 10,
  },
  primaryDisabled: {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
};
