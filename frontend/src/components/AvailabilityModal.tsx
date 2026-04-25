import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { AvailabilitySlot } from '../lib/api';

interface Props {
  onClose: () => void;
  onSubmit: (slots: AvailabilitySlot[]) => Promise<void> | void;
}

interface DraftSlot {
  start: string;
  durationMinutes: number;
}

const DEFAULT_DURATION = 30;

function defaultDraft(daysFromNow: number, hour = 14): DraftSlot {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  // datetime-local input format: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
  return { start: local, durationMinutes: DEFAULT_DURATION };
}

export default function AvailabilityModal({ onClose, onSubmit }: Props) {
  const [drafts, setDrafts] = useState<DraftSlot[]>(() => [
    defaultDraft(1, 10),
    defaultDraft(2, 14),
    defaultDraft(3, 16),
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slots = useMemo<AvailabilitySlot[]>(() => {
    return drafts
      .filter((d) => d.start)
      .map((d) => {
        const start = new Date(d.start);
        if (Number.isNaN(start.valueOf())) return null;
        const end = new Date(start.getTime() + d.durationMinutes * 60000);
        return {
          label: start.toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
          start_iso: start.toISOString(),
          end_iso: end.toISOString(),
        };
      })
      .filter((s): s is AvailabilitySlot => s != null);
  }, [drafts]);

  function update(i: number, patch: Partial<DraftSlot>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function addRow() {
    setDrafts((prev) => [...prev, defaultDraft(prev.length + 1, 10)]);
  }

  function removeRow(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (slots.length === 0) {
      setError('Pick at least one time.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(slots);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Could not send your availability.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-title"
      >
        <header style={styles.header}>
          <div>
            <span style={styles.eyebrow}>Reply with availability</span>
            <h2 id="availability-title" style={styles.title}>
              Pick times that work for you
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={styles.close}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} style={styles.body}>
          <p style={styles.hint}>
            Share up to 6 windows. The recruiter will pick one and send you a
            calendar invite.
          </p>
          <ul style={styles.list}>
            {drafts.map((d, i) => (
              <li key={i} style={styles.row}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Start</span>
                  <input
                    type="datetime-local"
                    value={d.start}
                    onChange={(e) => update(i, { start: e.target.value })}
                    style={styles.input}
                    required
                  />
                </label>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Duration</span>
                  <select
                    value={d.durationMinutes}
                    onChange={(e) =>
                      update(i, { durationMinutes: Number(e.target.value) })
                    }
                    style={styles.input}
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </label>
                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    style={styles.removeBtn}
                    aria-label="Remove time"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>

          {drafts.length < 6 && (
            <button type="button" onClick={addRow} style={styles.addBtn}>
              + Add another time
            </button>
          )}

          {error && (
            <div role="alert" style={styles.error}>
              {error}
            </div>
          )}

          <div style={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.secondaryBtn}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                ...styles.primaryBtn,
                ...(submitting ? styles.primaryBtnDisabled : null),
              }}
              disabled={submitting}
            >
              {submitting ? 'Sending…' : `Send ${slots.length} time${slots.length === 1 ? '' : 's'}`}
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
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '5vh 16px',
    zIndex: 110,
    overflowY: 'auto',
  },
  modal: {
    width: 'min(560px, 100%)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: '0 30px 60px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
  },
  header: {
    padding: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    borderBottom: '1px solid var(--border)',
  },
  eyebrow: {
    display: 'inline-block',
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: { margin: 0, fontSize: 20, color: 'var(--text-h)' },
  close: {
    appearance: 'none',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text)',
    fontSize: 16,
  },
  body: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflowY: 'auto',
  },
  hint: { margin: 0, fontSize: 13, color: 'var(--text)' },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    padding: '8px 10px',
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    outline: 'none',
  },
  removeBtn: {
    appearance: 'none',
    cursor: 'pointer',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    width: 36,
    height: 36,
    color: 'var(--text)',
    fontSize: 14,
  },
  addBtn: {
    appearance: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'transparent',
    border: '1px dashed var(--accent-border)',
    borderRadius: 8,
    padding: '8px 12px',
    width: 'fit-content',
  },
  error: {
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
    borderRadius: 8,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
    marginTop: 8,
  },
  secondaryBtn: {
    appearance: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '8px 16px',
  },
  primaryBtn: {
    appearance: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 10,
    padding: '8px 18px',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};
