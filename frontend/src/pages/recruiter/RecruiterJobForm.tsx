import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  api,
  ApiError,
  type EmploymentType,
  type JobReviewIssue,
  type JobReviewSeverity,
  type RecruiterJob,
  type RecruiterJobInput,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

type Mode = 'create' | 'edit';

type FormState = {
  title: string;
  company: string;
  description: string;
  location: string;
  remote: boolean;
  employment_type: EmploymentType | '';
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  is_active: boolean;
};

type FieldKey = keyof FormState;

const EMPTY_FORM: FormState = {
  title: '',
  company: '',
  description: '',
  location: '',
  remote: false,
  employment_type: '',
  salary_min: '',
  salary_max: '',
  salary_currency: 'USD',
  is_active: true,
};

const EMPLOYMENT_OPTIONS: { value: EmploymentType | ''; label: string }[] = [
  { value: '', label: 'Not specified' },
  { value: 'FullTime', label: 'Full-time' },
  { value: 'PartTime', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Internship', label: 'Internship' },
  { value: 'Temporary', label: 'Temporary' },
];

const FIELD_LABELS: Record<JobReviewIssue['field'], string> = {
  title: 'Title',
  company: 'Company',
  description: 'Description',
  location: 'Location',
  employment_type: 'Employment type',
  salary_min: 'Min salary',
  salary_max: 'Max salary',
  salary_currency: 'Salary currency',
};

function jobToForm(job: RecruiterJob | null): FormState {
  if (!job) return { ...EMPTY_FORM };
  return {
    title: job.title ?? '',
    company: job.company ?? '',
    description: job.description ?? '',
    location: job.location ?? '',
    remote: job.remote === 1,
    employment_type: (job.employment_type ?? '') as EmploymentType | '',
    salary_min: job.salary_min == null ? '' : String(job.salary_min),
    salary_max: job.salary_max == null ? '' : String(job.salary_max),
    salary_currency: job.salary_currency ?? 'USD',
    is_active: job.is_active === 1,
  };
}

function buildPayload(form: FormState): RecruiterJobInput {
  return {
    title: form.title.trim(),
    company: form.company.trim() === '' ? null : form.company.trim(),
    description:
      form.description.trim() === '' ? null : form.description.trim(),
    location: form.location.trim() === '' ? null : form.location.trim(),
    remote: form.remote,
    employment_type: form.employment_type === '' ? null : form.employment_type,
    salary_min:
      form.salary_min.trim() === '' ? null : Number(form.salary_min),
    salary_max:
      form.salary_max.trim() === '' ? null : Number(form.salary_max),
    salary_currency:
      form.salary_currency.trim() === '' ? 'USD' : form.salary_currency.trim(),
    is_active: form.is_active,
  };
}

export default function RecruiterJobForm({ mode }: { mode: Mode }) {
  const params = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const jobId = mode === 'edit' && params.id ? Number(params.id) : null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<JobReviewIssue[]>([]);
  const [reviewSource, setReviewSource] = useState<'llm' | 'heuristic' | null>(null);
  const [reviewedAt, setReviewedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !token || !jobId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .recruiterGetJob(token, jobId)
      .then((d) => {
        if (cancelled) return;
        setForm(jobToForm(d.job));
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load this posting.';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, token, jobId]);

  function update<K extends FieldKey>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleReview() {
    if (!token) return;
    setReviewing(true);
    setError(null);
    try {
      const payload = buildPayload(form);
      const res = await api.recruiterReviewJob(token, payload);
      setIssues(res.issues);
      setReviewSource(res.source);
      setReviewedAt(new Date());
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail || err.code
          : 'Could not review this posting.';
      setError(msg);
    } finally {
      setReviewing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload(form);
      const res =
        mode === 'create'
          ? await api.recruiterCreateJob(token, payload)
          : await api.recruiterUpdateJob(token, jobId!, payload);
      navigate(`/recruiter/jobs/${res.job.id}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail || err.code
          : 'Could not save this posting.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const issuesByField = useMemo(() => {
    const map = new Map<string, JobReviewIssue[]>();
    for (const i of issues) {
      const arr = map.get(i.field) || [];
      arr.push(i);
      map.set(i.field, arr);
    }
    return map;
  }, [issues]);

  const hasErrors = issues.some((i) => i.severity === 'error');

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.loading}>Loading posting…</p>
      </div>
    );
  }

  return (
    <form style={styles.page} onSubmit={handleSubmit} noValidate>
      <header style={styles.header}>
        <div>
          <span style={styles.eyebrow}>Recruiter</span>
          <h1 style={styles.title}>
            {mode === 'create' ? 'Add job posting' : 'Edit job posting'}
          </h1>
          <p style={styles.subtitle}>
            Fill in the role details. Use the AI review to flag vague phrasing,
            typos, or missing information before publishing.
          </p>
        </div>
        <Link to="/recruiter/jobs" style={styles.backLink}>
          ← Back to postings
        </Link>
      </header>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}

      <section style={styles.cardCol}>
        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Role</legend>

          <Field
            label="Title"
            required
            issues={issuesByField.get('title')}
            input={
              <input
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                style={styles.input}
                required
              />
            }
          />

          <div style={styles.gridTwo}>
            <Field
              label="Company"
              issues={issuesByField.get('company')}
              input={
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => update('company', e.target.value)}
                  placeholder="e.g. Acme Corp"
                  style={styles.input}
                />
              }
            />
            <Field
              label="Employment type"
              issues={issuesByField.get('employment_type')}
              input={
                <select
                  value={form.employment_type}
                  onChange={(e) =>
                    update('employment_type', e.target.value as EmploymentType | '')
                  }
                  style={styles.input}
                >
                  {EMPLOYMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              }
            />
          </div>

          <div style={styles.gridTwo}>
            <Field
              label="Location"
              issues={issuesByField.get('location')}
              input={
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                  style={styles.input}
                />
              }
            />
            <Field
              label="Remote"
              input={
                <label style={styles.toggleRow}>
                  <input
                    type="checkbox"
                    checked={form.remote}
                    onChange={(e) => update('remote', e.target.checked)}
                  />
                  <span>This role can be done remotely</span>
                </label>
              }
            />
          </div>

          <Field
            label="Description"
            issues={issuesByField.get('description')}
            input={
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Describe the role: responsibilities, tech stack, what success looks like, who you're looking for…"
                style={{ ...styles.input, minHeight: 180, resize: 'vertical' }}
              />
            }
          />
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Compensation</legend>

          <div style={styles.gridThree}>
            <Field
              label="Min salary"
              issues={issuesByField.get('salary_min')}
              input={
                <input
                  type="number"
                  min={0}
                  value={form.salary_min}
                  onChange={(e) => update('salary_min', e.target.value)}
                  placeholder="e.g. 120000"
                  style={styles.input}
                />
              }
            />
            <Field
              label="Max salary"
              issues={issuesByField.get('salary_max')}
              input={
                <input
                  type="number"
                  min={0}
                  value={form.salary_max}
                  onChange={(e) => update('salary_max', e.target.value)}
                  placeholder="e.g. 180000"
                  style={styles.input}
                />
              }
            />
            <Field
              label="Currency"
              issues={issuesByField.get('salary_currency')}
              input={
                <input
                  type="text"
                  value={form.salary_currency}
                  onChange={(e) => update('salary_currency', e.target.value.toUpperCase())}
                  maxLength={3}
                  placeholder="USD"
                  style={styles.input}
                />
              }
            />
          </div>
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Status</legend>
          <label style={styles.toggleRow}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
            />
            <span>Posting is active and visible to applicants</span>
          </label>
        </fieldset>
      </section>

      <section style={styles.reviewCard}>
        <header style={styles.reviewHeader}>
          <div>
            <h2 style={styles.reviewTitle}>AI review</h2>
            <p style={styles.reviewSubtitle}>
              Catch vague questions, typos, and missing details before
              publishing.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReview}
            disabled={reviewing || saving}
            style={styles.reviewBtn}
          >
            {reviewing ? 'Reviewing…' : 'Run AI review'}
          </button>
        </header>

        {issues.length === 0 && reviewedAt && (
          <p style={styles.reviewClean}>
            ✓ No issues found in this draft
            {reviewSource === 'heuristic' ? ' (heuristic check)' : ''}.
          </p>
        )}

        {issues.length > 0 && (
          <ul style={styles.issueList}>
            {issues.map((issue, idx) => (
              <li key={idx} style={{ ...styles.issueRow, ...severityStyle(issue.severity) }}>
                <div style={styles.issueRowTop}>
                  <span style={styles.issueField}>{FIELD_LABELS[issue.field]}</span>
                  <span style={styles.issueSeverity}>{issue.severity.toUpperCase()}</span>
                </div>
                <p style={styles.issueMessage}>{issue.message}</p>
              </li>
            ))}
          </ul>
        )}

        {reviewSource === 'heuristic' && reviewedAt && (
          <p style={styles.reviewFootnote}>
            Reviewed by built-in heuristics. Set <code>GEMINI_API_KEY</code> on
            the backend for richer LLM suggestions.
          </p>
        )}
      </section>

      <div style={styles.formFooter}>
        <Link to="/recruiter/jobs" style={styles.cancelBtn}>
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving || !form.title.trim()}
          style={styles.submitBtn}
        >
          {saving
            ? 'Saving…'
            : mode === 'create'
              ? 'Create posting'
              : 'Save changes'}
        </button>
      </div>

      {hasErrors && (
        <p style={styles.warningFootnote}>
          Heads up: the AI review flagged hard errors above. You can still save,
          but consider fixing them first.
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  required,
  issues,
  input,
}: {
  label: string;
  required?: boolean;
  issues?: JobReviewIssue[];
  input: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>
        {label}
        {required && <span style={styles.requiredMark}> *</span>}
      </span>
      {input}
      {issues && issues.length > 0 && (
        <ul style={styles.fieldIssues}>
          {issues.map((i, idx) => (
            <li key={idx} style={{ ...styles.fieldIssue, color: severityColor(i.severity) }}>
              {i.message}
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

function severityColor(s: JobReviewSeverity) {
  if (s === 'error') return '#9a1a1a';
  if (s === 'warning') return '#946200';
  return 'var(--text)';
}

function severityStyle(s: JobReviewSeverity): CSSProperties {
  if (s === 'error') {
    return {
      borderColor: 'rgba(154, 26, 26, 0.45)',
      background: 'rgba(154, 26, 26, 0.08)',
    };
  }
  if (s === 'warning') {
    return {
      borderColor: 'rgba(255, 184, 0, 0.5)',
      background: 'rgba(255, 184, 0, 0.1)',
    };
  }
  return {
    borderColor: 'var(--accent-border)',
    background: 'var(--accent-bg)',
  };
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
    fontSize: 30,
    lineHeight: 1.1,
    color: 'var(--text-h)',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
    maxWidth: 580,
  },
  backLink: {
    fontSize: 13,
    color: 'var(--text)',
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
  },
  loading: { color: 'var(--text)', fontSize: 14 },
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 10,
  },
  cardCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  fieldset: {
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '18px 20px',
    background: 'var(--bg)',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  legend: {
    padding: '0 6px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-h)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  requiredMark: { color: '#9a1a1a' },
  input: {
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: 'var(--text-h)',
    cursor: 'pointer',
  },
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  gridThree: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 16,
  },
  fieldIssues: {
    listStyle: 'none',
    margin: '4px 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  fieldIssue: { fontSize: 12, lineHeight: 1.4 },
  reviewCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
  },
  reviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  reviewTitle: {
    margin: 0,
    fontSize: 16,
    color: 'var(--text-h)',
  },
  reviewSubtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'var(--text)',
  },
  reviewBtn: {
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  reviewClean: {
    margin: 0,
    fontSize: 13,
    color: '#106a3d',
  },
  issueList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  issueRow: {
    border: '1px solid',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  issueRowTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  issueField: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-h)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  issueSeverity: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.4,
    color: 'var(--text)',
  },
  issueMessage: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-h)',
    lineHeight: 1.45,
  },
  reviewFootnote: {
    margin: 0,
    fontSize: 12,
    color: 'var(--text)',
  },
  formFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 8,
  },
  cancelBtn: {
    padding: '10px 16px',
    fontSize: 14,
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 10,
    textDecoration: 'none',
  },
  submitBtn: {
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  warningFootnote: {
    margin: 0,
    fontSize: 12,
    color: '#946200',
  },
};
