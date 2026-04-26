import { useState, type CSSProperties, type FormEvent } from 'react';
import type { AvailabilitySlot, CalendarInviteInput } from '../lib/api';

interface Props {
  initialSlot: AvailabilitySlot;
  defaultTitle: string;
  onClose: () => void;
  onSubmit: (invite: CalendarInviteInput) => Promise<void> | void;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function CalendarInviteModal({
  initialSlot,
  defaultTitle,
  onClose,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState(defaultTitle);
  const [start, setStart] = useState(toLocalInput(initialSlot.start_iso));
  const [end, setEnd] = useState(toLocalInput(initialSlot.end_iso));
  const [location, setLocation] = useState('Video call (link in description)');
  const [description, setDescription] = useState(
    'Looking forward to chatting. Use the calendar invite link to add this to your schedule.',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!start || !end) {
      setError('Pick a start and end time.');
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
      setError('Invalid date.');
      return;
    }
    if (endDate <= startDate) {
      setError('End must be after start.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim() || 'Interview',
        description: description.trim(),
        location: location.trim(),
        start_iso: startDate.toISOString(),
        end_iso: endDate.toISOString(),
        slot_label: initialSlot.label,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Could not send the invite.');
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
        aria-labelledby="calendar-invite-title"
      >
        <header style={styles.header}>
          <div>
            <span className="indicator indicator-info">Send calendar invite</span>
            <h2 id="calendar-invite-title" style={styles.title}>
              Confirm interview details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={styles.closeOverride}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} style={styles.body}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Event title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              required
            />
          </label>
          <div style={styles.fieldRow}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Start</span>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                style={styles.input}
                required
              />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>End</span>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                style={styles.input}
                required
              />
            </label>
          </div>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Location</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ ...styles.input, resize: 'vertical' }}
            />
          </label>

          {error && (
            <div role="alert" style={styles.error}>
              {error}
            </div>
          )}

          <div style={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Sending…' : 'Send Google Calendar invite'}
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
    width: 'min(520px, 100%)',
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
  closeOverride: {
    width: 32,
    height: 32,
    padding: 0,
    fontSize: 16,
  },
  body: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflowY: 'auto',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
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
};
