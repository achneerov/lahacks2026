import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import {
  api,
  ApiError,
  type AvailabilitySlot,
  type ConversationDetail,
  type ConversationMessage,
  type ConversationSummary,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import AvailabilityModal from '../../components/AvailabilityModal';
import { renderSpecialBubble } from '../../components/InterviewCards';

type ActiveFilter = 'any' | 'open' | 'closed';

const POLL_INTERVAL_MS = 5000;

export default function ApplicantMessages() {
  const { token } = useAuth();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('any');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [thread, setThread] = useState<{
    conversation: ConversationDetail;
    messages: ConversationMessage[];
  } | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [awaitingReply, setAwaitingReply] = useState(false);

  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const loadConversations = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) {
        setConversationsLoading(true);
        setConversationsError(null);
      }
      try {
        const { conversations: list } = await api.applicantConversations(token, {
          q: debouncedSearch || undefined,
          active:
            activeFilter === 'open'
              ? true
              : activeFilter === 'closed'
                ? false
                : undefined,
        });
        setConversations(list);
      } catch (err) {
        if (opts.silent) return;
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load your messages.';
        setConversationsError(msg);
      } finally {
        if (!opts.silent) setConversationsLoading(false);
      }
    },
    [token, debouncedSearch, activeFilter],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId != null) return;
    if (conversations.length === 0) return;
    setSelectedId(conversations[0].id);
  }, [conversations, selectedId]);

  const loadThread = useCallback(
    async (conversationId: number, opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) {
        setThreadLoading(true);
        setThreadError(null);
      }
      try {
        const data = await api.applicantConversationMessages(
          token,
          conversationId,
        );
        setThread((prev) => {
          if (
            opts.silent &&
            prev &&
            prev.conversation.id === conversationId &&
            prev.messages.length === data.messages.length &&
            prev.messages[prev.messages.length - 1]?.index ===
              data.messages[data.messages.length - 1]?.index
          ) {
            return prev;
          }
          return data;
        });
      } catch (err) {
        if (opts.silent) return;
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load this conversation.';
        setThreadError(msg);
        setThread(null);
      } finally {
        if (!opts.silent) setThreadLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (selectedId == null) {
      setThread(null);
      return;
    }
    setDraft('');
    setSendError(null);
    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  useEffect(() => {
    if (selectedId == null) return;
    const id = setInterval(() => {
      void loadThread(selectedId, { silent: true });
      void loadConversations({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [selectedId, loadThread, loadConversations]);

  useEffect(() => {
    if (!thread) return;
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.conversation.id, thread?.messages.length]);

  useEffect(() => {
    const last = thread?.messages.at(-1);
    if (!last) return;
    if (!last.from_me) setAwaitingReply(false);
  }, [thread?.messages]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!token || selectedId == null) return;
    const content = draft.trim();
    if (content === '') return;
    if (!thread || thread.conversation.active === 0) {
      setSendError('This conversation is closed.');
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const { message } = await api.applicantSendMessage(
        token,
        selectedId,
        content,
      );
      setDraft('');
      setThread((prev) =>
        prev && prev.conversation.id === selectedId
          ? { ...prev, messages: [...prev.messages, message] }
          : prev,
      );
      setAwaitingReply(true);
      window.setTimeout(() => setAwaitingReply(false), 8000);
      void loadConversations({ silent: true });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail || err.code
          : 'Could not send your message.';
      setSendError(msg);
    } finally {
      setSending(false);
    }
  }

  async function handleSendAvailability(slots: AvailabilitySlot[]) {
    if (!token || selectedId == null) return;
    const { message } = await api.applicantSendAvailability(
      token,
      selectedId,
      slots,
    );
    setThread((prev) =>
      prev && prev.conversation.id === selectedId
        ? { ...prev, messages: [...prev.messages, message] }
        : prev,
    );
    void loadConversations({ silent: true });
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes wsBubbleIn {
          from { opacity: 0; transform: translateY(6px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wsDots {
          0%, 80%, 100% { opacity: 0.22; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
        @keyframes wsSoftPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(120, 120, 140, 0.16); }
          50% { box-shadow: 0 0 0 6px rgba(120, 120, 140, 0.0); }
        }
      `}</style>
      <header style={styles.header}>
        <span style={styles.eyebrow}>Applicant</span>
        <h1 style={styles.title}>Messages</h1>
        <p style={styles.subtitle}>
          Talk to recruiters and agents about open roles.
        </p>
      </header>

      {conversationsError && (
        <div role="alert" style={styles.errorBanner}>
          {conversationsError}
        </div>
      )}

      <section style={styles.layout}>
        <aside style={styles.sidebar} aria-label="Conversations">
          <div style={styles.sidebarHeader}>
            <input
              type="search"
              placeholder="Search by name, role, or job"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
            />
            <div style={styles.filterRow}>
              {(['any', 'open', 'closed'] as ActiveFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  style={{
                    ...styles.filterChip,
                    ...(activeFilter === f ? styles.filterChipActive : null),
                  }}
                >
                  {f === 'any' ? 'All' : f === 'open' ? 'Open' : 'Closed'}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.conversationList}>
            {conversationsLoading && conversations.length === 0 ? (
              <div style={styles.emptyState}>Loading…</div>
            ) : conversations.length === 0 ? (
              <div style={styles.emptyState}>
                No conversations yet. Apply to a job to start chatting with
                recruiters.
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    style={{
                      ...styles.conversationItem,
                      ...(isSelected ? styles.conversationItemActive : null),
                    }}
                  >
                    <div style={styles.conversationTopRow}>
                      <span style={styles.avatar} aria-hidden="true">
                        {c.other_party.username.slice(0, 1).toUpperCase()}
                      </span>
                      <div style={styles.conversationMain}>
                        <div style={styles.conversationNameRow}>
                          <span style={styles.conversationName}>
                            {c.other_party.username}
                          </span>
                          {c.last_message_at && (
                            <span style={styles.conversationTime}>
                              {formatRelative(c.last_message_at)}
                            </span>
                          )}
                        </div>
                        <div style={styles.conversationMetaRow}>
                          <span style={styles.rolePill}>
                            {c.other_party.role}
                          </span>
                          {c.active === 0 && (
                            <span style={styles.closedPill}>Closed</span>
                          )}
                        </div>
                        {(c.job_title || c.job_company) && (
                          <span style={styles.conversationJob}>
                            Re:{' '}
                            {c.job_title ||
                              c.job_company ||
                              'job'}
                          </span>
                        )}
                        {c.last_message ? (
                          <span style={styles.conversationPreview}>
                            {c.last_message_from_me ? 'You: ' : ''}
                            {c.last_message}
                          </span>
                        ) : (
                          <span style={styles.conversationPreviewMuted}>
                            No messages yet
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section style={styles.thread} aria-label="Conversation thread">
          {selectedId == null ? (
            <div style={styles.threadEmpty}>
              <h2 style={styles.threadEmptyTitle}>Select a conversation</h2>
              <p style={styles.threadEmptyBody}>
                Pick a chat on the left to view messages and reply.
              </p>
            </div>
          ) : threadLoading && !thread ? (
            <div style={styles.threadEmpty}>Loading conversation…</div>
          ) : threadError ? (
            <div role="alert" style={styles.errorBanner}>
              {threadError}
            </div>
          ) : thread ? (
            <>
              <header style={styles.threadHeader}>
                <div style={styles.threadHeaderTop}>
                  <span style={styles.avatarLg} aria-hidden="true">
                    {thread.conversation.other_party.username
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <div>
                    <div style={styles.threadName}>
                      {thread.conversation.other_party.username}
                    </div>
                    <div style={styles.threadMeta}>
                      <span style={styles.rolePill}>
                        {thread.conversation.other_party.role}
                      </span>
                      {thread.conversation.job_title && (
                        <span style={styles.threadMetaText}>
                          · {thread.conversation.job_title}
                        </span>
                      )}
                      {thread.conversation.job_company && (
                        <span style={styles.threadMetaMuted}>
                          · {thread.conversation.job_company}
                        </span>
                      )}
                      {thread.conversation.active === 0 && (
                        <span style={styles.closedPill}>Closed</span>
                      )}
                    </div>
                  </div>
                </div>
              </header>

              <div style={styles.messageList}>
                {thread.messages.length === 0 ? (
                  <div style={styles.threadEmpty}>
                    No messages yet. Say hi to{' '}
                    {thread.conversation.other_party.username}.
                  </div>
                ) : (
                  groupByDay(thread.messages).map((group) => (
                    <div key={group.dayKey} style={styles.dayGroup}>
                      <div style={styles.daySeparator}>
                        <span style={styles.dayLabel}>{group.label}</span>
                      </div>
                      {group.messages.map((m) => {
                        const special = renderSpecialBubble(m, 'applicant', {
                          onProposeAvailability: () =>
                            setAvailabilityOpen(true),
                        });
                        if (special) return <div key={m.index}>{special}</div>;
                        return (
                          <MessageBubble
                            key={m.index}
                            message={m}
                            otherName={
                              thread.conversation.other_party.username
                            }
                          />
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} style={styles.composer}>
                {sendError && (
                  <div role="alert" style={styles.composerError}>
                    {sendError}
                  </div>
                )}
                <div style={styles.composerRow}>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      thread.conversation.active === 0
                        ? 'This conversation is closed'
                        : `Message ${thread.conversation.other_party.username}…`
                    }
                    disabled={
                      sending || thread.conversation.active === 0
                    }
                    rows={2}
                    style={styles.textarea}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        (e.metaKey || e.ctrlKey) &&
                        !sending
                      ) {
                        e.preventDefault();
                        void handleSend(e);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      ...styles.sendBtn,
                      ...(draft.trim() === '' ||
                      sending ||
                      thread.conversation.active === 0
                        ? styles.sendBtnDisabled
                        : null),
                    }}
                    disabled={
                      sending ||
                      draft.trim() === '' ||
                      thread.conversation.active === 0
                    }
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
                <div style={styles.feedbackRow}>
                  {sending ? (
                    <span style={styles.feedbackChip}>
                      Sending
                      <TypingDots />
                    </span>
                  ) : draft.trim() ? (
                    <span style={styles.feedbackChip}>
                      You&apos;re typing
                      <TypingDots />
                    </span>
                  ) : awaitingReply ? (
                    <span style={styles.feedbackChipAwait}>
                      Waiting for reply
                      <TypingDots />
                    </span>
                  ) : null}
                </div>
                <span style={styles.composerHint}>
                  Press ⌘/Ctrl + Enter to send
                </span>
              </form>
            </>
          ) : null}

          {availabilityOpen && (
            <AvailabilityModal
              onClose={() => setAvailabilityOpen(false)}
              onSubmit={handleSendAvailability}
            />
          )}

          {selectedConversation && !thread && !threadLoading && !threadError && (
            <div style={styles.threadEmpty}>
              {selectedConversation.other_party.username}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={styles.dotsWrap} aria-hidden>
      <span style={{ ...styles.dot, animationDelay: '0ms' }} />
      <span style={{ ...styles.dot, animationDelay: '120ms' }} />
      <span style={{ ...styles.dot, animationDelay: '240ms' }} />
    </span>
  );
}

function MessageBubble({
  message,
  otherName,
}: {
  message: ConversationMessage;
  otherName: string;
}) {
  const mine = message.from_me;
  return (
    <div style={mine ? styles.messageRowMine : styles.messageRowTheirs}>
      <div style={mine ? styles.bubbleMine : styles.bubbleTheirs}>
        {!mine && <div style={styles.bubbleAuthor}>{otherName}</div>}
        <div style={styles.bubbleBody}>{message.content}</div>
        <div style={mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs}>
          {formatTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}

function parseISO(iso: string): Date | null {
  const ts = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(ts)) return null;
  return new Date(ts);
}

function formatTime(iso: string): string {
  const d = parseISO(iso);
  if (!d) return iso;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatRelative(iso: string): string {
  const d = parseISO(iso);
  if (!d) return iso;
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h`;
  if (diffSec < 7 * 86400) return `${Math.round(diffSec / 86400)}d`;
  return d.toLocaleDateString();
}

function dayLabel(d: Date): string {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const ymd = (x: Date) =>
    `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (ymd(d) === ymd(today)) return 'Today';
  if (ymd(d) === ymd(yest)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function groupByDay(messages: ConversationMessage[]) {
  const groups: { dayKey: string; label: string; messages: ConversationMessage[] }[] = [];
  for (const m of messages) {
    const d = parseISO(m.created_at);
    if (!d) continue;
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) {
      last.messages.push(m);
    } else {
      groups.push({ dayKey, label: dayLabel(d), messages: [m] });
    }
  }
  return groups;
}

const styles: Record<string, CSSProperties> = {
  page: {
    flex: 1,
    width: '100%',
    boxSizing: 'border-box',
    padding: '40px 32px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    textAlign: 'left',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  eyebrow: {
    display: 'inline-block',
    width: 'fit-content',
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#0F3D3A',
    background: '#EAF6F5',
    border: '1px solid #76B6B2',
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    margin: '8px 0 4px',
    fontSize: 32,
    lineHeight: 1.1,
    color: 'var(--text-h)',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 15,
  },
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 10,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
    gap: 20,
    alignItems: 'stretch',
    minHeight: 'min(72vh, 720px)',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border)',
    borderRadius: 16,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    minHeight: 0,
  },
  sidebarHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 16,
    borderBottom: '1px solid var(--border)',
  },
  input: {
    padding: '8px 12px',
    fontSize: 14,
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    outline: 'none',
  },
  filterRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 999,
    cursor: 'pointer',
  },
  filterChipActive: {
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
  },
  conversationList: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  conversationItem: {
    appearance: 'none',
    cursor: 'pointer',
    display: 'block',
    width: '100%',
    padding: '14px 16px',
    fontFamily: 'inherit',
    fontSize: 14,
    color: 'inherit',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    textAlign: 'left',
    transition: 'background 180ms ease, transform 180ms ease',
  },
  conversationItemActive: {
    background: 'var(--accent-bg)',
  },
  conversationTopRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    flexShrink: 0,
    background: 'var(--accent)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 600,
  },
  avatarLg: {
    width: 44,
    height: 44,
    borderRadius: 999,
    flexShrink: 0,
    background: 'var(--accent)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 600,
  },
  conversationMain: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  conversationNameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  conversationName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-h)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  conversationTime: {
    fontSize: 11,
    color: 'var(--text)',
    flexShrink: 0,
  },
  conversationMetaRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  conversationJob: {
    fontSize: 12,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  conversationPreview: {
    fontSize: 13,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
  },
  conversationPreviewMuted: {
    fontSize: 13,
    color: 'var(--text)',
    fontStyle: 'italic',
    opacity: 0.7,
  },
  rolePill: {
    fontSize: 10,
    fontWeight: 500,
    padding: '2px 8px',
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  closedPill: {
    fontSize: 10,
    fontWeight: 500,
    padding: '2px 8px',
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 999,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  emptyState: {
    padding: 32,
    fontSize: 14,
    color: 'var(--text)',
    textAlign: 'center',
  },
  thread: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border)',
    borderRadius: 16,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    minHeight: 0,
  },
  threadEmpty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    color: 'var(--text)',
    textAlign: 'center',
  },
  threadEmptyTitle: {
    margin: 0,
    fontSize: 18,
    color: 'var(--text-h)',
  },
  threadEmptyBody: {
    margin: 0,
    fontSize: 14,
    maxWidth: 420,
  },
  threadHeader: {
    padding: 18,
    borderBottom: '1px solid var(--border)',
  },
  threadHeaderTop: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  threadName: {
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  threadMeta: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
    fontSize: 13,
    color: 'var(--text)',
    marginTop: 4,
  },
  threadMetaText: {
    color: 'var(--text-h)',
  },
  threadMetaMuted: {
    color: 'var(--text)',
  },
  messageList: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  dayGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  daySeparator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '4px 0',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: 500,
    padding: '3px 10px',
    color: 'var(--text)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  messageRowMine: {
    display: 'flex',
    justifyContent: 'flex-end',
    animation: 'wsBubbleIn 280ms cubic-bezier(0.22, 1, 0.36, 1)',
  },
  messageRowTheirs: {
    display: 'flex',
    justifyContent: 'flex-start',
    animation: 'wsBubbleIn 280ms cubic-bezier(0.22, 1, 0.36, 1)',
  },
  bubbleMine: {
    maxWidth: '72%',
    padding: '10px 14px',
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: '16px 16px 4px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    boxShadow: '0 6px 12px rgba(0,0,0,0.08)',
  },
  bubbleTheirs: {
    maxWidth: '72%',
    padding: '10px 14px',
    background: 'var(--accent-bg)',
    color: 'var(--text-h)',
    border: '1px solid var(--accent-border)',
    borderRadius: '16px 16px 16px 4px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
  },
  bubbleAuthor: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    padding: '3px 10px',
    marginBottom: 2,
  },
  bubbleBody: {
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  bubbleTimeMine: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    alignSelf: 'flex-end',
  },
  bubbleTimeTheirs: {
    fontSize: 10,
    color: 'var(--text)',
    alignSelf: 'flex-end',
  },
  composer: {
    borderTop: '1px solid var(--border)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  composerError: {
    padding: '8px 12px',
    fontSize: 13,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 8,
  },
  composerRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    outline: 'none',
    resize: 'vertical',
    minHeight: 44,
    maxHeight: 200,
    lineHeight: 1.5,
  },
  sendBtn: {
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 10,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 140ms ease, opacity 140ms ease, box-shadow 140ms ease',
    boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
  },
  sendBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  composerHint: {
    fontSize: 11,
    color: 'var(--text)',
    opacity: 0.7,
  },
  feedbackRow: {
    minHeight: 18,
    display: 'flex',
    alignItems: 'center',
  },
  feedbackChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'var(--text)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    padding: '4px 10px',
  },
  feedbackChipAwait: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '4px 10px',
    animation: 'wsSoftPulse 1.8s ease-in-out infinite',
  },
  dotsWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    background: 'currentColor',
    animation: 'wsDots 950ms ease-in-out infinite',
  },
};
