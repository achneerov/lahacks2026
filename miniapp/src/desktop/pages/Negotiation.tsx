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
import {
  AgentBubble,
  AgentChatKeyframes,
  SessionDivider,
  useStickToBottom,
  type AgentMessage,
  type AgentSender,
} from '../components/AgentChat';

const TOTAL_TURNS = 9;

interface Verdict {
  decision: 'recommend' | 'decline';
  reasoning: string;
  status: ApplicationStatus;
  early?: boolean;
}

type IncomingEvent =
  | { type: 'state'; application: ApplicationDetail; messages: NegotiationMessage[] }
  | { type: 'started'; applicationId: number; totalTurns: number }
  | { type: 'turn-start'; turnIndex: number; sender: AgentSender }
  | { type: 'delta'; turnIndex: number; sender: AgentSender; delta: string }
  | { type: 'turn-complete'; turnIndex: number; sender: AgentSender; content: string }
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

const APPLICANT_LABEL = 'Applicant agent';
const RECRUITER_LABEL = 'Recruiter agent';

export default function Negotiation() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const applicationId = useMemo(() => {
    const n = Number(id);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [id]);

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [messages, setMessages] = useState<Record<number, AgentMessage>>({});
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictPending, setVerdictPending] = useState(false);
  const [retry, setRetry] = useState<
    { label: string; attempt: number; maxRetries: number } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [streamClosed, setStreamClosed] = useState(false);

  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const messageList = useMemo(
    () => Object.values(messages).sort((a, b) => a.turnIndex - b.turnIndex),
    [messages],
  );

  const handleTranscriptScroll = useStickToBottom(
    transcriptRef,
    messageList,
    Boolean(verdict),
    verdictPending,
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
        const seeded: Record<number, AgentMessage> = {};
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
      <AgentChatKeyframes />
      <header style={styles.header}>
        <Link to={backHref()} style={styles.backLink}>
          ← Back
        </Link>
        <span className="indicator indicator-info" style={{ marginTop: 4 }}>
          Live agent screening
        </span>
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

      <section
        style={{
          ...styles.statusBar,
          ...(verdict ? styles.statusBarComplete : null),
        }}
        aria-label="Negotiation progress"
      >
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${Math.round(progress * 100)}%`,
              background: verdict
                ? verdict.decision === 'recommend'
                  ? 'var(--success)'
                  : 'var(--danger)'
                : 'var(--accent)',
            }}
          />
        </div>
        <div style={styles.statusRow}>
          <span style={styles.progressLabel}>
            Turn {Math.min(completedTurns, TOTAL_TURNS)} / {TOTAL_TURNS}
          </span>
          {verdictPending && (
            <span className="indicator indicator-signal">Reaching verdict…</span>
          )}
          {retry && !verdict && (
            <span className="indicator indicator-warning">
              {retry.label} retry {retry.attempt}/{retry.maxRetries}…
            </span>
          )}
          {verdict && (
            <span
              className={`indicator ${verdict.decision === 'recommend' ? 'indicator-success' : 'indicator-danger'}`}
            >
              {verdict.decision === 'recommend'
                ? 'Sent to recruiter'
                : 'Declined'}
              {verdict.early ? ' (early)' : ''}
            </span>
          )}
          {streamClosed && !verdict && (
            <span className="indicator indicator-neutral">Stream closed</span>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}

      <section
        style={styles.transcript}
        ref={transcriptRef}
        aria-live="polite"
        onScroll={handleTranscriptScroll}
      >
        {messageList.length === 0 && isPending && (
          <div style={styles.empty}>Waiting for the first message…</div>
        )}
        {messageList.map((m) => (
          <AgentBubble
            key={m.turnIndex}
            message={m}
            applicantLabel={APPLICANT_LABEL}
            recruiterLabel={RECRUITER_LABEL}
          />
        ))}
        {verdict && (
          <>
            <SessionDivider label="Session complete - verdict generated" />
            <VerdictCard verdict={verdict} application={application} />
          </>
        )}
      </section>

      <footer style={styles.footer}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate(backHref())}
        >
          {verdict ? 'Done' : 'Run in the background'}
        </button>
      </footer>
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
          ? 'var(--success-border)'
          : 'var(--danger-border)',
        background: isRecommend
          ? 'var(--success-bg)'
          : 'var(--danger-bg)',
      }}
    >
      <div style={styles.verdictHeader}>
        <span
          className={`indicator ${isRecommend ? 'indicator-success' : 'indicator-danger'}`}
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
    transition: 'opacity 220ms ease, filter 220ms ease, transform 220ms ease',
  },
  statusBarComplete: {
    opacity: 0.62,
    filter: 'saturate(0.75)',
    transform: 'translateY(-1px)',
  },
  progressTrack: {
    width: '100%',
    height: 10,
    padding: 1,
    boxSizing: 'border-box',
    background: 'linear-gradient(180deg, #EFE9DF 0%, #E6DED2 100%)',
    borderRadius: 999,
    overflow: 'hidden',
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.7)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 200ms ease',
    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
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
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
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
};
