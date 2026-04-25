const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

export type Role = 'Applicant' | 'Recruiter' | 'Agent';
export type SignupRole = 'Applicant' | 'Recruiter';

export interface User {
  id: number;
  role: Role;
  email: string;
  username: string;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type WorldIdResult = unknown;

export interface WorldIdContext {
  app_id: `app_${string}`;
  action: string;
  rp_context: {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  detail?: string;
  constructor(status: number, code: string, detail?: string) {
    super(detail || code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'request_failed', data.detail);
  }
  return data as T;
}

export interface SignupBasicsResponse {
  ok: true;
  email: string;
  username: string;
  role: SignupRole;
}

export const api = {
  worldIdContext: () => request<WorldIdContext>('/api/auth/world-id-context'),

  signupCheckBasics: (body: {
    email: string;
    password: string;
    username: string;
    role: SignupRole;
  }) =>
    request<SignupBasicsResponse>('/api/auth/signup/check-basics', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  register: (body: {
    email: string;
    password: string;
    username: string;
    role: Role;
    world_id_result: WorldIdResult;
  }) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  me: (token: string) => request<{ user: User }>('/api/auth/me', {}, token),
};
