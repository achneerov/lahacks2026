import type { CSSProperties } from 'react';
import type { VerificationLevel } from '../lib/api';

const VERIFICATION_META: Record<
  VerificationLevel,
  { label: string; tone: 'high' | 'mid' | 'low'; icon: string }
> = {
  orb: { label: 'Orb verified', tone: 'high', icon: '◉' },
  iris: { label: 'Iris verified', tone: 'high', icon: '◉' },
  passport: { label: 'Passport verified', tone: 'high', icon: '✦' },
  document: { label: 'Document verified', tone: 'mid', icon: '◊' },
  device: { label: 'Device verified', tone: 'low', icon: '◇' },
};

const TONE_STYLES: Record<'high' | 'mid' | 'low', CSSProperties> = {
  high: {
    color: '#106a3d',
    background: 'rgba(16, 106, 61, 0.12)',
    borderColor: 'rgba(16, 106, 61, 0.4)',
  },
  mid: {
    color: '#946200',
    background: 'rgba(255, 184, 0, 0.12)',
    borderColor: 'rgba(255, 184, 0, 0.45)',
  },
  low: {
    color: 'var(--text)',
    background: 'transparent',
    borderColor: 'var(--border)',
  },
};

export function VerificationLevelBadge({
  level,
  size = 'sm',
}: {
  level: VerificationLevel | null | undefined;
  size?: 'sm' | 'md';
}) {
  const meta = (level && VERIFICATION_META[level]) || VERIFICATION_META.device;
  const tone = TONE_STYLES[meta.tone];
  return (
    <span
      style={{
        ...badgeBase,
        ...(size === 'md' ? badgeMd : null),
        ...tone,
      }}
      title={`World ID — ${meta.label}`}
    >
      <span aria-hidden="true" style={{ fontSize: size === 'md' ? 13 : 11 }}>
        {meta.icon}
      </span>
      <span>{meta.label}</span>
    </span>
  );
}

function trustTone(score: number): 'high' | 'mid' | 'low' {
  if (score >= 85) return 'high';
  if (score >= 65) return 'mid';
  return 'low';
}

export function TrustScoreBadge({
  score,
  size = 'sm',
}: {
  score: number | null | undefined;
  size?: 'sm' | 'md';
}) {
  if (score == null) {
    return (
      <span
        style={{
          ...badgeBase,
          ...(size === 'md' ? badgeMd : null),
          ...TONE_STYLES.low,
        }}
        title="No trust score yet"
      >
        <span aria-hidden="true">○</span>
        <span>Trust —</span>
      </span>
    );
  }
  const rounded = Math.round(score);
  const tone = TONE_STYLES[trustTone(rounded)];
  return (
    <span
      style={{
        ...badgeBase,
        ...(size === 'md' ? badgeMd : null),
        ...tone,
      }}
      title="Trust score (0–100). Set by recruiter feedback after past interviews."
    >
      <span aria-hidden="true">●</span>
      <span>Trust {rounded}</span>
    </span>
  );
}

function matchTone(score: number): 'high' | 'mid' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

export function MatchScoreBadge({
  score,
  size = 'sm',
}: {
  score: number | null | undefined;
  size?: 'sm' | 'md';
}) {
  if (score == null) {
    return (
      <span
        style={{
          ...badgeBase,
          ...(size === 'md' ? badgeMd : null),
          ...TONE_STYLES.low,
        }}
        title="Match score pending — applicant agent screen has not finished."
      >
        <span aria-hidden="true">…</span>
        <span>Match pending</span>
      </span>
    );
  }
  const rounded = Math.round(score);
  const tone = TONE_STYLES[matchTone(rounded)];
  return (
    <span
      style={{
        ...badgeBase,
        ...(size === 'md' ? badgeMd : null),
        ...tone,
      }}
      title="Match score from the applicant↔recruiter agent screen."
    >
      <span aria-hidden="true">★</span>
      <span>Match {rounded}</span>
    </span>
  );
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.3,
  padding: '3px 8px',
  borderRadius: 999,
  border: '1px solid',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const badgeMd: CSSProperties = {
  fontSize: 12,
  padding: '5px 12px',
};
