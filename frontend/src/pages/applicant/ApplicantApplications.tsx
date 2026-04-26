import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  ApiError,
  type Application,
  type ApplicantApplicationsQuery,
  type ApplicantApplicationsResponse,
  type ApplicationStatus,
  type EmploymentType,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

type StatusFilter = 'all' | ApplicationStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Pending', label: 'Pending' },
  { id: 'SentToRecruiter', label: 'Sent to recruiter' },
  { id: 'Declined', label: 'Declined' },
];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  Pending: 'Pending',
  Declined: 'Declined',
  SentToRecruiter: 'Sent to recruiter',
};

const STATUS_DESCRIPTIONS: Record<ApplicationStatus, string> = {
  Pending: "AI chat hasn't been completed yet.",
  SentToRecruiter: 'Marked as a potential match and shared with the recruiter.',
  Declined: 'No longer being considered for this role.',
};

const STATUS_TONE: Record<
  ApplicationStatus,
  { color: string; bg: string; border: string }
> = {
  Pending: {
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
    border: 'var(--warning-border)',
  },
  SentToRecruiter: {
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    border: 'var(--success-border)',
  },
  Declined: {
    color: 'var(--danger)',
    bg: 'var(--danger-bg)',
    border: 'var(--danger-border)',
  },
};

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  FullTime: 'Full-time',
  PartTime: 'Part-time',
  Contract: 'Contract',
  Internship: 'Internship',
  Temporary: 'Temporary',
};

const PAGE_SIZE = 20;

export default function ApplicantApplications() {
  const { token } = useAuth();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);

  const [data, setData] = useState<ApplicantApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter]);

  const query = useMemo<ApplicantApplicationsQuery>(
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
      .applicantApplications(token, query)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load your applications.';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, query]);

  const applications = data?.applications ?? [];
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE + applications.length);
  const hasNext = end < total;
  const hasPrev = page > 0;

  const totalApplications =
    (data?.status_counts.Pending ?? 0) +
    (data?.status_counts.SentToRecruiter ?? 0) +
    (data?.status_counts.Declined ?? 0);

  function countFor(filter: StatusFilter) {
    if (!data) return null;
    if (filter === 'all') return totalApplications;
    return data.status_counts[filter] ?? 0;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span className="indicator indicator-info">Applicant</span>
        <h1 style={styles.title}>Applications</h1>
        <p style={styles.subtitle}>
          Track every job you've applied to and where it stands.
        </p>
      </header>

      <section style={styles.summaryGrid} aria-label="Application summary">
        <SummaryCard
          label="Total"
          value={loading && !data ? '—' : String(totalApplications)}
          hint="All applications you've submitted."
        />
        <SummaryCard
          label="Pending"
          value={
            loading && !data ? '—' : String(data?.status_counts.Pending ?? 0)
          }
          hint={STATUS_DESCRIPTIONS.Pending}
          tone={STATUS_TONE.Pending}
        />
        <SummaryCard
          label="Sent to recruiter"
          value={
            loading && !data
              ? '—'
              : String(data?.status_counts.SentToRecruiter ?? 0)
          }
          hint={STATUS_DESCRIPTIONS.SentToRecruiter}
          tone={STATUS_TONE.SentToRecruiter}
        />
        <SummaryCard
          label="Declined"
          value={
            loading && !data ? '—' : String(data?.status_counts.Declined ?? 0)
          }
          hint={STATUS_DESCRIPTIONS.Declined}
          tone={STATUS_TONE.Declined}
        />
      </section>

      <section style={styles.controls} aria-label="Filters">
        <label style={styles.searchField}>
          <span style={styles.fieldLabelText}>Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Job title, company, location, or recruiter"
            style={styles.input}
          />
        </label>

        <div style={styles.tabs} role="tablist" aria-label="Status filter">
          {STATUS_FILTERS.map((f) => {
            const isActive = statusFilter === f.id;
            const count = countFor(f.id);
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
                {count != null && (
                  <span
                    style={{
                      ...styles.tabCount,
                      ...(isActive ? styles.tabCountActive : null),
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={styles.controlsFooter}>
          <span style={styles.resultCount}>
            {loading && !data
              ? 'Loading…'
              : total === 0
                ? 'No matching applications'
                : `Showing ${start}–${end} of ${total}`}
          </span>
          {(search || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="btn btn-ghost btn-sm"
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

      <section aria-label="Applications">
        {loading && applications.length === 0 ? (
          <div style={styles.empty}>Loading your applications…</div>
        ) : applications.length === 0 ? (
          <div style={styles.empty}>
            {totalApplications === 0
              ? "You haven't applied to anything yet. Browse open roles in Job postings."
              : 'No applications match your filters.'}
          </div>
        ) : (
          <ul style={styles.list}>
            {applications.map((a) => (
              <ApplicationRow key={a.id} application={a} />
            ))}
          </ul>
        )}

        {(hasPrev || hasNext) && (
          <div style={styles.pagination}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={!hasPrev || loading}
              className="btn btn-ghost btn-sm"
            >
              ← Previous
            </button>
            <span style={styles.pageLabel}>Page {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext || loading}
              className="btn btn-ghost btn-sm"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ApplicationRow({ application }: { application: Application }) {
  const tone = STATUS_TONE[application.status];
  const job = application.job;
  const isPending = application.status === 'Pending';
  return (
    <li style={styles.row}>
      <div style={styles.rowMain}>
        <div style={styles.rowTopRow}>
          <span style={styles.jobTitle}>{job.title}</span>
          <span
            style={{
              ...styles.statusBadge,
              color: tone.color,
              background: tone.bg,
              borderColor: tone.border,
            }}
          >
            {STATUS_LABELS[application.status]}
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
        </div>
        <div style={styles.rowMeta}>
          <span style={styles.salary}>{formatSalary(job)}</span>
          <span style={styles.metaMuted}>
            · Applied {formatRelative(application.applied_at)} · Posted by @
            {job.poster_username}
          </span>
          {job.is_active === 0 && (
            <span style={styles.metaWarning}>· Posting closed</span>
          )}
        </div>
        {application.notes && (
          <p style={styles.notes}>“{application.notes}”</p>
        )}
        <div style={styles.rowActions}>
          <Link
            to={`/applications/${application.id}`}
            style={isPending ? styles.viewChatBtnPrimary : styles.viewChatBtn}
            aria-label={
              isPending
                ? `Watch the AI negotiation in progress for ${job.title}`
                : `View the AI negotiation transcript for ${job.title}`
            }
          >
            {isPending ? 'Watch AI chat live' : 'View AI chat'}
            <span aria-hidden="true" style={styles.viewChatArrow}>
              →
            </span>
          </Link>
        </div>
      </div>
    </li>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: { color: string; bg: string; border: string };
}) {
  return (
    <div style={styles.summary}>
      <span
        style={{
          ...styles.summaryLabel,
          ...(tone
            ? {
                color: tone.color,
                background: tone.bg,
                border: `1px solid ${tone.border}`,
              }
            : null),
        }}
      >
        {label}
      </span>
      <span style={styles.summaryValue}>{value}</span>
      <span style={styles.summaryHint}>{hint}</span>
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
    gap: 24,
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
    color: 'var(--text-h)',
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
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  summary: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 18,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    borderRadius: 999,
    width: 'fit-content',
    border: '1px solid var(--border)',
    background: 'var(--accent-bg)',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 600,
    color: 'var(--text-h)',
    lineHeight: 1.1,
  },
  summaryHint: {
    fontSize: 12,
    color: 'var(--text)',
    lineHeight: 1.4,
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
  tabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
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
  resultCount: {
    fontSize: 13,
    color: 'var(--text)',
  },
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
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
  },
  rowMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  rowTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    border: '1px solid',
    borderRadius: 999,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  rowMeta: {
    fontSize: 13,
    color: 'var(--text)',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaStrong: {
    color: 'var(--text-h)',
    fontWeight: 500,
  },
  metaMuted: {
    color: 'var(--text)',
  },
  metaWarning: {
    color: 'var(--danger)',
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
  salary: {
    color: 'var(--text-h)',
    fontWeight: 500,
  },
  notes: {
    margin: 0,
    fontSize: 13,
    fontStyle: 'italic',
    color: 'var(--text)',
    lineHeight: 1.5,
    paddingLeft: 12,
    borderLeft: '2px solid var(--border)',
  },
  rowActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  viewChatBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    textDecoration: 'none',
    fontFamily: 'inherit',
  },
  viewChatBtnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    textDecoration: 'none',
    fontFamily: 'inherit',
  },
  viewChatArrow: {
    fontSize: 14,
    lineHeight: 1,
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
  pageLabel: {
    fontSize: 13,
    color: 'var(--text)',
  },
};
