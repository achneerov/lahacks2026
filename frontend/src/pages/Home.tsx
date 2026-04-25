import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Home() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div style={styles.container}>Loading…</div>;

  if (!user) {
    return (
      <div style={styles.container}>
        <h1>Welcome</h1>
        <p>
          <Link to="/login">Log in</Link> or <Link to="/register">register</Link> to continue.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1>Hi, {user.username}</h1>
      <p>Role: {user.role}</p>
      <p>Email: {user.email}</p>
      <button type="button" onClick={logout} style={styles.button}>
        Log out
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 420, margin: '40px auto', padding: 24, fontFamily: 'system-ui' },
  button: {
    padding: '10px 16px',
    fontSize: 16,
    background: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
};
