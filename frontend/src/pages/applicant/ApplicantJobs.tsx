import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  ApiError,
  type ApplicantJobsQuery,
  type ApplicantJobsResponse,
  type EmploymentType,
  type JobPosting,
  type VerificationLevel,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { VerificationLevelBadge } from '../../components/Badges';

const LEVEL_RANK: Record<VerificationLevel, number> = {
  orb: 4,
  document: 3,
  face: 2,
  device: 1,
};

function meetsLevel(
  userLevel: VerificationLevel | null | undefined,
  requiredLevel: VerificationLevel | null | undefined,
): boolean {
  const u = userLevel ? LEVEL_RANK[userLevel] : 0;
  const r = requiredLevel ? LEVEL_RANK[requiredLevel] : 0;
  return u >= r;
}

function verificationLabel(level: VerificationLevel | null | undefined): string {
  switch (level) {
    case 'orb': return 'Proof of Human (Orb)';
    case 'document': return 'Document';
    case 'face': return 'Selfie Face';
    case 'device': return 'Device';
    default: return 'unverified';
  }
}

type RemoteFilter = 'any' | 'remote' | 'onsite';

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'FullTime',
  'PartTime',
  'Contract',
  'Internship',
  'Temporary',
];

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  FullTime: 'Full-time',
  PartTime: 'Part-time',
  Contract: 'Contract',
  Internship: 'Internship',
  Temporary: 'Temporary',
};

const PAGE_SIZE = 20;

export default function ApplicantJobs() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const userLevel = user?.verification_level ?? null;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [location, setLocation] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>('');
  const [remote, setRemote] = useState<RemoteFilter>('any');
  const [page, setPage] = useState(0);

  const [data, setData] = useState<ApplicantJobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [applyingJobId, setApplyingJobId] = useState<number | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function handleApply(job: JobPosting) {
    if (!token || applyingJobId != null) return;
    setApplyingJobId(job.id);
    setApplyError(null);
    try {
      const { application } = await api.apply(token, job.id);
      navigate(`/applications/${application.id}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'already_applied'
            ? 'You already applied to this role.'
            : err.code === 'verification_level_too_low'
              ? `This role requires ${verificationLabel(job.min_verification_level)} or higher.`
              : err.detail || err.code
          : 'Could not submit your application.';
      setApplyError(msg);
      setApplyingJobId(null);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocation(location.trim()), 250);
    return () => clearTimeout(t);
  }, [location]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, debouncedLocation, employmentType, remote]);

  const query = useMemo<ApplicantJobsQuery>(
    () => ({
      q: debouncedSearch || undefined,
      location: debouncedLocation || undefined,
      employment_type: employmentType || undefined,
      remote:
        remote === 'remote' ? true : remote === 'onsite' ? false : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [debouncedSearch, debouncedLocation, employmentType, remote, page],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .applicantJobs(token, query)
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load jobs.';
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
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE + jobs.length);
  const hasNext = end < total;
  const hasPrev = page > 0;

  function clearFilters() {
    setSearch('');
    setLocation('');
    setEmploymentType('');
    setRemote('any');
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.eyebrow}>Applicant</span>
        <h1 style={styles.title}>Job postings</h1>
        <p style={styles.subtitle}>
          Browse open roles from verified recruiters.
        </p>
      </header>

      <section style={styles.filters} aria-label="Job filters">
        <div style={styles.searchRow}>
          <label style={styles.fieldLabel}>
            <span style={styles.fieldLabelText}>Search</span>
            <input
              type="search"
              placeholder="Title, company, or keyword"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.fieldLabel}>
            <span style={styles.fieldLabelText}>Location</span>
            <input
              type="text"
              placeholder="City, region, or country"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.fieldLabel}>
            <span style={styles.fieldLabelText}>Employment</span>
            <select
              value={employmentType}
              onChange={(e) =>
                setEmploymentType(e.target.value as EmploymentType | '')
              }
              style={styles.input}
            >
              <option value="">Any</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.fieldLabel}>
            <span style={styles.fieldLabelText}>Workplace</span>
            <select
              value={remote}
              onChange={(e) => setRemote(e.target.value as RemoteFilter)}
              style={styles.input}
            >
              <option value="any">Any</option>
              <option value="remote">Remote</option>
              <option value="onsite">On-site</option>
            </select>
          </label>
        </div>

        <div style={styles.filterFooter}>
          <span style={styles.resultCount}>
            {loading
              ? 'Loading…'
              : total === 0
                ? 'No jobs match'
                : `Showing ${start}–${end} of ${total}`}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            style={styles.clearBtn}
            disabled={
              !search && !location && !employmentType && remote === 'any'
            }
          >
            Clear filters
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}

      <section style={styles.layout}>
        <div style={styles.list}>
          {loading && jobs.length === 0 ? (
            <div style={styles.empty}>Loading job postings…</div>
          ) : jobs.length === 0 ? (
            <div style={styles.empty}>
              No job postings match your filters yet.
            </div>
          ) : (
            jobs.map((j) => {
              const isSelected = selectedJob?.id === j.id;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedJob(j)}
                  style={{
                    ...styles.jobCard,
                    ...(isSelected ? styles.jobCardSelected : null),
                  }}
                >
                  <div style={styles.jobCardTopRow}>
                    <span style={styles.jobTitle}>{j.title}</span>
                    {j.employment_type && (
                      <span style={styles.pill}>
                        {EMPLOYMENT_LABELS[j.employment_type]}
                      </span>
                    )}
                  </div>
                  <div style={styles.jobMeta}>
                    {j.company && (
                      <span style={styles.jobMetaStrong}>{j.company}</span>
                    )}
                    {j.location && (
                      <span style={styles.jobMetaMuted}>· {j.location}</span>
                    )}
                    {j.remote === 1 && (
                      <span style={styles.jobMetaMuted}>· Remote</span>
                    )}
                  </div>
                  <div style={styles.jobFooter}>
                    <span style={styles.salary}>{formatSalary(j)}</span>
                    <span style={styles.posted}>
                      Posted {formatRelative(j.created_at)}
                    </span>
                  </div>
                </button>
              );
            })
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
        </div>

        <aside style={styles.detail} aria-label="Job details">
          {selectedJob ? (
            <JobDetail
              job={selectedJob}
              onApply={handleApply}
              applying={applyingJobId === selectedJob.id}
              applyError={applyingJobId == null ? applyError : null}
              userLevel={userLevel}
            />
          ) : (
            <div style={styles.detailEmpty}>
              <h2 style={styles.detailEmptyTitle}>Select a job</h2>
              <p style={styles.detailEmptyBody}>
                Pick any posting on the left to see the full description and
                next steps.
              </p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function JobDetail({
  job,
  onApply,
  applying,
  applyError,
  userLevel,
}: {
  job: JobPosting;
  onApply: (job: JobPosting) => void;
  applying: boolean;
  applyError: string | null;
  userLevel: VerificationLevel | null;
}) {
  const meets = meetsLevel(userLevel, job.min_verification_level);
  const gated = job.min_verification_level !== 'device' && !meets;
  const disabled = applying || gated;
  const primaryStyle = disabled
    ? { ...styles.primaryBtn, cursor: applying ? 'progress' : 'not-allowed', opacity: 0.6 }
    : { ...styles.primaryBtn, cursor: 'pointer', opacity: 1 };

  return (
    <div style={styles.detailInner}>
      <header style={styles.detailHeader}>
        <h2 style={styles.detailTitle}>{job.title}</h2>
        <div style={styles.detailMetaRow}>
          {job.company && (
            <span style={styles.detailCompany}>{job.company}</span>
          )}
          {job.employment_type && (
            <span style={styles.pill}>
              {EMPLOYMENT_LABELS[job.employment_type]}
            </span>
          )}
        </div>
        <div style={styles.detailMetaRow}>
          {job.location && (
            <span style={styles.detailMetaText}>{job.location}</span>
          )}
          {job.remote === 1 && (
            <span style={styles.detailMetaMuted}>· Remote-friendly</span>
          )}
        </div>
        <div style={styles.detailMetaRow}>
          <span style={styles.salary}>{formatSalary(job)}</span>
          <span style={styles.detailMetaMuted}>
            · Posted {formatRelative(job.created_at)} by @{job.poster_username}
          </span>
        </div>
        {job.min_verification_level !== 'device' && (
          <div style={styles.detailMetaRow}>
            <span style={styles.detailMetaMuted}>Requires:</span>
            <VerificationLevelBadge level={job.min_verification_level} />
            {!meets && (
              <span style={{ ...styles.detailMetaMuted, color: 'var(--warning)' }}>
                · Your level ({verificationLabel(userLevel)}) does not meet this requirement.
              </span>
            )}
          </div>
        )}
      </header>

      <div style={styles.detailBody}>
        <h3 style={styles.detailSectionTitle}>About the role</h3>
        <p style={styles.detailDescription}>
          {job.description?.trim() || 'No description provided.'}
        </p>
      </div>

      {applyError && (
        <div role="alert" style={styles.errorBanner}>
          {applyError}
        </div>
      )}

      <div style={styles.detailActions}>
        <button
          type="button"
          style={primaryStyle}
          disabled={disabled}
          onClick={() => onApply(job)}
          title={gated ? `Requires ${verificationLabel(job.min_verification_level)} or higher.` : undefined}
        >
          {applying
            ? 'Starting agent screen…'
            : gated
              ? `Verify with ${verificationLabel(job.min_verification_level)} to apply`
              : 'Apply'}
        </button>
      </div>
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
  filters: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
  },
  searchRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },
  fieldLabelText: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  filterFooter: {
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
  clearBtn: {
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--text-h)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    cursor: 'pointer',
  },
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
    borderRadius: 10,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
    gap: 20,
    alignItems: 'start',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minWidth: 0,
  },
  jobCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 18,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
    cursor: 'pointer',
    textAlign: 'left',
    font: 'inherit',
    color: 'inherit',
    width: '100%',
    transition: 'border-color 150ms ease, transform 150ms ease',
  },
  jobCardSelected: {
    border: '1px solid var(--accent)',
    boxShadow: '0 0 0 1px var(--accent)',
  },
  jobCardTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  jobMeta: {
    fontSize: 13,
    color: 'var(--text)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  jobMetaStrong: {
    color: 'var(--text-h)',
    fontWeight: 500,
  },
  jobMetaMuted: {
    color: 'var(--text)',
  },
  jobFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    flexWrap: 'wrap',
  },
  salary: {
    color: 'var(--text-h)',
    fontWeight: 500,
  },
  posted: {
    color: 'var(--text)',
    fontSize: 12,
  },
  pill: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    color: 'var(--text-h)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.3,
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
    padding: '12px 4px 4px',
  },
  pageBtn: {
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
  },
  pageLabel: {
    fontSize: 13,
    color: 'var(--text)',
  },
  detail: {
    position: 'sticky',
    top: 24,
    minHeight: 320,
    padding: 24,
    border: '1px solid var(--border)',
    borderRadius: 16,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
  },
  detailEmpty: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
    color: 'var(--text)',
  },
  detailEmptyTitle: {
    margin: 0,
    fontSize: 18,
    color: 'var(--text-h)',
  },
  detailEmptyBody: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text)',
  },
  detailInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  detailHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailTitle: {
    margin: 0,
    fontSize: 22,
    color: 'var(--text-h)',
  },
  detailMetaRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    fontSize: 14,
    color: 'var(--text)',
  },
  detailCompany: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--text-h)',
  },
  detailMetaText: {
    color: 'var(--text-h)',
  },
  detailMetaMuted: {
    color: 'var(--text)',
  },
  detailBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailSectionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailDescription: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--text-h)',
    whiteSpace: 'pre-wrap',
  },
  detailActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryBtn: {
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--bg)',
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 10,
    cursor: 'not-allowed',
    opacity: 0.8,
  },
  secondaryBtn: {
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-h)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'not-allowed',
    opacity: 0.8,
  },
};
