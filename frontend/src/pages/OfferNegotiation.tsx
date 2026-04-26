import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, API_BASE_URL, type OfferNegotiationDetail } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const OFFER_TURNS = 5;

type Sender = 'applicant_agent' | 'recruiter_agent';

interface LiveMessage {
  turnIndex: number;
  sender: Sender;
  content: string;
  done: boolean;
}

type NegMsg = { turn_index: number; sender: Sender; content: string };

type IncomingEvent =
  | { type: 'state'; negotiation: OfferNegotiationDetail; messages: NegMsg[] }
  | { type: 'started'; negotiationId: number; totalTurns: number }
  | { type: 'turn-start'; turnIndex: number; sender: Sender }
  | { type: 'delta'; turnIndex: number; sender: Sender; delta: string }
  | { type: 'turn-complete'; turnIndex: number; sender: Sender; content: string }
  | { type: 'retry'; label: string; attempt: number; maxRetries: number; waitMs: number }
  | { type: 'verdict-pending' }
  | {
      type: 'settlement';
      final_terms: string;
      key_points: string[];
      summary_for_both: string;
    }
  | { type: 'error'; message: string }
  | { type: 'done' };

const SENDER_LABEL: Record<Sender, string> = {
  applicant_agent: 'Candidate-side agent',
  recruiter_agent: 'Company-side agent',
};

export default function OfferNegotiation() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const negotiationId = useMemo(() => {
    const n = Number(id);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [id]);

  const [negotiation, setNegotiation] = useState<OfferNegotiationDetail | null>(null);
  const [messages, setMessages] = useState<Record<number, LiveMessage>>({});
  const [settlement, setSettlement] = useState<{
    final_terms: string;
    key_points: string[];
    summary: string;
  } | null>(null);
  const [verdictPending, setVerdictPending] = useState(false);
  const [retry, setRetry] = useState<{
    label: string;
    attempt: number;
    maxRetries: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamClosed, setStreamClosed] = useState(false);

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!negotiationId || !token) return;
    const url = `${API_BASE_URL}/api/offer-negotiations/${negotiationId}/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    const nid = negotiationId;
    const t = token;

    function handleEvent(event: IncomingEvent) {
    switch (event.type) {
      case 'state': {
        setNegotiation(event.negotiation);
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
        if (event.negotiation.status === 'complete' && event.negotiation.final_terms) {
          setSettlement({
            final_terms: event.negotiation.final_terms,
            key_points: event.negotiation.key_points,
            summary: event.negotiation.final_summary || '',
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
      case 'settlement': {
        setVerdictPending(false);
        setRetry(null);
        setSettlement({
          final_terms: event.final_terms,
          key_points: event.key_points,
          summary: event.summary_for_both,
        });
        if (t && nid) {
          api
            .getOfferNegotiation(t, nid)
            .then((d) => setNegotiation(d.negotiation))
            .catch(() => {
              /* */
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
      setNegotiation((prev) => {
        if (!prev) setError('Lost connection to the offer negotiation stream.');
        return prev;
      });
    };

    return () => {
      es.close();
    };
  }, [negotiationId, token]);

  const messageList = useMemo(
    () => Object.values(messages).sort((a, b) => a.turnIndex - b.turnIndex),
    [messages],
  );

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    transcriptEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messageList, settlement, verdictPending]);

  const completedTurns = messageList.filter((m) => m.done).length;
  const progress = Math.min(1, completedTurns / OFFER_TURNS);
  const inFlight =
    negotiation != null && negotiation.status === 'running' && !settlement;

  function backHref(): string {
    if (user?.role === 'Recruiter') return '/recruiter/messages';
    return '/applicant/messages';
  }

  if (!negotiationId) {
    return (
      <div style={styles.page}>
        <p>Invalid offer id.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <Link to={backHref()} style={styles.backLink}>
          ← Back to messages
        </Link>
        <span style={styles.eyebrow}>Live offer negotiation</span>
        <h1 style={styles.title}>
          {negotiation
            ? `Offer #${negotiation.id} · ${negotiation.status.replace(/_/g, ' ')}`
            : 'Loading…'}
        </h1>
        <p style={styles.subtitle}>
          Two roles — one advocating for the candidate, one for the company — exchange up to {OFFER_TURNS}{' '}
          messages, then we settle on a suggested package in both your inboxes.
        </p>
      </header>

      <section style={styles.statusBar} aria-label="Progress">
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${Math.round(progress * 100)}%`,
              background: settlement ? 'var(--accent)' : 'var(--accent)',
            }}
          />
        </div>
        <div style={styles.statusRow}>
          <span style={styles.progressLabel}>
            Turn {Math.min(completedTurns, OFFER_TURNS)} / {OFFER_TURNS}
          </span>
          {verdictPending && (
            <span style={styles.statusPill}>Composing final package…</span>
          )}
          {retry && !settlement && (
            <span style={styles.retryPill}>
              {retry.label} retry {retry.attempt}/{retry.maxRetries}…
            </span>
          )}
          {inFlight && (
            <span style={styles.statusPill}>Agents negotiating</span>
          )}
          {streamClosed && !settlement && (
            <span style={styles.statusPill}>Stream closed</span>
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
      >
        {messageList.length === 0 && inFlight && (
          <div style={styles.empty}>Starting negotiators…</div>
        )}
        {messageList.map((m) => (
          <div
            key={m.turnIndex}
            style={{
              ...styles.bubbleRow,
              justifyContent: m.sender === 'applicant_agent' ? 'flex-start' : 'flex-end',
            }}
          >
            <div
              style={{
                ...styles.bubble,
                ...(m.sender === 'applicant_agent'
                  ? styles.bubbleApplicant
                  : styles.bubbleRecruiter),
              }}
            >
              <span
                style={{
                  ...styles.bubbleSender,
                  ...(m.sender === 'applicant_agent'
                    ? styles.bubbleSenderApplicant
                    : styles.bubbleSenderRecruiter),
                }}
              >
                {SENDER_LABEL[m.sender]}
              </span>
              <p style={styles.bubbleBody}>
                {m.content || (m.done ? '…' : '')}
              </p>
            </div>
          </div>
        ))}

        {settlement && (
          <div style={styles.settlementCard}>
            <span style={styles.cardEyebrow}>Suggested package</span>
            {settlement.summary && <p style={styles.settlementSummary}>{settlement.summary}</p>}
            <p style={styles.bubbleBody}>{settlement.final_terms}</p>
            {settlement.key_points.length > 0 && (
              <ul style={styles.kpList}>
                {settlement.key_points.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            )}
            <p style={styles.metaNote}>
              This also appears in your messages thread. It is a suggestion, not a binding contract.
            </p>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </section>

      <footer style={styles.footer}>
        <button
          type="button"
          style={styles.secondaryBtn}
          onClick={() => navigate(backHref())}
        >
          {settlement ? 'Done' : 'Run in the background'}
        </button>
      </footer>
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
    maxWidth: 900,
    margin: '0 auto',
  },
  header: { display: 'flex', flexDirection: 'column', gap: 6 },
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
    fontSize: 26,
    lineHeight: 1.15,
    color: 'var(--text-h)',
  },
  subtitle: { margin: 0, color: 'var(--text)', fontSize: 14 },
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
    height: 10,
    borderRadius: 999,
    background: 'var(--border)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 200ms ease',
  },
  statusRow: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  progressLabel: { fontSize: 13, fontWeight: 500, color: 'var(--text-h)' },
  statusPill: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 10px',
    textTransform: 'uppercase',
    borderRadius: 999,
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
  },
  retryPill: {
    fontSize: 12,
    color: 'var(--warning)',
    background: 'var(--warning-bg)',
    border: '1px solid var(--warning-border)',
    borderRadius: 999,
    padding: '3px 10px',
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
    minHeight: 280,
    maxHeight: '58vh',
    overflowY: 'auto',
    padding: 16,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  empty: { textAlign: 'center', color: 'var(--text)', padding: 24, fontSize: 14 },
  bubbleRow: { display: 'flex', width: '100%' },
  bubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 12,
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  bubbleApplicant: { alignSelf: 'flex-start' },
  bubbleRecruiter: {
    alignSelf: 'flex-end',
    background: 'var(--accent-bg)',
    borderColor: 'var(--accent-border)',
  },
  bubbleSender: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: '2px 8px',
    borderRadius: 999,
    width: 'fit-content',
  },
  bubbleSenderApplicant: { background: 'var(--success)', color: '#fff' },
  bubbleSenderRecruiter: { background: 'var(--brand-ink)', color: '#fff' },
  bubbleBody: { margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' },
  settlementCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    border: '1px solid var(--success-border)',
    background: 'var(--success-bg)',
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--accent)',
  },
  settlementSummary: { fontSize: 14, lineHeight: 1.5, margin: '8px 0 0' },
  kpList: { margin: '8px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.5 },
  metaNote: { fontSize: 12, color: 'var(--text)', fontStyle: 'italic', marginTop: 8 },
  footer: { display: 'flex', justifyContent: 'flex-end' },
  secondaryBtn: {
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: 'transparent',
  },
};
