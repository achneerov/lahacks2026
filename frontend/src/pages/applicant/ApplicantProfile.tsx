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
type WarningMap = Partial<Record<FieldKey, string>>;

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

function profileToForm(p: ApplicantProfile | null): FormState {
  if (!p) return { ...EMPTY_FORM };
  return {
    full_name: p.full_name ?? '',
    phone: p.phone ?? '',
    address_line1: p.address_line1 ?? '',
    address_line2: p.address_line2 ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    postal_code: p.postal_code ?? '',
    country: p.country ?? '',
    headline: p.headline ?? '',
    bio: p.bio ?? '',
    resume_url: p.resume_url ?? '',
    linkedin_url: p.linkedin_url ?? '',
    github_url: p.github_url ?? '',
    portfolio_url: p.portfolio_url ?? '',
    years_experience:
      p.years_experience == null ? '' : String(p.years_experience),
  };
}

function diffPayload(form: FormState, base: FormState): ApplicantProfileInput {
  const out: ApplicantProfileInput = {};
  (Object.keys(form) as FieldKey[]).forEach((k) => {
    const a = form[k].trim();
    const b = base[k].trim();
    if (a === b) return;
    if (k === 'years_experience') {
      out.years_experience = a === '' ? null : Number(a);
    } else {
      (out as Record<string, string>)[k] = a;
    }
  });
  return out;
}

export default function ApplicantProfile() {
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
          Update your personal details, resume, and links so recruiters can
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
          <Field
            label="Full name"
            value={form.full_name}
            onChange={(v) => update('full_name', v)}
            warning={warnings.full_name}
            disabled={busy}
            placeholder="Jane Doe"
          />
          <Field
            label="Headline"
            value={form.headline}
            onChange={(v) => update('headline', v)}
            warning={warnings.headline}
            disabled={busy}
            placeholder="Senior frontend engineer"
          />
        </Section>

        <Section title="Contact">
          <Field
            label="Phone"
            value={form.phone}
            onChange={(v) => update('phone', v)}
            warning={warnings.phone}
            disabled={busy}
            placeholder="+1 555 555 5555"
            type="tel"
          />
        </Section>

        <Section title="Address">
          <Field
            label="Address line 1"
            value={form.address_line1}
            onChange={(v) => update('address_line1', v)}
            warning={warnings.address_line1}
            disabled={busy}
          />
          <Field
            label="Address line 2"
            value={form.address_line2}
            onChange={(v) => update('address_line2', v)}
            warning={warnings.address_line2}
            disabled={busy}
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
              label="Postal code"
              value={form.postal_code}
              onChange={(v) => update('postal_code', v)}
              warning={warnings.postal_code}
              disabled={busy}
            />
            <Field
              label="Country"
              value={form.country}
              onChange={(v) => update('country', v)}
              warning={warnings.country}
              disabled={busy}
            />
          </div>
        </Section>

        <Section title="Experience">
          <Field
            label="Years of experience"
            value={form.years_experience}
            onChange={(v) => update('years_experience', v)}
            warning={warnings.years_experience}
            disabled={busy}
            type="number"
            min={0}
            max={80}
            placeholder="e.g. 5"
          />
          <Field
            label="Bio"
            value={form.bio}
            onChange={(v) => update('bio', v)}
            warning={warnings.bio}
            disabled={busy}
            multiline
            rows={5}
            placeholder="A short paragraph about your background and what you're looking for."
          />
        </Section>

        <Section title="Links">
          <Field
            label="Resume URL"
            value={form.resume_url}
            onChange={(v) => update('resume_url', v)}
            warning={warnings.resume_url}
            disabled={busy}
            type="url"
            placeholder="https://…"
          />
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
            label="GitHub URL"
            value={form.github_url}
            onChange={(v) => update('github_url', v)}
            warning={warnings.github_url}
            disabled={busy}
            type="url"
            placeholder="https://github.com/…"
          />
          <Field
            label="Portfolio URL"
            value={form.portfolio_url}
            onChange={(v) => update('portfolio_url', v)}
            warning={warnings.portfolio_url}
            disabled={busy}
            type="url"
            placeholder="https://…"
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
