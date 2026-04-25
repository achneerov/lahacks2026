import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError, api, type ApplicantProfileInput } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useSignup } from '../../signup/SignupContext';

const URL_RE = /^https?:\/\/[^\s]+$/i;

type FormState = {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  headline: string;
  bio: string;
  resume_url: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  years_experience: string;
};

type FieldKey = keyof FormState;
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY_FORM: FormState = {
  full_name: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  headline: '',
  bio: '',
  resume_url: '',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
  years_experience: '',
};

const URL_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'resume_url', label: 'Resume URL' },
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'github_url', label: 'GitHub' },
  { key: 'portfolio_url', label: 'Portfolio' },
];

function fromDraft(draft: ApplicantProfileInput | null): FormState {
  if (!draft) return EMPTY_FORM;
  return {
    full_name: draft.full_name ?? '',
    phone: draft.phone ?? '',
    address_line1: draft.address_line1 ?? '',
    address_line2: draft.address_line2 ?? '',
    city: draft.city ?? '',
    state: draft.state ?? '',
    postal_code: draft.postal_code ?? '',
    country: draft.country ?? '',
    headline: draft.headline ?? '',
    bio: draft.bio ?? '',
    resume_url: draft.resume_url ?? '',
    linkedin_url: draft.linkedin_url ?? '',
    github_url: draft.github_url ?? '',
    portfolio_url: draft.portfolio_url ?? '',
    years_experience:
      draft.years_experience === null || draft.years_experience === undefined
        ? ''
        : String(draft.years_experience),
  };
}

function toProfile(form: FormState): ApplicantProfileInput {
  const out: ApplicantProfileInput = {};
  const setIf = <K extends keyof ApplicantProfileInput>(key: K, value: string) => {
    const trimmed = value.trim();
    if (trimmed) (out as Record<string, unknown>)[key] = trimmed;
  };

  setIf('full_name', form.full_name);
  setIf('phone', form.phone);
  setIf('address_line1', form.address_line1);
  setIf('address_line2', form.address_line2);
  setIf('city', form.city);
  setIf('state', form.state);
  setIf('postal_code', form.postal_code);
  setIf('country', form.country);
  setIf('headline', form.headline);
  setIf('bio', form.bio);
  setIf('resume_url', form.resume_url);
  setIf('linkedin_url', form.linkedin_url);
  setIf('github_url', form.github_url);
  setIf('portfolio_url', form.portfolio_url);

  const yrs = form.years_experience.trim();
  if (yrs) out.years_experience = Number(yrs);

  return out;
}

function validate(form: FormState): FieldErrors {
  const errs: FieldErrors = {};

  if (!form.full_name.trim()) {
    errs.full_name = 'Please enter your full name.';
  }

  for (const { key, label } of URL_FIELDS) {
    const v = form[key].trim();
    if (v && !URL_RE.test(v)) {
      errs[key] = `${label} must start with http:// or https://.`;
    }
  }

  if (form.years_experience.trim()) {
    const n = Number(form.years_experience);
    if (!Number.isInteger(n) || n < 0 || n > 80) {
      errs.years_experience = 'Must be a whole number between 0 and 80.';
    }
  }

  return errs;
}

export default function SignupProfile() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const {
    basics,
    password,
    worldIdResult,
    applicantProfile,
    setApplicantProfile,
    reset,
  } = useSignup();

  const [form, setForm] = useState<FormState>(() => fromDraft(applicantProfile));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({});
  const completedRef = useRef(false);

  useEffect(() => {
    setApplicantProfile(toProfile(form));
  }, [form, setApplicantProfile]);

  if (!completedRef.current) {
    if (!basics) return <Navigate to="/signup" replace />;
    if (basics.role !== 'Applicant') return <Navigate to="/" replace />;
  }

  function update<K extends FieldKey>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function focusFirstError(errs: FieldErrors) {
    const firstKey = (Object.keys(errs) as FieldKey[])[0];
    if (!firstKey) return;
    const el = fieldRefs.current[firstKey];
    if (el && typeof (el as HTMLElement).focus === 'function') {
      (el as HTMLElement).focus({ preventScroll: false });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTopError(null);

    const errs = validate(form);
    setFieldErrors(errs);

    if (Object.keys(errs).length > 0) {
      setTopError('Please fix the highlighted fields and try again.');
      focusFirstError(errs);
      return;
    }
    if (!basics || !password) {
      setTopError(
        'Your signup session expired. Please go back to step 1 and re-enter your password.'
      );
      return;
    }
    if (!worldIdResult) {
      setTopError(
        'World ID verification is required before completing signup. Go back to step 2 to verify.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const profile = toProfile(form);
      const { token, user } = await api.register({
        email: basics.email,
        username: basics.username,
        password,
        role: basics.role,
        world_id_result: worldIdResult,
        profile,
      });
      completedRef.current = true;
      setAuth(token, user);
      reset();
      nav('/', { replace: true });
    } catch (err) {
      setTopError(
        err instanceof ApiError
          ? errorMessage(err.code, err.detail)
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  function inputStyle(key: FieldKey, extra?: CSSProperties): CSSProperties {
    return {
      ...styles.input,
      ...(fieldErrors[key] ? styles.inputError : null),
      ...(extra || {}),
    };
  }

  function fieldError(key: FieldKey) {
    const msg = fieldErrors[key];
    if (!msg) return null;
    return <span style={styles.fieldErrorText}>{msg}</span>;
  }

  function setRef(key: FieldKey) {
    return (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      fieldRefs.current[key] = el;
    };
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.eyebrow}>Step 3 of 3</span>
          <h1 style={styles.title}>Build your applicant profile</h1>
          <p style={styles.subtitle}>
            Add the details recruiters need to consider you for roles. You can update
            anything later from your profile page.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              (e.target as HTMLElement).tagName === 'INPUT'
            ) {
              e.preventDefault();
            }
          }}
          style={styles.form}
          noValidate
        >
          <fieldset style={styles.section}>
            <legend style={styles.legend}>About you</legend>

            <label style={styles.label}>
              <span style={styles.labelText}>Full name</span>
              <input
                ref={setRef('full_name')}
                type="text"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                placeholder="Alex Chneerov"
                maxLength={120}
                style={inputStyle('full_name')}
                aria-invalid={!!fieldErrors.full_name}
              />
              {fieldError('full_name')}
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>Headline</span>
              <input
                ref={setRef('headline')}
                type="text"
                value={form.headline}
                onChange={(e) => update('headline', e.target.value)}
                placeholder="Full-stack engineer focused on React + Postgres"
                maxLength={140}
                style={inputStyle('headline')}
                aria-invalid={!!fieldErrors.headline}
              />
              {fieldError('headline') ?? (
                <span style={styles.hint}>One short line. Shown at the top of your profile.</span>
              )}
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>Bio</span>
              <textarea
                ref={setRef('bio')}
                value={form.bio}
                onChange={(e) => update('bio', e.target.value)}
                placeholder="A few sentences about your experience, interests, and what you're looking for."
                maxLength={1000}
                rows={4}
                style={inputStyle('bio', { resize: 'vertical', minHeight: 96 })}
                aria-invalid={!!fieldErrors.bio}
              />
              {fieldError('bio')}
            </label>

            <div style={styles.row2}>
              <label style={styles.label}>
                <span style={styles.labelText}>Years of experience</span>
                <input
                  ref={setRef('years_experience')}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={80}
                  step={1}
                  value={form.years_experience}
                  onChange={(e) => update('years_experience', e.target.value)}
                  placeholder="3"
                  style={inputStyle('years_experience')}
                  aria-invalid={!!fieldErrors.years_experience}
                />
                {fieldError('years_experience')}
              </label>
              <label style={styles.label}>
                <span style={styles.labelText}>Phone</span>
                <input
                  ref={setRef('phone')}
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="+1 555 123 4567"
                  maxLength={32}
                  style={inputStyle('phone')}
                  aria-invalid={!!fieldErrors.phone}
                />
                {fieldError('phone')}
              </label>
            </div>
          </fieldset>

          <fieldset style={styles.section}>
            <legend style={styles.legend}>Location</legend>

            <label style={styles.label}>
              <span style={styles.labelText}>Address line 1</span>
              <input
                ref={setRef('address_line1')}
                type="text"
                autoComplete="address-line1"
                value={form.address_line1}
                onChange={(e) => update('address_line1', e.target.value)}
                placeholder="123 Market St"
                maxLength={120}
                style={inputStyle('address_line1')}
              />
              {fieldError('address_line1')}
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>Address line 2</span>
              <input
                ref={setRef('address_line2')}
                type="text"
                autoComplete="address-line2"
                value={form.address_line2}
                onChange={(e) => update('address_line2', e.target.value)}
                placeholder="Apt 4B"
                maxLength={120}
                style={inputStyle('address_line2')}
              />
              {fieldError('address_line2')}
            </label>

            <div style={styles.row2}>
              <label style={styles.label}>
                <span style={styles.labelText}>City</span>
                <input
                  ref={setRef('city')}
                  type="text"
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="San Francisco"
                  maxLength={80}
                  style={inputStyle('city')}
                />
                {fieldError('city')}
              </label>
              <label style={styles.label}>
                <span style={styles.labelText}>State / region</span>
                <input
                  ref={setRef('state')}
                  type="text"
                  autoComplete="address-level1"
                  value={form.state}
                  onChange={(e) => update('state', e.target.value)}
                  placeholder="CA"
                  maxLength={80}
                  style={inputStyle('state')}
                />
                {fieldError('state')}
              </label>
            </div>

            <div style={styles.row2}>
              <label style={styles.label}>
                <span style={styles.labelText}>Postal code</span>
                <input
                  ref={setRef('postal_code')}
                  type="text"
                  autoComplete="postal-code"
                  value={form.postal_code}
                  onChange={(e) => update('postal_code', e.target.value)}
                  placeholder="94103"
                  maxLength={20}
                  style={inputStyle('postal_code')}
                />
                {fieldError('postal_code')}
              </label>
              <label style={styles.label}>
                <span style={styles.labelText}>Country</span>
                <input
                  ref={setRef('country')}
                  type="text"
                  autoComplete="country-name"
                  value={form.country}
                  onChange={(e) => update('country', e.target.value)}
                  placeholder="USA"
                  maxLength={80}
                  style={inputStyle('country')}
                />
                {fieldError('country')}
              </label>
            </div>
          </fieldset>

          <fieldset style={styles.section}>
            <legend style={styles.legend}>Links</legend>

            <label style={styles.label}>
              <span style={styles.labelText}>Resume URL</span>
              <input
                ref={setRef('resume_url')}
                type="url"
                value={form.resume_url}
                onChange={(e) => update('resume_url', e.target.value)}
                placeholder="https://example.com/resume.pdf"
                style={inputStyle('resume_url')}
                aria-invalid={!!fieldErrors.resume_url}
              />
              {fieldError('resume_url') ?? (
                <span style={styles.hint}>Link to a hosted PDF or doc.</span>
              )}
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>LinkedIn</span>
              <input
                ref={setRef('linkedin_url')}
                type="url"
                value={form.linkedin_url}
                onChange={(e) => update('linkedin_url', e.target.value)}
                placeholder="https://linkedin.com/in/your-handle"
                style={inputStyle('linkedin_url')}
                aria-invalid={!!fieldErrors.linkedin_url}
              />
              {fieldError('linkedin_url')}
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>GitHub</span>
              <input
                ref={setRef('github_url')}
                type="url"
                value={form.github_url}
                onChange={(e) => update('github_url', e.target.value)}
                placeholder="https://github.com/your-handle"
                style={inputStyle('github_url')}
                aria-invalid={!!fieldErrors.github_url}
              />
              {fieldError('github_url')}
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>Portfolio</span>
              <input
                ref={setRef('portfolio_url')}
                type="url"
                value={form.portfolio_url}
                onChange={(e) => update('portfolio_url', e.target.value)}
                placeholder="https://yourname.dev"
                style={inputStyle('portfolio_url')}
                aria-invalid={!!fieldErrors.portfolio_url}
              />
              {fieldError('portfolio_url')}
            </label>
          </fieldset>

          {topError && (
            <div role="alert" style={styles.error}>
              {topError}
            </div>
          )}

          <div style={styles.actions}>
            <Link to="/signup/world-id" style={styles.back}>
              ← Back to step 2
            </Link>
            <button
              type="submit"
              disabled={submitting}
              style={{
                ...styles.primary,
                ...(submitting ? styles.primaryDisabled : null),
              }}
            >
              {submitting ? 'Creating account…' : 'Finish signup'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function errorMessage(code: string, detail?: string): string {
  switch (code) {
    case 'email_taken':
      return 'That email is already registered.';
    case 'username_taken':
      return 'That username is taken.';
    case 'world_id_already_used':
      return 'This World ID has already been used to register an account.';
    case 'world_id_failed':
      return detail || 'World ID verification failed. Please try step 2 again.';
    case 'invalid_profile':
    case 'invalid_profile_url':
    case 'invalid_profile_years':
      return detail || 'One of the profile fields is invalid.';
    case 'missing_fields':
      return 'Some required fields are missing. Please review and try again.';
    default:
      return detail || 'Something went wrong. Please try again.';
  }
}

const styles: Record<string, CSSProperties> = {
  page: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: 640,
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
    padding: 32,
    border: '1px solid var(--border)',
    borderRadius: 16,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
    textAlign: 'left',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
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
  },
  title: {
    margin: 0,
    color: 'var(--text-h)',
    fontSize: 28,
    lineHeight: 1.15,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  section: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '18px 18px 20px',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  legend: {
    padding: '0 6px',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-h)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  labelText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-h)',
  },
  input: {
    appearance: 'none',
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    fontSize: 15,
    color: 'var(--text-h)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
  },
  inputError: {
    borderColor: '#b00020',
    background: 'rgba(176, 0, 32, 0.04)',
    boxShadow: '0 0 0 3px rgba(176, 0, 32, 0.12)',
  },
  hint: {
    fontSize: 12,
    color: 'var(--text)',
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#b00020',
    fontWeight: 500,
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  error: {
    padding: '10px 12px',
    fontSize: 13,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 8,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  back: {
    fontSize: 14,
    color: 'var(--accent)',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  primary: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '14px 24px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    borderRadius: 12,
    transition: 'transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
  },
  primaryDisabled: {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
};
