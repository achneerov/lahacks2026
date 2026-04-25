import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  ApiError,
  type RecruiterHomeResponse,
  type RecruiterRecentPosting,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

export default function RecruiterHome() {
  const { user, token } = useAuth();

  const [data, setData] = useState<RecruiterHomeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .recruiterHome(token)
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
        <span style={styles.eyebrow}>Recruiter dashboard</span>
        <h1 style={styles.title}>
          Welcome back,{' '}
          <span style={styles.titleAccent}>{user?.username ?? 'there'}</span>
        </h1>
        <p style={styles.subtitle}>
          Here's how your hiring pipeline is doing today.
        </p>
      </header>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}

      <section style={styles.statsGrid}>
        <StatCard
          label="Active postings"
          value={loading ? '—' : String(stats?.active_postings ?? 0)}
          hint={
            stats
              ? `${stats.total_postings} total posting${
                  stats.total_postings === 1 ? '' : 's'
                } created`
              : 'Live job postings on the marketplace.'
          }
        />
        <StatCard
          label="Total applicants"
          value={loading ? '—' : String(stats?.total_applicants ?? 0)}
          hint={
            stats
              ? `${stats.total_applications} application${
                  stats.total_applications === 1 ? '' : 's'
                } received`
              : 'Unique people who applied to your roles.'
          }
        />
        <StatCard
          label="New this week"
          value={loading ? '—' : String(stats?.new_applicants_7d ?? 0)}
          hint="Applications received in the last 7 days."
        />
        <StatCard
          label="Pending review"
          value={loading ? '—' : String(stats?.pending_applications ?? 0)}
          hint="Applications awaiting your decision."
        />
        <StatCard
          label="Active conversations"
          value={loading ? '—' : String(stats?.active_conversations ?? 0)}
          hint="Open threads with applicants and agents."
        />
        <StatCard
          label="Messages received"
          value={loading ? '—' : String(stats?.messages_received ?? 0)}
          hint="Total inbound messages across all chats."
        />
      </section>

      <section style={styles.columns}>
        <article style={styles.card}>
          <header style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Recent job postings</h2>
              <span style={styles.cardSubtitle}>
                Click a posting to manage it
              </span>
            </div>
            <Link to="/recruiter/jobs" style={styles.cardAction}>
              View all
            </Link>
          </header>

          {loading ? (
            <p style={styles.empty}>Loading…</p>
          ) : data && data.recent_postings.length > 0 ? (
            <ul style={styles.list}>
              {data.recent_postings.map((p) => (
                <PostingItem key={p.id} posting={p} />
              ))}
            </ul>
          ) : (
            <div style={styles.emptyBlock}>
              <p style={styles.empty}>You haven't created any postings yet.</p>
              <Link to="/recruiter/jobs" style={styles.primaryAction}>
                Create your first posting
              </Link>
            </div>
          )}
        </article>

        <article style={styles.card}>
          <header style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Recent applications</h2>
              <span style={styles.cardSubtitle}>
                Latest people who applied to your roles
              </span>
            </div>
          </header>

          {loading ? (
            <p style={styles.empty}>Loading…</p>
          ) : data && data.recent_applications.length > 0 ? (
            <ul style={styles.list}>
              {data.recent_applications.map((a) => (
                <li key={a.id} style={styles.listItem}>
                  <div style={styles.itemTopRow}>
                    <span style={styles.itemTitle}>
                      {a.applicant.full_name || a.applicant.username}
                    </span>
                    <span style={styles.pill}>{statusLabel(a.status)}</span>
                  </div>
                  <div style={styles.itemMeta}>
                    <Link
                      to={`/recruiter/jobs?job=${a.job.id}`}
                      style={styles.itemMetaLink}
                    >
                      {a.job.title}
                    </Link>
                    {a.job.company && (
                      <span style={styles.itemMetaMuted}>
                        · {a.job.company}
                      </span>
                    )}
                    <span style={styles.itemMetaMuted}>
                      · {formatRelative(a.applied_at)}
                    </span>
                  </div>
                  {a.applicant.headline && (
                    <p style={styles.itemBody}>{a.applicant.headline}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={styles.empty}>No applications yet.</p>
          )}
        </article>
      </section>
    </div>
  );
}

function PostingItem({ posting }: { posting: RecruiterRecentPosting }) {
  return (
    <li>
      <Link
        to={`/recruiter/jobs?job=${posting.id}`}
        style={styles.postingLink}
      >
        <div style={styles.itemTopRow}>
          <span style={styles.itemTitle}>{posting.title}</span>
          <span
            style={{
              ...styles.pill,
              ...(posting.is_active ? null : styles.pillMuted),
            }}
          >
            {posting.is_active ? 'Active' : 'Closed'}
          </span>
        </div>
        <div style={styles.itemMeta}>
          {posting.company && (
            <span style={styles.itemMetaText}>{posting.company}</span>
          )}
          {posting.location && (
            <span style={styles.itemMetaMuted}>· {posting.location}</span>
          )}
          {posting.remote === 1 && (
            <span style={styles.itemMetaMuted}>· Remote</span>
          )}
          {posting.employment_type && (
            <span style={styles.itemMetaMuted}>
              · {employmentLabel(posting.employment_type)}
            </span>
          )}
        </div>
        <div style={styles.metricRow}>
          <Metric label="Applicants" value={posting.applicant_count} />
          <Metric label="New (7d)" value={posting.new_applicants_7d} />
          <Metric label="Pending" value={posting.pending_count} />
          <span style={styles.salaryText}>{formatSalary(posting)}</span>
        </div>
      </Link>
    </li>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statHint}>{hint}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span style={styles.metric}>
      <span style={styles.metricValue}>{value}</span>
      <span style={styles.metricLabel}>{label}</span>
    </span>
  );
}

function statusLabel(status: 'Pending' | 'Declined' | 'SentToRecruiter') {
  switch (status) {
    case 'Pending':
      return 'Pending';
    case 'Declined':
      return 'Declined';
    case 'SentToRecruiter':
      return 'Sent to you';
    default:
      return status;
  }
}

function employmentLabel(t: string) {
  switch (t) {
    case 'FullTime':
      return 'Full-time';
    case 'PartTime':
      return 'Part-time';
    case 'Contract':
      return 'Contract';
    case 'Internship':
      return 'Internship';
    case 'Temporary':
      return 'Temporary';
    default:
      return t;
  }
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
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
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
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
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
  cardAction: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--accent)',
    textDecoration: 'none',
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    whiteSpace: 'nowrap',
  },
  primaryAction: {
    display: 'inline-block',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background: 'var(--accent)',
    padding: '8px 14px',
    borderRadius: 10,
    textDecoration: 'none',
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
  postingLink: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 14,
    border: '1px solid var(--border)',
    borderRadius: 12,
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 120ms ease, background 120ms ease',
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
    whiteSpace: 'nowrap',
  },
  pillMuted: {
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--border)',
  },
  itemMeta: {
    fontSize: 13,
    color: 'var(--text)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  itemMetaText: {
    color: 'var(--text-h)',
  },
  itemMetaMuted: {
    color: 'var(--text)',
  },
  itemMetaLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500,
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
  metricRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
    paddingTop: 4,
  },
  metric: {
    display: 'inline-flex',
    flexDirection: 'column',
    lineHeight: 1.1,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  metricLabel: {
    fontSize: 11,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  salaryText: {
    marginLeft: 'auto',
    fontSize: 13,
    color: 'var(--text)',
  },
  empty: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text)',
  },
  emptyBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'flex-start',
  },
};
