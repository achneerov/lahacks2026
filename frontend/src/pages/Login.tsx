import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const nav = useNavigate();
  const { setAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, user } = await api.login({ email: email.trim(), password });
      setAuth(token, user);
      nav('/');
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'invalid_credentials'
          ? 'Invalid email or password.'
          : 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <h1>Log in</h1>
      <form onSubmit={onSubmit} style={styles.form}>
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
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
        </label>

        <button type="submit" disabled={submitting} style={styles.button}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        {error && <p style={styles.error}>{error}</p>}
      </form>

      <p>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
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
