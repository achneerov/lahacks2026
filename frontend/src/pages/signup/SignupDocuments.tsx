import { useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError, api, type ApplicantDocumentKind } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useSignup } from '../../signup/SignupContext';

const KIND_OPTIONS: { value: ApplicantDocumentKind; label: string }[] = [
  { value: 'transcript', label: 'School transcript' },
  { value: 'letter_of_recommendation', label: 'Letter of recommendation' },
  { value: 'other', label: 'Other' },
];

const MAX_BYTES = 10 * 1024 * 1024;

function kindLabel(kind: ApplicantDocumentKind): string {
  return KIND_OPTIONS.find(o => o.value === kind)?.label || kind;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(code: string, detail?: string): string {
  switch (code) {
    case 'email_taken': return 'That email is already registered.';
    case 'username_taken': return 'That username is taken.';
    case 'world_id_already_used': return 'This World ID has already been used to register an account.';
    case 'world_id_failed': return detail || 'World ID verification failed. Please try step 2 again.';
    case 'invalid_profile':
    case 'invalid_profile_url': return detail || 'One of the profile fields is invalid.';
    case 'missing_fields': return 'Some required fields are missing.';
    default: return detail || 'Something went wrong. Please try again.';
  }
}

export default function SignupDocuments() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const {
    basics,
    password,
    worldIdResult,
    applicantProfile,
    pendingDocuments,
    addPendingDocument,
    removePendingDocument,
    reset,
  } = useSignup();

  const [kind, setKind] = useState<ApplicantDocumentKind>('transcript');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const completedRef = useRef(false);

  if (!completedRef.current) {
    if (!basics) return <Navigate to="/signup" replace />;
    if (basics.role !== 'Applicant') return <Navigate to="/signup/world-id" replace />;
    if (!password) return <Navigate to="/signup" replace />;
    if (!worldIdResult) return <Navigate to="/signup/world-id" replace />;
    if (!applicantProfile) return <Navigate to="/signup/profile" replace />;
  }

  function onAdd() {
    if (!file) return;
    setError(null);
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setError('Only PDF files are supported.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That file is over 10 MB. Please pick a smaller PDF.');
      return;
    }
    addPendingDocument({ id: newId(), file, kind, title: title.trim() });
    setFile(null);
    setTitle('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function createAccount() {
    if (submitting) return;
    if (!basics || !password || !worldIdResult || !applicantProfile) {
      setError('Your signup session is incomplete. Please go back and finish the previous steps.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { token, user } = await api.register({
        email: basics.email,
        username: basics.username,
        password,
        role: basics.role,
        world_id_result: worldIdResult,
        profile: applicantProfile,
      });
      completedRef.current = true;
      setAuth(token, user);
      for (const doc of pendingDocuments) {
        try {
          await api.applicantUploadDocument(token, doc.file, doc.kind, doc.title);
        } catch (uploadErr) {
          console.warn('[signup] failed to upload pending document', doc.file.name, uploadErr);
        }
      }
      reset();
      nav('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? errorMessage(err.code, err.detail)
          : 'Something went wrong. Please try again.'
      );
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
              <span style={layout.logoRingMid}></span>
              <span style={layout.logoRingInner}></span>
            </div>
            <span style={layout.logoText}>Impulse</span>
          </div>
          <div style={layout.heroTextContainer}>
            <h1 style={layout.heroTitle}>Give your AI agent something to cite.</h1>
            <p style={layout.heroSubtitle}>
              Upload your school transcripts and letters of recommendation as
              PDFs. We extract the text so the agent that represents you in
              applications can quote them by name — not invent them.
            </p>
          </div>
          <div style={layout.statsRow}>
            <div>
              <div style={layout.statLabel}>PARSED LOCALLY</div>
              <div style={layout.statValue}>Text only</div>
            </div>
            <div>
              <div style={layout.statLabel}>YOU CONTROL</div>
              <div style={layout.statValue}>Add or remove anytime</div>
            </div>
          </div>
        </div>
      </div>

      <div style={layout.rightPanel}>
        <div style={layout.rightContentBox}>
          <div style={s.panelHeader}>
            <span style={s.panelStepCounter}>Step 4 of 4 · Final · Optional</span>
            <div style={s.stepSegments} aria-hidden>
              <div style={{ ...s.stepSeg, ...s.stepSegOn }} />
              <div style={{ ...s.stepSeg, ...s.stepSegOn }} />
              <div style={{ ...s.stepSeg, ...s.stepSegOn }} />
              <div style={{ ...s.stepSeg, ...s.stepSegCurrent }} />
            </div>
            <h1 style={s.panelTitle}>Upload supporting documents</h1>
            <p style={s.panelSubtitle}>
              Optional. Add transcripts or letters of recommendation, then
              create your account. You can always upload more later from your
              profile.
            </p>
          </div>

          <div style={s.body}>
            <p style={s.hint}>
              PDFs only, up to 10 MB each. Files are uploaded after your
              account is created.
            </p>

            <div style={s.uploadRow}>
              <label style={s.field}>
                <span style={s.label}>TYPE</span>
                <select
                  value={kind}
                  onChange={e => setKind(e.target.value as ApplicantDocumentKind)}
                  style={s.input}
                  disabled={submitting}
                >
                  {KIND_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ ...s.field, flex: 2 }}>
                <span style={s.label}>LABEL (OPTIONAL)</span>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. MIT undergraduate transcript"
                  maxLength={200}
                  style={s.input}
                  disabled={submitting}
                />
              </label>
            </div>

            <div style={s.fileRow}>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={e => setFile(e.target.files?.[0] || null)}
                style={s.fileInput}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={onAdd}
                disabled={!file || submitting}
                style={{ ...s.addBtn, ...((!file || submitting) ? s.addBtnDisabled : null) }}
              >
                Add file
              </button>
            </div>

            {error && <div role="alert" style={s.error}>{error}</div>}

            <div style={s.list}>
              {pendingDocuments.length === 0 ? (
                <p style={s.empty}>No documents added yet.</p>
              ) : (
                pendingDocuments.map(d => (
                  <div key={d.id} style={s.docRow}>
                    <div style={s.docInfo}>
                      <div style={s.docTitle}>{d.title || d.file.name}</div>
                      <div style={s.docMeta}>
                        {kindLabel(d.kind)} · {d.file.name} · {fmtBytes(d.file.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingDocument(d.id)}
                      style={s.removeBtn}
                      disabled={submitting}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={s.navRow}>
            <Link
              to="/signup/profile"
              style={{ ...s.backLink, ...(submitting ? s.backLinkDisabled : null) }}
              onClick={e => { if (submitting) e.preventDefault(); }}
            >
              ← Profile
            </Link>
            <button
              type="button"
              style={{ ...s.primary, ...s.primaryFlex, ...(submitting ? s.primaryDisabled : null) }}
              onClick={createAccount}
              disabled={submitting}
            >
              {submitting ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const layout: Record<string, CSSProperties> = {
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
    backgroundColor: 'var(--brand-ink)',
    opacity: 0.78,
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
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRingMid: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    position: 'absolute',
    boxSizing: 'border-box',
  },
  logoRingInner: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    position: 'absolute',
    boxSizing: 'border-box',
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
    color: 'rgba(255,255,255,0.82)',
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
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  statValue: { fontSize: '20px', fontWeight: 400 },
  rightPanel: {
    flex: '1',
    minWidth: 0,
    minHeight: 0,
    backgroundColor: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderLeft: '1px solid var(--border)',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  rightContentBox: {
    width: '100%',
    maxWidth: '600px',
    padding: '40px 32px 56px',
    boxSizing: 'border-box',
    minHeight: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
};

const s: Record<string, CSSProperties> = {
  panelHeader: { marginBottom: 18 },
  panelStepCounter: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  stepSegments: { display: 'flex', gap: 6, marginBottom: 12 },
  stepSeg: { flex: 1, height: 3, background: 'var(--border)', borderRadius: 2 },
  stepSegOn: { background: 'var(--brand-ink)' },
  stepSegCurrent: { background: 'var(--accent)' },
  panelTitle: {
    fontSize: '22px',
    fontWeight: 500,
    color: 'var(--text-h)',
    margin: '0 0 6px',
    letterSpacing: '-0.3px',
  },
  panelSubtitle: {
    fontSize: '14px',
    color: 'var(--text)',
    margin: 0,
    lineHeight: 1.55,
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '20px 22px',
    marginBottom: 16,
    overflow: 'auto',
  },
  hint: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text)',
    lineHeight: 1.5,
  },
  uploadRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
    minWidth: 160,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
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
    width: '100%',
    boxSizing: 'border-box',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  fileInput: {
    flex: 1,
    minWidth: 200,
    fontSize: 13,
    fontFamily: 'inherit',
  },
  addBtn: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--brand-ink)',
    border: '1px solid var(--brand-ink)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  addBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  error: {
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
    borderRadius: 10,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  empty: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text)',
    padding: 12,
    border: '1px dashed var(--border)',
    borderRadius: 10,
    textAlign: 'center',
  },
  docRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg)',
  },
  docInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  docMeta: {
    fontSize: 12,
    color: 'var(--text)',
  },
  removeBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--danger)',
    background: 'transparent',
    border: '1px solid var(--danger-border)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  navRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'stretch',
    marginTop: 'auto',
    paddingTop: 14,
  },
  backLink: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--accent)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    padding: '12px 10px',
  },
  backLinkDisabled: {
    pointerEvents: 'none',
    opacity: 0.5,
  },
  primary: {
    appearance: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '16px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    background: 'var(--brand-ink)',
    borderRadius: '999px',
    letterSpacing: '0.5px',
    fontFamily: 'inherit',
  },
  primaryDisabled: { cursor: 'not-allowed', opacity: 0.5 },
  primaryFlex: { flex: 1 },
};
