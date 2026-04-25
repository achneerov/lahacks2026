import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  api,
  ApiError,
  type ApplicantProfile,
  type ApplicantProfileInput,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

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
  challenge_you_overcame: string;
  greatest_strength: string;
  greatest_weakness: string;
  five_year_goals: string;
  leadership_experience: string;
  anything_else: string;
};

type FieldKey = keyof FormState;
type WarningMap = Partial<Record<FieldKey, string>>;

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
  challenge_you_overcame: '',
  greatest_strength: '',
  greatest_weakness: '',
  five_year_goals: '',
  leadership_experience: '',
  anything_else: '',
};

function profileToForm(p: ApplicantProfile | null): FormState {
  if (!p) return { ...EMPTY_FORM };
  return {
    first_name: p.first_name ?? '',
    middle_initial: p.middle_initial ?? '',
    last_name: p.last_name ?? '',
    preferred_name: p.preferred_name ?? '',
    phone_number: p.phone_number ?? '',
    street_address: p.street_address ?? '',
    apt_suite_unit: p.apt_suite_unit ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    zip_code: p.zip_code ?? '',
    linkedin_url: p.linkedin_url ?? '',
    website_portfolio: p.website_portfolio ?? '',
    github_or_other_portfolio: p.github_or_other_portfolio ?? '',
    challenge_you_overcame: p.challenge_you_overcame ?? '',
    greatest_strength: p.greatest_strength ?? '',
    greatest_weakness: p.greatest_weakness ?? '',
    five_year_goals: p.five_year_goals ?? '',
    leadership_experience: p.leadership_experience ?? '',
    anything_else: p.anything_else ?? '',
  };
}

function diffPayload(form: FormState, base: FormState): ApplicantProfileInput {
  const out: ApplicantProfileInput = {};
  (Object.keys(form) as FieldKey[]).forEach((k) => {
    const a = form[k].trim();
    const b = base[k].trim();
    if (a === b) return;
    (out as Record<string, string | null>)[k] = a === '' ? null : a;
  });
  return out;
}

export default function ApplicantProfilePage() {
  const { token } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<FormState>(EMPTY_FORM);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<WarningMap>({});
  const [pendingConfirm, setPendingConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .applicantGetProfile(token)
      .then((d) => {
        if (cancelled) return;
        const next = profileToForm(d.profile);
        setForm(next);
        setBaseline(next);
        setUpdatedAt(d.profile?.updated_at ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load your profile.';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dirty = useMemo(() => {
    return (Object.keys(form) as FieldKey[]).some(
      (k) => form[k].trim() !== baseline[k].trim(),
    );
  }, [form, baseline]);

  function update<K extends FieldKey>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(null);
    setWarnings((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _ignored, ...rest } = prev;
      return rest;
    });
    setPendingConfirm(false);
  }

  async function attemptSave() {
    if (!token || !dirty || saving) return;
    setError(null);
    setSuccess(null);

    const payload = diffPayload(form, baseline);
    if (Object.keys(payload).length === 0) return;

    if (!pendingConfirm) {
      setReviewing(true);
      try {
        const review = await api.applicantReviewProfile(token, payload);
        setReviewing(false);
        if (review.warnings && Object.keys(review.warnings).length > 0) {
          setWarnings(review.warnings as WarningMap);
          setPendingConfirm(true);
          return;
        }
      } catch (err) {
        setReviewing(false);
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not check your changes.';
        setError(msg);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await api.applicantUpdateProfile(token, payload);
      const next = profileToForm(res.profile);
      setForm(next);
      setBaseline(next);
      setUpdatedAt(res.profile?.updated_at ?? null);
      setWarnings({});
      setPendingConfirm(false);
      setSuccess('Profile updated.');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail || err.code
          : 'Could not save your profile.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setForm(baseline);
    setWarnings({});
    setPendingConfirm(false);
    setError(null);
    setSuccess(null);
  }

  const busy = loading || saving || reviewing;
  const warningKeys = Object.keys(warnings) as FieldKey[];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.eyebrow}>Applicant</span>
        <h1 style={styles.title}>Edit profile</h1>
        <p style={styles.subtitle}>
          Update your personal details, address, and links so recruiters can
          find you. Changes to identity-level fields are reviewed before saving.
        </p>
        {updatedAt && (
          <span style={styles.updatedAt}>
            Last updated {formatRelative(updatedAt)}
          </span>
        )}
      </header>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}
      {success && (
        <div role="status" style={styles.successBanner}>
          {success}
        </div>
      )}
      {pendingConfirm && warningKeys.length > 0 && (
        <div role="alert" style={styles.warningBanner}>
          <strong style={styles.warningTitle}>
            We flagged {warningKeys.length === 1 ? 'a change' : 'some changes'}{' '}
            that look unusual.
          </strong>
          <p style={styles.warningBody}>
            Review the highlighted{' '}
            {warningKeys.length === 1 ? 'field' : 'fields'} below. If everything
            is correct, click <em>Save anyway</em>; otherwise revert the
            change or open a support ticket.
          </p>
        </div>
      )}

      <form
        style={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void attemptSave();
        }}
      >
        <Section title="Identity">
          <div style={styles.row3}>
            <Field
              label="First name"
              value={form.first_name}
              onChange={(v) => update('first_name', v)}
              warning={warnings.first_name}
              disabled={busy}
              placeholder="Alex"
            />
            <Field
              label="Middle initial"
              value={form.middle_initial}
              onChange={(v) => update('middle_initial', v)}
              warning={warnings.middle_initial}
              disabled={busy}
              placeholder="J"
            />
            <Field
              label="Last name"
              value={form.last_name}
              onChange={(v) => update('last_name', v)}
              warning={warnings.last_name}
              disabled={busy}
              placeholder="Chen"
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Preferred name"
              value={form.preferred_name}
              onChange={(v) => update('preferred_name', v)}
              warning={warnings.preferred_name}
              disabled={busy}
              placeholder="Alex"
            />
            <Field
              label="Phone"
              value={form.phone_number}
              onChange={(v) => update('phone_number', v)}
              warning={warnings.phone_number}
              disabled={busy}
              type="tel"
              placeholder="+1 555 555 5555"
            />
          </div>
        </Section>

        <Section title="Address">
          <Field
            label="Street address"
            value={form.street_address}
            onChange={(v) => update('street_address', v)}
            warning={warnings.street_address}
            disabled={busy}
            placeholder="123 Market St"
          />
          <Field
            label="Apt / suite / unit"
            value={form.apt_suite_unit}
            onChange={(v) => update('apt_suite_unit', v)}
            warning={warnings.apt_suite_unit}
            disabled={busy}
            placeholder="Apt 4B"
          />
          <div style={styles.row}>
            <Field
              label="City"
              value={form.city}
              onChange={(v) => update('city', v)}
              warning={warnings.city}
              disabled={busy}
            />
            <Field
              label="State / region"
              value={form.state}
              onChange={(v) => update('state', v)}
              warning={warnings.state}
              disabled={busy}
            />
            <Field
              label="ZIP code"
              value={form.zip_code}
              onChange={(v) => update('zip_code', v)}
              warning={warnings.zip_code}
              disabled={busy}
            />
          </div>
        </Section>

        <Section title="Links">
          <Field
            label="LinkedIn URL"
            value={form.linkedin_url}
            onChange={(v) => update('linkedin_url', v)}
            warning={warnings.linkedin_url}
            disabled={busy}
            type="url"
            placeholder="https://linkedin.com/in/…"
          />
          <Field
            label="Website / portfolio"
            value={form.website_portfolio}
            onChange={(v) => update('website_portfolio', v)}
            warning={warnings.website_portfolio}
            disabled={busy}
            type="url"
            placeholder="https://yourname.dev"
          />
          <Field
            label="GitHub or other portfolio"
            value={form.github_or_other_portfolio}
            onChange={(v) => update('github_or_other_portfolio', v)}
            warning={warnings.github_or_other_portfolio}
            disabled={busy}
            type="url"
            placeholder="https://github.com/…"
          />
        </Section>

        <Section title="About you">
          <Field
            label="A challenge you overcame"
            value={form.challenge_you_overcame}
            onChange={(v) => update('challenge_you_overcame', v)}
            warning={warnings.challenge_you_overcame}
            disabled={busy}
            multiline
            rows={4}
          />
          <Field
            label="Your greatest strength"
            value={form.greatest_strength}
            onChange={(v) => update('greatest_strength', v)}
            warning={warnings.greatest_strength}
            disabled={busy}
            multiline
            rows={3}
          />
          <Field
            label="Your greatest weakness"
            value={form.greatest_weakness}
            onChange={(v) => update('greatest_weakness', v)}
            warning={warnings.greatest_weakness}
            disabled={busy}
            multiline
            rows={3}
          />
          <Field
            label="Where do you see yourself in five years?"
            value={form.five_year_goals}
            onChange={(v) => update('five_year_goals', v)}
            warning={warnings.five_year_goals}
            disabled={busy}
            multiline
            rows={3}
          />
          <Field
            label="Leadership experience"
            value={form.leadership_experience}
            onChange={(v) => update('leadership_experience', v)}
            warning={warnings.leadership_experience}
            disabled={busy}
            multiline
            rows={3}
          />
          <Field
            label="Anything else recruiters should know?"
            value={form.anything_else}
            onChange={(v) => update('anything_else', v)}
            warning={warnings.anything_else}
            disabled={busy}
            multiline
            rows={4}
          />
        </Section>

        <div style={styles.actionsRow}>
          <button
            type="button"
            onClick={discard}
            style={styles.secondaryBtn}
            disabled={!dirty || busy}
          >
            Discard changes
          </button>
          <button
            type="submit"
            style={styles.primaryBtn}
            disabled={!dirty || busy}
          >
            {saving
              ? 'Saving…'
              : reviewing
                ? 'Checking…'
                : pendingConfirm
                  ? 'Save anyway'
                  : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  warning?: string;
  disabled?: boolean;
  placeholder?: string;
  type?: 'text' | 'tel' | 'url' | 'number';
  multiline?: boolean;
  rows?: number;
  min?: number;
  max?: number;
}

function Field({
  label,
  value,
  onChange,
  warning,
  disabled,
  placeholder,
  type = 'text',
  multiline,
  rows,
  min,
  max,
}: FieldProps) {
  const inputStyle: CSSProperties = {
    ...styles.input,
    ...(warning ? styles.inputWarning : null),
  };
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows ?? 4}
          placeholder={placeholder}
          disabled={disabled}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          style={inputStyle}
        />
      )}
      {warning && <span style={styles.warning}>{warning}</span>}
    </label>
  );
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
    maxWidth: 880,
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
    maxWidth: 640,
  },
  updatedAt: {
    marginTop: 8,
    fontSize: 12,
    color: 'var(--text)',
  },
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
    borderRadius: 10,
  },
  successBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: '#0a6b2b',
    background: 'rgba(10, 107, 43, 0.08)',
    border: '1px solid rgba(10, 107, 43, 0.25)',
    borderRadius: 10,
  },
  warningBanner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '12px 14px',
    fontSize: 14,
    color: '#7a4a00',
    background: 'rgba(255, 184, 0, 0.10)',
    border: '1px solid rgba(255, 184, 0, 0.4)',
    borderRadius: 10,
  },
  warningTitle: {
    fontSize: 14,
    color: '#7a4a00',
  },
  warningBody: {
    margin: 0,
    fontSize: 13,
    color: '#7a4a00',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
    boxShadow: 'var(--shadow)',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    color: 'var(--text-h)',
  },
  sectionBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  row3: {
    display: 'grid',
    gridTemplateColumns: '1fr 100px 1fr',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },
  fieldLabel: {
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
    fontFamily: 'inherit',
  },
  inputWarning: {
    borderColor: '#d99e00',
    boxShadow: '0 0 0 1px rgba(255, 184, 0, 0.4)',
  },
  warning: {
    fontSize: 12,
    color: '#7a4a00',
    lineHeight: 1.4,
  },
  actionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  primaryBtn: {
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--bg)',
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondaryBtn: {
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-h)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
