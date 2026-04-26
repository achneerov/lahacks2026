import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

/**
 * Shared transcript primitives for the agent-vs-agent chats
 * (frontend/src/pages/Negotiation.tsx and OfferNegotiation.tsx).
 *
 * Why one place: both pages render the same kind of streaming transcript
 * — left bubble, right bubble, typing indicator, typewriter reveal, session
 * divider — and previously each had its own slightly different scroll
 * behaviour. The OfferNegotiation copy unconditionally yanked the page to
 * the bottom on every event; this module provides a single smart-scroll
 * hook so both pages share the exact same UX.
 */

export type AgentSender = 'applicant_agent' | 'recruiter_agent';

export interface AgentMessage {
  turnIndex: number;
  sender: AgentSender;
  content: string;
  done: boolean;
}

interface StickToBottomOptions {
  /** Pixel threshold from the bottom that still counts as "near the bottom". */
  threshold?: number;
}

/**
 * Smart auto-scroll for a chat-style transcript:
 * - Always pin to bottom when a brand-new message arrives.
 * - During streaming deltas, only auto-scroll if the user is already near
 *   the bottom (so they can scroll up and read history without getting
 *   yanked back).
 * - Scrolls only the transcript element — never the document — to avoid
 *   scrolling the surrounding page.
 *
 * Returns the scroll handler to wire into the transcript's `onScroll`.
 */
export function useStickToBottom(
  transcriptRef: RefObject<HTMLDivElement | null>,
  messages: AgentMessage[],
  ...extraDeps: unknown[]
): (event: React.UIEvent<HTMLDivElement>) => void {
  const stickToBottomRef = useRef(true);
  const prevMetaRef = useRef({
    count: 0,
    lastLength: 0,
    extras: extraDeps,
  });

  useEffect(() => {
    const node = transcriptRef.current;
    if (!node) return;
    const prev = prevMetaRef.current;
    const last = messages.at(-1);
    const lastLength = last?.content.length ?? 0;
    const count = messages.length;
    const hasNewMessage = count > prev.count;
    const hasStreamingUpdate =
      count === prev.count && lastLength > prev.lastLength;
    const extrasChanged = extraDeps.some((v, i) => v !== prev.extras[i]);

    const shouldScroll =
      hasNewMessage ||
      extrasChanged ||
      (stickToBottomRef.current && hasStreamingUpdate);

    if (shouldScroll) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const el = transcriptRef.current;
          if (!el) return;
          el.scrollTop = el.scrollHeight;
        });
      });
    }

    prevMetaRef.current = { count, lastLength, extras: extraDeps };
    // We intentionally read extraDeps via spread so the effect re-runs when
    // any of them change. The eslint plugin can't see through the rest arg.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, ...extraDeps]);

  return function handleScroll(event) {
    const el = event.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceToBottom < 56;
  };
}

interface BubbleProps {
  message: AgentMessage;
  applicantLabel: string;
  recruiterLabel: string;
  /**
   * If true, the active streaming bubble shows a typing indicator and
   * reveals characters with a typewriter cadence. Defaults to true.
   */
  typewriter?: boolean;
}

const _stickToBottomOptionsDefaults: Required<StickToBottomOptions> = {
  threshold: 56,
};
void _stickToBottomOptionsDefaults;

export function AgentBubble({
  message,
  applicantLabel,
  recruiterLabel,
  typewriter = true,
}: BubbleProps) {
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
        <div
          style={{
            ...styles.bubbleHeader,
            ...(isApplicant
              ? styles.bubbleHeaderApplicant
              : styles.bubbleHeaderRecruiter),
          }}
        >
          <span
            style={{
              ...styles.bubbleSender,
              ...(isApplicant
                ? styles.bubbleSenderApplicant
                : styles.bubbleSenderRecruiter),
            }}
          >
            {isApplicant ? applicantLabel : recruiterLabel}
          </span>
        </div>
        {!message.done && (
          <TypingIndicator
            label={
              isApplicant
                ? `${applicantLabel} is typing`
                : `${recruiterLabel} is typing`
            }
          />
        )}
        <p style={styles.bubbleBody}>
          {typewriter ? (
            <TypewriterBody
              content={message.content || (message.done ? '(no response)' : '')}
              active={!message.done}
            />
          ) : (
            message.content || (message.done ? '(no response)' : '')
          )}
        </p>
      </div>
    </div>
  );
}

export function TypingIndicator({ label }: { label: string }) {
  return (
    <div style={styles.typingIndicatorWrap} aria-live="polite" aria-label={label}>
      <span style={styles.typingLabel}>{label}</span>
      <span style={styles.typingDots} aria-hidden>
        <span style={{ ...styles.typingDot, animationDelay: '0ms' }} />
        <span style={{ ...styles.typingDot, animationDelay: '140ms' }} />
        <span style={{ ...styles.typingDot, animationDelay: '280ms' }} />
      </span>
    </div>
  );
}

export function TypewriterBody({
  content,
  active,
}: {
  content: string;
  active: boolean;
}) {
  const [shown, setShown] = useState(content.length);

  useEffect(() => {
    if (!active) {
      setShown(content.length);
      return;
    }
    setShown((prev) => Math.min(prev, content.length));
  }, [content, active]);

  useEffect(() => {
    if (!active) return;
    if (shown >= content.length) return;

    const nextChar = content.charAt(shown);
    let delay = 46;
    if (nextChar === ' ') delay = 22;
    else if (/[.,!?;:]/.test(nextChar)) delay = 135;
    else if (/\n/.test(nextChar)) delay = 170;

    const id = window.setTimeout(() => {
      setShown((prev) => Math.min(content.length, prev + 1));
    }, delay);
    return () => window.clearTimeout(id);
  }, [active, content, shown]);

  return <>{content.slice(0, shown)}</>;
}

export function SessionDivider({ label }: { label: string }) {
  return (
    <div style={styles.sessionDividerWrap} role="separator" aria-label={label}>
      <span style={styles.sessionDividerLine} />
      <span style={styles.sessionDividerLabel}>{label}</span>
      <span style={styles.sessionDividerLine} />
    </div>
  );
}

/**
 * Inline keyframes used by the typing indicator. Render once in any page
 * that mounts AgentBubble.
 */
export function AgentChatKeyframes(): ReactNode {
  return (
    <style>{`
      @keyframes wsTypingDot {
        0%, 80%, 100% { opacity: 0.22; transform: translateY(0); }
        40% { opacity: 1; transform: translateY(-2px); }
      }
      @keyframes wsTypingGlow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(120,120,140,0.14); }
        50% { box-shadow: 0 0 0 5px rgba(120,120,140,0.0); }
      }
    `}</style>
  );
}

const styles: Record<string, CSSProperties> = {
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
  bubbleHeaderApplicant: { justifyContent: 'space-between' },
  bubbleHeaderRecruiter: { justifyContent: 'flex-end' },
  bubbleSender: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    borderRadius: 999,
    padding: '3px 10px',
    border: '1px solid transparent',
    lineHeight: 1.2,
  },
  bubbleSenderApplicant: {
    background: 'var(--brand-gold)',
    borderColor: 'var(--brand-gold)',
    color: 'var(--brand-ink)',
  },
  bubbleSenderRecruiter: {
    background: 'var(--brand-ink)',
    borderColor: 'var(--brand-ink)',
  },
  bubbleBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--text-h)',
    whiteSpace: 'pre-wrap',
  },
  typingIndicatorWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    width: 'fit-content',
    padding: '5px 10px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.72)',
    animation: 'wsTypingGlow 1.7s ease-in-out infinite',
  },
  typingLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  typingDots: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    background: 'var(--text)',
    animation: 'wsTypingDot 1.1s ease-in-out infinite',
  },
  sessionDividerWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 2,
  },
  sessionDividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--border)',
  },
  sessionDividerLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    whiteSpace: 'nowrap',
  },
};
