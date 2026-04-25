import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  ApiError,
  type RecruiterJobListItem,
  type RecruiterJobsResponse,
  type EmploymentType,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

type StatusFilter = 'all' | 'active' | 'closed';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'closed', label: 'Closed' },
];

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  FullTime: 'Full-time',
  PartTime: 'Part-time',
  Contract: 'Contract',
  Internship: 'Internship',
  Temporary: 'Temporary',
};

const PAGE_SIZE = 20;

export default function RecruiterJobs() {
  const { token } = useAuth();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);

  const [data, setData] = useState<RecruiterJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter]);

  const query = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [debouncedSearch, statusFilter, page],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .recruiterListJobs(token, query)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load your job postings.';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, query]);

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const counts = data?.counts ?? { active: 0, closed: 0, total: 0 };
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE + jobs.length);
  const hasNext = end < total;
  const hasPrev = page > 0;

  function countFor(filter: StatusFilter) {
    if (filter === 'all') return counts.total;
    if (filter === 'active') return counts.active;
    return counts.closed;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <span style={styles.eyebrow}>Recruiter</span>
          <h1 style={styles.title}>Job postings</h1>
          <p style={styles.subtitle}>
            Create, edit, and manage your open roles. Click a posting to see
            applicants.
          </p>
        </div>
        <Link to="/recruiter/jobs/new" style={styles.primaryBtn}>
          + Add job posting
        </Link>
      </header>

      <section style={styles.controls} aria-label="Filters">
        <label style={styles.searchField}>
          <span style={styles.fieldLabelText}>Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, company, location, or description"
            style={styles.input}
          />
        </label>

        <div style={styles.tabs} role="tablist" aria-label="Status filter">
          {STATUS_FILTERS.map((f) => {
            const isActive = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setStatusFilter(f.id)}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : null),
                }}
              >
                <span>{f.label}</span>
                <span
                  style={{
                    ...styles.tabCount,
                    ...(isActive ? styles.tabCountActive : null),
                  }}
                >
                  {countFor(f.id)}
                </span>
              </button>
            );
          })}
        </div>

        <div style={styles.controlsFooter}>
          <span style={styles.resultCount}>
            {loading && !data
              ? 'Loading…'
              : total === 0
                ? 'No matching postings'
                : `Showing ${start}–${end} of ${total}`}
          </span>
          {(search || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              style={styles.clearBtn}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}

      <section aria-label="Postings">
        {loading && jobs.length === 0 ? (
          <div style={styles.empty}>Loading your postings…</div>
        ) : jobs.length === 0 ? (
          <div style={styles.empty}>
            {counts.total === 0
              ? "You haven't created any job postings yet."
              : 'No postings match your filters.'}
          </div>
        ) : (
          <ul style={styles.list}>
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        )}

        {(hasPrev || hasNext) && (
          <div style={styles.pagination}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={!hasPrev || loading}
              style={styles.pageBtn}
            >
              ← Previous
            </button>
            <span style={styles.pageLabel}>Page {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext || loading}
              style={styles.pageBtn}
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function JobRow({ job }: { job: RecruiterJobListItem }) {
  return (
    <li style={styles.row}>
      <div style={styles.rowMain}>
        <div style={styles.rowTopRow}>
          <Link to={`/recruiter/jobs/${job.id}`} style={styles.jobTitleLink}>
            {job.title}
          </Link>
          <span
            style={{
              ...styles.statusPill,
              ...(job.is_active ? styles.statusPillActive : styles.statusPillClosed),
            }}
          >
            {job.is_active ? 'Active' : 'Closed'}
          </span>
        </div>
        <div style={styles.rowMeta}>
          {job.company && <span style={styles.metaStrong}>{job.company}</span>}
          {job.location && (
            <span style={styles.metaMuted}>· {job.location}</span>
          )}
          {job.remote === 1 && <span style={styles.metaMuted}>· Remote</span>}
          {job.employment_type && (
            <span style={styles.pill}>
              {EMPLOYMENT_LABELS[job.employment_type]}
            </span>
          )}
          <span style={styles.metaMuted}>· {formatSalary(job)}</span>
        </div>
        <div style={styles.metricRow}>
          <Metric label="Applicants" value={job.applicant_count} />
          <Metric label="Pending" value={job.pending_count} />
          <Metric label="Sent" value={job.sent_count} />
          <Metric label="New (7d)" value={job.new_applicants_7d} />
          <span style={styles.posted}>Posted {formatRelative(job.created_at)}</span>
        </div>
      </div>
      <div style={styles.rowActions}>
        <Link
          to={`/recruiter/jobs/${job.id}/edit`}
          style={styles.secondaryBtn}
          aria-label={`Edit ${job.title}`}
        >
          Edit
        </Link>
        <Link
          to={`/recruiter/jobs/${job.id}`}
          style={styles.tertiaryBtn}
          aria-label={`View ${job.title}`}
        >
          View →
        </Link>
      </div>
    </li>
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
    gap: 24,
    textAlign: 'left',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: 'wrap',
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
    maxWidth: 560,
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background: 'var(--accent)',
    padding: '10px 16px',
    borderRadius: 10,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
  },
  searchField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabelText: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    outline: 'none',
  },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabActive: {
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    fontWeight: 500,
  },
  tabCount: {
    fontSize: 11,
    fontWeight: 500,
    padding: '1px 8px',
    borderRadius: 999,
    background: 'var(--border)',
    color: 'var(--text-h)',
  },
  tabCountActive: {
    background: 'var(--accent)',
    color: 'var(--bg)',
  },
  controlsFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  resultCount: { fontSize: 13, color: 'var(--text)' },
  clearBtn: {
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--accent)',
    background: 'transparent',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 10,
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  row: {
    display: 'flex',
    gap: 16,
    padding: 18,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  rowMain: { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 240 },
  rowTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  jobTitleLink: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-h)',
    textDecoration: 'none',
  },
  statusPill: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 999,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    border: '1px solid',
  },
  statusPillActive: {
    color: '#106a3d',
    background: 'rgba(16, 106, 61, 0.12)',
    borderColor: 'rgba(16, 106, 61, 0.4)',
  },
  statusPillClosed: {
    color: 'var(--text)',
    background: 'transparent',
    borderColor: 'var(--border)',
  },
  rowMeta: {
    fontSize: 13,
    color: 'var(--text)',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaStrong: { color: 'var(--text-h)', fontWeight: 500 },
  metaMuted: { color: 'var(--text)' },
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
  metricRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
    paddingTop: 4,
  },
  metric: { display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1 },
  metricValue: { fontSize: 16, fontWeight: 600, color: 'var(--text-h)' },
  metricLabel: {
    fontSize: 11,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  posted: { marginLeft: 'auto', fontSize: 12, color: 'var(--text)' },
  rowActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 100,
  },
  secondaryBtn: {
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 10,
    textDecoration: 'none',
    textAlign: 'center',
  },
  tertiaryBtn: {
    padding: '8px 14px',
    fontSize: 13,
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 10,
    textDecoration: 'none',
    textAlign: 'center',
  },
  empty: {
    padding: 32,
    border: '1px dashed var(--border)',
    borderRadius: 14,
    fontSize: 14,
    color: 'var(--text)',
    textAlign: 'center',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '16px 4px 4px',
  },
  pageBtn: {
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  pageLabel: { fontSize: 13, color: 'var(--text)' },
};
