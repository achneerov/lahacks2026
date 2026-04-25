import { useEffect, useState, type CSSProperties } from 'react';
import { api, ApiError, type ApplicantHomeResponse } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

export default function ApplicantHome() {
  const { user, token } = useAuth();

  const [data, setData] = useState<ApplicantHomeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .applicantHome(token)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load your dashboard.';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const stats = data?.stats;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.eyebrow}>Applicant dashboard</span>
        <h1 style={styles.title}>
          Welcome back,{' '}
          <span style={styles.titleAccent}>{user?.username ?? 'there'}</span>
        </h1>
        <p style={styles.subtitle}>
          Here's what's happening with your job search today.
        </p>
      </header>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}

      <section style={styles.statsGrid}>
        <StatCard
          label="Profile completeness"
          value={loading ? '—' : `${stats?.profile_completeness ?? 0}%`}
          hint="Fill in more details to attract recruiters."
          progress={stats?.profile_completeness ?? 0}
        />
        <StatCard
          label="Active conversations"
          value={loading ? '—' : String(stats?.active_conversations ?? 0)}
          hint="Open threads with recruiters and agents."
        />
        <StatCard
          label="Messages received"
          value={loading ? '—' : String(stats?.messages_received ?? 0)}
          hint="Total inbound messages across all chats."
        />
        <StatCard
          label="Open jobs"
          value={loading ? '—' : String(stats?.open_jobs ?? 0)}
          hint="Live postings on the marketplace."
        />
      </section>

      <section style={styles.columns}>
        <article style={styles.card}>
          <header style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Recent conversations</h2>
            <span style={styles.cardSubtitle}>
              Your latest threads with recruiters and agents
            </span>
          </header>

          {loading ? (
            <p style={styles.empty}>Loading…</p>
          ) : data && data.recent_conversations.length > 0 ? (
            <ul style={styles.list}>
              {data.recent_conversations.map((c) => (
                <li key={c.id} style={styles.listItem}>
                  <div style={styles.itemTopRow}>
                    <span style={styles.itemTitle}>
                      {c.other_party.username}
                    </span>
                    <span style={styles.pill}>{c.other_party.role}</span>
                  </div>
                  <div style={styles.itemMeta}>
                    {c.job_title ? (
                      <span style={styles.itemMetaText}>
                        Re: {c.job_title}
                      </span>
                    ) : (
                      <span style={styles.itemMetaMuted}>General chat</span>
                    )}
                    {c.last_message_at && (
                      <span style={styles.itemMetaMuted}>
                        · {formatRelative(c.last_message_at)}
                      </span>
                    )}
                  </div>
                  {c.last_message && (
                    <p style={styles.itemBody}>{c.last_message}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={styles.empty}>
              You don't have any conversations yet. Apply to jobs to get
              started.
            </p>
          )}
        </article>

        <article style={styles.card}>
          <header style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Featured jobs</h2>
            <span style={styles.cardSubtitle}>
              Newest active postings from verified recruiters
            </span>
          </header>

          {loading ? (
            <p style={styles.empty}>Loading…</p>
          ) : data && data.featured_jobs.length > 0 ? (
            <ul style={styles.list}>
              {data.featured_jobs.map((j) => (
                <li key={j.id} style={styles.listItem}>
                  <div style={styles.itemTopRow}>
                    <span style={styles.itemTitle}>{j.title}</span>
                    {j.employment_type && (
                      <span style={styles.pill}>{j.employment_type}</span>
                    )}
                  </div>
                  <div style={styles.itemMeta}>
                    {j.company && (
                      <span style={styles.itemMetaText}>{j.company}</span>
                    )}
                    {j.location && (
                      <span style={styles.itemMetaMuted}>· {j.location}</span>
                    )}
                    {j.remote === 1 && (
                      <span style={styles.itemMetaMuted}>· Remote</span>
                    )}
                  </div>
                  <p style={styles.itemBody}>{formatSalary(j)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p style={styles.empty}>No active job postings yet.</p>
          )}
        </article>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  progress,
}: {
  label: string;
  value: string;
  hint: string;
  progress?: number;
}) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
      {typeof progress === 'number' && (
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${Math.max(0, Math.min(100, progress))}%`,
            }}
          />
        </div>
      )}
      <span style={styles.statHint}>{hint}</span>
    </div>
  );
}

function formatSalary(j: {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
}) {
  const cur = j.salary_currency || 'USD';
  if (j.salary_min == null && j.salary_max == null) {
    return 'Compensation not disclosed';
  }
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(n);
  if (j.salary_min != null && j.salary_max != null) {
    return `${fmt(j.salary_min)} – ${fmt(j.salary_max)}`;
  }
  return fmt((j.salary_min ?? j.salary_max) as number);
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(ts)) return iso;
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.round(diffSec / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
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
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-h)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    margin: '12px 0 4px',
    fontSize: 36,
    lineHeight: 1.1,
    color: 'var(--text-h)',
    letterSpacing: '-0.5px',
  },
  titleAccent: {
    color: 'var(--accent)',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 15,
  },
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
    borderRadius: 10,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 20,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 600,
    color: 'var(--text-h)',
    lineHeight: 1.1,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    background: 'var(--accent-bg)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 999,
    transition: 'width 200ms ease',
  },
  statHint: {
    fontSize: 12,
    color: 'var(--text)',
    lineHeight: 1.4,
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 24,
    border: '1px solid var(--border)',
    borderRadius: 16,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    color: 'var(--text-h)',
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'var(--text)',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  listItem: {
    padding: 14,
    border: '1px solid var(--border)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  itemTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  pill: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.3,
  },
  itemMeta: {
    fontSize: 13,
    color: 'var(--text)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemMetaText: {
    color: 'var(--text-h)',
  },
  itemMetaMuted: {
    color: 'var(--text)',
  },
  itemBody: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text)',
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  empty: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text)',
  },
};
