import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  api,
  ApiError,
  type ApplicantProfile as ProfileType,
  type ApplicantProfileInput,
  type WorkExperienceInput,
  type EducationInput,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

type WorkExpItem = WorkExperienceInput & { _key: number; _expanded: boolean };
type EduItem = EducationInput & { _key: number; _expanded: boolean };

const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: '', label: '— Select —' },
  { value: 'FullTime', label: 'Full-time' },
  { value: 'PartTime', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Internship', label: 'Internship' },
  { value: 'Temporary', label: 'Temporary' },
];

export default function ApplicantProfile() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Flat editable fields from personal_information
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [alternativePhone, setAlternativePhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [aptSuiteUnit, setAptSuiteUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [websitePortfolio, setWebsitePortfolio] = useState('');
  const [githubOrOther, setGithubOrOther] = useState('');

  const [workExp, setWorkExp] = useState<WorkExpItem[]>([]);
  const [education, setEducation] = useState<EduItem[]>([]);
  const keyCounter = useRef(0);
  const nextKey = () => ++keyCounter.current;

  // Snapshot of critical field values as loaded from the server (set in hydrate).
  // Used to compute whether any critical field has actually changed.
  const originalCritical = useRef<{
    linkedinUrl: string;
    websitePortfolio: string;
    githubOrOther: string;
    workJson: string;
    eduJson: string;
  } | null>(null);

  function serializeWork(items: WorkExpItem[]): string {
    return JSON.stringify(
      items.map(({ _key: _k, _expanded: _e, ...w }) => w),
    );
  }
  function serializeEdu(items: EduItem[]): string {
    return JSON.stringify(
      items.map(({ _key: _k, _expanded: _e, ...e }) => e),
    );
  }

  function hydrate(p: ProfileType) {
    const pi = p.personal_information;
    const ln = pi.linkedin_url ?? '';
    const wp = pi.website_portfolio ?? '';
    const gh = pi.github_or_other_portfolio ?? '';
    setFirstName(pi.first_name ?? '');
    setMiddleInitial(pi.middle_initial ?? '');
    setLastName(pi.last_name ?? '');
    setPreferredName(pi.preferred_name ?? '');
    setPronouns(pi.pronouns ?? '');
    setDateOfBirth(pi.date_of_birth ?? '');
    setPhoneNumber(pi.phone_number ?? '');
    setAlternativePhone(pi.alternative_phone ?? '');
    setStreetAddress(pi.street_address ?? '');
    setAptSuiteUnit(pi.apt_suite_unit ?? '');
    setCity(pi.city ?? '');
    setState(pi.state ?? '');
    setZipCode(pi.zip_code ?? '');
    setLinkedinUrl(ln);
    setWebsitePortfolio(wp);
    setGithubOrOther(gh);
    const newWork = p.work_experience.map(w => ({ ...w, _key: nextKey(), _expanded: false }));
    const newEdu = p.education.map(e => ({ ...e, _key: nextKey(), _expanded: false }));
    setWorkExp(newWork);
    setEducation(newEdu);
    // Capture the baseline for change detection.
    originalCritical.current = {
      linkedinUrl: ln,
      websitePortfolio: wp,
      githubOrOther: gh,
      workJson: serializeWork(newWork),
      eduJson: serializeEdu(newEdu),
    };
  }

  // True when at least one critical field differs from what the server returned.
  const criticalEditsPending = useMemo(() => {
    const orig = originalCritical.current;
    if (!orig) return false;
    return (
      linkedinUrl !== orig.linkedinUrl ||
      websitePortfolio !== orig.websitePortfolio ||
      githubOrOther !== orig.githubOrOther ||
      serializeWork(workExp) !== orig.workJson ||
      serializeEdu(education) !== orig.eduJson
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedinUrl, websitePortfolio, githubOrOther, workExp, education]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.applicantGetProfile(token).then(d => {
      if (cancelled) return;
      hydrate(d.profile);
    }).catch(err => {
      if (cancelled) return;
      setError(err instanceof ApiError ? err.detail || err.code : 'Could not load profile.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function updateWork(idx: number, patch: Partial<WorkExperienceInput>) {
    setWorkExp(prev => prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  }
  function removeWork(idx: number) {
    setWorkExp(prev => prev.filter((_, i) => i !== idx));
  }
  function toggleWork(idx: number) {
    setWorkExp(prev =>
      prev.map((w, i) => (i === idx ? { ...w, _expanded: !w._expanded } : w)),
    );
  }
  function addWork() {
    setWorkExp(prev => [
      ...prev,
      {
        _key: nextKey(),
        _expanded: true,
        current_job: false,
        employment_type: '',
      },
    ]);
  }

  function updateEdu(idx: number, patch: Partial<EducationInput>) {
    setEducation(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function removeEdu(idx: number) {
    setEducation(prev => prev.filter((_, i) => i !== idx));
  }
  function toggleEdu(idx: number) {
    setEducation(prev =>
      prev.map((e, i) => (i === idx ? { ...e, _expanded: !e._expanded } : e)),
    );
  }
  function addEdu() {
    setEducation(prev => [
      ...prev,
      {
        _key: nextKey(),
        _expanded: true,
        graduated: false,
        relevant_coursework: [],
      },
    ]);
  }

  async function save() {
    if (!token || saving) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    const payload: ApplicantProfileInput = {
      first_name: firstName.trim() || undefined,
      middle_initial: middleInitial.trim() || undefined,
      last_name: lastName.trim() || undefined,
      preferred_name: preferredName.trim() || undefined,
      pronouns: pronouns.trim() || undefined,
      date_of_birth: dateOfBirth.trim() || undefined,
      phone_number: phoneNumber.trim() || undefined,
      alternative_phone: alternativePhone.trim() || undefined,
      street_address: streetAddress.trim() || undefined,
      apt_suite_unit: aptSuiteUnit.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zip_code: zipCode.trim() || undefined,
      linkedin_url: linkedinUrl.trim() || undefined,
      website_portfolio: websitePortfolio.trim() || undefined,
      github_or_other_portfolio: githubOrOther.trim() || undefined,
      work_experience: workExp.map(({ _key: _wk, ...w }) => ({
        job_title: (w.job_title ?? '').trim() || undefined,
        company: (w.company ?? '').trim() || undefined,
        city: (w.city ?? '').trim() || undefined,
        state: (w.state ?? '').trim() || undefined,
        employment_type: (w.employment_type ?? '').trim() || undefined,
        start_date: (w.start_date ?? '').trim() || undefined,
        end_date: w.current_job ? undefined : (w.end_date ?? '').trim() || undefined,
        current_job: !!w.current_job,
        responsibilities: (w.responsibilities ?? '').trim() || undefined,
        key_achievements: (w.key_achievements ?? '').trim() || undefined,
      })),
      education: education.map(({ _key: _ek, ...e }) => ({
        school: (e.school ?? '').trim() || undefined,
        city: (e.city ?? '').trim() || undefined,
        state: (e.state ?? '').trim() || undefined,
        degree: (e.degree ?? '').trim() || undefined,
        major: (e.major ?? '').trim() || undefined,
        minor: (e.minor ?? '').trim() || undefined,
        start_date: (e.start_date ?? '').trim() || undefined,
        graduation_date: (e.graduation_date ?? '').trim() || undefined,
        graduated: !!e.graduated,
        gpa: (e.gpa ?? '').trim() || undefined,
        honors: (e.honors ?? '').trim() || undefined,
        relevant_coursework: Array.isArray(e.relevant_coursework)
          ? e.relevant_coursework.filter(c => c && c.trim() !== '')
          : [],
      })),
    };
    try {
      const res = await api.applicantUpdateProfile(token, payload);
      hydrate(res.profile);
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail || err.code : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={styles.page}><p>Loading profile…</p></div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.eyebrow}>Applicant</span>
        <h1 style={styles.title}>Edit profile</h1>
        <p style={styles.subtitle}>Update your personal details and links.</p>
      </header>

      <div role="note" style={styles.warningBanner}>
        Heads up: updates to links, work experience, and education are high-impact profile changes and may be reviewed by automated credibility checks.
      </div>

      {error && <div role="alert" style={styles.errorBanner}>{error}</div>}
      {success && <div role="status" style={styles.successBanner}>{success}</div>}

      <form style={styles.form} onSubmit={e => { e.preventDefault(); void save(); }}>
        <Section title="Personal Information">
          <div style={styles.row}>
            <Field label="First name" value={firstName} onChange={setFirstName} />
            <Field label="Middle initial" value={middleInitial} onChange={setMiddleInitial} />
            <Field label="Last name" value={lastName} onChange={setLastName} />
          </div>
          <div style={styles.row}>
            <Field label="Preferred name" value={preferredName} onChange={setPreferredName} />
            <Field label="Pronouns" value={pronouns} onChange={setPronouns} />
          </div>
          <div style={styles.row}>
            <Field label="Date of birth" value={dateOfBirth} onChange={setDateOfBirth} type="date" />
            <Field label="Phone" value={phoneNumber} onChange={setPhoneNumber} type="tel" />
            <Field label="Alt phone" value={alternativePhone} onChange={setAlternativePhone} type="tel" />
          </div>
        </Section>

        <Section title="Address">
          <Field label="Street address" value={streetAddress} onChange={setStreetAddress} />
          <Field label="Apt / Suite / Unit" value={aptSuiteUnit} onChange={setAptSuiteUnit} />
          <div style={styles.row}>
            <Field label="City" value={city} onChange={setCity} />
            <Field label="State" value={state} onChange={setState} />
            <Field label="ZIP code" value={zipCode} onChange={setZipCode} />
          </div>
        </Section>

        <Section title="Links">
          <Field label="LinkedIn" value={linkedinUrl} onChange={setLinkedinUrl} type="url" />
          <Field label="Website / Portfolio" value={websitePortfolio} onChange={setWebsitePortfolio} type="url" />
          <Field label="GitHub / Other" value={githubOrOther} onChange={setGithubOrOther} type="url" />
        </Section>

        <Section
          title="Work Experience"
          action={
            <button type="button" onClick={addWork} style={styles.addBtn}>
              + Add experience
            </button>
          }
        >
          {workExp.length === 0 ? (
            <p style={styles.emptyHint}>
              No work experience yet. Click <strong>+ Add experience</strong> to add your first role.
            </p>
          ) : (
            workExp.map((w, i) => (
              <WorkExperienceCard
                key={w._key}
                index={i}
                value={w}
                onChange={patch => updateWork(i, patch)}
                onRemove={() => removeWork(i)}
                onToggle={() => toggleWork(i)}
              />
            ))
          )}
        </Section>

        <Section
          title="Education"
          action={
            <button type="button" onClick={addEdu} style={styles.addBtn}>
              + Add education
            </button>
          }
        >
          {education.length === 0 ? (
            <p style={styles.emptyHint}>
              No education yet. Click <strong>+ Add education</strong> to add a school.
            </p>
          ) : (
            education.map((e, i) => (
              <EducationCard
                key={e._key}
                index={i}
                value={e}
                onChange={patch => updateEdu(i, patch)}
                onRemove={() => removeEdu(i)}
                onToggle={() => toggleEdu(i)}
              />
            ))
          )}
        </Section>

        {criticalEditsPending && (
          <div role="note" style={styles.saveWarningBanner}>
            You changed one or more high-impact fields. These updates will be reviewed for profile credibility after you save.
          </div>
        )}

        <div style={styles.actionsRow}>
          <button type="submit" style={styles.primaryBtn} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function WorkExperienceCard({
  index,
  value,
  onChange,
  onRemove,
  onToggle,
}: {
  index: number;
  value: WorkExpItem;
  onChange: (patch: Partial<WorkExperienceInput>) => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const expanded = value._expanded;
  const title = value.job_title?.trim();
  const company = value.company?.trim();
  const heading =
    title && company
      ? `${title} · ${company}`
      : title || company || `Experience #${index + 1}`;
  const place = [value.city, value.state].filter(Boolean).join(', ');
  const dateRange = formatDateRange(
    value.start_date,
    value.current_job ? 'Present' : value.end_date,
  );
  const summaryBits = [place, dateRange].filter(Boolean);

  return (
    <div style={expanded ? styles.editCard : styles.previewCard}>
      <button
        type="button"
        onClick={onToggle}
        style={styles.cardToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse entry' : 'Expand to edit'}
      >
        <span style={styles.cardToggleMain}>
          <span style={styles.cardTitle}>{heading}</span>
          {summaryBits.length > 0 && (
            <span style={styles.cardSubtitle}>{summaryBits.join(' · ')}</span>
          )}
          {value.current_job && <span style={styles.badge}>Current</span>}
        </span>
        <span style={styles.cardToggleControls}>
          <span
            aria-hidden="true"
            style={{
              ...styles.chevron,
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ›
          </span>
        </span>
      </button>
      {!expanded ? null : (
        <div style={styles.cardBody}>
          <div style={styles.cardActionsRow}>
            <button type="button" onClick={onRemove} style={styles.removeBtn}>
              Remove
            </button>
          </div>
          <div style={styles.row}>
            <Field
              label="Job title"
              value={value.job_title ?? ''}
              onChange={v => onChange({ job_title: v })}
            />
            <Field
              label="Company"
              value={value.company ?? ''}
              onChange={v => onChange({ company: v })}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="City"
              value={value.city ?? ''}
              onChange={v => onChange({ city: v })}
            />
            <Field
              label="State"
              value={value.state ?? ''}
              onChange={v => onChange({ state: v })}
            />
            <Select
              label="Employment type"
              value={value.employment_type ?? ''}
              onChange={v => onChange({ employment_type: v })}
              options={EMPLOYMENT_TYPES}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Start date"
              type="date"
              value={value.start_date ?? ''}
              onChange={v => onChange({ start_date: v })}
            />
            <Field
              label="End date"
              type="date"
              value={value.current_job ? '' : value.end_date ?? ''}
              onChange={v => onChange({ end_date: v })}
              disabled={!!value.current_job}
            />
          </div>
          <Checkbox
            label="I currently work here"
            checked={!!value.current_job}
            onChange={v => onChange({ current_job: v, end_date: v ? undefined : value.end_date })}
          />
          <Textarea
            label="Responsibilities"
            value={value.responsibilities ?? ''}
            onChange={v => onChange({ responsibilities: v })}
            rows={3}
            placeholder="What you owned day-to-day."
          />
          <Textarea
            label="Key achievements"
            value={value.key_achievements ?? ''}
            onChange={v => onChange({ key_achievements: v })}
            rows={3}
            placeholder="Concrete wins: scope, scale, outcomes."
          />
        </div>
      )}
    </div>
  );
}

function EducationCard({
  index,
  value,
  onChange,
  onRemove,
  onToggle,
}: {
  index: number;
  value: EduItem;
  onChange: (patch: Partial<EducationInput>) => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const expanded = value._expanded;
  const school = value.school?.trim();
  const degreeMajor = [value.degree, value.major].filter(Boolean).join(' in ');
  const heading =
    school || degreeMajor || `Education #${index + 1}`;
  const subBits: string[] = [];
  if (school && degreeMajor) subBits.push(degreeMajor);
  const place = [value.city, value.state].filter(Boolean).join(', ');
  if (place) subBits.push(place);
  const dateRange = formatDateRange(value.start_date, value.graduation_date);
  if (dateRange) subBits.push(dateRange);
  const courseworkText = (value.relevant_coursework ?? []).join(', ');

  return (
    <div style={expanded ? styles.editCard : styles.previewCard}>
      <button
        type="button"
        onClick={onToggle}
        style={styles.cardToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse entry' : 'Expand to edit'}
      >
        <span style={styles.cardToggleMain}>
          <span style={styles.cardTitle}>{heading}</span>
          {subBits.length > 0 && (
            <span style={styles.cardSubtitle}>{subBits.join(' · ')}</span>
          )}
          {value.graduated && <span style={styles.badge}>Graduated</span>}
        </span>
        <span style={styles.cardToggleControls}>
          <span
            aria-hidden="true"
            style={{
              ...styles.chevron,
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ›
          </span>
        </span>
      </button>
      {!expanded ? null : (
        <div style={styles.cardBody}>
          <div style={styles.cardActionsRow}>
            <button type="button" onClick={onRemove} style={styles.removeBtn}>
              Remove
            </button>
          </div>
          <Field
            label="School"
            value={value.school ?? ''}
            onChange={v => onChange({ school: v })}
          />
          <div style={styles.row}>
            <Field
              label="City"
              value={value.city ?? ''}
              onChange={v => onChange({ city: v })}
            />
            <Field
              label="State"
              value={value.state ?? ''}
              onChange={v => onChange({ state: v })}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Degree"
              value={value.degree ?? ''}
              onChange={v => onChange({ degree: v })}
              placeholder="e.g. B.S."
            />
            <Field
              label="Major"
              value={value.major ?? ''}
              onChange={v => onChange({ major: v })}
            />
            <Field
              label="Minor"
              value={value.minor ?? ''}
              onChange={v => onChange({ minor: v })}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Start date"
              type="date"
              value={value.start_date ?? ''}
              onChange={v => onChange({ start_date: v })}
            />
            <Field
              label={value.graduated ? 'Graduation date' : 'Expected graduation'}
              type="date"
              value={value.graduation_date ?? ''}
              onChange={v => onChange({ graduation_date: v })}
            />
          </div>
          <Checkbox
            label="Graduated"
            checked={!!value.graduated}
            onChange={v => onChange({ graduated: v })}
          />
          <div style={styles.row}>
            <Field
              label="GPA"
              value={value.gpa ?? ''}
              onChange={v => onChange({ gpa: v })}
              placeholder="e.g. 3.8"
            />
            <Field
              label="Honors"
              value={value.honors ?? ''}
              onChange={v => onChange({ honors: v })}
              placeholder="e.g. cum laude"
            />
          </div>
          <Field
            label="Relevant coursework (comma-separated)"
            value={courseworkText}
            onChange={v =>
              onChange({
                relevant_coursework: v
                  .split(',')
                  .map(s => s.trim())
                  .filter(s => s !== ''),
              })
            }
            placeholder="Algorithms, Operating Systems, Databases"
          />
        </div>
      )}
    </div>
  );
}

function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = formatYearMonth(start);
  const e = end === 'Present' ? 'Present' : formatYearMonth(end);
  if (!s && !e) return '';
  if (!s) return e || '';
  if (!e) return s;
  return `${s} – ${e}`;
}

function formatYearMonth(value: string | null | undefined): string {
  if (!value) return '';
  // Inputs from <input type="date"> are YYYY-MM-DD; show as Mon YYYY.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const monthIdx = parseInt(m[2], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${months[monthIdx]} ${m[1]}`;
    }
  }
  return value;
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        {action}
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  onFocus?: () => void;
}

function Field({ label, value, onChange, type = 'text', placeholder, disabled, onFocus }: FieldProps) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={onFocus}
        placeholder={placeholder} disabled={disabled} style={styles.input} />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  onFocus?: () => void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        rows={rows}
        placeholder={placeholder}
        style={{ ...styles.input, ...styles.textarea }}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  onFocus?: () => void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        style={styles.input}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  onFocus,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  onFocus?: () => void;
}) {
  return (
    <label style={styles.checkboxRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        onFocus={onFocus}
        style={styles.checkbox}
      />
      <span style={styles.checkboxLabel}>{label}</span>
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { flex: 1, width: '100%', boxSizing: 'border-box', padding: '40px 32px 64px', display: 'flex', flexDirection: 'column', gap: 24, textAlign: 'left', maxWidth: 880 },
  header: { display: 'flex', flexDirection: 'column', gap: 6 },
  eyebrow: { display: 'inline-block', width: 'fit-content', padding: '4px 12px', fontSize: 12, fontWeight: 500, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 999, letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { margin: '8px 0 4px', fontSize: 32, lineHeight: 1.1, color: 'var(--text-h)', letterSpacing: '-0.5px' },
  subtitle: { margin: 0, color: 'var(--text)', fontSize: 15, maxWidth: 640 },
  errorBanner: { padding: '10px 14px', fontSize: 14, color: '#b00020', background: 'rgba(176, 0, 32, 0.08)', border: '1px solid rgba(176, 0, 32, 0.25)', borderRadius: 10 },
  warningBanner: { padding: '10px 14px', fontSize: 14, color: '#7a5600', background: 'rgba(255, 184, 0, 0.14)', border: '1px solid rgba(255, 184, 0, 0.5)', borderRadius: 10 },
  saveWarningBanner: { padding: '10px 14px', fontSize: 13, color: '#7a5600', background: 'rgba(255, 184, 0, 0.12)', border: '1px solid rgba(255, 184, 0, 0.45)', borderRadius: 10 },
  successBanner: { padding: '10px 14px', fontSize: 14, color: '#0a6b2b', background: 'rgba(10, 107, 43, 0.08)', border: '1px solid rgba(10, 107, 43, 0.25)', borderRadius: 10 },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 12, padding: 20, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--bg)', boxShadow: 'var(--shadow)' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  sectionTitle: { margin: 0, fontSize: 16, color: 'var(--text-h)' },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { padding: '10px 12px', fontSize: 14, color: 'var(--text-h)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, outline: 'none', fontFamily: 'inherit' },
  textarea: { resize: 'vertical', minHeight: 72, lineHeight: 1.5 },
  readonlyCard: { padding: '10px 14px', fontSize: 14, color: 'var(--text-h)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 10 },
  previewCard: { display: 'flex', flexDirection: 'column', padding: 0, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)', overflow: 'hidden' },
  editCard: { display: 'flex', flexDirection: 'column', gap: 12, padding: 0, border: '1px solid var(--accent-border)', borderRadius: 12, background: 'var(--accent-bg)', overflow: 'hidden' },
  cardToggle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', padding: '12px 14px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' },
  cardToggleMain: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, minWidth: 0, flex: 1 },
  cardToggleControls: { display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text)' },
  chevron: { display: 'inline-block', fontSize: 18, lineHeight: 1, transition: 'transform 120ms ease' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 14px 14px' },
  cardActionsRow: { display: 'flex', justifyContent: 'flex-end' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  cardTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-h)' },
  cardSubtitle: { fontSize: 13, color: 'var(--text)' },
  removeBtn: { padding: '6px 10px', fontSize: 12, fontWeight: 500, color: '#9a1a1a', background: 'transparent', border: '1px solid rgba(154, 26, 26, 0.45)', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit' },
  addBtn: { padding: '6px 12px', fontSize: 13, fontWeight: 500, color: 'var(--accent)', background: 'transparent', border: '1px dashed var(--accent-border)', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit' },
  emptyHint: { margin: 0, fontSize: 13, color: 'var(--text)', padding: 12, border: '1px dashed var(--border)', borderRadius: 10, textAlign: 'center' },
  badge: { marginLeft: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 999 },
  hint: { margin: 0, fontSize: 12, color: 'var(--text)' },
  checkboxRow: { display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  checkbox: { width: 16, height: 16, accentColor: 'var(--accent)' },
  checkboxLabel: { fontSize: 13, color: 'var(--text-h)' },
  actionsRow: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  primaryBtn: { padding: '10px 18px', fontSize: 14, fontWeight: 500, color: 'var(--bg)', background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' },
};
