import {
  useEffect,
  useState,
  type FormEvent,
  type CSSProperties,
} from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const AUTOFILL = `I'm fully aligned on the role and the June timeline. To sign, I'd need the base in the $158,000–$165,000 range, a 15% bonus target, 26 PTO days, and a six-month prorated equity grant with standard single-trigger acceleration. During onboarding I can do three in-office days per week for the first ninety days, then two fixed days in the SoMa office after that. If we can get close on comp and the hybrid cadence, I'm ready to move quickly on paperwork.`;

type Props = {
  conversationId: number;
  negotiationId: number;
  onClose: () => void;
  onCounterSubmitted: (negotiationId: number) => void;
};

export default function OfferCounterModal({
  conversationId,
  negotiationId,
  onClose,
  onCounterSubmitted,
}: Props) {
  const { token } = useAuth();
  const [counter, setCounter] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.ctrlKey || !e.shiftKey || e.key.toLowerCase() !== 'f') return;
      e.preventDefault();
      setCounter(AUTOFILL);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const t = counter.trim();
    if (!t) {
      setErr('Describe your counter (pay, hours, start date, or other must-haves).');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await api.applicantOfferRespond(token, conversationId, {
        negotiation_id: negotiationId,
        action: 'counter',
        counter: t,
      });
      onCounterSubmitted(negotiationId);
      onClose();
    } catch (ex) {
      const msg =
        ex instanceof ApiError
          ? ex.detail || ex.code
          : 'Could not send your counter.';
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.backdrop} onClick={onClose} role="presentation">
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="counter-title"
      >
        <h2 id="counter-title" style={styles.title}>
          Your counter-proposal
        </h2>
        <p style={styles.hint}>
          The recruiter’s terms stay in the thread. Write what you need changed.
          If you send a counter, two AI negotiators will try to find a
          five-turn compromise, then we’ll post a suggested package for both
          sides.
        </p>
        <p style={styles.shortcut}>
          <kbd>⌃</kbd> + <kbd>⇧</kbd> + <kbd>F</kbd> fills the form (development
          shortcut).
        </p>
        <form onSubmit={submit}>
          <label style={styles.label} htmlFor="counter-text">
            Counter terms
          </label>
          <textarea
            id="counter-text"
            value={counter}
            onChange={(e) => setCounter(e.target.value)}
            style={styles.textarea}
            rows={10}
            disabled={submitting}
          />
          {err && (
            <div role="alert" style={styles.error}>
              {err}
            </div>
          )}
          <div style={styles.row}>
            <button
              type="button"
              style={styles.secondary}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.primary}
              disabled={submitting || !counter.trim()}
            >
              {submitting ? 'Sending…' : 'Send counter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 15, 20, 0.45)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    boxSizing: 'border-box',
  },
  modal: {
    width: 'min(520px, 100%)',
    maxHeight: '90vh',
    overflow: 'auto',
    background: 'var(--bg)',
    color: 'var(--text-h)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
  },
  title: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 600,
  },
  hint: {
    margin: '0 0 10px',
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text)',
  },
  shortcut: {
    fontSize: 12,
    color: 'var(--text)',
    marginBottom: 12,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 14,
    lineHeight: 1.5,
    padding: 12,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-h)',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  error: {
    marginTop: 8,
    padding: 8,
    fontSize: 13,
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
    borderRadius: 8,
  },
  row: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  secondary: {
    padding: '8px 14px',
    fontSize: 14,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-h)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primary: {
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    border: '1px solid var(--accent)',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
