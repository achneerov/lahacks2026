import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, API_BASE_URL, ApiError, type OfferNegotiationDetail } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import {
  AgentBubble,
  AgentChatKeyframes,
  SessionDivider,
  useStickToBottom,
  type AgentMessage,
  type AgentSender,
} from '../components/AgentChat';

const OFFER_TURNS = 5;

type NegMsg = { turn_index: number; sender: AgentSender; content: string };

type StateIntervention = {
  turnIndex: number;
  matched_topics: string[];
} | null;

type IncomingEvent =
  | {
      type: 'state';
      negotiation: OfferNegotiationDetail;
      messages: NegMsg[];
      intervention_pending?: StateIntervention;
    }
  | { type: 'started'; negotiationId: number; totalTurns: number }
  | { type: 'intervention-detected'; turnIndex: number; matched_topics: string[] }
  | { type: 'turn-start'; turnIndex: number; sender: AgentSender }
  | { type: 'delta'; turnIndex: number; sender: AgentSender; delta: string }
  | { type: 'turn-complete'; turnIndex: number; sender: AgentSender; content: string }
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

const APPLICANT_LABEL = 'Candidate-side agent';
const RECRUITER_LABEL = 'Company-side agent';

const OI = '[offer-intervention]';
function oiLog(message: string, data?: Record<string, unknown>) {
  if (data) {
    console.info(OI, message, data);
  } else {
    console.info(OI, message);
  }
}

export default function OfferNegotiation() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const negotiationId = useMemo(() => {
    const n = Number(id);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [id]);

  const [negotiation, setNegotiation] = useState<OfferNegotiationDetail | null>(null);
  const [messages, setMessages] = useState<Record<number, AgentMessage>>({});
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
  const [intervention, setIntervention] = useState<{
    turnIndex: number;
    matchedTopics: string[];
  } | null>(null);
  const [interventionComposing, setInterventionComposing] = useState(false);
  const [interventionInput, setInterventionInput] = useState('');
  const [interventionErr, setInterventionErr] = useState<string | null>(null);
  const [interventionSubmitting, setInterventionSubmitting] = useState(false);

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const interventionInputRef = useRef<HTMLTextAreaElement | null>(null);

  const messageList = useMemo(
    () => Object.values(messages).sort((a, b) => a.turnIndex - b.turnIndex),
    [messages],
  );

  const handleTranscriptScroll = useStickToBottom(
    transcriptRef,
    messageList,
    Boolean(settlement),
    verdictPending,
  );

  useEffect(() => {
    if (!negotiationId || !token) return;
    oiLog('Opening SSE', { negotiationId, url: `${API_BASE_URL}/api/offer-negotiations/${negotiationId}/stream?…` });
    const url = `${API_BASE_URL}/api/offer-negotiations/${negotiationId}/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    const nid = negotiationId;
    const t = token;

    function handleEvent(event: IncomingEvent) {
      switch (event.type) {
        case 'state': {
          oiLog('Event: state', {
            status: event.negotiation.status,
            watchPhrases: event.negotiation.intervention_topics?.length ?? 0,
            topics: event.negotiation.intervention_topics,
            interventionPending: event.intervention_pending,
            messageCount: event.messages.length,
          });
          setNegotiation(event.negotiation);
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
          const pending = event.intervention_pending;
          if (pending && Array.isArray(pending.matched_topics) && pending.matched_topics.length > 0) {
            setIntervention({ turnIndex: pending.turnIndex, matchedTopics: pending.matched_topics });
            setInterventionComposing(false);
            setInterventionInput('');
            setInterventionErr(null);
          } else {
            setIntervention(null);
            setInterventionComposing(false);
          }
          if (event.negotiation.status === 'complete' && event.negotiation.final_terms) {
            setSettlement({
              final_terms: event.negotiation.final_terms,
              key_points: event.negotiation.key_points,
              summary: event.negotiation.final_summary || '',
            });
          }
          return;
        }
        case 'intervention-detected': {
          oiLog('Event: intervention-detected (show nudge UI)', {
            turnIndex: event.turnIndex,
            matched_topics: event.matched_topics,
          });
          setInterventionComposing(false);
          setInterventionInput('');
          setIntervention({
            turnIndex: event.turnIndex,
            matchedTopics: event.matched_topics,
          });
          setInterventionErr(null);
          return;
        }
        case 'started':
          oiLog('Event: started', { totalTurns: event.totalTurns, negotiationId: event.negotiationId });
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
          if (event.sender === 'applicant_agent') {
            setIntervention((prev) => {
              if (prev && prev.turnIndex === event.turnIndex) {
                oiLog('Applicant turn complete; clearing nudge if same turn', {
                  turn: event.turnIndex,
                  wasAwaiting: true,
                });
                return null;
              }
              return prev;
            });
            setInterventionComposing(false);
            setInterventionInput('');
            setInterventionErr(null);
          }
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
          oiLog('Event: verdict-pending (settlement running)');
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
          oiLog('Event: done (stream ending)');
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

  const isApplicant = user?.role === 'Applicant';

  useEffect(() => {
    if (!interventionComposing) return;
    oiLog('Composing: textarea focused (yes → type path)');
    const id = requestAnimationFrame(() => {
      interventionInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [interventionComposing]);

  async function onInterventionUseAgent() {
    if (!token || !negotiationId || !intervention) return;
    oiLog('POST /intervene: use model for turn', { turn: intervention.turnIndex, negotiationId });
    setInterventionErr(null);
    setInterventionSubmitting(true);
    try {
      await api.applicantOfferIntervene(token, negotiationId, {
        turn_index: intervention.turnIndex,
        use_agent: true,
      });
      oiLog('use_agent OK; resuming model stream for turn', { turn: intervention.turnIndex });
      setIntervention(null);
      setInterventionComposing(false);
      setInterventionInput('');
    } catch (e) {
      oiLog('use_agent failed', { error: e instanceof Error ? e.message : String(e) });
      setInterventionErr(
        e instanceof ApiError
          ? e.detail || e.code
          : 'Could not continue with the agent. Try again.',
      );
    } finally {
      setInterventionSubmitting(false);
    }
  }

  async function onInterventionSend() {
    const text = interventionInput.trim();
    if (!token || !negotiationId || !intervention) return;
    if (!text) {
      oiLog('Send blocked: empty message');
      setInterventionErr('Type your reply below, or choose the model to respond.');
      return;
    }
    oiLog('POST /intervene: human message', {
      turn: intervention.turnIndex,
      negotiationId,
      length: text.length,
    });
    setInterventionErr(null);
    setInterventionSubmitting(true);
    try {
      await api.applicantOfferIntervene(token, negotiationId, {
        turn_index: intervention.turnIndex,
        message: text,
      });
      oiLog('Human message sent OK');
      setInterventionInput('');
      setInterventionComposing(false);
      setIntervention(null);
    } catch (e) {
      oiLog('Human message failed', { error: e instanceof Error ? e.message : String(e) });
      setInterventionErr(
        e instanceof ApiError
          ? e.detail || e.code
          : 'Could not send. Try again.',
      );
    } finally {
      setInterventionSubmitting(false);
    }
  }

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
      <AgentChatKeyframes />
      <header style={styles.header}>
        <Link to={backHref()} style={styles.backLink}>
          ← Back to messages
        </Link>
        <span className="indicator indicator-info" style={{ marginTop: 4 }}>
          Live offer negotiation
        </span>
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

      <section
        style={{
          ...styles.statusBar,
          ...(settlement ? styles.statusBarComplete : null),
        }}
        aria-label="Progress"
      >
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${Math.round(progress * 100)}%`,
              background: settlement ? 'var(--signal)' : 'var(--accent)',
            }}
          />
        </div>
        <div style={styles.statusRow}>
          <span style={styles.progressLabel}>
            Turn {Math.min(completedTurns, OFFER_TURNS)} / {OFFER_TURNS}
          </span>
          {verdictPending && (
            <span className="indicator indicator-signal">Composing final package…</span>
          )}
          {retry && !settlement && (
            <span className="indicator indicator-warning">
              {retry.label} retry {retry.attempt}/{retry.maxRetries}…
            </span>
          )}
          {inFlight && (
            <span className="indicator indicator-signal">Agents negotiating</span>
          )}
          {streamClosed && !settlement && (
            <span className="indicator indicator-neutral">Stream closed</span>
          )}
          {settlement && (
            <span className="indicator indicator-signal">Settlement reached</span>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}

      {isApplicant && inFlight && intervention && (
        <div role="alert" style={styles.interventionBar}>
          <div style={styles.interventionMark} aria-hidden>
            !
          </div>
          <div style={styles.interventionBody}>
            <p style={styles.interventionKicker}>
              {interventionComposing
                ? 'Type your own candidate-side line below'
                : 'A topic you listed came up in the negotiation flow'}
            </p>
            {!interventionComposing && (
              <>
                <p style={styles.interventionList}>
                  {intervention.matchedTopics.map((x) => (
                    <span key={x} style={styles.interventionPill}>
                      {x}
                    </span>
                  ))}
                </p>
                <p style={styles.interventionAsk}>
                  Intervene and type this turn yourself, instead of the candidate
                  agent?
                </p>
                <div style={styles.interventionRow}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      oiLog('User: Yes, I will type the reply');
                      setInterventionComposing(true);
                      setInterventionErr(null);
                    }}
                    disabled={interventionSubmitting}
                  >
                    Yes, I’ll type it
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onInterventionUseAgent}
                    disabled={interventionSubmitting}
                  >
                    No, keep the agent
                  </button>
                </div>
              </>
            )}
            {interventionComposing && (
              <p style={styles.interventionNote}>
                Use the field and send at the bottom — it’s a one-off message for
                this turn, like chat. You can also{' '}
                <button
                  type="button"
                  onClick={onInterventionUseAgent}
                  className="btn-link"
                  style={styles.interventionLinkBtn}
                  disabled={interventionSubmitting}
                >
                  switch to the model
                </button>{' '}
                instead.
              </p>
            )}
            {interventionErr && (
              <p style={styles.interventionError}>{interventionErr}</p>
            )}
          </div>
        </div>
      )}

      <section
        style={styles.transcript}
        ref={transcriptRef}
        aria-live="polite"
        onScroll={handleTranscriptScroll}
      >
        {messageList.length === 0 && inFlight && (
          <div style={styles.empty}>Starting negotiators…</div>
        )}
        {messageList.map((m) => (
          <AgentBubble
            key={m.turnIndex}
            message={m}
            applicantLabel={APPLICANT_LABEL}
            recruiterLabel={RECRUITER_LABEL}
          />
        ))}

        {settlement && (
          <>
            <SessionDivider label="Negotiation complete - suggested package below" />
            <div style={styles.settlementCard}>
              <span className="indicator indicator-signal">Suggested package</span>
              {settlement.summary && (
                <p style={styles.settlementSummary}>{settlement.summary}</p>
              )}
              <p style={styles.settlementBody}>{settlement.final_terms}</p>
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
          </>
        )}
      </section>

      <footer
        style={{
          ...styles.footer,
          ...((isApplicant && inFlight && interventionComposing) ? styles.footerWithComposer : null),
        }}
      >
        {isApplicant && inFlight && interventionComposing && intervention && (
          <div style={styles.composerBlock}>
            <label htmlFor="intervention-reply" style={styles.composerLabel}>
              Your message for this turn
            </label>
            <div style={styles.composerRow}>
              <textarea
                ref={interventionInputRef}
                id="intervention-reply"
                value={interventionInput}
                onChange={(e) => setInterventionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.shiftKey) return;
                  if (e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    void onInterventionSend();
                  }
                }}
                style={styles.composerInput}
                rows={2}
                placeholder="Same place you’d type in chat—send when ready."
                disabled={interventionSubmitting}
                aria-label="Intervention message for this negotiation turn"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void onInterventionSend()}
                disabled={interventionSubmitting}
              >
                {interventionSubmitting ? 'Sending…' : 'Send'}
              </button>
            </div>
            <p style={styles.composerHint}>
              <kbd>⌃</kbd> or <kbd>⌘</kbd> + <kbd>Enter</kbd> to send
            </p>
          </div>
        )}
        <div style={styles.footerActions}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(backHref())}
          >
            {settlement ? 'Done' : 'Run in the background'}
          </button>
        </div>
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
    transition: 'opacity 220ms ease, filter 220ms ease, transform 220ms ease',
  },
  statusBarComplete: {
    opacity: 0.8,
    filter: 'saturate(0.85)',
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
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
    borderRadius: 10,
  },
  interventionBar: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: '14px 16px',
    fontSize: 14,
    color: 'var(--text-h)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
    borderRadius: 12,
  },
  interventionMark: {
    flexShrink: 0,
    width: 28,
    height: 28,
    lineHeight: '28px',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--bg)',
    background: 'var(--danger-strong)',
    borderRadius: '50%',
  },
  interventionBody: { flex: 1, minWidth: 0 },
  interventionKicker: { margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--text-h)' },
  interventionList: { margin: '0 0 6px', display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  interventionPill: {
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text-h)',
  },
  interventionAsk: { margin: '0 0 8px', fontSize: 13, lineHeight: 1.45, color: 'var(--text)' },
  interventionRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' },
  interventionNote: { margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text)' },
  interventionError: { margin: '6px 0 0', fontSize: 13, color: 'var(--danger-strong)' },
  interventionLinkBtn: { display: 'inline', padding: 0, minHeight: 0, verticalAlign: 'baseline' },
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
  settlementCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    border: '1px solid var(--signal-border)',
    background: 'var(--signal-bg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  settlementSummary: { fontSize: 14, lineHeight: 1.5, margin: 0 },
  settlementBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    color: 'var(--text-h)',
  },
  kpList: { margin: '4px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.5 },
  metaNote: { fontSize: 12, color: 'var(--text)', fontStyle: 'italic', marginTop: 4 },
  footer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
    gap: 12,
  },
  footerWithComposer: { position: 'sticky' as const, bottom: 0, paddingTop: 8, marginTop: 8, background: 'var(--app-bg, var(--bg))' },
  footerActions: { display: 'flex', justifyContent: 'flex-end' },
  composerBlock: { display: 'flex', flexDirection: 'column' as const, gap: 6, width: '100%' },
  composerLabel: { fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--text-h)' },
  composerRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 10,
    alignItems: 'flex-end' as const,
  },
  composerInput: {
    flex: 1,
    minWidth: 200,
    boxSizing: 'border-box',
    padding: 12,
    fontSize: 14,
    lineHeight: 1.45,
    fontFamily: 'inherit',
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-h)',
    resize: 'vertical' as const,
  },
  composerHint: { margin: 0, fontSize: 12, color: 'var(--text)' },
};
