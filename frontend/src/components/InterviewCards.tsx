import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  api,
  type AvailabilityMetadata,
  type AvailabilitySlot,
  type CalendarInviteMetadata,
  type ConversationMessage,
  type InterviewGateState,
  type InterviewRequestMetadata,
  type OfferNegotiationDetail,
  type Role,
} from '../lib/api';

type Viewer = 'applicant' | 'recruiter';

interface InterviewCardProps {
  message: ConversationMessage;
  viewer: Viewer;
  interviewGateState?: InterviewGateState;
  onProposeAvailability?: () => void;
  onVerifyIdentity?: () => void;
  onSendInvite?: (slot: AvailabilitySlot) => void;
  authToken?: string | null;
  onOfferAccept?: (negotiationId: number) => void;
  onOfferCounterOpen?: (negotiationId: number) => void;
  onWatchOfferNegotiation?: (negotiationId: number) => void;
  onConfirmOfferTerms?: (negotiationId: number) => void | Promise<void>;
}

export function renderSpecialBubble(
  message: ConversationMessage,
  viewer: Viewer,
  handlers: {
    interviewGateState?: InterviewGateState;
    onProposeAvailability?: () => void;
    onVerifyIdentity?: () => void;
    onSendInvite?: (slot: AvailabilitySlot) => void;
    authToken?: string | null;
    onOfferAccept?: (negotiationId: number) => void;
    onOfferCounterOpen?: (negotiationId: number) => void;
    onWatchOfferNegotiation?: (negotiationId: number) => void;
    onConfirmOfferTerms?: (negotiationId: number) => void | Promise<void>;
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
      authToken={handlers.authToken}
      onOfferAccept={handlers.onOfferAccept}
      onOfferCounterOpen={handlers.onOfferCounterOpen}
      onWatchOfferNegotiation={handlers.onWatchOfferNegotiation}
      onConfirmOfferTerms={handlers.onConfirmOfferTerms}
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
  authToken,
  onOfferAccept,
  onOfferCounterOpen,
  onWatchOfferNegotiation,
  onConfirmOfferTerms,
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

  if (message.kind === 'offer_proposal') {
    return (
      <div style={message.from_me ? styles.cardRowMine : styles.cardRowTheirs}>
        <OfferProposalCard
          message={message}
          viewer={viewer}
          authToken={authToken}
          onOfferAccept={onOfferAccept}
          onOfferCounterOpen={onOfferCounterOpen}
          onWatchOfferNegotiation={onWatchOfferNegotiation}
        />
      </div>
    );
  }

  if (message.kind === 'offer_settled') {
    return (
      <div style={message.from_me ? styles.cardRowMine : styles.cardRowTheirs}>
        <OfferSettledCard
          message={message}
          viewer={viewer}
          authToken={authToken}
          onConfirmOfferTerms={onConfirmOfferTerms}
        />
      </div>
    );
  }

  return null;
}

function OfferSettledCard({
  message,
  viewer,
  authToken,
  onConfirmOfferTerms,
}: {
  message: ConversationMessage;
  viewer: Viewer;
  authToken?: string | null;
  onConfirmOfferTerms?: (negotiationId: number) => void | Promise<void>;
}) {
  const meta = (message.metadata || {}) as {
    negotiation_id?: number;
    error?: boolean;
    key_points?: string[];
  };
  const isErr = meta.error === true;
  const rawId = meta.negotiation_id;
  const negoId =
    typeof rawId === 'number' && rawId > 0
      ? rawId
      : typeof rawId === 'string' && Number.isFinite(Number(rawId)) && Number(rawId) > 0
        ? Number(rawId)
        : null;
  const [remote, setRemote] = useState<OfferNegotiationDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (negoId == null) return;
    if (authToken == null || authToken === '') return;
    const token: string = authToken;
    const id: number = negoId;
    let cancel = false;
    async function load() {
      try {
        const { negotiation: n } = await api.getOfferNegotiation(
          token,
          id,
        );
        if (!cancel) setRemote(n);
      } catch {
        if (!cancel) setRemote(null);
      }
    }
    void load();
    const t = setInterval(() => {
      void load();
    }, 4000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [authToken, negoId]);

  const both =
    Boolean(remote?.recruiter_confirmed_at) &&
    Boolean(remote?.applicant_confirmed_at);
  const myDone =
    viewer === 'recruiter'
      ? Boolean(remote?.recruiter_confirmed_at)
      : Boolean(remote?.applicant_confirmed_at);
  const otherDone =
    viewer === 'recruiter'
      ? Boolean(remote?.applicant_confirmed_at)
      : Boolean(remote?.recruiter_confirmed_at);
  const termsReady =
    remote != null &&
    (remote.status === 'complete' || remote.status === 'accepted_initial') &&
    !remote.error_message;
  const showBtn =
    !isErr &&
    negoId != null &&
    onConfirmOfferTerms &&
    !myDone &&
    termsReady;

  return (
    <div
      style={{
        ...styles.card,
        borderColor: isErr
          ? 'var(--danger-border)'
          : 'var(--success-border)',
        background: isErr ? 'var(--danger-bg)' : 'var(--success-bg)',
      }}
    >
      <span style={styles.cardEyebrow}>
        {isErr ? 'Offer negotiation' : 'Agreed terms (summary)'}
      </span>
      <p style={styles.cardBody}>{message.content}</p>
      {Array.isArray(meta.key_points) && meta.key_points.length > 0 && (
        <ul style={styles.slotList}>
          {meta.key_points.map((k, i) => (
            <li key={i} style={{ ...styles.slotItem, display: 'block' }}>
              {k}
            </li>
          ))}
        </ul>
      )}
      {remote && !isErr && termsReady && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 4,
          }}
        >
          {both ? (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--success)',
              }}
            >
              You both confirmed these terms in the app.
            </span>
          ) : myDone ? (
            <span style={styles.stateNote}>
              You’ve confirmed. Waiting for the other party to confirm.
            </span>
          ) : otherDone ? (
            <span style={styles.stateNote}>
              The other party has confirmed. Please confirm to complete.
            </span>
          ) : null}
        </div>
      )}
      {showBtn && negoId != null && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirmOfferTerms(negoId);
            } finally {
              setBusy(false);
            }
          }}
          style={styles.primaryActionBtn}
        >
          {busy ? 'Saving…' : 'Confirm — I agree to these terms'}
        </button>
      )}
    </div>
  );
}

function OfferProposalCard({
  message,
  viewer,
  authToken,
  onOfferAccept,
  onOfferCounterOpen,
  onWatchOfferNegotiation,
}: {
  message: ConversationMessage;
  viewer: Viewer;
  authToken?: string | null;
  onOfferAccept?: (negotiationId: number) => void;
  onOfferCounterOpen?: (negotiationId: number) => void;
  onWatchOfferNegotiation?: (negotiationId: number) => void;
}) {
  const meta = (message.metadata || {}) as { negotiation_id?: number };
  const negoId =
    typeof meta.negotiation_id === 'number' && meta.negotiation_id > 0
      ? meta.negotiation_id
      : null;
  const [remote, setRemote] = useState<OfferNegotiationDetail | null>(null);

  useEffect(() => {
    if (negoId == null) return;
    if (authToken == null || authToken === '') return;
    const token: string = authToken;
    const id: number = negoId;
    let cancel = false;
    async function load() {
      try {
        const { negotiation: n } = await api.getOfferNegotiation(
          token,
          id,
        );
        if (!cancel) setRemote(n);
      } catch {
        if (!cancel) setRemote(null);
      }
    }
    void load();
    const t = setInterval(() => {
      void load();
    }, 3500);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [authToken, negoId]);

  const displayBody = message.content.startsWith('Offer extended')
    ? message.content.replace(/^Offer extended\s*(\n)*/i, '').trimStart()
    : message.content;

  const status = remote?.status;
  const showApplicantActions =
    viewer === 'applicant' &&
    (status == null || status === 'awaiting_applicant') &&
    onOfferAccept &&
    onOfferCounterOpen;
  const waitingRecruiter =
    viewer === 'recruiter' && status === 'awaiting_applicant';
  const runningRecruiter = viewer === 'recruiter' && status === 'running';

  return (
    <div style={styles.card}>
      <span style={styles.cardEyebrow}>📝 Offer package</span>
      <p style={styles.cardBody}>{displayBody}</p>
      {waitingRecruiter && (
        <span style={styles.stateNote}>
          Awaiting the candidate’s response to this offer.
        </span>
      )}
      {runningRecruiter && (
        <span style={styles.stateNote}>
          AI negotiators are working on a counter-proposal.
        </span>
      )}
      {showApplicantActions && negoId != null && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={() => onOfferAccept(negoId)}
            style={styles.primaryActionBtn}
          >
            Accept as written
          </button>
          <button
            type="button"
            onClick={() => onOfferCounterOpen(negoId)}
            style={styles.slotActionBtn}
          >
            Send a counter
          </button>
        </div>
      )}
      {negoId != null &&
        status === 'running' &&
        onWatchOfferNegotiation && (
        <button
          type="button"
          onClick={() => onWatchOfferNegotiation(negoId)}
          style={styles.primaryActionBtn}
        >
          Watch live negotiation
        </button>
      )}
    </div>
  );
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
