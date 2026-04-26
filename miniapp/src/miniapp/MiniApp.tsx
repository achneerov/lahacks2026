'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import {
  api,
  API_BASE_URL,
  type ApplicantFeaturedJob,
  type User,
} from '@/desktop/lib/api';
import { AUTH_STORAGE_KEY } from '@/desktop/auth/AuthContext';

interface WalletNonce {
  nonce: string;
  expires_at: number;
  signature: string;
}

async function fetchNonce(): Promise<WalletNonce> {
  const res = await fetch(`${API_BASE_URL}/api/auth/wallet-nonce`);
  if (!res.ok) throw new Error('nonce_failed');
  return res.json();
}

async function walletLogin(payload: {
  nonce: string;
  expires_at: number;
  signature: string;
  finalPayload: unknown;
}): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/wallet-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'login_failed');
  return data as { token: string; user: User };
}

export default function MiniApp() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(AUTH_STORAGE_KEY);
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const attempted = useRef(false);

  const handleLogin = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const nonceRes = await fetchNonce();
      const result = await MiniKit.walletAuth({
        nonce: nonceRes.nonce,
        expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
        statement: 'Sign in to Impulse.',
      });
      if (!result?.data?.address) {
        throw new Error('wallet_auth_failed');
      }
      const { token: jwt, user: u } = await walletLogin({
        nonce: nonceRes.nonce,
        expires_at: nonceRes.expires_at,
        signature: nonceRes.signature,
        finalPayload: {
          address: result.data.address,
          message: result.data.message,
          signature: result.data.signature,
        },
      });
      localStorage.setItem(AUTH_STORAGE_KEY, jwt);
      setToken(jwt);
      setUser(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }, [pending]);

  // Auto-restore from existing token, else auto-login.
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    if (token) {
      api
        .me(token)
        .then(({ user: u }) => setUser(u))
        .catch(() => {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setToken(null);
          handleLogin();
        });
    } else {
      handleLogin();
    }
  }, [token, handleLogin]);

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 gap-4">
        <h1 className="text-xl font-semibold">Impulse</h1>
        <p className="text-sm opacity-70 text-center">
          Sign in with your World App wallet to continue.
        </p>
        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}
        <LiveFeedback
          label={{
            failed: 'Failed to sign in',
            pending: 'Signing in',
            success: 'Signed in',
          }}
          state={pending ? 'pending' : error ? 'failed' : undefined}
        >
          <Button
            onClick={handleLogin}
            disabled={pending}
            size="lg"
            variant="primary"
          >
            Sign in with World
          </Button>
        </LiveFeedback>
      </main>
    );
  }

  return <MiniAppHome user={user} token={token!} onLogout={() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setToken(null);
    setUser(null);
    attempted.current = false;
  }} />;
}

function MiniAppHome({
  user,
  token,
  onLogout,
}: {
  user: User;
  token: string;
  onLogout: () => void;
}) {
  const [jobs, setJobs] = useState<ApplicantFeaturedJob[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (user.role !== 'Applicant') return;
    api
      .applicantHome(token)
      .then((res) => setJobs(res.featured_jobs))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [token, user.role]);

  return (
    <main className="flex min-h-screen flex-col p-4 gap-4 max-w-md mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60">
            Signed in as
          </p>
          <h1 className="text-lg font-semibold">{user.username}</h1>
          <p className="text-xs opacity-60">{user.role}</p>
        </div>
        <Button onClick={onLogout} size="sm" variant="secondary">
          Sign out
        </Button>
      </header>

      {user.role !== 'Applicant' ? (
        <section className="rounded-xl border p-4">
          <p className="text-sm">
            Recruiter accounts are managed on the desktop site.
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">
            Featured jobs
          </h2>
          {loadError && (
            <p className="text-sm text-red-600">{loadError}</p>
          )}
          {!jobs && !loadError && (
            <p className="text-sm opacity-60">Loading…</p>
          )}
          {jobs && jobs.length === 0 && (
            <p className="text-sm opacity-60">No jobs yet.</p>
          )}
          {jobs?.map((j) => (
            <article
              key={j.id}
              className="rounded-xl border p-3 flex flex-col gap-1"
            >
              <h3 className="font-semibold">{j.title}</h3>
              {j.company && (
                <p className="text-sm opacity-70">{j.company}</p>
              )}
              {j.location && (
                <p className="text-xs opacity-60">
                  {j.location}
                  {j.remote ? ' · Remote' : ''}
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
