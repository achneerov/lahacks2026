import type { CSSProperties } from 'react';

interface PagePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  issueNumber?: number;
}

export default function PagePlaceholder({
  eyebrow,
  title,
  description,
  issueNumber,
}: PagePlaceholderProps) {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.eyebrow}>{eyebrow}</span>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>{description}</p>
      </header>

      <section style={styles.card}>
        <span style={styles.badge}>Coming soon</span>
        <h2 style={styles.cardTitle}>This page is being built</h2>
        <p style={styles.cardBody}>
          Hang tight — this view is on the roadmap and will be wired up shortly.
          {issueNumber ? ` Tracked in issue #${issueNumber}.` : ''}
        </p>
      </section>
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
    gap: 32,
    textAlign: 'left',
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
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
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
    maxWidth: 640,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'flex-start',
    padding: 32,
    border: '1px dashed var(--border)',
    borderRadius: 16,
    background: 'var(--bg)',
  },
  badge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 10px',
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
    color: 'var(--text-h)',
  },
  cardBody: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text)',
    lineHeight: 1.5,
    maxWidth: 560,
  },
};
