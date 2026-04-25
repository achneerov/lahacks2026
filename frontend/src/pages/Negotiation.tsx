import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  api,
  API_BASE_URL,
  type ApplicationDetail,
  type ApplicationStatus,
  type NegotiationMessage,
} from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const TOTAL_TURNS = 14;

type Sender = 'applicant_agent' | 'recruiter_agent';

interface LiveMessage {
  turnIndex: number;
  sender: Sender;
  content: string;
  done: boolean;
}

interface Verdict {
  decision: 'recommend' | 'decline';
  reasoning: string;
  status: ApplicationStatus;
  early?: boolean;
}

type IncomingEvent =
  | { type: 'state'; application: ApplicationDetail; messages: NegotiationMessage[] }
  | { type: 'started'; applicationId: number; totalTurns: number }
  | { type: 'turn-start'; turnIndex: number; sender: Sender }
  | { type: 'delta'; turnIndex: number; sender: Sender; delta: string }
  | { type: 'turn-complete'; turnIndex: number; sender: Sender; content: string }
  | { type: 'retry'; label: string; attempt: number; maxRetries: number; waitMs: number }
  | { type: 'verdict-pending' }
  | {
      type: 'verdict';
      decision: 'recommend' | 'decline';
      reasoning: string;
      status: ApplicationStatus;
      early?: boolean;
    }
  | { type: 'error'; message: string }
  | { type: 'done' };

const SENDER_LABEL: Record<Sender, string> = {
  applicant_agent: 'Applicant agent',
  recruiter_agent: 'Recruiter agent',
};

export default function Negotiation() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const applicationId = useMemo(() => {
    const n = Number(id);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [id]);

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [messages, setMessages] = useState<Record<number, LiveMessage>>({});
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictPending, setVerdictPending] = useState(false);
  const [retry, setRetry] = useState<
    { label: string; attempt: number; maxRetries: number } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [streamClosed, setStreamClosed] = useState(false);

  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const messageList = useMemo(
    () =>
      Object.values(messages).sort((a, b) => a.turnIndex - b.turnIndex),
    [messages]
  );

  // Open the SSE stream on mount.
  useEffect(() => {
    if (!applicationId || !token) return;
    const url = `${API_BASE_URL}/api/applications/${applicationId}/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      let event: IncomingEvent;
      try {
        event = JSON.parse(ev.data);
      } catch {
        return;
      }
      handleEvent(event);
    };

    es.onerror = () => {
      // EventSource will auto-reconnect; only surface an error if we never
      // managed to seed state.
      setApplication((prev) => {
        if (!prev) setError('Lost connection to the negotiation stream.');
        return prev;
      });
    };

    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, token]);

  function handleEvent(event: IncomingEvent) {
    switch (event.type) {
      case 'state': {
        setApplication(event.application);
        const seeded: Record<number, LiveMessage> = {};
        for (const m of event.messages) {
          seeded[m.turn_index] = {
            turnIndex: m.turn_index,
            sender: m.sender,
            content: m.content,
            done: true,
          };
        }
        setMessages(seeded);
        if (
          event.application.status !== 'Pending' &&
          event.application.agent_reasoning
        ) {
          setVerdict({
            decision:
              event.application.status === 'SentToRecruiter'
                ? 'recommend'
                : 'decline',
            reasoning: event.application.agent_reasoning,
            status: event.application.status,
          });
        }
        return;
      }
      case 'started':
        return;
      case 'turn-start': {
        setMessages((prev) => ({
          ...prev,
          [event.turnIndex]: {
            turnIndex: event.turnIndex,
            sender: event.sender,
            content: '',
            done: false,
          },
        }));
        return;
      }
      case 'delta': {
        setMessages((prev) => {
          const existing = prev[event.turnIndex] || {
            turnIndex: event.turnIndex,
            sender: event.sender,
            content: '',
            done: false,
          };
          return {
            ...prev,
            [event.turnIndex]: {
              ...existing,
              content: existing.content + event.delta,
              sender: event.sender,
            },
          };
        });
        return;
      }
      case 'turn-complete': {
        setMessages((prev) => ({
          ...prev,
          [event.turnIndex]: {
            turnIndex: event.turnIndex,
            sender: event.sender,
            content: event.content,
            done: true,
          },
        }));
        return;
      }
      case 'retry': {
        setRetry({
          label: event.label,
          attempt: event.attempt,
          maxRetries: event.maxRetries,
        });
        return;
      }
      case 'verdict-pending': {
        setVerdictPending(true);
        setRetry(null);
        return;
      }
      case 'verdict': {
        setVerdictPending(false);
        setRetry(null);
        setVerdict({
          decision: event.decision,
          reasoning: event.reasoning,
          status: event.status,
          early: event.early,
        });
        // One-shot refresh of the persisted application row.
        if (token && applicationId) {
          api
            .getApplication(token, applicationId)
            .then((d) => setApplication(d.application))
            .catch(() => {
              // non-fatal
            });
        }
        return;
      }
      case 'error': {
        setError(event.message);
        return;
      }
      case 'done': {
        setStreamClosed(true);
        return;
      }
    }
  }

  // Auto-scroll to the bottom whenever the transcript changes.
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messageList, verdict, verdictPending]);

  const completedTurns = messageList.filter((m) => m.done).length;
  const progress = Math.min(1, completedTurns / TOTAL_TURNS);
  const isPending = !verdict && (application?.status === 'Pending' || application == null);

  function backHref(): string {
    if (user?.role === 'Recruiter') return '/recruiter/jobs';
    return '/applicant/applications';
  }

  if (!applicationId) {
    return (
      <div style={styles.page}>
        <p>Invalid application id.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <Link to={backHref()} style={styles.backLink}>
          ← Back
        </Link>
        <span style={styles.eyebrow}>Live agent screening</span>
        <h1 style={styles.title}>
          {application
            ? `${application.job_title}${application.job_company ? ` · ${application.job_company}` : ''}`
            : 'Loading negotiation…'}
        </h1>
        <p style={styles.subtitle}>
          Two AI agents — one advocating for the candidate, one screening for the
          recruiter — are negotiating in real time over up to {TOTAL_TURNS}{' '}
          turns.
        </p>
      </header>

      <section style={styles.statusBar} aria-label="Negotiation progress">
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${Math.round(progress * 100)}%`,
              background: verdict
                ? verdict.decision === 'recommend'
                  ? 'var(--accent)'
                  : '#9a1a1a'
                : 'var(--accent)',
            }}
          />
        </div>
        <div style={styles.statusRow}>
          <span style={styles.progressLabel}>
            Turn {Math.min(completedTurns, TOTAL_TURNS)} / {TOTAL_TURNS}
          </span>
          {verdictPending && (
            <span style={styles.statusPill}>Reaching verdict…</span>
          )}
          {retry && !verdict && (
            <span style={styles.retryPill}>
              {retry.label} retry {retry.attempt}/{retry.maxRetries}…
            </span>
          )}
          {verdict && (
            <span
              style={{
                ...styles.statusPill,
                color: verdict.decision === 'recommend' ? '#106a3d' : '#9a1a1a',
                background:
                  verdict.decision === 'recommend'
                    ? 'rgba(16, 106, 61, 0.12)'
                    : 'rgba(154, 26, 26, 0.10)',
                borderColor:
                  verdict.decision === 'recommend'
                    ? 'rgba(16, 106, 61, 0.4)'
                    : 'rgba(154, 26, 26, 0.35)',
              }}
            >
              {verdict.decision === 'recommend'
                ? 'Sent to recruiter'
                : 'Declined'}
              {verdict.early ? ' (early)' : ''}
            </span>
          )}
          {streamClosed && !verdict && (
            <span style={styles.statusPill}>Stream closed</span>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}

      <section style={styles.transcript} ref={transcriptRef} aria-live="polite">
        {messageList.length === 0 && isPending && (
          <div style={styles.empty}>Waiting for the first message…</div>
        )}
        {messageList.map((m) => (
          <Bubble key={m.turnIndex} message={m} />
        ))}
        {verdict && (
          <VerdictCard verdict={verdict} application={application} />
        )}
      </section>

      <footer style={styles.footer}>
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => navigate(backHref())}
        >
          {verdict ? 'Done' : 'Run in the background'}
        </button>
      </footer>
    </div>
  );
}

function Bubble({ message }: { message: LiveMessage }) {
  const isApplicant = message.sender === 'applicant_agent';
  return (
    <div
      style={{
        ...styles.bubbleRow,
        justifyContent: isApplicant ? 'flex-start' : 'flex-end',
      }}
    >
      <div
        style={{
          ...styles.bubble,
          ...(isApplicant ? styles.bubbleApplicant : styles.bubbleRecruiter),
        }}
      >
        <div style={styles.bubbleHeader}>
          <span style={styles.bubbleSender}>{SENDER_LABEL[message.sender]}</span>
          <span style={styles.bubbleTurn}>Turn {message.turnIndex + 1}</span>
        </div>
        <p style={styles.bubbleBody}>
          {message.content || (message.done ? '(no response)' : '')}
          {!message.done && <span style={styles.cursor}>▍</span>}
        </p>
      </div>
    </div>
  );
}

function VerdictCard({
  verdict,
  application,
}: {
  verdict: Verdict;
  application: ApplicationDetail | null;
}) {
  const isRecommend = verdict.decision === 'recommend';
  return (
    <div
      style={{
        ...styles.verdictCard,
        borderColor: isRecommend
          ? 'rgba(16, 106, 61, 0.4)'
          : 'rgba(154, 26, 26, 0.35)',
        background: isRecommend
          ? 'rgba(16, 106, 61, 0.06)'
          : 'rgba(154, 26, 26, 0.04)',
      }}
    >
      <div style={styles.verdictHeader}>
        <span
          style={{
            ...styles.verdictBadge,
            color: isRecommend ? '#106a3d' : '#9a1a1a',
            background: isRecommend
              ? 'rgba(16, 106, 61, 0.12)'
              : 'rgba(154, 26, 26, 0.10)',
            borderColor: isRecommend
              ? 'rgba(16, 106, 61, 0.4)'
              : 'rgba(154, 26, 26, 0.35)',
          }}
        >
          {verdict.early
            ? 'Early verdict'
            : isRecommend
              ? 'Verdict: recommend'
              : 'Verdict: decline'}
        </span>
        <span style={styles.verdictStatus}>
          {isRecommend
            ? 'Sent to the human recruiter for review.'
            : 'No further action — application closed.'}
        </span>
      </div>
      <p style={styles.verdictReasoning}>{verdict.reasoning}</p>
      {application?.decided_at && (
        <span style={styles.verdictMeta}>
          Decided {new Date(application.decided_at.replace(' ', 'T') + 'Z').toLocaleString()}
        </span>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    flex: 1,
    width: '100%',
    boxSizing: 'border-box',
    padding: '40px 32px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    textAlign: 'left',
    maxWidth: 960,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  backLink: {
    fontSize: 13,
    color: 'var(--text)',
    textDecoration: 'none',
    width: 'fit-content',
  },
  eyebrow: {
    display: 'inline-block',
    width: 'fit-content',
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  title: {
    margin: '8px 0 4px',
    fontSize: 28,
    lineHeight: 1.15,
    color: 'var(--text-h)',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
  },
  statusBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 16,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    background: 'var(--border)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    transition: 'width 200ms ease',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  progressLabel: {
    fontSize: 13,
    color: 'var(--text-h)',
    fontWeight: 500,
  },
  statusPill: {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 10px',
    color: 'var(--text-h)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  retryPill: {
    fontSize: 12,
    fontWeight: 500,
    padding: '3px 10px',
    color: '#946200',
    background: 'rgba(255, 184, 0, 0.12)',
    border: '1px solid rgba(255, 184, 0, 0.45)',
    borderRadius: 999,
  },
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 10,
  },
  transcript: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    minHeight: 320,
    maxHeight: '60vh',
    overflowY: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
  },
  empty: {
    padding: 24,
    fontSize: 14,
    color: 'var(--text)',
    textAlign: 'center',
  },
  bubbleRow: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '78%',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  bubbleApplicant: {
    background: 'var(--bg)',
    borderTopLeftRadius: 4,
  },
  bubbleRecruiter: {
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderTopRightRadius: 4,
  },
  bubbleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  bubbleSender: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bubbleTurn: {
    fontSize: 11,
    color: 'var(--text)',
  },
  bubbleBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: 'var(--text-h)',
    whiteSpace: 'pre-wrap',
  },
  cursor: {
    display: 'inline-block',
    marginLeft: 2,
    color: 'var(--accent)',
    animation: 'blink 1s steps(2) infinite',
  },
  verdictCard: {
    marginTop: 8,
    padding: 18,
    border: '1px solid',
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  verdictHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  verdictBadge: {
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    border: '1px solid',
    borderRadius: 999,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  verdictStatus: {
    fontSize: 13,
    color: 'var(--text)',
  },
  verdictReasoning: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: 'var(--text-h)',
  },
  verdictMeta: {
    fontSize: 12,
    color: 'var(--text)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  secondaryBtn: {
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-h)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
