import { useAuth } from '../auth/AuthContext';
import AppShell from '../layouts/AppShell';
import Landing from './Landing';
import ApplicantHome from './applicant/ApplicantHome';
import RecruiterHome from './recruiter/RecruiterHome';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text)' }}>Loading…</div>;
  }

  if (!user) return <Landing />;

  if (user.role === 'Applicant') {
    return (
      <AppShell>
        <ApplicantHome />
      </AppShell>
    );
  }

  if (user.role === 'Recruiter') {
    return (
      <AppShell>
        <RecruiterHome />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ padding: 32 }}>
        <h1>Hi, {user.username}</h1>
        <p>Role: {user.role}</p>
        <p>Email: {user.email}</p>
      </div>
    </AppShell>
  );
}
