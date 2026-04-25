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
  // URL validation
  for (const [key, label] of [['linkedin_url', 'LinkedIn'], ['website_portfolio', 'Website/Portfolio'], ['github_or_other_portfolio', 'GitHub/Portfolio'], ['resume_url', 'Resume URL']] as const) {
    const v = form[key].trim();
    if (v && !URL_RE.test(v)) errs.push(`${label} must start with http:// or https://.`);
  }
  if (!form.legal.over_18) errs.push('You must confirm you are 18 or older.');
  return errs;
}

export default function SignupProfile() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const { basics, password, worldIdResult, applicantProfile, setApplicantProfile, reset } = useSignup();

  const [form, setForm] = useState<FormState>(() => EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [topError, setTopError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setApplicantProfile(toProfile(form));
  }, [form, setApplicantProfile]);

  // Quick fill shortcut
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
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.eyebrow}>Step 3 of 3</span>
          <h1 style={styles.title}>Build your applicant profile</h1>
          <p style={styles.subtitle}>Fill in your details. You can update anything later.</p>
        </header>

        <form onSubmit={onSubmit} style={styles.form} noValidate>
          {/* Personal Information */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>Personal Information</legend>
            <div style={styles.row3}>
              <Input label="First name *" value={form.first_name} onChange={v => updateField('first_name', v)} />
              <Input label="Middle initial" value={form.middle_initial} onChange={v => updateField('middle_initial', v)} maxLength={1} />
              <Input label="Last name *" value={form.last_name} onChange={v => updateField('last_name', v)} />
            </div>
            <div style={styles.row2}>
              <Input label="Preferred name" value={form.preferred_name} onChange={v => updateField('preferred_name', v)} />
              <Input label="Pronouns" value={form.pronouns} onChange={v => updateField('pronouns', v)} placeholder="e.g. she/her" />
            </div>
            <div style={styles.row2}>
              <Input label="Date of birth" value={form.date_of_birth} onChange={v => updateField('date_of_birth', v)} type="date" />
              <Input label="Phone number *" value={form.phone_number} onChange={v => updateField('phone_number', v)} type="tel" placeholder="+1 555 123 4567" />
            </div>
            <Input label="Alternative phone" value={form.alternative_phone} onChange={v => updateField('alternative_phone', v)} type="tel" />
          </fieldset>

          {/* Address */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>Address</legend>
            <Input label="Street address *" value={form.street_address} onChange={v => updateField('street_address', v)} />
            <Input label="Apt / Suite / Unit" value={form.apt_suite_unit} onChange={v => updateField('apt_suite_unit', v)} />
            <div style={styles.row3}>
              <Input label="City *" value={form.city} onChange={v => updateField('city', v)} />
              <Input label="State *" value={form.state} onChange={v => updateField('state', v)} placeholder="CA" />
              <Input label="ZIP code *" value={form.zip_code} onChange={v => updateField('zip_code', v)} placeholder="94103" />
            </div>
          </fieldset>

          {/* Links */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>Links</legend>
            <Input label="Resume URL" value={form.resume_url} onChange={v => updateField('resume_url', v)} type="url" placeholder="https://example.com/resume.pdf" />
            <Input label="LinkedIn" value={form.linkedin_url} onChange={v => updateField('linkedin_url', v)} type="url" placeholder="https://linkedin.com/in/..." />
            <Input label="Website / Portfolio" value={form.website_portfolio} onChange={v => updateField('website_portfolio', v)} type="url" />
            <Input label="GitHub / Other" value={form.github_or_other_portfolio} onChange={v => updateField('github_or_other_portfolio', v)} type="url" />
          </fieldset>

          {/* Work Experience */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>Work Experience</legend>
            {form.work_experience.map((w, i) => (
              <div key={i} style={styles.subCard}>
                <div style={styles.row2}>
                  <Input label="Job title" value={w.job_title || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], job_title: v }; updateField('work_experience', arr); }} />
                  <Input label="Company" value={w.company || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], company: v }; updateField('work_experience', arr); }} />
                </div>
                <div style={styles.row3}>
                  <Input label="City" value={w.city || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], city: v }; updateField('work_experience', arr); }} />
                  <Input label="State" value={w.state || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], state: v }; updateField('work_experience', arr); }} />
                  <Input label="Type" value={w.employment_type || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], employment_type: v }; updateField('work_experience', arr); }} placeholder="FullTime" />
                </div>
                <div style={styles.row2}>
                  <Input label="Start date" value={w.start_date || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], start_date: v }; updateField('work_experience', arr); }} placeholder="2022-01" />
                  <Input label="End date" value={w.end_date || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], end_date: v }; updateField('work_experience', arr); }} placeholder="2024-06 or blank if current" />
                </div>
                <Checkbox label="Currently employed here" checked={!!w.current_job} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], current_job: v }; updateField('work_experience', arr); }} />
                <TextArea label="Responsibilities" value={w.responsibilities || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], responsibilities: v }; updateField('work_experience', arr); }} />
                <TextArea label="Key achievements" value={w.key_achievements || ''} onChange={v => { const arr = [...form.work_experience]; arr[i] = { ...arr[i], key_achievements: v }; updateField('work_experience', arr); }} />
                {form.work_experience.length > 1 && <button type="button" style={styles.removeBtn} onClick={() => { const arr = form.work_experience.filter((_, j) => j !== i); updateField('work_experience', arr); }}>Remove</button>}
              </div>
            ))}
            <button type="button" style={styles.addBtn} onClick={() => updateField('work_experience', [...form.work_experience, emptyWorkExp()])}>+ Add work experience</button>
          </fieldset>

          {/* Education */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>Education</legend>
            {form.education.map((ed, i) => (
              <div key={i} style={styles.subCard}>
                <Input label="School" value={ed.school || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], school: v }; updateField('education', arr); }} />
                <div style={styles.row3}>
                  <Input label="City" value={ed.city || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], city: v }; updateField('education', arr); }} />
                  <Input label="State" value={ed.state || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], state: v }; updateField('education', arr); }} />
                  <Input label="Degree" value={ed.degree || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], degree: v }; updateField('education', arr); }} placeholder="B.S." />
                </div>
                <div style={styles.row2}>
                  <Input label="Major" value={ed.major || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], major: v }; updateField('education', arr); }} />
                  <Input label="Minor" value={ed.minor || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], minor: v }; updateField('education', arr); }} />
                </div>
                <div style={styles.row2}>
                  <Input label="Start date" value={ed.start_date || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], start_date: v }; updateField('education', arr); }} placeholder="2016-08" />
                  <Input label="Graduation date" value={ed.graduation_date || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], graduation_date: v }; updateField('education', arr); }} placeholder="2020-05" />
                </div>
                <Checkbox label="Graduated" checked={!!ed.graduated} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], graduated: v }; updateField('education', arr); }} />
                <div style={styles.row2}>
                  <Input label="GPA" value={ed.gpa || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], gpa: v }; updateField('education', arr); }} placeholder="3.7" />
                  <Input label="Honors" value={ed.honors || ''} onChange={v => { const arr = [...form.education]; arr[i] = { ...arr[i], honors: v }; updateField('education', arr); }} />
                </div>
                {form.education.length > 1 && <button type="button" style={styles.removeBtn} onClick={() => { const arr = form.education.filter((_, j) => j !== i); updateField('education', arr); }}>Remove</button>}
              </div>
            ))}
            <button type="button" style={styles.addBtn} onClick={() => updateField('education', [...form.education, emptyEducation()])}>+ Add education</button>
          </fieldset>

          {/* Skills */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>Skills</legend>
            {form.skills.map((sk, i) => (
              <div key={i} style={styles.row3}>
                <Input label="Skill" value={sk.skill} onChange={v => { const arr = [...form.skills]; arr[i] = { ...arr[i], skill: v }; updateField('skills', arr); }} />
                <Input label="Proficiency" value={sk.proficiency || ''} onChange={v => { const arr = [...form.skills]; arr[i] = { ...arr[i], proficiency: v }; updateField('skills', arr); }} placeholder="Advanced" />
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <Input label="Years" value={sk.years != null ? String(sk.years) : ''} onChange={v => { const arr = [...form.skills]; arr[i] = { ...arr[i], years: v ? Number(v) : null }; updateField('skills', arr); }} type="number" />
                  {form.skills.length > 1 && <button type="button" style={styles.removeBtn} onClick={() => updateField('skills', form.skills.filter((_, j) => j !== i))}>×</button>}
                </div>
              </div>
            ))}
            <button type="button" style={styles.addBtn} onClick={() => updateField('skills', [...form.skills, emptySkill()])}>+ Add skill</button>
          </fieldset>

          {/* Languages */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>Languages</legend>
            {form.languages.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <Input label="Language" value={l.language} onChange={v => { const arr = [...form.languages]; arr[i] = { ...arr[i], language: v }; updateField('languages', arr); }} />
                <Input label="Proficiency" value={l.proficiency || ''} onChange={v => { const arr = [...form.languages]; arr[i] = { ...arr[i], proficiency: v }; updateField('languages', arr); }} placeholder="Native" />
                {form.languages.length > 1 && <button type="button" style={styles.removeBtn} onClick={() => updateField('languages', form.languages.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            <button type="button" style={styles.addBtn} onClick={() => updateField('languages', [...form.languages, emptyLanguage()])}>+ Add language</button>
          </fieldset>

          {/* References */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>References</legend>
            {form.references.map((r, i) => (
              <div key={i} style={styles.subCard}>
                <div style={styles.row2}>
                  <Input label="Name" value={r.name || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], name: v }; updateField('references', arr); }} />
                  <Input label="Relationship" value={r.relationship || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], relationship: v }; updateField('references', arr); }} />
                </div>
                <div style={styles.row2}>
                  <Input label="Company" value={r.company || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], company: v }; updateField('references', arr); }} />
                  <Input label="Title" value={r.title || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], title: v }; updateField('references', arr); }} />
                </div>
                <div style={styles.row2}>
                  <Input label="Phone" value={r.phone || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], phone: v }; updateField('references', arr); }} />
                  <Input label="Email" value={r.email || ''} onChange={v => { const arr = [...form.references]; arr[i] = { ...arr[i], email: v }; updateField('references', arr); }} />
                </div>
                {form.references.length > 1 && <button type="button" style={styles.removeBtn} onClick={() => updateField('references', form.references.filter((_, j) => j !== i))}>Remove</button>}
              </div>
            ))}
            <button type="button" style={styles.addBtn} onClick={() => updateField('references', [...form.references, emptyReference()])}>+ Add reference</button>
          </fieldset>

          {/* About Me */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>About Me</legend>
            <TextArea label="A challenge you overcame" value={form.about_me.challenge_you_overcame || ''} onChange={v => updateField('about_me', { ...form.about_me, challenge_you_overcame: v })} />
            <div style={styles.row2}>
              <Input label="Greatest strength" value={form.about_me.greatest_strength || ''} onChange={v => updateField('about_me', { ...form.about_me, greatest_strength: v })} />
              <Input label="Greatest weakness" value={form.about_me.greatest_weakness || ''} onChange={v => updateField('about_me', { ...form.about_me, greatest_weakness: v })} />
            </div>
            <Input label="5-year goals" value={form.about_me.five_year_goals || ''} onChange={v => updateField('about_me', { ...form.about_me, five_year_goals: v })} />
            <Input label="Leadership experience" value={form.about_me.leadership_experience || ''} onChange={v => updateField('about_me', { ...form.about_me, leadership_experience: v })} />
            <TextArea label="Anything else" value={form.about_me.anything_else || ''} onChange={v => updateField('about_me', { ...form.about_me, anything_else: v })} />
          </fieldset>

          {/* Legal */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>Legal Eligibility</legend>
            <Checkbox label="Authorized to work in the US" checked={!!form.legal.us_work_authorization} onChange={v => updateField('legal', { ...form.legal, us_work_authorization: v })} />
            <Checkbox label="Requires visa sponsorship" checked={!!form.legal.requires_sponsorship} onChange={v => updateField('legal', { ...form.legal, requires_sponsorship: v })} />
            {form.legal.requires_sponsorship && <Input label="Visa type" value={form.legal.visa_type || ''} onChange={v => updateField('legal', { ...form.legal, visa_type: v })} />}
            <Checkbox label="I am 18 years or older *" checked={!!form.legal.over_18} onChange={v => updateField('legal', { ...form.legal, over_18: v })} />
            <Input label="Security clearance" value={form.legal.security_clearance || ''} onChange={v => updateField('legal', { ...form.legal, security_clearance: v })} placeholder="e.g. Secret, Top Secret" />
            <Checkbox label="Needs accommodation" checked={!!form.legal.needs_accommodation} onChange={v => updateField('legal', { ...form.legal, needs_accommodation: v })} />
          </fieldset>

          {/* EEO */}
          <fieldset style={styles.section}>
            <legend style={styles.legend}>EEO (Voluntary)</legend>
            <p style={styles.hint}>This information is voluntary and will not affect your application.</p>
            <div style={styles.row2}>
              <Input label="Gender" value={form.eeo.gender || ''} onChange={v => updateField('eeo', { ...form.eeo, gender: v })} />
              <Input label="Race / Ethnicity" value={form.eeo.race_ethnicity || ''} onChange={v => updateField('eeo', { ...form.eeo, race_ethnicity: v })} />
            </div>
            <div style={styles.row2}>
              <Input label="Disability status" value={form.eeo.disability_status || ''} onChange={v => updateField('eeo', { ...form.eeo, disability_status: v })} />
              <Input label="Veteran status" value={form.eeo.veteran_status || ''} onChange={v => updateField('eeo', { ...form.eeo, veteran_status: v })} />
            </div>
          </fieldset>

          {errors.length > 0 && (
            <div role="alert" style={styles.error}>
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          {topError && <div role="alert" style={styles.error}>{topError}</div>}

          <div style={styles.actions}>
            <Link to="/signup/world-id" style={styles.back}>← Back to step 2</Link>
            <button type="submit" disabled={submitting} style={{ ...styles.primary, ...(submitting ? styles.primaryDisabled : null) }}>
              {submitting ? 'Creating account…' : 'Finish signup'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

// ── Sub-components ──

function Input({ label, value, onChange, type = 'text', placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; maxLength?: number;
}) {
  return (
    <label style={styles.label}>
      <span style={styles.labelText}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength} style={styles.input} />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <label style={styles.label}>
      <span style={styles.labelText}>{label}</span>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        style={{ ...styles.input, resize: 'vertical' as const, minHeight: 72 }} />
    </label>
  );
}

function Checkbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-h)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
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

// ── Styles ──

const styles: Record<string, CSSProperties> = {
  page: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', boxSizing: 'border-box' },
  card: { width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 28, padding: 32, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--bg)', boxShadow: 'var(--shadow)', textAlign: 'left' },
  header: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 },
  eyebrow: { display: 'inline-block', padding: '4px 12px', fontSize: 12, fontWeight: 500, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 999, letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { margin: 0, color: 'var(--text-h)', fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.5px' },
  subtitle: { margin: 0, color: 'var(--text)', fontSize: 15, lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: 24 },
  section: { border: '1px solid var(--border)', borderRadius: 12, padding: '18px 18px 20px', margin: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  legend: { padding: '0 6px', fontSize: 13, fontWeight: 600, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: 0.5 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 },
  labelText: { fontSize: 13, fontWeight: 500, color: 'var(--text-h)' },
  input: { appearance: 'none', width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 15, color: 'var(--text-h)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, outline: 'none', fontFamily: 'inherit' },
  hint: { fontSize: 12, color: 'var(--text)', margin: 0 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  subCard: { display: 'flex', flexDirection: 'column', gap: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' },
  addBtn: { appearance: 'none', border: '1px dashed var(--border)', cursor: 'pointer', padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--accent)', background: 'transparent', borderRadius: 10, fontFamily: 'inherit' },
  removeBtn: { appearance: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', fontSize: 12, fontWeight: 500, color: '#b00020', background: 'rgba(176, 0, 32, 0.08)', borderRadius: 8, fontFamily: 'inherit', alignSelf: 'flex-start' },
  error: { padding: '10px 12px', fontSize: 13, color: '#b00020', background: 'rgba(176, 0, 32, 0.08)', border: '1px solid rgba(176, 0, 32, 0.25)', borderRadius: 8 },
  actions: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  back: { fontSize: 14, color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 },
  primary: { appearance: 'none', border: 'none', cursor: 'pointer', padding: '14px 24px', fontSize: 16, fontWeight: 600, color: '#fff', background: 'var(--accent)', borderRadius: 12, transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease' },
  primaryDisabled: { cursor: 'not-allowed', opacity: 0.55 },
};
