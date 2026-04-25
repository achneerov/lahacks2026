import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../lib/api';

interface RequireRoleProps {
  role: Role;
  children: ReactNode;
}

export default function RequireRole({ role, children }: RequireRoleProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text)' }}>Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
