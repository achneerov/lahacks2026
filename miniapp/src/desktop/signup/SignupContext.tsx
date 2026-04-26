import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  ApplicantDocumentKind,
  ApplicantProfileInput,
  SignupRole,
  WorldIdResult,
} from '../lib/api';

export interface SignupBasics {
  email: string;
  username: string;
  role: SignupRole;
}

export interface PendingDocument {
  id: string;
  file: File;
  kind: ApplicantDocumentKind;
  title: string;
}

interface SignupState {
  basics: SignupBasics | null;
  password: string | null;
  worldIdResult: WorldIdResult | null;
  applicantProfile: ApplicantProfileInput | null;
  pendingDocuments: PendingDocument[];
  setBasics: (basics: SignupBasics) => void;
  setPassword: (password: string) => void;
  setWorldIdResult: (result: WorldIdResult | null) => void;
  setApplicantProfile: (profile: ApplicantProfileInput | null) => void;
  addPendingDocument: (doc: PendingDocument) => void;
  removePendingDocument: (id: string) => void;
  reset: () => void;
}

const SignupCtx = createContext<SignupState | null>(null);
const STORAGE_KEY = 'signup_basics';
const PROFILE_STORAGE_KEY = 'signup_applicant_profile';

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

function loadApplicantProfile(): ApplicantProfileInput | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ApplicantProfileInput;
  } catch {
    return null;
  }
}

export function SignupProvider({ children }: { children: ReactNode }) {
  const [basics, setBasicsState] = useState<SignupBasics | null>(() => loadBasics());
  const [password, setPasswordState] = useState<string | null>(null);
  const [worldIdResult, setWorldIdResultState] = useState<WorldIdResult | null>(null);
  const [applicantProfile, setApplicantProfileState] = useState<ApplicantProfileInput | null>(
    () => loadApplicantProfile()
  );
  const [pendingDocuments, setPendingDocumentsState] = useState<PendingDocument[]>([]);

  useEffect(() => {
    if (basics) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(basics));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [basics]);

  useEffect(() => {
    if (applicantProfile) {
      sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(applicantProfile));
    } else {
      sessionStorage.removeItem(PROFILE_STORAGE_KEY);
    }
  }, [applicantProfile]);

  const setBasics = useCallback((next: SignupBasics) => setBasicsState(next), []);
  const setPassword = useCallback((next: string) => setPasswordState(next), []);
  const setWorldIdResult = useCallback(
    (next: WorldIdResult | null) => setWorldIdResultState(next),
    []
  );
  const setApplicantProfile = useCallback(
    (next: ApplicantProfileInput | null) => setApplicantProfileState(next),
    []
  );
  const addPendingDocument = useCallback(
    (doc: PendingDocument) => setPendingDocumentsState(prev => [...prev, doc]),
    []
  );
  const removePendingDocument = useCallback(
    (id: string) => setPendingDocumentsState(prev => prev.filter(d => d.id !== id)),
    []
  );
  const reset = useCallback(() => {
    setBasicsState(null);
    setPasswordState(null);
    setWorldIdResultState(null);
    setApplicantProfileState(null);
    setPendingDocumentsState([]);
  }, []);

  const value = useMemo(
    () => ({
      basics,
      password,
      worldIdResult,
      applicantProfile,
      pendingDocuments,
      setBasics,
      setPassword,
      setWorldIdResult,
      setApplicantProfile,
      addPendingDocument,
      removePendingDocument,
      reset,
    }),
    [
      basics,
      password,
      worldIdResult,
      applicantProfile,
      pendingDocuments,
      setBasics,
      setPassword,
      setWorldIdResult,
      setApplicantProfile,
      addPendingDocument,
      removePendingDocument,
      reset,
    ]
  );

  return <SignupCtx.Provider value={value}>{children}</SignupCtx.Provider>;
}

export function useSignup() {
  const ctx = useContext(SignupCtx);
  if (!ctx) throw new Error('useSignup must be used inside <SignupProvider>');
  return ctx;
}
