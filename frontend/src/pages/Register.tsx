import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  IDKitRequestWidget,
  CredentialRequest,
  type IDKitResult,
} from '@worldcoin/idkit';
import { api, ApiError, type Role, type WorldIdContext } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const ROLES: Role[] = ['Applicant', 'Recruiter', 'Agent'];

export default function Register() {
  const nav = useNavigate();
  const { setAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('Applicant');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [ctx, setCtx] = useState<WorldIdContext | null>(null);
  const [open, setOpen] = useState(false);

  const formValid =
    email.trim() && password.length >= 8 && username.trim() && ROLES.includes(role);

  async function startVerification() {
    setError(null);
    try {
      const fresh = await api.worldIdContext();
      setCtx(fresh);
      setOpen(true);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `Could not start World ID flow: ${e.detail || e.code}`
          : 'Could not start World ID flow.'
      );
    }
  }

  async function handleWorldIdSuccess(result: IDKitResult) {
    setSubmitting(true);
    try {
      const { token, user } = await api.register({
        email: email.trim(),
        password,
        username: username.trim(),
        role,
        world_id_result: result,
      });
      setAuth(token, user);
      nav('/');
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? errorMessage(e.code, e.detail)
          : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1>Register</h1>

      <form onSubmit={(e) => e.preventDefault()} style={styles.form}>
        <label style={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Password (min 8 chars)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={styles.input}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={startVerification}
          disabled={!formValid || submitting}
          style={styles.button}
        >
          {submitting ? 'Creating account…' : 'Verify with World ID & Register'}
        </button>

        {error && <p style={styles.error}>{error}</p>}
      </form>

      {ctx && (
        <IDKitRequestWidget
          app_id={ctx.app_id}
          action={ctx.action}
          rp_context={ctx.rp_context}
          allow_legacy_proofs={true}
          constraints={CredentialRequest('proof_of_human')}
          open={open}
          onOpenChange={setOpen}
          onSuccess={handleWorldIdSuccess}
        />
      )}

      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

function errorMessage(code: string, detail?: string): string {
  switch (code) {
    case 'email_taken':
      return 'That email is already registered.';
    case 'username_taken':
      return 'That username is taken.';
    case 'world_id_already_used':
      return 'This World ID is already linked to another account.';
    case 'world_id_failed':
      return `World ID verification failed${detail ? `: ${detail}` : ''}.`;
    case 'password_too_short':
      return 'Password must be at least 8 characters.';
    case 'invalid_role':
      return 'Please choose a valid role.';
    case 'missing_fields':
      return 'Please fill out all fields.';
    default:
      return detail || code;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 420, margin: '40px auto', padding: 24, fontFamily: 'system-ui' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 },
  input: { padding: 8, fontSize: 16, borderRadius: 4, border: '1px solid #ccc' },
  button: {
    padding: '10px 16px',
    fontSize: 16,
    background: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  error: { color: '#c00', margin: 0 },
};
