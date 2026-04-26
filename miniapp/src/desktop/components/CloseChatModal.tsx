import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { api, ApiError, type TrustQuestion, type TrustResponse } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

export type CloseChatRaterRole = 'recruiter' | 'applicant';

interface Props {
  conversationId: number;
  /** Who is filling the form (drives questions + API). */
  raterRole: CloseChatRaterRole;
  /** Username of the person being rated (shown in the title). */
  ratedUsername: string;
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
  raterRole,
  ratedUsername,
  onClose,
  onClosed,
}: Props) {
  const { token } = useAuth();
  const [questions, setQuestions] = useState<TrustQuestion[] | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const req =
      raterRole === 'recruiter'
        ? api.recruiterTrustQuestions(token)
        : api.applicantRecruiterTrustQuestions(token);
    req
      .then((d) => setQuestions(d.questions))
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load questions.';
        setError(msg);
      });
  }, [token, raterRole]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!questions) return;
    const responses: TrustResponse[] = questions.map((q) => ({
      question_id: q.id,
      score: scores[q.id],
    }));

    if (
      responses.some(
        (r) =>
          typeof r.score !== 'number' ||
          !Number.isFinite(r.score) ||
          r.score < 1 ||
          r.score > 5,
      )
    ) {
      setError('Please answer every question (1–5).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body = { responses };
      const { new_trust_score } =
        raterRole === 'recruiter'
          ? await api.recruiterCloseConversation(token, conversationId, body)
          : await api.applicantCloseConversation(token, conversationId, body);
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
            <span className="indicator indicator-info">Close conversation</span>
            <h2 id="close-chat-title" style={styles.title}>
              {raterRole === 'recruiter'
                ? `How was @${ratedUsername}?`
                : `How was @${ratedUsername} as a recruiter?`}
            </h2>
            <p style={styles.subtitle}>
              Two ratings (1–5). We round their average: 5 → +2, 4 → +1, 3 → no
              change, 2 → −1, 1 → −2 on their trust score (0–100).
            </p>
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
              </div>
            ))}

            {(() => {
              const answered = questions.every((q) => scores[q.id] != null);
              if (!answered) return null;
              const avg =
                questions.reduce((sum, q) => sum + scores[q.id], 0) /
                questions.length;
              const rounded = Math.max(
                1,
                Math.min(5, Math.round(avg)),
              );
              let delta = 0;
              if (rounded === 5) delta = 2;
              else if (rounded === 4) delta = 1;
              else if (rounded === 3) delta = 0;
              else if (rounded === 2) delta = -1;
              else delta = -2;
              const deltaLabel =
                delta === 0 ? 'no change' : delta > 0 ? `+${delta}` : `${delta}`;
              return (
                <div style={styles.scorePreview}>
                  <strong style={styles.scorePreviewStrong}>
                    Average {avg.toFixed(1)} → rounds to {rounded}
                  </strong>
                  <span style={styles.scorePreviewMuted}>
                    {' '}
                    → their trust score will change by{' '}
                    <strong style={styles.scorePreviewStrong}>{deltaLabel}</strong>
                    .
                  </span>
                </div>
              );
            })()}

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
  closeOverride: {
    width: 32,
    height: 32,
    padding: 0,
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
  scorePreview: {
    fontSize: 13,
    lineHeight: 1.45,
    color: 'var(--text-h)',
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  scorePreviewStrong: { fontWeight: 600 },
  scorePreviewMuted: { color: 'var(--text)' },
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
  },
};
