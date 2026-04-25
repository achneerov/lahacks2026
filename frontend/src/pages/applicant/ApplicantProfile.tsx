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
  type ApplicantProfileInput,
  type ApplicantProfileResponse,
  type ProfileLockState,
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

type WorkExpItem = WorkExperienceInput & { _key: number; _expanded: boolean };
type EduItem = EducationInput & { _key: number; _expanded: boolean };
type SkillItem = SkillInput & { _key: number };
type LanguageItem = LanguageInput & { _key: number };
type ReferenceItem = ReferenceInput & { _key: number; _expanded: boolean };

function emptyAbout(): AboutMeInput {
  return {
    challenge_you_overcame: '',
    greatest_strength: '',
    greatest_weakness: '',
    five_year_goals: '',
    leadership_experience: '',
    anything_else: '',
  };
}
function emptyLegal(): LegalInput {
  return {
    us_work_authorization: false,
    requires_sponsorship: false,
    visa_type: '',
    over_18: false,
    security_clearance: '',
    needs_accommodation: false,
  };
}
function emptyEeo(): EeoInput {
  return { gender: '', race_ethnicity: '', disability_status: '', veteran_status: '' };
}

function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map(s => s.trim())
    .filter(s => s !== '');
}
function listToLines(list: string[] | null | undefined): string {
  return Array.isArray(list) ? list.join('\n') : '';
}

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
  const [lock, setLock] = useState<ProfileLockState>({
    locked: false,
    reason: null,
    locked_at: null,
  });

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

  // Documents
  const [resumeUrl, setResumeUrl] = useState('');
  const [writingSamples, setWritingSamples] = useState('');
  const [portfolioSamples, setPortfolioSamples] = useState('');
  const [transcripts, setTranscripts] = useState('');
  const [certifications, setCertifications] = useState('');
  const [otherDocuments, setOtherDocuments] = useState('');

  // Sub-collections
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [references, setReferences] = useState<ReferenceItem[]>([]);

  // Single-row sections
  const [aboutMe, setAboutMe] = useState<AboutMeInput>(emptyAbout());
  const [legal, setLegal] = useState<LegalInput>(emptyLegal());
  const [eeo, setEeo] = useState<EeoInput>(emptyEeo());

  const keyCounter = useRef(0);
  const pageTopRef = useRef<HTMLDivElement | null>(null);
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

  function hydrate(res: ApplicantProfileResponse) {
    const p = res.profile;
    setLock(res.lock || { locked: false, reason: null, locked_at: null });
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

    const docs = p.documents;
    setResumeUrl(docs?.resume ?? '');
    setWritingSamples(listToLines(docs?.writing_samples));
    setPortfolioSamples(listToLines(docs?.portfolio_work_samples));
    setTranscripts(listToLines(docs?.transcripts));
    setCertifications(listToLines(docs?.certifications));
    setOtherDocuments(listToLines(docs?.other_documents));

    setSkills(p.skills.map(s => ({ ...s, _key: nextKey() })));
    setLanguages(p.languages.map(l => ({ ...l, _key: nextKey() })));
    setReferences(
      p.references.map(r => ({ ...r, _key: nextKey(), _expanded: false })),
    );

    setAboutMe({ ...emptyAbout(), ...(p.about_me ?? {}) });
    setLegal({ ...emptyLegal(), ...(p.legal ?? {}) });
    setEeo({ ...emptyEeo(), ...(p.eeo ?? {}) });

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
      hydrate(d);
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

  function updateSkill(idx: number, patch: Partial<SkillInput>) {
    setSkills(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function removeSkill(idx: number) {
    setSkills(prev => prev.filter((_, i) => i !== idx));
  }
  function addSkill() {
    setSkills(prev => [...prev, { _key: nextKey(), skill: '', proficiency: '', years: null }]);
  }

  function updateLanguage(idx: number, patch: Partial<LanguageInput>) {
    setLanguages(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLanguage(idx: number) {
    setLanguages(prev => prev.filter((_, i) => i !== idx));
  }
  function addLanguage() {
    setLanguages(prev => [...prev, { _key: nextKey(), language: '', proficiency: '' }]);
  }

  function updateReference(idx: number, patch: Partial<ReferenceInput>) {
    setReferences(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeReference(idx: number) {
    setReferences(prev => prev.filter((_, i) => i !== idx));
  }
  function toggleReference(idx: number) {
    setReferences(prev =>
      prev.map((r, i) => (i === idx ? { ...r, _expanded: !r._expanded } : r)),
    );
  }
  function addReference() {
    setReferences(prev => [
      ...prev,
      {
        _key: nextKey(),
        _expanded: true,
        name: '',
        relationship: '',
        company: '',
        title: '',
        phone: '',
        email: '',
      },
    ]);
  }

  function patchAbout(patch: Partial<AboutMeInput>) {
    setAboutMe(prev => ({ ...prev, ...patch }));
  }
  function patchLegal(patch: Partial<LegalInput>) {
    setLegal(prev => ({ ...prev, ...patch }));
  }
  function patchEeo(patch: Partial<EeoInput>) {
    setEeo(prev => ({ ...prev, ...patch }));
  }

  async function save() {
    if (!token || saving) return;
    pageTopRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    window.scrollTo({ top: 0, behavior: 'auto' });
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
      documents: {
        resume: resumeUrl.trim() || undefined,
        writing_samples: linesToList(writingSamples),
        portfolio_work_samples: linesToList(portfolioSamples),
        transcripts: linesToList(transcripts),
        certifications: linesToList(certifications),
        other_documents: linesToList(otherDocuments),
      },
      skills: skills
        .map(({ _key: _sk, ...s }) => ({
          skill: (s.skill ?? '').trim(),
          proficiency: (s.proficiency ?? '').trim() || undefined,
          years: s.years == null || s.years === ('' as unknown as number) ? null : Number(s.years),
        }))
        .filter(s => s.skill !== ''),
      languages: languages
        .map(({ _key: _lk, ...l }) => ({
          language: (l.language ?? '').trim(),
          proficiency: (l.proficiency ?? '').trim() || undefined,
        }))
        .filter(l => l.language !== ''),
      references: references.map(({ _key: _rk, _expanded: _re, ...r }) => ({
        name: (r.name ?? '').trim() || undefined,
        relationship: (r.relationship ?? '').trim() || undefined,
        company: (r.company ?? '').trim() || undefined,
        title: (r.title ?? '').trim() || undefined,
        phone: (r.phone ?? '').trim() || undefined,
        email: (r.email ?? '').trim() || undefined,
      })),
      about_me: {
        challenge_you_overcame: (aboutMe.challenge_you_overcame ?? '').trim() || undefined,
        greatest_strength: (aboutMe.greatest_strength ?? '').trim() || undefined,
        greatest_weakness: (aboutMe.greatest_weakness ?? '').trim() || undefined,
        five_year_goals: (aboutMe.five_year_goals ?? '').trim() || undefined,
        leadership_experience: (aboutMe.leadership_experience ?? '').trim() || undefined,
        anything_else: (aboutMe.anything_else ?? '').trim() || undefined,
      },
      legal: {
        us_work_authorization: !!legal.us_work_authorization,
        requires_sponsorship: !!legal.requires_sponsorship,
        visa_type: legal.requires_sponsorship
          ? (legal.visa_type ?? '').trim() || undefined
          : undefined,
        over_18: !!legal.over_18,
        security_clearance: (legal.security_clearance ?? '').trim() || undefined,
        needs_accommodation: !!legal.needs_accommodation,
      },
      eeo: {
        gender: (eeo.gender ?? '').trim() || undefined,
        race_ethnicity: (eeo.race_ethnicity ?? '').trim() || undefined,
        disability_status: (eeo.disability_status ?? '').trim() || undefined,
        veteran_status: (eeo.veteran_status ?? '').trim() || undefined,
      },
    };
    try {
      const res = await api.applicantUpdateProfile(token, payload);
      hydrate(res);
      setSuccess('Profile updated.');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'profile_change_rejected' || err.code === 'profile_locked') {
          // Backend just changed our lock state. Refetch so the page picks
          // it up and renders the locked-out UI without a manual reload.
          setError(err.detail || err.code);
          try {
            const fresh = await api.applicantGetProfile(token);
            hydrate(fresh);
          } catch {
            // ignore — error banner is enough.
          }
        } else if (err.code === 'review_unavailable') {
          setError(
            err.detail ||
              'Profile credibility review is temporarily unavailable. Please try saving again in a moment.',
          );
        } else {
          setError(err.detail || err.code);
        }
      } else {
        setError('Could not save.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={styles.page}><p>Loading profile…</p></div>;

  return (
    <div ref={pageTopRef} style={styles.page}>
      <header style={styles.header}>
        <span style={styles.eyebrow}>Applicant</span>
        <h1 style={styles.title}>Edit profile</h1>
        <p style={styles.subtitle}>Update your personal details and links.</p>
      </header>

      {lock.locked ? (
        <div role="alert" style={styles.lockBanner}>
          <div style={styles.lockBannerText}>
            <strong style={styles.lockBannerTitle}>Profile locked pending review.</strong>
            <span>
              {lock.reason
                ? `Our credibility check flagged a recent change: ${lock.reason}`
                : 'A recent change to your links, work experience, or education was flagged by our credibility check.'}
              {' '}
              Further changes to those fields are blocked until a human reviews your account. You can still update your name, address, and other personal details.
            </span>
          </div>
          <button
            type="button"
            style={styles.openTicketBtn}
            onClick={() => {
              window.location.href = 'mailto:support@impulse.com?subject=Profile%20Lock%20-%20Request%20to%20Unlock';
            }}
          >
            Open a ticket
          </button>
        </div>
      ) : (
        <div role="note" style={styles.warningBanner}>
          Heads up: updates to links, work experience, and education are high-impact profile changes and may be reviewed by automated credibility checks.
        </div>
      )}

      {error && !(lock.locked && error === lock.reason) && (
        <div role="alert" style={styles.errorBanner}>{error}</div>
      )}
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
          <Field
            label="LinkedIn"
            value={linkedinUrl}
            onChange={setLinkedinUrl}
            type="url"
            disabled={lock.locked}
          />
          <Field
            label="Website / Portfolio"
            value={websitePortfolio}
            onChange={setWebsitePortfolio}
            type="url"
            disabled={lock.locked}
          />
          <Field
            label="GitHub / Other"
            value={githubOrOther}
            onChange={setGithubOrOther}
            type="url"
            disabled={lock.locked}
          />
        </Section>

        <Section
          title="Work Experience"
          action={
            !lock.locked && (
              <button type="button" onClick={addWork} style={styles.addBtn}>
                + Add experience
              </button>
            )
          }
        >
          {workExp.length === 0 ? (
            <p style={styles.emptyHint}>
              {lock.locked
                ? 'No work experience on file. Adding new entries is blocked while your profile is under review.'
                : (
                  <>No work experience yet. Click <strong>+ Add experience</strong> to add your first role.</>
                )}
            </p>
          ) : (
            workExp.map((w, i) => (
              <WorkExperienceCard
                key={w._key}
                index={i}
                value={w}
                disabled={lock.locked}
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
            !lock.locked && (
              <button type="button" onClick={addEdu} style={styles.addBtn}>
                + Add education
              </button>
            )
          }
        >
          {education.length === 0 ? (
            <p style={styles.emptyHint}>
              {lock.locked
                ? 'No education on file. Adding new entries is blocked while your profile is under review.'
                : (
                  <>No education yet. Click <strong>+ Add education</strong> to add a school.</>
                )}
            </p>
          ) : (
            education.map((e, i) => (
              <EducationCard
                key={e._key}
                index={i}
                value={e}
                disabled={lock.locked}
                onChange={patch => updateEdu(i, patch)}
                onRemove={() => removeEdu(i)}
                onToggle={() => toggleEdu(i)}
              />
            ))
          )}
        </Section>

        <Section title="Documents">
          <Field
            label="Resume URL"
            type="url"
            value={resumeUrl}
            onChange={setResumeUrl}
            placeholder="https://…"
          />
          <Textarea
            label="Writing samples (one URL per line)"
            value={writingSamples}
            onChange={setWritingSamples}
            rows={2}
          />
          <Textarea
            label="Portfolio / work samples (one URL per line)"
            value={portfolioSamples}
            onChange={setPortfolioSamples}
            rows={2}
          />
          <Textarea
            label="Transcripts (one URL per line)"
            value={transcripts}
            onChange={setTranscripts}
            rows={2}
          />
          <Textarea
            label="Certifications (one URL per line)"
            value={certifications}
            onChange={setCertifications}
            rows={2}
          />
          <Textarea
            label="Other documents (one URL per line)"
            value={otherDocuments}
            onChange={setOtherDocuments}
            rows={2}
          />
        </Section>

        <Section
          title="Skills"
          action={
            <button type="button" onClick={addSkill} style={styles.addBtn}>
              + Add skill
            </button>
          }
        >
          {skills.length === 0 ? (
            <p style={styles.emptyHint}>
              No skills yet. Click <strong>+ Add skill</strong> to add one.
            </p>
          ) : (
            skills.map((s, i) => (
              <div key={s._key} style={styles.inlineRow}>
                <div style={{ ...styles.row, flex: 1 }}>
                  <Field
                    label="Skill"
                    value={s.skill ?? ''}
                    onChange={v => updateSkill(i, { skill: v })}
                  />
                  <Field
                    label="Proficiency"
                    value={s.proficiency ?? ''}
                    onChange={v => updateSkill(i, { proficiency: v })}
                    placeholder="e.g. Advanced"
                  />
                  <Field
                    label="Years"
                    type="number"
                    value={s.years != null ? String(s.years) : ''}
                    onChange={v =>
                      updateSkill(i, { years: v === '' ? null : Number(v) })
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSkill(i)}
                  style={styles.removeBtnInline}
                  aria-label="Remove skill"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </Section>

        <Section
          title="Languages"
          action={
            <button type="button" onClick={addLanguage} style={styles.addBtn}>
              + Add language
            </button>
          }
        >
          {languages.length === 0 ? (
            <p style={styles.emptyHint}>
              No languages yet. Click <strong>+ Add language</strong> to add one.
            </p>
          ) : (
            languages.map((l, i) => (
              <div key={l._key} style={styles.inlineRow}>
                <div style={{ ...styles.row, flex: 1 }}>
                  <Field
                    label="Language"
                    value={l.language ?? ''}
                    onChange={v => updateLanguage(i, { language: v })}
                  />
                  <Field
                    label="Proficiency"
                    value={l.proficiency ?? ''}
                    onChange={v => updateLanguage(i, { proficiency: v })}
                    placeholder="e.g. Native"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLanguage(i)}
                  style={styles.removeBtnInline}
                  aria-label="Remove language"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </Section>

        <Section title="Work eligibility">
          <Checkbox
            label="I am authorized to work in the United States"
            checked={!!legal.us_work_authorization}
            onChange={v => patchLegal({ us_work_authorization: v })}
          />
          <Checkbox
            label="I will need visa sponsorship"
            checked={!!legal.requires_sponsorship}
            onChange={v => patchLegal({ requires_sponsorship: v })}
          />
          {legal.requires_sponsorship && (
            <Field
              label="Visa type"
              value={legal.visa_type ?? ''}
              onChange={v => patchLegal({ visa_type: v })}
              placeholder="e.g. F-1 OPT, H-1B"
            />
          )}
          <Checkbox
            label="I am 18 years of age or older"
            checked={!!legal.over_18}
            onChange={v => patchLegal({ over_18: v })}
          />
          <Field
            label="Security clearance (if any)"
            value={legal.security_clearance ?? ''}
            onChange={v => patchLegal({ security_clearance: v })}
            placeholder="e.g. Secret"
          />
          <Checkbox
            label="I need a reasonable accommodation"
            checked={!!legal.needs_accommodation}
            onChange={v => patchLegal({ needs_accommodation: v })}
          />
        </Section>

        <Section title="EEO (optional)">
          <p style={styles.hint}>
            Voluntary. Used for diversity reporting only and not for hiring decisions.
          </p>
          <div style={styles.row}>
            <Field
              label="Gender"
              value={eeo.gender ?? ''}
              onChange={v => patchEeo({ gender: v })}
            />
            <Field
              label="Race / ethnicity"
              value={eeo.race_ethnicity ?? ''}
              onChange={v => patchEeo({ race_ethnicity: v })}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Disability status"
              value={eeo.disability_status ?? ''}
              onChange={v => patchEeo({ disability_status: v })}
            />
            <Field
              label="Veteran status"
              value={eeo.veteran_status ?? ''}
              onChange={v => patchEeo({ veteran_status: v })}
            />
          </div>
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
  disabled = false,
  onChange,
  onRemove,
  onToggle,
}: {
  index: number;
  value: WorkExpItem;
  disabled?: boolean;
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
            <button
              type="button"
              onClick={onRemove}
              style={styles.removeBtn}
              disabled={disabled}
            >
              Remove
            </button>
          </div>
          <div style={styles.row}>
            <Field
              label="Job title"
              value={value.job_title ?? ''}
              onChange={v => onChange({ job_title: v })}
              disabled={disabled}
            />
            <Field
              label="Company"
              value={value.company ?? ''}
              onChange={v => onChange({ company: v })}
              disabled={disabled}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="City"
              value={value.city ?? ''}
              onChange={v => onChange({ city: v })}
              disabled={disabled}
            />
            <Field
              label="State"
              value={value.state ?? ''}
              onChange={v => onChange({ state: v })}
              disabled={disabled}
            />
            <Select
              label="Employment type"
              value={value.employment_type ?? ''}
              onChange={v => onChange({ employment_type: v })}
              options={EMPLOYMENT_TYPES}
              disabled={disabled}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Start date"
              type="text"
              value={value.start_date ?? ''}
              onChange={v => onChange({ start_date: v })}
              placeholder="YYYY-MM"
              disabled={disabled}
            />
            <Field
              label="End date"
              type="text"
              value={value.current_job ? '' : value.end_date ?? ''}
              onChange={v => onChange({ end_date: v })}
              placeholder="YYYY-MM"
              disabled={disabled || !!value.current_job}
            />
          </div>
          <Checkbox
            label="I currently work here"
            checked={!!value.current_job}
            onChange={v => onChange({ current_job: v, end_date: v ? undefined : value.end_date })}
            disabled={disabled}
          />
          <Textarea
            label="Responsibilities"
            value={value.responsibilities ?? ''}
            onChange={v => onChange({ responsibilities: v })}
            rows={3}
            placeholder="What you owned day-to-day."
            disabled={disabled}
          />
          <Textarea
            label="Key achievements"
            value={value.key_achievements ?? ''}
            onChange={v => onChange({ key_achievements: v })}
            rows={3}
            placeholder="Concrete wins: scope, scale, outcomes."
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function EducationCard({
  index,
  value,
  disabled = false,
  onChange,
  onRemove,
  onToggle,
}: {
  index: number;
  value: EduItem;
  disabled?: boolean;
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
            <button
              type="button"
              onClick={onRemove}
              style={styles.removeBtn}
              disabled={disabled}
            >
              Remove
            </button>
          </div>
          <Field
            label="School"
            value={value.school ?? ''}
            onChange={v => onChange({ school: v })}
            disabled={disabled}
          />
          <div style={styles.row}>
            <Field
              label="City"
              value={value.city ?? ''}
              onChange={v => onChange({ city: v })}
              disabled={disabled}
            />
            <Field
              label="State"
              value={value.state ?? ''}
              onChange={v => onChange({ state: v })}
              disabled={disabled}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Degree"
              value={value.degree ?? ''}
              onChange={v => onChange({ degree: v })}
              placeholder="e.g. B.S."
              disabled={disabled}
            />
            <Field
              label="Major"
              value={value.major ?? ''}
              onChange={v => onChange({ major: v })}
              disabled={disabled}
            />
            <Field
              label="Minor"
              value={value.minor ?? ''}
              onChange={v => onChange({ minor: v })}
              disabled={disabled}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Start date"
              type="text"
              value={value.start_date ?? ''}
              onChange={v => onChange({ start_date: v })}
              placeholder="YYYY-MM"
              disabled={disabled}
            />
            <Field
              label={value.graduated ? 'Graduation date' : 'Expected graduation'}
              type="text"
              value={value.graduation_date ?? ''}
              onChange={v => onChange({ graduation_date: v })}
              placeholder="YYYY-MM"
              disabled={disabled}
            />
          </div>
          <Checkbox
            label="Graduated"
            checked={!!value.graduated}
            onChange={v => onChange({ graduated: v })}
            disabled={disabled}
          />
          <div style={styles.row}>
            <Field
              label="GPA"
              value={value.gpa ?? ''}
              onChange={v => onChange({ gpa: v })}
              placeholder="e.g. 3.8"
              disabled={disabled}
            />
            <Field
              label="Honors"
              value={value.honors ?? ''}
              onChange={v => onChange({ honors: v })}
              placeholder="e.g. cum laude"
              disabled={disabled}
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
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function ReferenceCard({
  index,
  value,
  onChange,
  onRemove,
  onToggle,
}: {
  index: number;
  value: ReferenceItem;
  onChange: (patch: Partial<ReferenceInput>) => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const expanded = value._expanded;
  const name = value.name?.trim();
  const heading = name || `Reference #${index + 1}`;
  const subBits = [value.relationship, value.company, value.title]
    .map(s => (s ?? '').trim())
    .filter(s => s !== '');

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
            <button
              type="button"
              onClick={onRemove}
              style={styles.removeBtn}
            >
              Remove
            </button>
          </div>
          <div style={styles.row}>
            <Field
              label="Name"
              value={value.name ?? ''}
              onChange={v => onChange({ name: v })}
            />
            <Field
              label="Relationship"
              value={value.relationship ?? ''}
              onChange={v => onChange({ relationship: v })}
              placeholder="e.g. Former Manager"
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Company"
              value={value.company ?? ''}
              onChange={v => onChange({ company: v })}
            />
            <Field
              label="Title"
              value={value.title ?? ''}
              onChange={v => onChange({ title: v })}
            />
          </div>
          <div style={styles.row}>
            <Field
              label="Phone"
              type="tel"
              value={value.phone ?? ''}
              onChange={v => onChange({ phone: v })}
            />
            <Field
              label="Email"
              type="email"
              value={value.email ?? ''}
              onChange={v => onChange({ email: v })}
            />
          </div>
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  onFocus?: () => void;
  disabled?: boolean;
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
        disabled={disabled}
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  onFocus?: () => void;
  disabled?: boolean;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={disabled}
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
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  onFocus?: () => void;
  disabled?: boolean;
}) {
  return (
    <label style={styles.checkboxRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        onFocus={onFocus}
        disabled={disabled}
        style={styles.checkbox}
      />
      <span style={styles.checkboxLabel}>{label}</span>
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { flex: 1, width: '100%', boxSizing: 'border-box', padding: '40px 32px 64px', display: 'flex', flexDirection: 'column', gap: 24, textAlign: 'left', maxWidth: 880 },
  header: { display: 'flex', flexDirection: 'column', gap: 6 },
  eyebrow: { display: 'inline-block', width: 'fit-content', padding: '4px 12px', fontSize: 12, fontWeight: 500, color: 'var(--text-h)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 999, letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { margin: '8px 0 4px', fontSize: 32, lineHeight: 1.1, color: 'var(--text-h)', letterSpacing: '-0.5px' },
  subtitle: { margin: 0, color: 'var(--text)', fontSize: 15, maxWidth: 640 },
  errorBanner: { padding: '10px 14px', fontSize: 14, color: 'var(--danger-strong)', background: 'var(--danger-strong-bg)', border: '1px solid var(--danger-strong-border)', borderRadius: 10 },
  warningBanner: { padding: '10px 14px', fontSize: 14, color: 'var(--warning)', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 10 },
  saveWarningBanner: { padding: '10px 14px', fontSize: 13, color: 'var(--warning)', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 10 },
  lockBanner: { display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 16px', fontSize: 14, color: 'var(--danger-strong)', background: 'var(--danger-strong-bg)', border: '1px solid var(--danger-strong-border)', borderRadius: 12, flexWrap: 'wrap' },
  lockBannerText: { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 320px', minWidth: 0, lineHeight: 1.5 },
  lockBannerTitle: { color: 'var(--danger-strong)', fontSize: 15 },
  openTicketBtn: { padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--danger-strong)', border: '1px solid var(--danger-strong)', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  successBanner: { padding: '10px 14px', fontSize: 14, color: 'var(--success)', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10 },
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
  removeBtn: { padding: '6px 10px', fontSize: 12, fontWeight: 500, color: 'var(--danger)', background: 'transparent', border: '1px solid var(--danger-border)', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit' },
  removeBtnInline: { width: 32, height: 32, padding: 0, fontSize: 18, lineHeight: 1, fontWeight: 600, color: 'var(--danger)', background: 'transparent', border: '1px solid var(--danger-border)', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, alignSelf: 'flex-end', marginBottom: 4 },
  inlineRow: { display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%' },
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
