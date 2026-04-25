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

export interface ApplicantProfileInput {
  full_name?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  headline?: string;
  bio?: string;
  resume_url?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  years_experience?: number | null;
}

export interface ApplicantProfile {
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  headline: string | null;
  bio: string | null;
  resume_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  years_experience: number | null;
  updated_at: string | null;
}

export interface ApplicantProfileResponse {
  profile: ApplicantProfile;
}

export interface ApplicantProfileReviewResponse {
  warnings: Partial<Record<keyof ApplicantProfileInput, string>>;
  source: 'llm' | 'heuristic';
}

export interface ApplicantHomeStats {
  profile_completeness: number;
  active_conversations: number;
  messages_received: number;
  open_jobs: number;
}

export interface ApplicantRecentConversation {
  id: number;
  job_posting_id: number | null;
  job_title: string | null;
  other_party: { id: number; username: string; role: Role | string };
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface ApplicantFeaturedJob {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  remote: 0 | 1;
  employment_type: 'FullTime' | 'PartTime' | 'Contract' | 'Internship' | 'Temporary' | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  created_at: string;
  poster_username: string;
}

export interface ApplicantHomeResponse {
  stats: ApplicantHomeStats;
  recent_conversations: ApplicantRecentConversation[];
  featured_jobs: ApplicantFeaturedJob[];
}

export type EmploymentType =
  | 'FullTime'
  | 'PartTime'
  | 'Contract'
  | 'Internship'
  | 'Temporary';

export interface JobPosting {
  id: number;
  title: string;
  company: string | null;
  description: string | null;
  location: string | null;
  remote: 0 | 1;
  employment_type: EmploymentType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  created_at: string;
  poster_username: string;
}

export interface ApplicantJobsQuery {
  q?: string;
  employment_type?: EmploymentType;
  remote?: boolean;
  location?: string;
  limit?: number;
  offset?: number;
}

export interface ApplicantJobsResponse {
  total: number;
  limit: number;
  offset: number;
  jobs: JobPosting[];
}

export type ApplicationStatus = 'Pending' | 'Declined' | 'SentToRecruiter';

export interface ApplicationJobSummary {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  remote: 0 | 1;
  employment_type: EmploymentType | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  is_active: 0 | 1;
  poster_username: string;
}

export interface Application {
  id: number;
  status: ApplicationStatus;
  notes: string | null;
  applied_at: string;
  updated_at: string;
  job: ApplicationJobSummary;
}

export interface ApplicantApplicationsQuery {
  q?: string;
  status?: ApplicationStatus | ApplicationStatus[];
  limit?: number;
  offset?: number;
}

export interface ApplicantApplicationsResponse {
  total: number;
  limit: number;
  offset: number;
  status_counts: Record<ApplicationStatus, number>;
  applications: Application[];
}

export const api = {
  worldIdContext: () => request<WorldIdContext>('/api/auth/world-id-context'),

  applicantHome: (token: string) =>
    request<ApplicantHomeResponse>('/api/applicant/home', {}, token),

  applicantGetProfile: (token: string) =>
    request<ApplicantProfileResponse>('/api/applicant/profile', {}, token),

  applicantUpdateProfile: (token: string, profile: ApplicantProfileInput) =>
    request<ApplicantProfileResponse>(
      '/api/applicant/profile',
      { method: 'PATCH', body: JSON.stringify({ profile }) },
      token,
    ),

  applicantReviewProfile: (token: string, profile: ApplicantProfileInput) =>
    request<ApplicantProfileReviewResponse>(
      '/api/applicant/profile/review',
      { method: 'POST', body: JSON.stringify({ profile }) },
      token,
    ),

  applicantApplications: (
    token: string,
    query: ApplicantApplicationsQuery = {},
  ) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.status) {
      const list = Array.isArray(query.status) ? query.status : [query.status];
      if (list.length > 0) params.set('status', list.join(','));
    }
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.offset != null) params.set('offset', String(query.offset));
    const qs = params.toString();
    return request<ApplicantApplicationsResponse>(
      `/api/applicant/applications${qs ? `?${qs}` : ''}`,
      {},
      token,
    );
  },

  applicantJobs: (token: string, query: ApplicantJobsQuery = {}) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.employment_type) params.set('employment_type', query.employment_type);
    if (typeof query.remote === 'boolean') params.set('remote', query.remote ? '1' : '0');
    if (query.location) params.set('location', query.location);
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.offset != null) params.set('offset', String(query.offset));
    const qs = params.toString();
    return request<ApplicantJobsResponse>(
      `/api/applicant/jobs${qs ? `?${qs}` : ''}`,
      {},
      token,
    );
  },

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

  checkWorldId: (body: { world_id_result: WorldIdResult }) =>
    request<{ ok: true }>('/api/auth/signup/check-world-id', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  register: (body: {
    email: string;
    password: string;
    username: string;
    role: Role;
    world_id_result: WorldIdResult;
    profile?: ApplicantProfileInput;
  }) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  me: (token: string) => request<{ user: User }>('/api/auth/me', {}, token),
};
