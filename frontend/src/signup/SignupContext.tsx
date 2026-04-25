import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SignupRole } from '../lib/api';

export interface SignupBasics {
  email: string;
  username: string;
  role: SignupRole;
}

interface SignupState {
  basics: SignupBasics | null;
  password: string | null;
  setBasics: (basics: SignupBasics) => void;
  setPassword: (password: string) => void;
  reset: () => void;
}

const SignupCtx = createContext<SignupState | null>(null);
const STORAGE_KEY = 'signup_basics';

function loadBasics(): SignupBasics | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SignupBasics;
    if (
      parsed &&
      typeof parsed.email === 'string' &&
      typeof parsed.username === 'string' &&
      (parsed.role === 'Applicant' || parsed.role === 'Recruiter')
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function SignupProvider({ children }: { children: ReactNode }) {
  const [basics, setBasicsState] = useState<SignupBasics | null>(() => loadBasics());
  const [password, setPasswordState] = useState<string | null>(null);

  useEffect(() => {
    if (basics) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(basics));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [basics]);

  const setBasics = useCallback((next: SignupBasics) => setBasicsState(next), []);
  const setPassword = useCallback((next: string) => setPasswordState(next), []);
  const reset = useCallback(() => {
    setBasicsState(null);
    setPasswordState(null);
  }, []);

  const value = useMemo(
    () => ({ basics, password, setBasics, setPassword, reset }),
    [basics, password, setBasics, setPassword, reset]
  );

  return <SignupCtx.Provider value={value}>{children}</SignupCtx.Provider>;
}

export function useSignup() {
  const ctx = useContext(SignupCtx);
  if (!ctx) throw new Error('useSignup must be used inside <SignupProvider>');
  return ctx;
}
