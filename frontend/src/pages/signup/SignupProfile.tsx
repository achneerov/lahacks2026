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
  first_name: string;
  middle_initial: string;
  last_name: string;
  preferred_name: string;
  phone_number: string;
  street_address: string;
  apt_suite_unit: string;
  city: string;
  state: string;
  zip_code: string;
  linkedin_url: string;
  website_portfolio: string;
  github_or_other_portfolio: string;
  anything_else: string;
};

type FieldKey = keyof FormState;
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY_FORM: FormState = {
  first_name: '',
  middle_initial: '',
  last_name: '',
  preferred_name: '',
  phone_number: '',
  street_address: '',
  apt_suite_unit: '',
  city: '',
  state: '',
  zip_code: '',
  linkedin_url: '',
  website_portfolio: '',
  github_or_other_portfolio: '',
  anything_else: '',
};

const URL_FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'website_portfolio', label: 'Website / portfolio' },
  { key: 'github_or_other_portfolio', label: 'GitHub or other portfolio' },
];

function fromDraft(draft: ApplicantProfileInput | null): FormState {
  if (!draft) return EMPTY_FORM;
  return {
    first_name: draft.first_name ?? '',
    middle_initial: draft.middle_initial ?? '',
    last_name: draft.last_name ?? '',
    preferred_name: draft.preferred_name ?? '',
    phone_number: draft.phone_number ?? '',
    street_address: draft.street_address ?? '',
    apt_suite_unit: draft.apt_suite_unit ?? '',
    city: draft.city ?? '',
    state: draft.state ?? '',
    zip_code: draft.zip_code ?? '',
    linkedin_url: draft.linkedin_url ?? '',
    website_portfolio: draft.website_portfolio ?? '',
    github_or_other_portfolio: draft.github_or_other_portfolio ?? '',
    anything_else: draft.anything_else ?? '',
  };
}

function toProfile(form: FormState): ApplicantProfileInput {
  const out: ApplicantProfileInput = {};
  const setIf = <K extends keyof ApplicantProfileInput>(key: K, value: string) => {
    const trimmed = value.trim();
    if (trimmed) (out as Record<string, unknown>)[key] = trimmed;
  };

  setIf('first_name', form.first_name);
  setIf('middle_initial', form.middle_initial);
  setIf('last_name', form.last_name);
  setIf('preferred_name', form.preferred_name);
  setIf('phone_number', form.phone_number);
  setIf('street_address', form.street_address);
  setIf('apt_suite_unit', form.apt_suite_unit);
  setIf('city', form.city);
  setIf('state', form.state);
  setIf('zip_code', form.zip_code);
  setIf('linkedin_url', form.linkedin_url);
  setIf('website_portfolio', form.website_portfolio);
  setIf('github_or_other_portfolio', form.github_or_other_portfolio);
  setIf('anything_else', form.anything_else);

  return out;
}

function validate(form: FormState): FieldErrors {
  const errs: FieldErrors = {};

  if (!form.first_name.trim()) {
    errs.first_name = 'Please enter your first name.';
  }
  if (!form.last_name.trim()) {
    errs.last_name = 'Please enter your last name.';
  }

  for (const { key, label } of URL_FIELDS) {
    const v = form[key].trim();
    if (v && !URL_RE.test(v)) {
      errs[key] = `${label} must start with http:// or https://.`;
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
            Add the basics recruiters need to consider you for roles. You can fill in
            the rest of your profile later from your profile page.
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

            <div style={styles.row3}>
              <label style={styles.label}>
                <span style={styles.labelText}>First name</span>
                <input
                  ref={setRef('first_name')}
                  type="text"
                  autoComplete="given-name"
                  value={form.first_name}
                  onChange={(e) => update('first_name', e.target.value)}
                  placeholder="Alex"
                  maxLength={80}
                  style={inputStyle('first_name')}
                  aria-invalid={!!fieldErrors.first_name}
                />
                {fieldError('first_name')}
              </label>
              <label style={styles.label}>
                <span style={styles.labelText}>Middle initial</span>
                <input
                  ref={setRef('middle_initial')}
                  type="text"
                  autoComplete="additional-name"
                  value={form.middle_initial}
                  onChange={(e) => update('middle_initial', e.target.value)}
                  placeholder="J"
                  maxLength={4}
                  style={inputStyle('middle_initial')}
                />
                {fieldError('middle_initial')}
              </label>
              <label style={styles.label}>
                <span style={styles.labelText}>Last name</span>
                <input
                  ref={setRef('last_name')}
                  type="text"
                  autoComplete="family-name"
                  value={form.last_name}
                  onChange={(e) => update('last_name', e.target.value)}
                  placeholder="Chneerov"
                  maxLength={80}
                  style={inputStyle('last_name')}
                  aria-invalid={!!fieldErrors.last_name}
                />
                {fieldError('last_name')}
              </label>
            </div>

            <div style={styles.row2}>
              <label style={styles.label}>
                <span style={styles.labelText}>Preferred name</span>
                <input
                  ref={setRef('preferred_name')}
                  type="text"
                  autoComplete="nickname"
                  value={form.preferred_name}
                  onChange={(e) => update('preferred_name', e.target.value)}
                  placeholder="Alex"
                  maxLength={80}
                  style={inputStyle('preferred_name')}
                />
                {fieldError('preferred_name') ?? (
                  <span style={styles.hint}>How you'd like recruiters to address you.</span>
                )}
              </label>
              <label style={styles.label}>
                <span style={styles.labelText}>Phone</span>
                <input
                  ref={setRef('phone_number')}
                  type="tel"
                  autoComplete="tel"
                  value={form.phone_number}
                  onChange={(e) => update('phone_number', e.target.value)}
                  placeholder="+1 555 123 4567"
                  maxLength={32}
                  style={inputStyle('phone_number')}
                />
                {fieldError('phone_number')}
              </label>
            </div>

            <label style={styles.label}>
              <span style={styles.labelText}>Anything else</span>
              <textarea
                ref={setRef('anything_else')}
                value={form.anything_else}
                onChange={(e) => update('anything_else', e.target.value)}
                placeholder="A short note recruiters should see — what you're looking for, what you're not, anything that doesn't fit elsewhere."
                maxLength={1000}
                rows={4}
                style={inputStyle('anything_else', { resize: 'vertical', minHeight: 96 })}
              />
              {fieldError('anything_else') ?? (
                <span style={styles.hint}>Optional. You can fill in your full bio, work history, and education later.</span>
              )}
            </label>
          </fieldset>

          <fieldset style={styles.section}>
            <legend style={styles.legend}>Address</legend>

            <label style={styles.label}>
              <span style={styles.labelText}>Street address</span>
              <input
                ref={setRef('street_address')}
                type="text"
                autoComplete="address-line1"
                value={form.street_address}
                onChange={(e) => update('street_address', e.target.value)}
                placeholder="123 Market St"
                maxLength={120}
                style={inputStyle('street_address')}
              />
              {fieldError('street_address')}
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>Apt / suite / unit</span>
              <input
                ref={setRef('apt_suite_unit')}
                type="text"
                autoComplete="address-line2"
                value={form.apt_suite_unit}
                onChange={(e) => update('apt_suite_unit', e.target.value)}
                placeholder="Apt 4B"
                maxLength={60}
                style={inputStyle('apt_suite_unit')}
              />
              {fieldError('apt_suite_unit')}
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

            <label style={styles.label}>
              <span style={styles.labelText}>ZIP code</span>
              <input
                ref={setRef('zip_code')}
                type="text"
                autoComplete="postal-code"
                value={form.zip_code}
                onChange={(e) => update('zip_code', e.target.value)}
                placeholder="94103"
                maxLength={20}
                style={inputStyle('zip_code')}
              />
              {fieldError('zip_code')}
            </label>
          </fieldset>

          <fieldset style={styles.section}>
            <legend style={styles.legend}>Links</legend>

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
              <span style={styles.labelText}>Website / portfolio</span>
              <input
                ref={setRef('website_portfolio')}
                type="url"
                value={form.website_portfolio}
                onChange={(e) => update('website_portfolio', e.target.value)}
                placeholder="https://yourname.dev"
                style={inputStyle('website_portfolio')}
                aria-invalid={!!fieldErrors.website_portfolio}
              />
              {fieldError('website_portfolio')}
            </label>

            <label style={styles.label}>
              <span style={styles.labelText}>GitHub or other portfolio</span>
              <input
                ref={setRef('github_or_other_portfolio')}
                type="url"
                value={form.github_or_other_portfolio}
                onChange={(e) => update('github_or_other_portfolio', e.target.value)}
                placeholder="https://github.com/your-handle"
                style={inputStyle('github_or_other_portfolio')}
                aria-invalid={!!fieldErrors.github_or_other_portfolio}
              />
              {fieldError('github_or_other_portfolio')}
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
  row3: {
    display: 'grid',
    gridTemplateColumns: '1fr 100px 1fr',
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
