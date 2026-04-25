import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ApiError,
  api,
  type ApplicantProfileInput,
  type WorkExperienceInput,
  type EducationInput,
  type SkillInput,
  type LanguageInput,
  type ReferenceInput,
  type AboutMeInput,
  type LegalInput,
  type EeoInput,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useSignup } from '../../signup/SignupContext';

const URL_RE = /^https?:\/\/[^\s]+$/i;

// ── helpers ──

function emptyWorkExp(): WorkExperienceInput {
  return { job_title: '', company: '', city: '', state: '', employment_type: '', start_date: '', end_date: '', current_job: false, responsibilities: '', key_achievements: '' };
}
function emptyEducation(): EducationInput {
  return { school: '', city: '', state: '', degree: '', major: '', minor: '', start_date: '', graduation_date: '', graduated: false, gpa: '', honors: '', relevant_coursework: [] };
}
function emptySkill(): SkillInput { return { skill: '', proficiency: '', years: null }; }
function emptyLanguage(): LanguageInput { return { language: '', proficiency: '' }; }
function emptyReference(): ReferenceInput { return { name: '', relationship: '', company: '', title: '', phone: '', email: '' }; }

interface FormState {
  first_name: string;
  middle_initial: string;
  last_name: string;
  preferred_name: string;
  pronouns: string;
  date_of_birth: string;
  phone_number: string;
  alternative_phone: string;
  street_address: string;
  apt_suite_unit: string;
  city: string;
  state: string;
  zip_code: string;
  linkedin_url: string;
  website_portfolio: string;
  github_or_other_portfolio: string;
  resume_url: string;
  work_experience: WorkExperienceInput[];
  education: EducationInput[];
  skills: SkillInput[];
  languages: LanguageInput[];
  references: ReferenceInput[];
  about_me: AboutMeInput;
  legal: LegalInput;
  eeo: EeoInput;
}

const EMPTY_FORM: FormState = {
  first_name: '', middle_initial: '', last_name: '', preferred_name: '', pronouns: '',
  date_of_birth: '', phone_number: '', alternative_phone: '',
  street_address: '', apt_suite_unit: '', city: '', state: '', zip_code: '',
  linkedin_url: '', website_portfolio: '', github_or_other_portfolio: '', resume_url: '',
  work_experience: [emptyWorkExp()],
  education: [emptyEducation()],
  skills: [emptySkill()],
  languages: [emptyLanguage()],
  references: [emptyReference()],
  about_me: { challenge_you_overcame: '', greatest_strength: '', greatest_weakness: '', five_year_goals: '', leadership_experience: '', anything_else: '' },
  legal: { us_work_authorization: false, requires_sponsorship: false, visa_type: '', over_18: false, security_clearance: '', needs_accommodation: false },
  eeo: { gender: '', race_ethnicity: '', disability_status: '', veteran_status: '' },
};

function toProfile(form: FormState): ApplicantProfileInput {
  const s = (v: string) => v.trim() || undefined;
  return {
    first_name: s(form.first_name), middle_initial: s(form.middle_initial), last_name: s(form.last_name),
    preferred_name: s(form.preferred_name), pronouns: s(form.pronouns), date_of_birth: s(form.date_of_birth),
    phone_number: s(form.phone_number), alternative_phone: s(form.alternative_phone),
    street_address: s(form.street_address), apt_suite_unit: s(form.apt_suite_unit),
    city: s(form.city), state: s(form.state), zip_code: s(form.zip_code),
    linkedin_url: s(form.linkedin_url), website_portfolio: s(form.website_portfolio),
    github_or_other_portfolio: s(form.github_or_other_portfolio),
    documents: { resume: form.resume_url.trim() || undefined },
    work_experience: form.work_experience.filter(w => w.job_title?.trim() || w.company?.trim()),
    education: form.education.filter(e => e.school?.trim() || e.degree?.trim()),
    skills: form.skills.filter(sk => sk.skill?.trim()),
    languages: form.languages.filter(l => l.language?.trim()),
    references: form.references.filter(r => r.name?.trim()),
    about_me: form.about_me,
    legal: form.legal,
    eeo: form.eeo,
  };
}

function validate(form: FormState): string[] {
  const errs: string[] = [];
  if (!form.first_name.trim()) errs.push('First name is required.');
  if (!form.last_name.trim()) errs.push('Last name is required.');
  if (!form.phone_number.trim()) errs.push('Phone number is required.');
  if (!form.street_address.trim()) errs.push('Street address is required.');
  if (!form.city.trim()) errs.push('City is required.');
  if (!form.state.trim()) errs.push('State is required.');
  if (!form.zip_code.trim()) errs.push('ZIP code is required.');
  for (const [key, label] of [['linkedin_url', 'LinkedIn'], ['website_portfolio', 'Website/Portfolio'], ['github_or_other_portfolio', 'GitHub/Portfolio'], ['resume_url', 'Resume URL']] as const) {
    const v = form[key].trim();
    if (v && !URL_RE.test(v)) errs.push(`${label} must start with http:// or https://.`);
  }
  if (!form.legal.over_18) errs.push('You must confirm you are 18 or older.');
  return errs;
}

// ── layout (aligned with Login / SignupBasics) ──

const layout: Record<string, CSSProperties> = {
  // Match Login.tsx: fixed viewport height so the left image uses the same
  // `cover` crop; only the right column scrolls (tall profile form).
  pageContainer: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    minHeight: '100vh',
    maxHeight: '100vh',
    fontFamily: 'Inter, system-ui, sans-serif',
    margin: 0,
    overflow: 'hidden',
  },
  leftPanel: {
    flex: '1.2',
    alignSelf: 'stretch',
    position: 'relative',
    backgroundImage: 'url("/images/office.png")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  leftOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#000000',
    opacity: 0.75,
  },
  leftContent: {
    position: 'relative',
    zIndex: 1,
    padding: '48px 64px',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    color: 'white',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoIcon: {
    width: '32px',
    height: '32px',
    backgroundColor: 'white',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: '20px', fontWeight: 500, letterSpacing: '-0.5px' },
  heroTextContainer: { maxWidth: '480px', marginBottom: '80px' },
  heroTitle: {
    fontSize: '28px',
    fontWeight: 400,
    margin: '0 0 24px',
    lineHeight: 1.3,
    color: 'white',
  },
  heroSubtitle: {
    fontSize: '16px',
    color: '#CBD5E1',
    lineHeight: 1.6,
    margin: 0,
  },
  statsRow: {
    display: 'flex',
    gap: '64px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: '32px',
  },
  statLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#94A3B8',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  statValue: { fontSize: '20px', fontWeight: 400 },
  rightPanel: {
    flex: '1',
    minWidth: 0,
    minHeight: 0,
    backgroundColor: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    // flex-start, not center: with overflow-y, centering blocks scrolling to the true top
    justifyContent: 'flex-start',
    borderLeft: '1px solid #E2E8F0',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  rightContentBox: {
    width: '100%',
    maxWidth: '600px',
    padding: '40px 32px 56px',
    boxSizing: 'border-box',
  },
};

// ── form UI styles ──

const s: Record<string, CSSProperties> = {
  stepRow: { marginBottom: '28px' },
  stepEyebrow: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#3B82F6',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '10px',
  },
  stepSegments: { display: 'flex', gap: 6, marginBottom: 8 },
  stepSeg: { flex: 1, height: 3, background: '#E2E8F0', borderRadius: 2 },
  stepSegOn: { background: '#0F172A' },
  stepSegCurrent: { background: '#3B82F6' },
  formHeader: { marginBottom: '28px' },
  formTitle: {
    fontSize: '22px',
    fontWeight: 500,
    color: '#1E293B',
    margin: '0 0 8px',
    letterSpacing: '-0.3px',
  },
  formSubtitle: {
    fontSize: '14px',
    color: '#64748B',
    margin: 0,
    lineHeight: 1.55,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  sectionCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '20px',
    padding: '24px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#0F172A',
    margin: 0,
    letterSpacing: '0.2px',
  },
  sectionHint: {
    fontSize: '12px',
    color: '#64748B',
    margin: '-8px 0 0',
    lineHeight: 1.45,
  },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 16 },
  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  fieldLabelText: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#1E293B',
    letterSpacing: '0.5px',
  },
  fieldInput: {
    appearance: 'none',
    width: '100%',
    boxSizing: 'border-box',
    padding: '15px 18px',
    fontSize: '15px',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '999px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  textArea: {
    appearance: 'none',
    width: '100%',
    boxSizing: 'border-box',
    padding: '14px 16px',
    fontSize: '15px',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '16px',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    minHeight: 88,
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 },
  subCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 18,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
  },
  addBtn: {
    appearance: 'none',
    width: '100%',
    border: '1px dashed #CBD5E1',
    cursor: 'pointer',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    background: 'transparent',
    borderRadius: '999px',
    fontFamily: 'inherit',
    letterSpacing: '0.3px',
  },
  removeBtn: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 0',
    fontSize: '12px',
    fontWeight: 600,
    color: '#B91C1C',
    background: 'transparent',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  removeBtnInline: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    width: 40,
    height: 40,
    flexShrink: 0,
    fontSize: '18px',
    lineHeight: 1,
    color: '#64748B',
    background: '#F1F5F9',
    borderRadius: '999px',
    fontFamily: 'inherit',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    cursor: 'pointer',
    fontSize: 14,
    color: '#334155',
    lineHeight: 1.45,
  },
  checkInput: { width: 18, height: 18, marginTop: 2, flexShrink: 0, cursor: 'pointer' },
  error: {
    padding: '12px 14px',
    fontSize: '13px',
    color: '#B91C1C',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 12,
    lineHeight: 1.45,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginTop: 8,
    paddingTop: 8,
  },
  back: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#3B82F6',
    textAlign: 'center',
    textDecoration: 'none',
  },
  primary: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    padding: '16px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    background: '#0F172A',
    borderRadius: '999px',
    letterSpacing: '0.5px',
    fontFamily: 'inherit',
  },
  primaryDisabled: { cursor: 'not-allowed', opacity: 0.5 },
  footerLinks: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 36,
    fontSize: 12,
    color: '#94A3B8',
  },
  dot: { fontSize: 10 },
  flexEndRow: { display: 'flex', gap: 12, alignItems: 'flex-end' },
  skillRemoveWrap: { display: 'flex', gap: 10, alignItems: 'flex-end' },
};

function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={s.sectionCard} aria-label={title}>
      <h2 style={s.sectionTitle}>{title}</h2>
      {hint ? <p style={s.sectionHint}>{hint}</p> : null}
      <div style={s.sectionBody}>{children}</div>
    </section>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; maxLength?: number;
}) {
  return (
    <label style={s.fieldLabel}>
      <span style={s.fieldLabelText}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={s.fieldInput}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <label style={s.fieldLabel}>
      <span style={s.fieldLabelText}>{label}</span>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={s.textArea} />
    </label>
  );
}

function Checkbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={s.checkRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={s.checkInput}
      />
      <span>{label}</span>
    </label>
  );
}

function errorMessage(code: string, detail?: string): string {
  switch (code) {
    case 'email_taken': return 'That email is already registered.';
    case 'username_taken': return 'That username is taken.';
    case 'world_id_already_used': return 'This World ID has already been used to register an account.';
    case 'world_id_failed': return detail || 'World ID verification failed. Please try step 2 again.';
    case 'invalid_profile': case 'invalid_profile_url': return detail || 'One of the profile fields is invalid.';
    case 'missing_fields': return 'Some required fields are missing.';
    default: return detail || 'Something went wrong. Please try again.';
  }
}

export default function SignupProfile() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const { basics, password, worldIdResult, setApplicantProfile, reset } = useSignup();

  const [form, setForm] = useState<FormState>(() => EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [topError, setTopError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setApplicantProfile(toProfile(form));
  }, [form, setApplicantProfile]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setForm({
          first_name: 'Alex', middle_initial: 'J', last_name: 'Chneerov',
          preferred_name: 'Alex', pronouns: 'he/him', date_of_birth: '1998-05-15',
          phone_number: '555-123-4567', alternative_phone: '',
          street_address: '123 Market St', apt_suite_unit: 'Apt 4B',
          city: 'San Francisco', state: 'CA', zip_code: '94103',
          linkedin_url: 'https://linkedin.com/in/alexchneerov',
          website_portfolio: 'https://alexchneerov.dev',
          github_or_other_portfolio: 'https://github.com/achneerov',
          resume_url: 'https://example.com/resume.pdf',
          work_experience: [{ job_title: 'Software Engineer', company: 'TechCorp', city: 'San Francisco', state: 'CA', employment_type: 'FullTime', start_date: '2022-01', end_date: '', current_job: true, responsibilities: 'Full-stack development with React and Node.js', key_achievements: 'Led migration to TypeScript' }],
          education: [{ school: 'UC Berkeley', city: 'Berkeley', state: 'CA', degree: 'B.S.', major: 'Computer Science', minor: '', start_date: '2016-08', graduation_date: '2020-05', graduated: true, gpa: '3.7', honors: "Dean's List", relevant_coursework: [] }],
          skills: [{ skill: 'TypeScript', proficiency: 'Advanced', years: 4 }, { skill: 'React', proficiency: 'Advanced', years: 4 }],
          languages: [{ language: 'English', proficiency: 'Native' }],
          references: [{ name: 'Jane Smith', relationship: 'Former Manager', company: 'TechCorp', title: 'Engineering Director', phone: '555-999-8888', email: 'jane@techcorp.com' }],
          about_me: { challenge_you_overcame: 'Led a major migration under tight deadlines', greatest_strength: 'Full-stack versatility', greatest_weakness: 'Can over-engineer solutions', five_year_goals: 'Lead a platform engineering team', leadership_experience: 'Mentored 2 junior developers', anything_else: '' },
          legal: { us_work_authorization: true, requires_sponsorship: false, visa_type: '', over_18: true, security_clearance: '', needs_accommodation: false },
          eeo: { gender: 'Male', race_ethnicity: 'White', disability_status: '', veteran_status: '' },
        });
        setErrors([]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!completedRef.current) {
    if (!basics) return <Navigate to="/signup" replace />;
    if (basics.role !== 'Applicant') return <Navigate to="/" replace />;
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTopError(null);
    const errs = validate(form);
    setErrors(errs);
    if (errs.length > 0) { setTopError('Please fix the errors below.'); return; }
    if (!basics || !password) { setTopError('Session expired. Go back to step 1.'); return; }
    if (!worldIdResult) { setTopError('World ID verification required. Go back to step 2.'); return; }

    setSubmitting(true);
    try {
      const profile = toProfile(form);
      const { token, user } = await api.register({
        email: basics.email, username: basics.username, password, role: basics.role,
        world_id_result: worldIdResult, profile,
      });
      completedRef.current = true;
      setAuth(token, user);
      reset();
      nav('/', { replace: true });
    } catch (err) {
      setTopError(err instanceof ApiError ? errorMessage(err.code, err.detail) : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="landing-page" style={layout.pageContainer}>
      <div style={layout.leftPanel}>
        <div style={layout.leftOverlay} />
        <div style={layout.leftContent}>
          <div style={layout.logoRow}>
            <div style={layout.logoIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <span style={layout.logoText}>AegisTalent</span>
          </div>
          <div style={layout.heroTextContainer}>
            <h1 style={layout.heroTitle}>Build a profile employers trust.</h1>
            <p style={layout.heroSubtitle}>
              A clear, complete profile helps verified recruiters match you faster—same privacy standards as the rest of the platform.
            </p>
          </div>
          <div style={layout.statsRow}>
            <div>
              <div style={layout.statLabel}>VERIFIED USERS</div>
              <div style={layout.statValue}>42,000+</div>
            </div>
            <div>
              <div style={layout.statLabel}>AI PRECISION</div>
              <div style={layout.statValue}>99.8%</div>
            </div>
          </div>
        </div>
      </div>

      <div style={layout.rightPanel}>
        <div style={layout.rightContentBox}>
          <div style={s.stepRow}>
            <span style={s.stepEyebrow}>Step 3 of 3</span>
            <div style={s.stepSegments} aria-hidden>
              <div style={{ ...s.stepSeg, ...s.stepSegOn }} />
              <div style={{ ...s.stepSeg, ...s.stepSegOn }} />
              <div style={{ ...s.stepSeg, ...s.stepSegCurrent }} title="Current step" />
            </div>
            <div style={s.formHeader}>
              <h1 style={s.formTitle}>Your applicant profile</h1>
              <p style={s.formSubtitle}>
                A few more details to finish setup. You can update everything later from your account.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} style={s.form} noValidate>
            <FormSection title="Personal information">
              <div style={s.row3}>
                <Input label="FIRST NAME *" value={form.first_name} onChange={v => updateField('first_name', v)} />
                <Input label="MIDDLE INITIAL" value={form.middle_initial} onChange={v => updateField('middle_initial', v)} maxLength={1} />
                <Input label="LAST NAME *" value={form.last_name} onChange={v => updateField('last_name', v)} />
              </div>
              <div style={s.row2}>
                <Input label="PREFERRED NAME" value={form.preferred_name} onChange={v => updateField('preferred_name', v)} />
                <Input label="PRONOUNS" value={form.pronouns} onChange={v => updateField('pronouns', v)} placeholder="e.g. she/her" />
              </div>
              <div style={s.row2}>
                <Input label="DATE OF BIRTH" value={form.date_of_birth} onChange={v => updateField('date_of_birth', v)} type="date" />
                <Input label="PHONE *" value={form.phone_number} onChange={v => updateField('phone_number', v)} type="tel" placeholder="+1 555 123 4567" />
              </div>
              <Input label="ALTERNATIVE PHONE" value={form.alternative_phone} onChange={v => updateField('alternative_phone', v)} type="tel" />
            </FormSection>

            <FormSection title="Address">
              <Input label="STREET ADDRESS *" value={form.street_address} onChange={v => updateField('street_address', v)} />
              <Input label="APT / SUITE / UNIT" value={form.apt_suite_unit} onChange={v => updateField('apt_suite_unit', v)} />
              <div style={s.row3}>
                <Input label="CITY *" value={form.city} onChange={v => updateField('city', v)} />
                <Input label="STATE *" value={form.state} onChange={v => updateField('state', v)} placeholder="CA" />
                <Input label="ZIP *" value={form.zip_code} onChange={v => updateField('zip_code', v)} placeholder="94103" />
              </div>
            </FormSection>

            <FormSection title="Links">
              <Input label="RESUME URL" value={form.resume_url} onChange={v => updateField('resume_url', v)} type="url" placeholder="https://…" />
              <Input label="LINKEDIN" value={form.linkedin_url} onChange={v => updateField('linkedin_url', v)} type="url" placeholder="https://linkedin.com/in/…" />
              <Input label="WEBSITE / PORTFOLIO" value={form.website_portfolio} onChange={v => updateField('website_portfolio', v)} type="url" />
              <Input label="GITHUB / OTHER" value={form.github_or_other_portfolio} onChange={v => updateField('github_or_other_portfolio', v)} type="url" />
            </FormSection>

            <FormSection title="Work experience">
              {form.work_experience.map((w, i) => (
                <div key={i} style={s.subCard}>
                  <div style={s.row2}>
                    <Input label="JOB TITLE" value={w.job_title || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], job_title: v }; updateField('work_experience', arr); }} />
                    <Input label="COMPANY" value={w.company || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], company: v }; updateField('work_experience', arr); }} />
                  </div>
                  <div style={s.row3}>
                    <Input label="CITY" value={w.city || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], city: v }; updateField('work_experience', arr); }} />
                    <Input label="STATE" value={w.state || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], state: v }; updateField('work_experience', arr); }} />
                    <Input label="TYPE" value={w.employment_type || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], employment_type: v }; updateField('work_experience', arr); }} placeholder="Full-time" />
                  </div>
                  <div style={s.row2}>
                    <Input label="START" value={w.start_date || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], start_date: v }; updateField('work_experience', arr); }} placeholder="2022-01" />
                    <Input label="END" value={w.end_date || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], end_date: v }; updateField('work_experience', arr); }} placeholder="or leave blank" />
                  </div>
                  <Checkbox label="I currently work here" checked={!!w.current_job} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], current_job: v }; updateField('work_experience', arr); }} />
                  <TextArea label="RESPONSIBILITIES" value={w.responsibilities || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], responsibilities: v }; updateField('work_experience', arr); }} />
                  <TextArea label="KEY ACHIEVEMENTS" value={w.key_achievements || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], key_achievements: v }; updateField('work_experience', arr); }} />
                  {form.work_experience.length > 1 && (
                    <button type="button" style={s.removeBtn} onClick={() => updateField('work_experience', form.work_experience.filter((_, j) => j !== i))}>
                      Remove this role
                    </button>
                  )}
                </div>
              ))}
              <button type="button" style={s.addBtn} onClick={() => updateField('work_experience', [...form.work_experience, emptyWorkExp()])}>
                + Add work experience
              </button>
            </FormSection>

            <FormSection title="Education">
              {form.education.map((ed, i) => (
                <div key={i} style={s.subCard}>
                  <Input label="SCHOOL" value={ed.school || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], school: v }; updateField('education', arr); }} />
                  <div style={s.row3}>
                    <Input label="CITY" value={ed.city || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], city: v }; updateField('education', arr); }} />
                    <Input label="STATE" value={ed.state || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], state: v }; updateField('education', arr); }} />
                    <Input label="DEGREE" value={ed.degree || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], degree: v }; updateField('education', arr); }} placeholder="B.S." />
                  </div>
                  <div style={s.row2}>
                    <Input label="MAJOR" value={ed.major || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], major: v }; updateField('education', arr); }} />
                    <Input label="MINOR" value={ed.minor || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], minor: v }; updateField('education', arr); }} />
                  </div>
                  <div style={s.row2}>
                    <Input label="START" value={ed.start_date || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], start_date: v }; updateField('education', arr); }} placeholder="2016-08" />
                    <Input label="GRADUATION" value={ed.graduation_date || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], graduation_date: v }; updateField('education', arr); }} placeholder="2020-05" />
                  </div>
                  <Checkbox label="Graduated" checked={!!ed.graduated} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], graduated: v }; updateField('education', arr); }} />
                  <div style={s.row2}>
                    <Input label="GPA" value={ed.gpa || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], gpa: v }; updateField('education', arr); }} placeholder="3.7" />
                    <Input label="HONORS" value={ed.honors || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], honors: v }; updateField('education', arr); }} />
                  </div>
                  {form.education.length > 1 && (
                    <button type="button" style={s.removeBtn} onClick={() => updateField('education', form.education.filter((_, j) => j !== i))}>
                      Remove this school
                    </button>
                  )}
                </div>
              ))}
              <button type="button" style={s.addBtn} onClick={() => updateField('education', [...form.education, emptyEducation()])}>
                + Add education
              </button>
            </FormSection>

            <FormSection title="Skills">
              {form.skills.map((sk, i) => (
                <div key={i} style={s.skillRemoveWrap}>
                  <div style={{ ...s.row3, flex: 1, width: '100%' }}>
                    <Input label="SKILL" value={sk.skill} onChange={v => { const arr = [...form.skills]; arr[i] = { ...arr[i], skill: v }; updateField('skills', arr); }} />
                    <Input label="PROFICIENCY" value={sk.proficiency || ''} onChange={v => { const arr = [...form.skills]; arr[i] = { ...arr[i], proficiency: v }; updateField('skills', arr); }} placeholder="Advanced" />
                    <Input label="YEARS" value={sk.years != null ? String(sk.years) : ''} onChange={v => { const arr = [...form.skills]; arr[i] = { ...arr[i], years: v ? Number(v) : null }; updateField('skills', arr); }} type="number" />
                  </div>
                  {form.skills.length > 1 && (
                    <button type="button" style={s.removeBtnInline} title="Remove" onClick={() => updateField('skills', form.skills.filter((_, j) => j !== i))} aria-label="Remove skill">×</button>
                  )}
                </div>
              ))}
              <button type="button" style={s.addBtn} onClick={() => updateField('skills', [...form.skills, emptySkill()])}>
                + Add skill
              </button>
            </FormSection>

            <FormSection title="Languages">
              {form.languages.map((l, i) => (
                <div key={i} style={s.flexEndRow}>
                  <div style={{ ...s.row2, flex: 1, width: '100%' }}>
                    <Input label="LANGUAGE" value={l.language} onChange={v => { const arr = [...form.languages]; arr[i] = { ...arr[i], language: v }; updateField('languages', arr); }} />
                    <Input label="PROFICIENCY" value={l.proficiency || ''} onChange={v => { const arr = [...form.languages]; arr[i] = { ...arr[i], proficiency: v }; updateField('languages', arr); }} placeholder="Native" />
                  </div>
                  {form.languages.length > 1 && (
                    <button type="button" style={s.removeBtnInline} title="Remove" onClick={() => updateField('languages', form.languages.filter((_, j) => j !== i))} aria-label="Remove language">×</button>
                  )}
                </div>
              ))}
              <button type="button" style={s.addBtn} onClick={() => updateField('languages', [...form.languages, emptyLanguage()])}>
                + Add language
              </button>
            </FormSection>

            <FormSection title="References">
              {form.references.map((r, i) => (
                <div key={i} style={s.subCard}>
                  <div style={s.row2}>
                    <Input label="NAME" value={r.name || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], name: v }; updateField('references', arr); }} />
                    <Input label="RELATIONSHIP" value={r.relationship || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], relationship: v }; updateField('references', arr); }} />
                  </div>
                  <div style={s.row2}>
                    <Input label="COMPANY" value={r.company || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], company: v }; updateField('references', arr); }} />
                    <Input label="TITLE" value={r.title || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], title: v }; updateField('references', arr); }} />
                  </div>
                  <div style={s.row2}>
                    <Input label="PHONE" value={r.phone || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], phone: v }; updateField('references', arr); }} />
                    <Input label="EMAIL" value={r.email || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], email: v }; updateField('references', arr); }} />
                  </div>
                  {form.references.length > 1 && (
                    <button type="button" style={s.removeBtn} onClick={() => updateField('references', form.references.filter((_, j) => j !== i))}>
                      Remove this reference
                    </button>
                  )}
                </div>
              ))}
              <button type="button" style={s.addBtn} onClick={() => updateField('references', [...form.references, emptyReference()])}>
                + Add reference
              </button>
            </FormSection>

            <FormSection title="About you">
              <TextArea label="A CHALLENGE YOU OVERCAME" value={form.about_me.challenge_you_overcame || ''} onChange={v => updateField('about_me', { ...form.about_me, challenge_you_overcame: v })} />
              <div style={s.row2}>
                <Input label="GREATEST STRENGTH" value={form.about_me.greatest_strength || ''} onChange={v => updateField('about_me', { ...form.about_me, greatest_strength: v })} />
                <Input label="GREATEST WEAKNESS" value={form.about_me.greatest_weakness || ''} onChange={v => updateField('about_me', { ...form.about_me, greatest_weakness: v })} />
              </div>
              <Input label="FIVE-YEAR GOALS" value={form.about_me.five_year_goals || ''} onChange={v => updateField('about_me', { ...form.about_me, five_year_goals: v })} />
              <Input label="LEADERSHIP EXPERIENCE" value={form.about_me.leadership_experience || ''} onChange={v => updateField('about_me', { ...form.about_me, leadership_experience: v })} />
              <TextArea label="ANYTHING ELSE" value={form.about_me.anything_else || ''} onChange={v => updateField('about_me', { ...form.about_me, anything_else: v })} />
            </FormSection>

            <FormSection title="Work eligibility">
              <Checkbox label="I am authorized to work in the United States" checked={!!form.legal.us_work_authorization} onChange={v => updateField('legal', { ...form.legal, us_work_authorization: v })} />
              <Checkbox label="I will need visa sponsorship" checked={!!form.legal.requires_sponsorship} onChange={v => updateField('legal', { ...form.legal, requires_sponsorship: v })} />
              {form.legal.requires_sponsorship && <Input label="VISA TYPE" value={form.legal.visa_type || ''} onChange={v => updateField('legal', { ...form.legal, visa_type: v })} />}
              <Checkbox label="I am 18 years of age or older *" checked={!!form.legal.over_18} onChange={v => updateField('legal', { ...form.legal, over_18: v })} />
              <Input label="SECURITY CLEARANCE (IF ANY)" value={form.legal.security_clearance || ''} onChange={v => updateField('legal', { ...form.legal, security_clearance: v })} placeholder="e.g. Secret" />
              <Checkbox label="I need a reasonable accommodation" checked={!!form.legal.needs_accommodation} onChange={v => updateField('legal', { ...form.legal, needs_accommodation: v })} />
            </FormSection>

            <FormSection
              title="EEO (optional)"
              hint="Voluntary. This information will not be used in hiring decisions in a discriminatory way."
            >
              <div style={s.row2}>
                <Input label="GENDER" value={form.eeo.gender || ''} onChange={v => updateField('eeo', { ...form.eeo, gender: v })} />
                <Input label="RACE / ETHNICITY" value={form.eeo.race_ethnicity || ''} onChange={v => updateField('eeo', { ...form.eeo, race_ethnicity: v })} />
              </div>
              <div style={s.row2}>
                <Input label="DISABILITY STATUS" value={form.eeo.disability_status || ''} onChange={v => updateField('eeo', { ...form.eeo, disability_status: v })} />
                <Input label="VETERAN STATUS" value={form.eeo.veteran_status || ''} onChange={v => updateField('eeo', { ...form.eeo, veteran_status: v })} />
              </div>
            </FormSection>

            {errors.length > 0 && (
              <div role="alert" style={s.error}>
                {errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            {topError && <div role="alert" style={s.error}>{topError}</div>}

            <div style={s.actions}>
              <Link to="/signup/world-id" style={s.back}>← Back to World ID</Link>
              <button type="submit" disabled={submitting} style={{ ...s.primary, ...(submitting ? s.primaryDisabled : null) }}>
                {submitting ? 'CREATING ACCOUNT…' : 'FINISH SIGNUP'}
              </button>
            </div>
          </form>

          <div style={s.footerLinks}>
            <span>Privacy Policy</span>
            <span style={s.dot}>•</span>
            <span>Service Terms</span>
            <span style={s.dot}>•</span>
            <span>SOC2 Compliance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
