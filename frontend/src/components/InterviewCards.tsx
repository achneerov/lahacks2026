import type { CSSProperties, ReactNode } from 'react';
import type {
  AvailabilityMetadata,
  AvailabilitySlot,
  CalendarInviteMetadata,
  ConversationMessage,
  InterviewGateState,
  InterviewRequestMetadata,
  Role,
} from '../lib/api';

type Viewer = 'applicant' | 'recruiter';

interface InterviewCardProps {
  message: ConversationMessage;
  viewer: Viewer;
  interviewGateState?: InterviewGateState;
  onProposeAvailability?: () => void;
  onVerifyIdentity?: () => void;
  onSendInvite?: (slot: AvailabilitySlot) => void;
}

export function renderSpecialBubble(
  message: ConversationMessage,
  viewer: Viewer,
  handlers: {
    interviewGateState?: InterviewGateState;
    onProposeAvailability?: () => void;
    onVerifyIdentity?: () => void;
    onSendInvite?: (slot: AvailabilitySlot) => void;
  },
): ReactNode | null {
  if (!message.kind || message.kind === 'text') return null;
  return (
    <InterviewCard
      message={message}
      viewer={viewer}
      interviewGateState={handlers.interviewGateState}
      onProposeAvailability={handlers.onProposeAvailability}
      onVerifyIdentity={handlers.onVerifyIdentity}
      onSendInvite={handlers.onSendInvite}
    />
  );
}

export function InterviewCard({
  message,
  viewer,
  interviewGateState,
  onProposeAvailability,
  onVerifyIdentity,
  onSendInvite,
}: InterviewCardProps) {
  if (message.kind === 'system') {
    return (
      <div style={styles.systemRow}>
        <span style={styles.systemPill}>{message.content}</span>
      </div>
    );
  }

  if (message.kind === 'interview_request') {
    const meta = (message.metadata || {}) as Partial<InterviewRequestMetadata>;
    const requiresFaceId =
      meta.requires_face_id === true ||
      interviewGateState === 'awaiting_identity' ||
      interviewGateState === 'awaiting_availability';
    const needsIdentity =
      requiresFaceId &&
      (interviewGateState === 'awaiting_identity' || interviewGateState == null);
    const canShareAvailability =
      !requiresFaceId || interviewGateState === 'awaiting_availability';
    return (
      <div style={message.from_me ? styles.cardRowMine : styles.cardRowTheirs}>
        <div style={styles.card}>
          <span style={styles.cardEyebrow}>📅 Interview request</span>
          <p style={styles.cardBody}>{message.content}</p>
          {(meta.job_title || meta.suggested_format) && (
            <div style={styles.cardMeta}>
              {meta.job_title && (
                <span style={styles.cardMetaItem}>
                  <strong>Role:</strong> {meta.job_title}
                  {meta.job_company ? ` · ${meta.job_company}` : ''}
                </span>
              )}
              {meta.suggested_format && (
                <span style={styles.cardMetaItem}>
                  <strong>Format:</strong> {meta.suggested_format}
                </span>
              )}
            </div>
          )}
          {viewer === 'applicant' && needsIdentity && onVerifyIdentity && (
            <button
              type="button"
              onClick={onVerifyIdentity}
              style={styles.primaryActionBtn}
            >
              Verify identity with World Face ID →
            </button>
          )}
          {viewer === 'applicant' && canShareAvailability && onProposeAvailability && (
            <button
              type="button"
              onClick={onProposeAvailability}
              style={styles.primaryActionBtn}
            >
              Reply with my availability →
            </button>
          )}
          {viewer === 'recruiter' &&
            requiresFaceId &&
            interviewGateState === 'awaiting_identity' && (
              <span style={styles.stateNote}>
                Waiting on applicant to confirm identity in World app.
              </span>
            )}
          {viewer === 'recruiter' &&
            requiresFaceId &&
            interviewGateState === 'awaiting_availability' && (
              <span style={styles.stateNote}>
                Identity confirmed. Waiting on availability.
              </span>
            )}
        </div>
      </div>
    );
  }

  if (message.kind === 'availability_proposal') {
    const meta = (message.metadata || { slots: [] }) as AvailabilityMetadata;
    const slots = Array.isArray(meta.slots) ? meta.slots : [];
    const showActions = viewer === 'recruiter' && !!onSendInvite;
    return (
      <div style={message.from_me ? styles.cardRowMine : styles.cardRowTheirs}>
        <div style={styles.card}>
          <span style={styles.cardEyebrow}>🗓 Proposed times</span>
          <p style={styles.cardBody}>{message.content}</p>
          <ul style={styles.slotList}>
            {slots.map((s, i) => (
              <li key={`${s.start_iso}-${i}`} style={styles.slotItem}>
                <div style={styles.slotInfo}>
                  <span style={styles.slotLabel}>{s.label}</span>
                  <span style={styles.slotTime}>
                    {formatSlotRange(s.start_iso, s.end_iso)}
                  </span>
                </div>
                {showActions && (
                  <button
                    type="button"
                    onClick={() => onSendInvite!(s)}
                    style={styles.slotActionBtn}
                  >
                    Send invite
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (message.kind === 'calendar_invite') {
    const meta = (message.metadata || {}) as Partial<CalendarInviteMetadata>;
    return (
      <div style={message.from_me ? styles.cardRowMine : styles.cardRowTheirs}>
        <div style={styles.cardCalendar}>
          <span style={styles.cardEyebrow}>📨 Calendar invite</span>
          <h4 style={styles.cardTitle}>{meta.title || 'Interview'}</h4>
          {meta.start_iso && meta.end_iso && (
            <span style={styles.cardWhen}>
              {formatSlotRange(meta.start_iso, meta.end_iso)}
            </span>
          )}
          {meta.location && (
            <span style={styles.cardWhen}>
              <strong>Where:</strong> {meta.location}
            </span>
          )}
          {meta.description && (
            <p style={styles.cardBody}>{meta.description}</p>
          )}
          {meta.google_calendar_url && (
            <a
              href={meta.google_calendar_url}
              target="_blank"
              rel="noreferrer"
              style={styles.calendarBtn}
            >
              Add to Google Calendar ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export function senderLabel(party: { username: string; role: Role | string }): string {
  return party.username;
}

function formatSlotRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.valueOf()) || Number.isNaN(e.valueOf())) {
    return `${startIso} – ${endIso}`;
  }
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const dateFmt: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };
  const timeFmt: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };
  if (sameDay) {
    return `${s.toLocaleDateString(undefined, dateFmt)} · ${s.toLocaleTimeString(
      [],
      timeFmt,
    )} – ${e.toLocaleTimeString([], timeFmt)}`;
  }
  return `${s.toLocaleString(undefined, { ...dateFmt, ...timeFmt })} → ${e.toLocaleString(
    undefined,
    { ...dateFmt, ...timeFmt },
  )}`;
}

const styles: Record<string, CSSProperties> = {
  systemRow: {
    display: 'flex',
    justifyContent: 'center',
    margin: '4px 0',
  },
  systemPill: {
    display: 'inline-block',
    padding: '6px 14px',
    fontSize: 12,
    color: 'var(--text)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  cardRowMine: { display: 'flex', justifyContent: 'flex-end' },
  cardRowTheirs: { display: 'flex', justifyContent: 'flex-start' },
  card: {
    maxWidth: 'min(440px, 80%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 16,
    background: 'var(--bg)',
    color: 'var(--text-h)',
    border: '1px solid var(--accent-border)',
    borderRadius: 16,
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.05)',
  },
  cardCalendar: {
    maxWidth: 'min(440px, 80%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 16,
    background: 'linear-gradient(180deg, var(--accent-bg) 0%, var(--bg) 100%)',
    color: 'var(--text-h)',
    border: '1px solid var(--accent-border)',
    borderRadius: 16,
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.05)',
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  cardBody: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text-h)',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  cardWhen: {
    fontSize: 13,
    color: 'var(--text-h)',
  },
  cardMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
    color: 'var(--text)',
  },
  cardMetaItem: {
    fontSize: 13,
    color: 'var(--text)',
  },
  primaryActionBtn: {
    appearance: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 999,
    padding: '8px 14px',
    width: 'fit-content',
  },
  stateNote: {
    fontSize: 12,
    color: 'var(--text)',
    fontStyle: 'italic',
  },
  slotList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  slotItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
  },
  slotInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  slotLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  slotTime: {
    fontSize: 12,
    color: 'var(--text)',
  },
  slotActionBtn: {
    appearance: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    padding: '6px 12px',
  },
  calendarBtn: {
    display: 'inline-block',
    width: 'fit-content',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    textDecoration: 'none',
    padding: '8px 14px',
    borderRadius: 999,
    marginTop: 4,
  },
};
