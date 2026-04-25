import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { api, ApiError, type TrustQuestion, type TrustResponse } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

interface Props {
  conversationId: number;
  applicantUsername: string;
  onClose: () => void;
  onClosed: (newTrustScore: number | null) => void;
}

const SCORE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
];

export default function CloseChatModal({
  conversationId,
  applicantUsername,
  onClose,
  onClosed,
}: Props) {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<TrustQuestion[] | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .recruiterTrustQuestions(token)
      .then((d) => setQuestions(d.questions))
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load questions.';
        setError(msg);
      });
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!questions) return;
    const responses: TrustResponse[] = questions
      .filter((q) => scores[q.id])
      .map((q) => ({
        question_id: q.id,
        score: scores[q.id],
        note: notes[q.id]?.trim() || undefined,
      }));

    if (responses.length < questions.length) {
      setError('Please answer every question (1–5).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { new_trust_score } = await api.recruiterCloseConversation(
        token,
        conversationId,
        { responses, summary: summary.trim() },
      );
      onClosed(new_trust_score);
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail || err.code
          : 'Could not close the conversation.';
      setError(msg);
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
        aria-labelledby="close-chat-title"
      >
        <header style={styles.header}>
          <div>
            <span style={styles.eyebrow}>Close conversation</span>
            <h2 id="close-chat-title" style={styles.title}>
              How was @{applicantUsername}?
            </h2>
            <p style={styles.subtitle}>
              Your honest answers update their trust score so future recruiters
              can see who is reliable.
            </p>
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

        {!questions ? (
          <div style={styles.loading}>Loading questions…</div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.body}>
            {questions.map((q) => (
              <div key={q.id} style={styles.question}>
                <div style={styles.questionLabel}>{q.label}</div>
                <div style={styles.questionHelper}>{q.helper}</div>
                <div style={styles.scoreRow}>
                  {SCORE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setScores((prev) => ({ ...prev, [q.id]: opt.value }))
                      }
                      style={{
                        ...styles.scoreBtn,
                        ...(scores[q.id] === opt.value
                          ? styles.scoreBtnActive
                          : null),
                      }}
                      aria-pressed={scores[q.id] === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Optional comment (private to your team)"
                  value={notes[q.id] || ''}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  style={styles.noteInput}
                />
              </div>
            ))}

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Summary (optional)</span>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                placeholder="Anything else worth recording?"
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
                {submitting ? 'Closing…' : 'Submit & close'}
              </button>
            </div>
          </form>
        )}
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
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'var(--text)',
    lineHeight: 1.5,
  },
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
  loading: {
    padding: 32,
    fontSize: 14,
    color: 'var(--text)',
    textAlign: 'center',
  },
  body: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    overflowY: 'auto',
  },
  question: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 14,
    background: 'var(--accent-bg)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-h)',
    lineHeight: 1.4,
  },
  questionHelper: {
    fontSize: 12,
    color: 'var(--text)',
  },
  scoreRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  scoreBtn: {
    appearance: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '6px 14px',
    minWidth: 40,
  },
  scoreBtnActive: {
    color: '#fff',
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
  },
  noteInput: {
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    outline: 'none',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
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
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 8,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
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
