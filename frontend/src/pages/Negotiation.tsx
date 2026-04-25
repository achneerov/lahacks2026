import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  API_BASE_URL,
  api,
  type Application,
  type NegotiationMessage,
} from '../lib/api';

interface LiveMessage {
  turnIndex: number;
  sender: 'applicant_agent' | 'recruiter_agent';
  content: string;
  done: boolean;
}

interface Verdict {
  decision: 'recommend' | 'decline';
  reasoning: string;
  status: Application['status'];
}

export default function Negotiation() {
  const { id } = useParams();
  const { user, token, loading } = useAuth();
  const nav = useNavigate();
  const appId = Number(id);

  const [application, setApplication] = useState<Application | null>(null);
  const [messages, setMessages] = useState<Record<number, LiveMessage>>({});
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !user) nav('/login');
  }, [loading, user, nav]);

  useEffect(() => {
    if (!token || !appId) return;
    const url = `${API_BASE_URL}/api/applications/${appId}/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      let event: any;
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (event.type) {
        case 'state': {
          setApplication(event.application);
          const seeded: Record<number, LiveMessage> = {};
          for (const m of event.messages as NegotiationMessage[]) {
            seeded[m.turn_index] = {
              turnIndex: m.turn_index,
              sender: m.sender,
              content: m.content,
              done: true,
            };
          }
          setMessages(seeded);
          if (event.application.status !== 'Pending' && event.application.agent_reasoning) {
            setVerdict({
              decision: event.application.status === 'SentToRecruiter' ? 'recommend' : 'decline',
              reasoning: event.application.agent_reasoning,
              status: event.application.status,
            });
          }
          break;
        }
        case 'turn-start':
          setMessages((m) => ({
            ...m,
            [event.turnIndex]: {
              turnIndex: event.turnIndex,
              sender: event.sender,
              content: '',
              done: false,
            },
          }));
          break;
        case 'delta':
          setMessages((m) => {
            const cur = m[event.turnIndex] || {
              turnIndex: event.turnIndex,
              sender: event.sender,
              content: '',
              done: false,
            };
            return {
              ...m,
              [event.turnIndex]: { ...cur, content: cur.content + event.delta },
            };
          });
          break;
        case 'turn-complete':
          setMessages((m) => ({
            ...m,
            [event.turnIndex]: {
              turnIndex: event.turnIndex,
              sender: event.sender,
              content: event.content,
              done: true,
            },
          }));
          break;
        case 'verdict':
          setVerdict({
            decision: event.decision,
            reasoning: event.reasoning,
            status: event.status,
          });
          break;
        case 'error':
          setError(event.message || 'unknown error');
          break;
        case 'done':
          es.close();
          break;
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects unless the server closed normally; let it.
    };

    return () => es.close();
  }, [token, appId]);

  // Refresh application status when verdict arrives
  useEffect(() => {
    if (verdict && token) {
      api.getApplication(token, appId).then(({ application }) => setApplication(application));
    }
  }, [verdict, token, appId]);

  // Auto-scroll
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, verdict]);

  const ordered = useMemo(
    () => Object.values(messages).sort((a, b) => a.turnIndex - b.turnIndex),
    [messages]
  );

  const completedTurns = ordered.filter((m) => m.done).length;
  const totalTurns = 14;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Link to="/" style={styles.back}>← Home</Link>
        <h1 style={styles.title}>Agent Negotiation</h1>
        <div style={styles.meta}>
          {application
            ? `Application #${application.id} · job posting #${application.job_posting_id}`
            : 'Loading…'}
        </div>
      </div>

      {!verdict && (
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${(completedTurns / totalTurns) * 100}%`,
            }}
          />
          <div style={styles.progressText}>
            {completedTurns} / {totalTurns} turns
          </div>
        </div>
      )}

      {error && <div style={styles.error}>Error: {error}</div>}

      <div style={styles.transcript} ref={transcriptRef}>
        {ordered.length === 0 && !verdict && (
          <div style={styles.placeholder}>Waiting for the agents to begin…</div>
        )}
        {ordered.map((m) => (
          <MessageBubble key={m.turnIndex} msg={m} />
        ))}
        {verdict && <VerdictCard verdict={verdict} totalTurns={totalTurns} turnsCompleted={completedTurns} />}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: LiveMessage }) {
  const isApplicant = msg.sender === 'applicant_agent';
  const align = isApplicant ? 'flex-start' : 'flex-end';
  const bg = isApplicant ? '#eef4ff' : '#fff5e6';
  const border = isApplicant ? '#c4d8ff' : '#ffd9a6';
  const label = isApplicant ? 'APPLICANT_AGENT' : 'RECRUITER_AGENT';
  return (
    <div style={{ display: 'flex', justifyContent: align, marginBottom: 16 }}>
      <div
        style={{
          maxWidth: '75%',
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: '12px 16px',
          fontSize: 15,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, marginBottom: 6 }}>
          {label} · turn {msg.turnIndex}
          {!msg.done && <span style={{ marginLeft: 8 }}>▍</span>}
        </div>
        {msg.content || (msg.done ? '' : '…')}
      </div>
    </div>
  );
}

function VerdictCard({ verdict, totalTurns, turnsCompleted }: { verdict: Verdict; totalTurns: number; turnsCompleted: number }) {
  const isRecommend = verdict.decision === 'recommend';
  const isEarly = turnsCompleted < totalTurns;
  return (
    <div
      style={{
        marginTop: 24,
        padding: 20,
        borderRadius: 12,
        border: `2px solid ${isRecommend ? '#3a8a3a' : '#a23a3a'}`,
        background: isRecommend ? '#eaf7ea' : '#fbeaea',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 6 }}>
        {isEarly ? `EARLY VERDICT · turn ${turnsCompleted} of ${totalTurns}` : 'VERDICT'}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
        {isRecommend ? 'Recommended to employer' : 'Declined'}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {verdict.reasoning}
      </div>
      {isRecommend && (
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
          The human employer still makes the final hiring call.
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 880, margin: '32px auto', padding: 24, fontFamily: 'system-ui' },
  header: { marginBottom: 20 },
  back: { fontSize: 14, color: '#555', textDecoration: 'none' },
  title: { margin: '8px 0 4px' },
  meta: { fontSize: 13, color: '#666' },
  progressBar: {
    position: 'relative',
    height: 8,
    background: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: '#000',
    transition: 'width 200ms',
  },
  progressText: {
    position: 'absolute',
    right: 0,
    top: 12,
    fontSize: 12,
    color: '#666',
  },
  transcript: { paddingTop: 8 },
  placeholder: { color: '#999', fontStyle: 'italic', padding: 24, textAlign: 'center' },
  error: { padding: 12, background: '#fbeaea', border: '1px solid #f3b1b1', borderRadius: 8, marginBottom: 12 },
};
