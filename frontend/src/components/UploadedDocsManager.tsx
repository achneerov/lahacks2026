import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  api,
  ApiError,
  type ApplicantDocument,
  type ApplicantDocumentKind,
} from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const KIND_OPTIONS: { value: ApplicantDocumentKind; label: string }[] = [
  { value: 'transcript', label: 'School transcript' },
  { value: 'letter_of_recommendation', label: 'Letter of recommendation' },
  { value: 'other', label: 'Other' },
];

function kindLabel(kind: ApplicantDocumentKind): string {
  return KIND_OPTIONS.find((o) => o.value === kind)?.label || kind;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

interface Props {
  variant?: 'card' | 'plain';
}

export default function UploadedDocsManager({ variant = 'card' }: Props) {
  const { token } = useAuth();
  const [docs, setDocs] = useState<ApplicantDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<ApplicantDocumentKind>('transcript');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    api
      .applicantListDocuments(token)
      .then((r) => {
        if (alive) setDocs(r.documents);
      })
      .catch((e) => {
        if (alive) setError(e instanceof ApiError ? e.detail || e.code : 'Failed to load documents.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function onUpload() {
    if (!token || !file) return;
    setError(null);
    setUploading(true);
    try {
      const { document } = await api.applicantUploadDocument(token, file, kind, title);
      setDocs((prev) => [document, ...prev]);
      setFile(null);
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'only_pdf') setError('Only PDF files are supported.');
        else if (e.code === 'file_too_large') setError(e.detail || 'File is too large.');
        else setError(e.detail || e.code);
      } else {
        setError('Upload failed.');
      }
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: number) {
    if (!token) return;
    setError(null);
    setDeletingId(id);
    try {
      await api.applicantDeleteDocument(token, id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail || e.code : 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  async function onOpen(id: number) {
    if (!token) return;
    try {
      await api.applicantOpenDocument(token, id);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail || e.code : 'Could not open file.');
    }
  }

  const wrapStyle = variant === 'card' ? styles.card : styles.plain;

  return (
    <div style={wrapStyle}>
      <p style={styles.hint}>
        Upload PDFs of your school transcripts and letters of recommendation. The
        text inside is parsed so the AI agent that represents you in
        applications can reference them.
      </p>

      <div style={styles.uploadRow}>
        <label style={styles.field}>
          <span style={styles.label}>Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ApplicantDocumentKind)}
            style={styles.input}
            disabled={uploading}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...styles.field, flex: 2 }}>
          <span style={styles.label}>Label (optional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. MIT undergraduate transcript"
            style={styles.input}
            maxLength={200}
            disabled={uploading}
          />
        </label>
      </div>

      <div style={styles.fileRow}>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={uploading}
          style={styles.fileInput}
        />
        <button
          type="button"
          onClick={onUpload}
          disabled={!file || uploading}
          style={{
            ...styles.uploadBtn,
            ...(!file || uploading ? styles.uploadBtnDisabled : null),
          }}
        >
          {uploading ? 'Uploading…' : 'Upload PDF'}
        </button>
      </div>

      {error && <div role="alert" style={styles.error}>{error}</div>}

      <div style={styles.list}>
        {loading ? (
          <p style={styles.empty}>Loading…</p>
        ) : docs.length === 0 ? (
          <p style={styles.empty}>No documents uploaded yet.</p>
        ) : (
          docs.map((d) => (
            <div key={d.id} style={styles.docRow}>
              <div style={styles.docInfo}>
                <div style={styles.docTitle}>
                  {d.title || d.filename}
                  {!d.has_text && (
                    <span style={styles.warnBadge} title="The PDF could not be text-extracted; the AI won't be able to read it.">
                      no text
                    </span>
                  )}
                </div>
                <div style={styles.docMeta}>
                  {kindLabel(d.kind)} · {d.filename} · {fmtBytes(d.byte_size)}
                </div>
              </div>
              <div style={styles.docActions}>
                <button type="button" onClick={() => onOpen(d.id)} style={styles.linkBtn}>
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(d.id)}
                  disabled={deletingId === d.id}
                  style={styles.deleteBtn}
                >
                  {deletingId === d.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  plain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  hint: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text, #475569)',
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
    color: 'var(--text, #475569)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text-h, #0f172a)',
    background: 'var(--bg, #fff)',
    border: '1px solid var(--border, #cbd5e1)',
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
  uploadBtn: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent, #0f172a)',
    border: '1px solid var(--accent, #0f172a)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  uploadBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    padding: '10px 12px',
    fontSize: 13,
    color: '#b00020',
    background: 'rgba(176, 0, 32, 0.08)',
    border: '1px solid rgba(176, 0, 32, 0.25)',
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
    color: 'var(--text, #64748b)',
    padding: 12,
    border: '1px dashed var(--border, #cbd5e1)',
    borderRadius: 10,
    textAlign: 'center',
  },
  docRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 10,
    background: 'var(--bg, #fff)',
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
    color: 'var(--text-h, #0f172a)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  docMeta: {
    fontSize: 12,
    color: 'var(--text, #64748b)',
  },
  warnBadge: {
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    color: '#7a5600',
    background: 'rgba(255, 184, 0, 0.18)',
    border: '1px solid rgba(255, 184, 0, 0.5)',
    borderRadius: 999,
  },
  docActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  linkBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent, #0f172a)',
    background: 'transparent',
    border: '1px solid var(--accent-border, #cbd5e1)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  deleteBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#9a1a1a',
    background: 'transparent',
    border: '1px solid rgba(154, 26, 26, 0.45)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
