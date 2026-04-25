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
  // Job basics
  title: string;
  company: string;
  employment_type: EmploymentType | '';
  job_id_requisition: string;
  department: string;
  team: string;
  reporting_to: string;
  number_of_direct_reports: string;
  permanent_or_fixed_term: string;
  contract_duration: string;
  job_level: string;
  // Location
  location: string;
  remote: boolean;
  work_model: string;
  office_locations: string;
  hybrid_days_in_office: string;
  willing_to_hire_internationally: boolean;
  travel_required: boolean;
  travel_percentage: string;
  relocation_assistance: boolean;
  // Compensation
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  pay_frequency: string;
  bonus_commission_structure: string;
  equity_stock_options: string;
  benefits_overview: string;
  retirement_plan: string;
  paid_time_off_days: string;
  parental_leave_policy: string;
  other_perks: string;
  // Role description
  description: string;
  summary: string;
  key_responsibilities: string;
  why_role_is_open: string;
  team_size: string;
  team_structure: string;
  cross_functional_collaborators: string;
  // Requirements
  req_years_of_experience: string;
  req_education_level: string;
  req_field_of_study: string;
  req_certifications: string;
  req_technical_skills: string;
  req_work_authorization: string;
  // Nice to haves
  nice_years_of_experience: string;
  nice_education: string;
  nice_technical_skills: string;
  nice_industry_background: string;
  // Company info
  company_website: string;
  industry: string;
  company_size: string;
  company_stage: string;
  mission_values: string;
  culture_description: string;
  dei_statement: string;
  // Application process
  application_deadline: string;
  documents_required: string;
  interview_rounds: string;
  interview_format: string;
  expected_time_to_hire: string;
  contact_person: string;
  contact_email_phone: string;
  // Status
  is_active: boolean;
};

type FieldKey = keyof FormState;

const EMPTY_FORM: FormState = {
  title: '', company: '', employment_type: '', job_id_requisition: '', department: '',
  team: '', reporting_to: '', number_of_direct_reports: '', permanent_or_fixed_term: '',
  contract_duration: '', job_level: '',
  location: '', remote: false, work_model: '', office_locations: '',
  hybrid_days_in_office: '', willing_to_hire_internationally: false,
  travel_required: false, travel_percentage: '', relocation_assistance: false,
  salary_min: '', salary_max: '', salary_currency: 'USD', pay_frequency: '',
  bonus_commission_structure: '', equity_stock_options: '', benefits_overview: '',
  retirement_plan: '', paid_time_off_days: '', parental_leave_policy: '', other_perks: '',
  description: '', summary: '', key_responsibilities: '', why_role_is_open: '',
  team_size: '', team_structure: '', cross_functional_collaborators: '',
  req_years_of_experience: '', req_education_level: '', req_field_of_study: '',
  req_certifications: '', req_technical_skills: '', req_work_authorization: '',
  nice_years_of_experience: '', nice_education: '', nice_technical_skills: '',
  nice_industry_background: '',
  company_website: '', industry: '', company_size: '', company_stage: '',
  mission_values: '', culture_description: '', dei_statement: '',
  application_deadline: '', documents_required: '',
  interview_rounds: '', interview_format: '', expected_time_to_hire: '',
  contact_person: '', contact_email_phone: '',
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
  summary: 'Summary',
  location: 'Location',
  employment_type: 'Employment type',
  salary_min: 'Min salary',
  salary_max: 'Max salary',
  salary_currency: 'Salary currency',
  job_level: 'Job level',
  work_model: 'Work model',
  key_responsibilities: 'Key responsibilities',
  req_years_of_experience: 'Required experience',
  req_technical_skills: 'Required skills',
  benefits_overview: 'Benefits',
};

function tryParseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try { const arr = JSON.parse(val); return Array.isArray(arr) ? arr : []; } catch { return []; }
}

function jobToForm(job: RecruiterJob | null): FormState {
  if (!job) return { ...EMPTY_FORM };
  return {
    title: job.title ?? '', company: job.company ?? '',
    employment_type: (job.employment_type ?? '') as EmploymentType | '',
    job_id_requisition: job.job_id_requisition ?? '', department: job.department ?? '',
    team: job.team ?? '', reporting_to: job.reporting_to ?? '',
    number_of_direct_reports: job.number_of_direct_reports != null ? String(job.number_of_direct_reports) : '',
    permanent_or_fixed_term: job.permanent_or_fixed_term ?? '',
    contract_duration: job.contract_duration ?? '', job_level: job.job_level ?? '',
    location: job.location ?? '', remote: job.remote === 1,
    work_model: job.work_model ?? '',
    office_locations: tryParseJsonArray(job.office_locations).join('\n'),
    hybrid_days_in_office: job.hybrid_days_in_office != null ? String(job.hybrid_days_in_office) : '',
    willing_to_hire_internationally: job.willing_to_hire_internationally === 1,
    travel_required: job.travel_required === 1,
    travel_percentage: job.travel_percentage ?? '',
    relocation_assistance: job.relocation_assistance === 1,
    salary_min: job.salary_min != null ? String(job.salary_min) : '',
    salary_max: job.salary_max != null ? String(job.salary_max) : '',
    salary_currency: job.salary_currency ?? 'USD',
    pay_frequency: job.pay_frequency ?? '',
    bonus_commission_structure: job.bonus_commission_structure ?? '',
    equity_stock_options: job.equity_stock_options ?? '',
    benefits_overview: job.benefits_overview ?? '',
    retirement_plan: job.retirement_plan ?? '',
    paid_time_off_days: job.paid_time_off_days != null ? String(job.paid_time_off_days) : '',
    parental_leave_policy: job.parental_leave_policy ?? '',
    other_perks: tryParseJsonArray(job.other_perks).join('\n'),
    description: job.description ?? '', summary: job.summary ?? '',
    key_responsibilities: tryParseJsonArray(job.key_responsibilities).join('\n'),
    why_role_is_open: job.why_role_is_open ?? '',
    team_size: job.team_size != null ? String(job.team_size) : '',
    team_structure: job.team_structure ?? '',
    cross_functional_collaborators: tryParseJsonArray(job.cross_functional_collaborators).join('\n'),
    req_years_of_experience: job.req_years_of_experience != null ? String(job.req_years_of_experience) : '',
    req_education_level: job.req_education_level ?? '',
    req_field_of_study: job.req_field_of_study ?? '',
    req_certifications: tryParseJsonArray(job.req_certifications).join('\n'),
    req_technical_skills: tryParseJsonArray(job.req_technical_skills).join('\n'),
    req_work_authorization: job.req_work_authorization ?? '',
    nice_years_of_experience: job.nice_years_of_experience != null ? String(job.nice_years_of_experience) : '',
    nice_education: job.nice_education ?? '',
    nice_technical_skills: tryParseJsonArray(job.nice_technical_skills).join('\n'),
    nice_industry_background: job.nice_industry_background ?? '',
    company_website: job.company_website ?? '', industry: job.industry ?? '',
    company_size: job.company_size != null ? String(job.company_size) : '',
    company_stage: job.company_stage ?? '',
    mission_values: job.mission_values ?? '', culture_description: job.culture_description ?? '',
    dei_statement: job.dei_statement ?? '',
    application_deadline: job.application_deadline ?? '',
    documents_required: tryParseJsonArray(job.documents_required).join('\n'),
    interview_rounds: job.interview_rounds != null ? String(job.interview_rounds) : '',
    interview_format: tryParseJsonArray(job.interview_format).join('\n'),
    expected_time_to_hire: job.expected_time_to_hire ?? '',
    contact_person: job.contact_person ?? '', contact_email_phone: job.contact_email_phone ?? '',
    is_active: job.is_active === 1,
  };
}

function linesToArray(text: string): string[] {
  return text.split('\n').map(s => s.trim()).filter(s => s !== '');
}

function strOrNull(v: string): string | null { return v.trim() || null; }
function numOrNull(v: string): number | null { const t = v.trim(); return t === '' ? null : Number(t); }

function buildPayload(form: FormState): RecruiterJobInput {
  return {
    title: form.title.trim(),
    company: strOrNull(form.company),
    employment_type: form.employment_type === '' ? null : form.employment_type,
    job_id_requisition: strOrNull(form.job_id_requisition),
    department: strOrNull(form.department), team: strOrNull(form.team),
    reporting_to: strOrNull(form.reporting_to),
    number_of_direct_reports: numOrNull(form.number_of_direct_reports),
    permanent_or_fixed_term: strOrNull(form.permanent_or_fixed_term),
    contract_duration: strOrNull(form.contract_duration),
    job_level: strOrNull(form.job_level),
    location: strOrNull(form.location), remote: form.remote,
    work_model: strOrNull(form.work_model),
    office_locations: linesToArray(form.office_locations),
    hybrid_days_in_office: numOrNull(form.hybrid_days_in_office),
    willing_to_hire_internationally: form.willing_to_hire_internationally,
    travel_required: form.travel_required,
    travel_percentage: strOrNull(form.travel_percentage),
    relocation_assistance: form.relocation_assistance,
    salary_min: numOrNull(form.salary_min), salary_max: numOrNull(form.salary_max),
    salary_currency: form.salary_currency.trim() || 'USD',
    pay_frequency: strOrNull(form.pay_frequency),
    bonus_commission_structure: strOrNull(form.bonus_commission_structure),
    equity_stock_options: strOrNull(form.equity_stock_options),
    benefits_overview: strOrNull(form.benefits_overview),
    retirement_plan: strOrNull(form.retirement_plan),
    paid_time_off_days: numOrNull(form.paid_time_off_days),
    parental_leave_policy: strOrNull(form.parental_leave_policy),
    other_perks: linesToArray(form.other_perks),
    description: strOrNull(form.description), summary: strOrNull(form.summary),
    key_responsibilities: linesToArray(form.key_responsibilities),
    why_role_is_open: strOrNull(form.why_role_is_open),
    team_size: numOrNull(form.team_size), team_structure: strOrNull(form.team_structure),
    cross_functional_collaborators: linesToArray(form.cross_functional_collaborators),
    req_years_of_experience: numOrNull(form.req_years_of_experience),
    req_education_level: strOrNull(form.req_education_level),
    req_field_of_study: strOrNull(form.req_field_of_study),
    req_certifications: linesToArray(form.req_certifications),
    req_technical_skills: linesToArray(form.req_technical_skills),
    req_work_authorization: strOrNull(form.req_work_authorization),
    nice_years_of_experience: numOrNull(form.nice_years_of_experience),
    nice_education: strOrNull(form.nice_education),
    nice_technical_skills: linesToArray(form.nice_technical_skills),
    nice_industry_background: strOrNull(form.nice_industry_background),
    company_website: strOrNull(form.company_website), industry: strOrNull(form.industry),
    company_size: numOrNull(form.company_size), company_stage: strOrNull(form.company_stage),
    mission_values: strOrNull(form.mission_values),
    culture_description: strOrNull(form.culture_description),
    dei_statement: strOrNull(form.dei_statement),
    application_deadline: strOrNull(form.application_deadline),
    documents_required: linesToArray(form.documents_required),
    interview_rounds: numOrNull(form.interview_rounds),
    interview_format: linesToArray(form.interview_format),
    expected_time_to_hire: strOrNull(form.expected_time_to_hire),
    contact_person: strOrNull(form.contact_person),
    contact_email_phone: strOrNull(form.contact_email_phone),
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [issues, setIssues] = useState<JobReviewIssue[]>([]);
  const [reviewSource, setReviewSource] = useState<'llm' | 'heuristic' | null>(null);
  const [reviewedAt, setReviewedAt] = useState<Date | null>(null);

  // Quick fill shortcut (Ctrl+Shift+F) — includes a deliberate error for AI review testing
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setForm({
          title: 'Senior Backend Engineer', company: 'Acme Corp',
          employment_type: 'FullTime', job_id_requisition: 'REQ-2026-042',
          department: 'Engineering', team: 'Platform', reporting_to: 'VP of Engineering',
          number_of_direct_reports: '0', permanent_or_fixed_term: 'Permanent',
          contract_duration: '', job_level: 'Junior',
          location: 'San Francisco, CA', remote: true, work_model: 'remote',
          office_locations: 'San Francisco, CA', hybrid_days_in_office: '',
          willing_to_hire_internationally: false, travel_required: false,
          travel_percentage: '', relocation_assistance: true,
          salary_min: '65000', salary_max: '85000', salary_currency: 'USD',
          pay_frequency: 'Annual', bonus_commission_structure: '10-15% annual bonus',
          equity_stock_options: '0.05-0.1% equity', benefits_overview: 'Health, dental, vision, 401k match',
          retirement_plan: '401k with 4% match', paid_time_off_days: '20',
          parental_leave_policy: '16 weeks paid', other_perks: 'Gym stipend\nLearning budget\nHome office setup',
          description: 'Join our platform team as a junior backend engineer. You will work alongside senior engineers to build and maintain Node.js APIs backed by PostgreSQL. Great opportunity for someone early in their career.',
          summary: 'Junior backend engineering role supporting our core API services.',
          key_responsibilities: 'Assist in building RESTful APIs\nWrite unit tests\nParticipate in code reviews\nLearn from senior engineers',
          why_role_is_open: 'New headcount', team_size: '8', team_structure: 'Platform team within Engineering',
          cross_functional_collaborators: 'Product\nDesign\nData Engineering',
          req_years_of_experience: '0', req_education_level: "Bachelor's",
          req_field_of_study: 'Computer Science', req_certifications: '',
          req_technical_skills: 'Node.js\nPostgreSQL\nTypeScript',
          req_work_authorization: 'Must be authorized to work in the US',
          nice_years_of_experience: '1', nice_education: "Bachelor's",
          nice_technical_skills: 'Kubernetes\nGraphQL\nRedis', nice_industry_background: 'SaaS / B2B',
          company_website: 'https://acme.example.com', industry: 'Technology',
          company_size: '500', company_stage: 'Series C',
          mission_values: 'Building tools that empower developers worldwide.',
          culture_description: 'Fast-paced, collaborative, remote-first culture.',
          dei_statement: 'We are committed to building a diverse and inclusive team.',
          application_deadline: '2026-06-30', documents_required: 'Resume\nCover letter',
          interview_rounds: '4', interview_format: 'Phone screen\nTechnical\nSystem design\nTeam fit',
          expected_time_to_hire: '4-6 weeks', contact_person: 'Dana Recruiter',
          contact_email_phone: 'dana@acme.example.com',
          is_active: true,
        });
        setFieldErrors({});
        setIssues([]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    if (fieldErrors[key]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
    if (issues.length > 0) {
      setIssues([]);
      setReviewedAt(null);
    }
  }

  async function handleReview() {
    if (!token) return;
    setReviewing(true);
    setError(null);
    try {
      const payload = buildPayload(form);
      const res = await api.recruiterReviewJob(token, payload);
      setIssues(res.issues.length > 0 ? [res.issues[0]] : []);
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
    setError(null);

    const errs: Partial<Record<FieldKey, string>> = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.company.trim()) errs.company = 'Company is required.';
    if (!form.employment_type) errs.employment_type = 'Employment type is required.';
    if (!form.location.trim()) errs.location = 'Location is required.';
    if (!form.work_model) errs.work_model = 'Work model is required.';
    if (!form.summary.trim()) errs.summary = 'Role summary is required.';
    if (!form.application_deadline.trim()) errs.application_deadline = 'Application deadline is required.';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.application_deadline)) errs.application_deadline = 'Enter a valid date (YYYY-MM-DD).';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
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
          <legend style={styles.legend}>Job Basics</legend>
          <Field label="Title" required issues={issuesByField.get('title')} validationError={fieldErrors.title} input={<input type="text" value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Senior Backend Engineer" style={fieldErrors.title ? { ...styles.input, ...styles.inputError } : issuesByField.has('title') ? { ...styles.input, ...styles.inputWarning } : styles.input} required />} />
          <div style={styles.gridTwo}>
            <Field label="Company" required issues={issuesByField.get('company')} validationError={fieldErrors.company} input={<input type="text" value={form.company} onChange={e => update('company', e.target.value)} placeholder="e.g. Acme Corp" style={fieldErrors.company ? { ...styles.input, ...styles.inputError } : styles.input} required />} />
            <Field label="Employment type" required validationError={fieldErrors.employment_type} input={<select value={form.employment_type} onChange={e => update('employment_type', e.target.value as EmploymentType | '')} style={fieldErrors.employment_type ? { ...styles.input, ...styles.inputError } : styles.input}>{EMPLOYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>} />
          </div>
          <div style={styles.gridTwo}>
            <Field label="Job ID / Requisition #" input={<input type="text" value={form.job_id_requisition} onChange={e => update('job_id_requisition', e.target.value)} style={styles.input} />} />
            <Field label="Department" input={<input type="text" value={form.department} onChange={e => update('department', e.target.value)} style={styles.input} />} />
          </div>
          <div style={styles.gridTwo}>
            <Field label="Team" input={<input type="text" value={form.team} onChange={e => update('team', e.target.value)} style={styles.input} />} />
            <Field label="Reporting to" input={<input type="text" value={form.reporting_to} onChange={e => update('reporting_to', e.target.value)} placeholder="Title of direct manager" style={styles.input} />} />
          </div>
          <div style={styles.gridThree}>
            <Field label="# Direct reports" input={<input type="number" min={0} value={form.number_of_direct_reports} onChange={e => update('number_of_direct_reports', e.target.value)} style={styles.input} />} />
            <Field label="Permanent / Fixed-term" input={<input type="text" value={form.permanent_or_fixed_term} onChange={e => update('permanent_or_fixed_term', e.target.value)} placeholder="Permanent" style={styles.input} />} />
            <Field label="Contract duration" input={<input type="text" value={form.contract_duration} onChange={e => update('contract_duration', e.target.value)} placeholder="e.g. 6 months" style={styles.input} />} />
          </div>
          <Field label="Job level / Seniority" input={<input type="text" value={form.job_level} onChange={e => update('job_level', e.target.value)} placeholder="e.g. Senior, Staff, Lead" style={styles.input} />} />
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Location</legend>
          <div style={styles.gridTwo}>
            <Field label="Location" required validationError={fieldErrors.location} input={<input type="text" value={form.location} onChange={e => update('location', e.target.value)} placeholder="e.g. San Francisco, CA" style={fieldErrors.location ? { ...styles.input, ...styles.inputError } : styles.input} required />} />
            <Field label="Work model" required validationError={fieldErrors.work_model} input={<select value={form.work_model} onChange={e => update('work_model', e.target.value)} style={fieldErrors.work_model ? { ...styles.input, ...styles.inputError } : styles.input}><option value="">Not specified</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="on-site">On-site</option></select>} />
          </div>
          <Field label="Office locations (one per line)" input={<textarea value={form.office_locations} onChange={e => update('office_locations', e.target.value)} rows={2} placeholder="San Francisco, CA&#10;New York, NY" style={{ ...styles.input, resize: 'vertical' }} />} />
          {form.work_model === 'hybrid' && <Field label="Days in office per week" input={<input type="number" min={0} max={7} value={form.hybrid_days_in_office} onChange={e => update('hybrid_days_in_office', e.target.value)} style={styles.input} />} />}
          <div style={styles.gridTwo}>
            <Field label="Remote" input={<label style={styles.toggleRow}><input type="checkbox" checked={form.remote} onChange={e => update('remote', e.target.checked)} /><span>Remote-friendly</span></label>} />
            <Field label="International" input={<label style={styles.toggleRow}><input type="checkbox" checked={form.willing_to_hire_internationally} onChange={e => update('willing_to_hire_internationally', e.target.checked)} /><span>Willing to hire internationally</span></label>} />
          </div>
          <div style={styles.gridThree}>
            <Field label="Travel required" input={<label style={styles.toggleRow}><input type="checkbox" checked={form.travel_required} onChange={e => update('travel_required', e.target.checked)} /><span>Yes</span></label>} />
            <Field label="Travel %" input={<input type="text" value={form.travel_percentage} onChange={e => update('travel_percentage', e.target.value)} placeholder="e.g. 20%" style={styles.input} />} />
            <Field label="Relocation" input={<label style={styles.toggleRow}><input type="checkbox" checked={form.relocation_assistance} onChange={e => update('relocation_assistance', e.target.checked)} /><span>Offered</span></label>} />
          </div>
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Compensation</legend>
          <div style={styles.gridThree}>
            <Field label="Min salary" input={<input type="number" min={0} value={form.salary_min} onChange={e => update('salary_min', e.target.value)} placeholder="120000" style={styles.input} />} />
            <Field label="Max salary" input={<input type="number" min={0} value={form.salary_max} onChange={e => update('salary_max', e.target.value)} placeholder="180000" style={styles.input} />} />
            <Field label="Currency" input={<input type="text" value={form.salary_currency} onChange={e => update('salary_currency', e.target.value.toUpperCase())} maxLength={3} placeholder="USD" style={styles.input} />} />
          </div>
          <div style={styles.gridTwo}>
            <Field label="Pay frequency" input={<input type="text" value={form.pay_frequency} onChange={e => update('pay_frequency', e.target.value)} placeholder="Annual" style={styles.input} />} />
            <Field label="PTO days/year" input={<input type="number" min={0} value={form.paid_time_off_days} onChange={e => update('paid_time_off_days', e.target.value)} style={styles.input} />} />
          </div>
          <Field label="Bonus / Commission" input={<input type="text" value={form.bonus_commission_structure} onChange={e => update('bonus_commission_structure', e.target.value)} style={styles.input} />} />
          <Field label="Equity / Stock options" input={<input type="text" value={form.equity_stock_options} onChange={e => update('equity_stock_options', e.target.value)} style={styles.input} />} />
          <Field label="Benefits overview" input={<textarea value={form.benefits_overview} onChange={e => update('benefits_overview', e.target.value)} rows={2} placeholder="Health, dental, vision…" style={{ ...styles.input, resize: 'vertical' }} />} />
          <div style={styles.gridTwo}>
            <Field label="Retirement plan" input={<input type="text" value={form.retirement_plan} onChange={e => update('retirement_plan', e.target.value)} placeholder="401k with match" style={styles.input} />} />
            <Field label="Parental leave" input={<input type="text" value={form.parental_leave_policy} onChange={e => update('parental_leave_policy', e.target.value)} style={styles.input} />} />
          </div>
          <Field label="Other perks (one per line)" input={<textarea value={form.other_perks} onChange={e => update('other_perks', e.target.value)} rows={2} placeholder="Gym stipend&#10;Learning budget" style={{ ...styles.input, resize: 'vertical' }} />} />
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Role Description</legend>
          <Field label="Summary" required validationError={fieldErrors.summary} issues={issuesByField.get('summary')} input={<textarea value={form.summary} onChange={e => update('summary', e.target.value)} rows={3} placeholder="Brief overview of the role" style={fieldErrors.summary ? { ...styles.input, ...styles.inputError, resize: 'vertical' as const } : { ...styles.input, resize: 'vertical' as const }} required />} />
          <Field label="Key responsibilities (one per line)" input={<textarea value={form.key_responsibilities} onChange={e => update('key_responsibilities', e.target.value)} rows={4} placeholder="Design and implement APIs&#10;Mentor junior engineers" style={{ ...styles.input, resize: 'vertical' }} />} />
          <Field label="Full description" issues={issuesByField.get('description')} input={<textarea value={form.description} onChange={e => update('description', e.target.value)} rows={6} placeholder="Detailed role description…" style={{ ...styles.input, minHeight: 140, resize: 'vertical' }} />} />
          <Field label="Why is this role open?" input={<input type="text" value={form.why_role_is_open} onChange={e => update('why_role_is_open', e.target.value)} placeholder="New headcount / Backfill" style={styles.input} />} />
          <div style={styles.gridTwo}>
            <Field label="Team size" input={<input type="number" min={0} value={form.team_size} onChange={e => update('team_size', e.target.value)} style={styles.input} />} />
            <Field label="Team structure" input={<input type="text" value={form.team_structure} onChange={e => update('team_structure', e.target.value)} style={styles.input} />} />
          </div>
          <Field label="Cross-functional collaborators (one per line)" input={<textarea value={form.cross_functional_collaborators} onChange={e => update('cross_functional_collaborators', e.target.value)} rows={2} style={{ ...styles.input, resize: 'vertical' }} />} />
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Requirements</legend>
          <div style={styles.gridThree}>
            <Field label="Years of experience" input={<input type="number" min={0} value={form.req_years_of_experience} onChange={e => update('req_years_of_experience', e.target.value)} style={styles.input} />} />
            <Field label="Education level" input={<input type="text" value={form.req_education_level} onChange={e => update('req_education_level', e.target.value)} placeholder="Bachelor's" style={styles.input} />} />
            <Field label="Field of study" input={<input type="text" value={form.req_field_of_study} onChange={e => update('req_field_of_study', e.target.value)} placeholder="Computer Science" style={styles.input} />} />
          </div>
          <Field label="Required technical skills (one per line)" input={<textarea value={form.req_technical_skills} onChange={e => update('req_technical_skills', e.target.value)} rows={3} placeholder="Node.js&#10;PostgreSQL&#10;TypeScript" style={{ ...styles.input, resize: 'vertical' }} />} />
          <Field label="Required certifications (one per line)" input={<textarea value={form.req_certifications} onChange={e => update('req_certifications', e.target.value)} rows={2} style={{ ...styles.input, resize: 'vertical' }} />} />
          <Field label="Work authorization" input={<input type="text" value={form.req_work_authorization} onChange={e => update('req_work_authorization', e.target.value)} placeholder="Must be authorized to work in the US" style={styles.input} />} />
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Nice to Haves</legend>
          <div style={styles.gridTwo}>
            <Field label="Years of experience" input={<input type="number" min={0} value={form.nice_years_of_experience} onChange={e => update('nice_years_of_experience', e.target.value)} style={styles.input} />} />
            <Field label="Education" input={<input type="text" value={form.nice_education} onChange={e => update('nice_education', e.target.value)} style={styles.input} />} />
          </div>
          <Field label="Preferred technical skills (one per line)" input={<textarea value={form.nice_technical_skills} onChange={e => update('nice_technical_skills', e.target.value)} rows={2} style={{ ...styles.input, resize: 'vertical' }} />} />
          <Field label="Industry background" input={<input type="text" value={form.nice_industry_background} onChange={e => update('nice_industry_background', e.target.value)} style={styles.input} />} />
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Company Information</legend>
          <div style={styles.gridTwo}>
            <Field label="Company website" input={<input type="url" value={form.company_website} onChange={e => update('company_website', e.target.value)} placeholder="https://…" style={styles.input} />} />
            <Field label="Industry" input={<input type="text" value={form.industry} onChange={e => update('industry', e.target.value)} style={styles.input} />} />
          </div>
          <div style={styles.gridTwo}>
            <Field label="Company size" input={<input type="number" min={0} value={form.company_size} onChange={e => update('company_size', e.target.value)} placeholder="e.g. 500" style={styles.input} />} />
            <Field label="Company stage" input={<input type="text" value={form.company_stage} onChange={e => update('company_stage', e.target.value)} placeholder="e.g. Series B, Public" style={styles.input} />} />
          </div>
          <Field label="Mission / Values" input={<textarea value={form.mission_values} onChange={e => update('mission_values', e.target.value)} rows={2} style={{ ...styles.input, resize: 'vertical' }} />} />
          <Field label="Culture description" input={<textarea value={form.culture_description} onChange={e => update('culture_description', e.target.value)} rows={2} style={{ ...styles.input, resize: 'vertical' }} />} />
          <Field label="DEI statement" input={<textarea value={form.dei_statement} onChange={e => update('dei_statement', e.target.value)} rows={2} style={{ ...styles.input, resize: 'vertical' }} />} />
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Application Process</legend>
          <div style={styles.gridTwo}>
            <Field label="Application deadline" required validationError={fieldErrors.application_deadline} input={<input type="text" value={form.application_deadline} onChange={e => {
              // Auto-format: only digits, insert dashes after YYYY and MM, max 10 chars
              const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 8);
              let formatted = raw;
              if (raw.length > 4) formatted = raw.slice(0, 4) + '-' + raw.slice(4);
              if (raw.length > 6) formatted = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6);
              update('application_deadline', formatted);
            }} placeholder="YYYY-MM-DD" maxLength={10} style={fieldErrors.application_deadline ? { ...styles.input, ...styles.inputError } : styles.input} required />} />
            <Field label="Expected time to hire" input={<input type="text" value={form.expected_time_to_hire} onChange={e => update('expected_time_to_hire', e.target.value)} placeholder="e.g. 4-6 weeks" style={styles.input} />} />
          </div>
          <Field label="Documents required (one per line)" input={<textarea value={form.documents_required} onChange={e => update('documents_required', e.target.value)} rows={2} placeholder="Resume&#10;Cover letter" style={{ ...styles.input, resize: 'vertical' }} />} />
          <div style={styles.gridTwo}>
            <Field label="Interview rounds" input={<input type="number" min={0} value={form.interview_rounds} onChange={e => update('interview_rounds', e.target.value)} style={styles.input} />} />
            <Field label="Interview format (one per line)" input={<textarea value={form.interview_format} onChange={e => update('interview_format', e.target.value)} rows={2} placeholder="Phone screen&#10;Technical&#10;On-site" style={{ ...styles.input, resize: 'vertical' }} />} />
          </div>
          <div style={styles.gridTwo}>
            <Field label="Contact person" input={<input type="text" value={form.contact_person} onChange={e => update('contact_person', e.target.value)} style={styles.input} />} />
            <Field label="Contact email / phone" input={<input type="text" value={form.contact_email_phone} onChange={e => update('contact_email_phone', e.target.value)} style={styles.input} />} />
          </div>
        </fieldset>

        <fieldset style={styles.fieldset} disabled={saving}>
          <legend style={styles.legend}>Status</legend>
          <label style={styles.toggleRow}>
            <input type="checkbox" checked={form.is_active} onChange={e => update('is_active', e.target.checked)} />
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
          disabled={saving}
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
  validationError,
  input,
}: {
  label: string;
  required?: boolean;
  issues?: JobReviewIssue[];
  validationError?: string;
  input: React.ReactNode;
}) {
  const hasWarning = issues && issues.length > 0;
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>
        {label}
        {required && <span style={styles.requiredMark}> *</span>}
      </span>
      {input}
      {validationError && (
        <span style={styles.fieldValidationError}>{validationError}</span>
      )}
      {hasWarning && (
        <div style={styles.fieldWarningBanner}>
          {issues!.map((i, idx) => (
            <span key={idx}>{i.message}</span>
          ))}
        </div>
      )}
    </label>
  );
}

function severityColor(s: JobReviewSeverity) {
  if (s === 'error') return 'var(--danger)';
  if (s === 'warning') return 'var(--warning)';
  return 'var(--text)';
}

function severityStyle(s: JobReviewSeverity): CSSProperties {
  if (s === 'error') {
    return {
      borderColor: 'var(--danger-border)',
      background: 'var(--danger-bg)',
    };
  }
  if (s === 'warning') {
    return {
      borderColor: 'var(--warning-border)',
      background: 'var(--warning-bg)',
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
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
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
  requiredMark: { color: 'var(--danger)' },
  fieldValidationError: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--danger-strong)',
  },
  fieldWarningBanner: {
    padding: '8px 12px',
    fontSize: 13,
    color: '#7a4a00',
    background: 'rgba(255, 184, 0, 0.12)',
    border: '1px solid rgba(255, 184, 0, 0.5)',
    borderRadius: 8,
    lineHeight: 1.45,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
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
  inputError: {
    borderColor: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    boxShadow: '0 0 0 3px var(--danger-bg)',
  },
  inputWarning: {
    borderColor: '#d99e00',
    background: 'rgba(255, 184, 0, 0.06)',
    boxShadow: '0 0 0 3px rgba(255, 184, 0, 0.15)',
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
    color: 'var(--success)',
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
    color: 'var(--warning)',
  },
};
