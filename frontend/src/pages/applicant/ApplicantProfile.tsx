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
  type ApplicantProfile as ProfileType,
  type ApplicantProfileInput,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

export default function ApplicantProfile() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<ProfileType | null>(null);
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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.applicantGetProfile(token).then(d => {
      if (cancelled) return;
      setProfile(d.profile);
      const p = d.profile.personal_information;
      setFirstName(p.first_name ?? '');
      setMiddleInitial(p.middle_initial ?? '');
      setLastName(p.last_name ?? '');
      setPreferredName(p.preferred_name ?? '');
      setPronouns(p.pronouns ?? '');
      setDateOfBirth(p.date_of_birth ?? '');
      setPhoneNumber(p.phone_number ?? '');
      setAlternativePhone(p.alternative_phone ?? '');
      setStreetAddress(p.street_address ?? '');
      setAptSuiteUnit(p.apt_suite_unit ?? '');
      setCity(p.city ?? '');
      setState(p.state ?? '');
      setZipCode(p.zip_code ?? '');
      setLinkedinUrl(p.linkedin_url ?? '');
      setWebsitePortfolio(p.website_portfolio ?? '');
      setGithubOrOther(p.github_or_other_portfolio ?? '');
    }).catch(err => {
      if (cancelled) return;
      setError(err instanceof ApiError ? err.detail || err.code : 'Could not load profile.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

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
    };
    try {
      const res = await api.applicantUpdateProfile(token, payload);
      setProfile(res.profile);
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

        {profile && profile.work_experience.length > 0 && (
          <Section title="Work Experience">
            {profile.work_experience.map((w, i) => (
              <div key={i} style={styles.readonlyCard}>
                <strong>{w.job_title}</strong> at {w.company} — {w.city}, {w.state}
                {w.current_job && <span style={styles.badge}>Current</span>}
              </div>
            ))}
            <p style={styles.hint}>Edit work experience, education, skills, and other sections from the full profile editor (coming soon).</p>
          </Section>
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
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}

function Field({ label, value, onChange, type = 'text', placeholder, disabled }: FieldProps) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled} style={styles.input} />
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
  successBanner: { padding: '10px 14px', fontSize: 14, color: '#0a6b2b', background: 'rgba(10, 107, 43, 0.08)', border: '1px solid rgba(10, 107, 43, 0.25)', borderRadius: 10 },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  section: { display: 'flex', flexDirection: 'column', gap: 12, padding: 20, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--bg)', boxShadow: 'var(--shadow)' },
  sectionTitle: { margin: 0, fontSize: 16, color: 'var(--text-h)' },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: 500, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { padding: '10px 12px', fontSize: 14, color: 'var(--text-h)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, outline: 'none', fontFamily: 'inherit' },
  readonlyCard: { padding: '10px 14px', fontSize: 14, color: 'var(--text-h)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 10 },
  badge: { marginLeft: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 999 },
  hint: { margin: 0, fontSize: 12, color: 'var(--text)' },
  actionsRow: { display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  primaryBtn: { padding: '10px 18px', fontSize: 14, fontWeight: 500, color: 'var(--bg)', background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' },
};
