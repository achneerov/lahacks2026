import {
  useEffect,
  useState,
  type FormEvent,
  type CSSProperties,
} from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const AUTOFILL = `Base salary in the $142,000–$155,000 range commensurate with level, 12% annual bonus target, 24 PTO days plus company holidays, medical/dental/vision with roughly 90% of premiums covered, $1,200 annual professional development stipend, hybrid schedule (Tuesdays and Thursdays in-office) at the San Francisco SoMa location, a start date on or after June 9, 2026, and completion of a standard background check within five business days of a signed offer.`;

type Props = {
  conversationId: number;
  onClose: () => void;
  onSent: (negotiationId: number) => void;
};

export default function ExtendOfferModal({
  conversationId,
  onClose,
  onSent,
}: Props) {
  const { token } = useAuth();
  const [terms, setTerms] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.ctrlKey || !e.shiftKey || e.key.toLowerCase() !== 'f') return;
      e.preventDefault();
      setTerms(AUTOFILL);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const t = terms.trim();
    if (!t) {
      setErr('Describe the offer (compensation, schedule, start date, and any conditions).');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const { negotiation_id } = await api.recruiterExtendOffer(
        token,
        conversationId,
        t,
      );
      onSent(negotiation_id);
      onClose();
    } catch (ex) {
      const msg =
        ex instanceof ApiError
          ? ex.detail || ex.code
          : 'Could not send the offer message.';
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
        aria-labelledby="extend-offer-title"
      >
        <h2 id="extend-offer-title" style={styles.title}>
          Extend an offer
        </h2>
        <p style={styles.hint}>
          State compensation, title or level, schedule, start date, and any
          conditions. The candidate can accept or send a written counter; if they
          counter, our agents will negotiate for up to five turns and then post a
          suggested package in this thread.
        </p>
        <p style={styles.shortcut}>
          <kbd>⌃</kbd> + <kbd>⇧</kbd> + <kbd>F</kbd> fills the form (development
          shortcut).
        </p>
        <form onSubmit={submit}>
          <label style={styles.label} htmlFor="extend-offer-terms">
            Offer terms
          </label>
          <textarea
            id="extend-offer-terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            style={styles.textarea}
            rows={10}
            disabled={submitting}
            placeholder="e.g. base, bonus, equity, benefits, work location, start date, contingencies…"
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
              disabled={submitting || !terms.trim()}
            >
              {submitting ? 'Sending…' : 'Send to candidate'}
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
