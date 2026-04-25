const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';
export const API_BASE_URL = API_BASE;

export type Role = 'Applicant' | 'Recruiter';

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
  role: Role;
}

export interface ApplicantProfileInput {
  first_name?: string | null;
  middle_initial?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  phone_number?: string | null;
  street_address?: string | null;
  apt_suite_unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  linkedin_url?: string | null;
  website_portfolio?: string | null;
  github_or_other_portfolio?: string | null;
  challenge_you_overcame?: string | null;
  greatest_strength?: string | null;
  greatest_weakness?: string | null;
  five_year_goals?: string | null;
  leadership_experience?: string | null;
  anything_else?: string | null;
}

export interface ApplicantProfile {
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  preferred_name: string | null;
  phone_number: string | null;
  street_address: string | null;
  apt_suite_unit: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  linkedin_url: string | null;
  website_portfolio: string | null;
  github_or_other_portfolio: string | null;
  challenge_you_overcame: string | null;
  greatest_strength: string | null;
  greatest_weakness: string | null;
  five_year_goals: string | null;
  leadership_experience: string | null;
  anything_else: string | null;
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
  job_title: string;
  company_name: string | null;
  office_locations_json: string | null;
  work_model: string | null;
  employment_type: 'FullTime' | 'PartTime' | 'Contract' | 'Internship' | 'Temporary' | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  created_at: string;
  poster_username: string;
}

export interface ApplicantHomeResponse {
  stats: ApplicantHomeStats;
  recent_conversations: ApplicantRecentConversation[];
  featured_jobs: ApplicantFeaturedJob[];
}

export interface RecruiterHomeStats {
  active_postings: number;
  total_postings: number;
  total_applicants: number;
  total_applications: number;
  new_applicants_7d: number;
  pending_applications: number;
  active_conversations: number;
  messages_received: number;
}

export interface RecruiterRecentPosting {
  id: number;
  job_title: string;
  company_name: string | null;
  office_locations_json: string | null;
  work_model: string | null;
  employment_type:
    | 'FullTime'
    | 'PartTime'
    | 'Contract'
    | 'Internship'
    | 'Temporary'
    | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  is_active: 0 | 1;
  created_at: string;
  applicant_count: number;
  new_applicants_7d: number;
  pending_count: number;
}

export interface RecruiterRecentApplication {
  id: number;
  status: 'Pending' | 'Declined' | 'SentToRecruiter';
  applied_at: string;
  updated_at: string;
  job: {
    id: number;
    job_title: string;
    company_name: string | null;
  };
  applicant: {
    id: number;
    username: string;
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
  };
}

export interface RecruiterHomeResponse {
  stats: RecruiterHomeStats;
  recent_postings: RecruiterRecentPosting[];
  recent_applications: RecruiterRecentApplication[];
}

export type EmploymentType =
  | 'FullTime'
  | 'PartTime'
  | 'Contract'
  | 'Internship'
  | 'Temporary';

export interface JobPosting {
  id: number;
  job_title: string;
  company_name: string | null;
  summary: string | null;
  office_locations_json: string | null;
  work_model: string | null;
  employment_type: EmploymentType | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
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
  job_title: string;
  company_name: string | null;
  office_locations_json: string | null;
  work_model: string | null;
  employment_type: EmploymentType | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  is_active: 0 | 1;
  poster_username: string;
}

// Returned by /api/applicant/applications (enriched with job info).
// Also returned by /api/applications/:id (raw row, no `job`).
// Negotiation-only columns are optional so both shapes type-check.
export interface Application {
  id: number;
  status: ApplicationStatus;
  notes: string | null;
  applied_at?: string;
  updated_at?: string;
  job?: ApplicationJobSummary;

  applicant_id?: number;
  job_posting_id?: number;
  agent_reasoning?: string | null;
  created_at?: string;
  decided_at?: string | null;
}

export function parseOfficeLocations(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    // ignore
  }
  return [];
}

export function formatOfficeLocations(json: string | null | undefined): string | null {
  const list = parseOfficeLocations(json);
  if (list.length === 0) return null;
  return list.join(' • ');
}

export function formatApplicantDisplayName(p: {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  username?: string;
}): string {
  const first = p.preferred_name?.trim() || p.first_name?.trim() || '';
  const last = p.last_name?.trim() || '';
  const composed = [first, last].filter(Boolean).join(' ').trim();
  return composed || p.username || '';
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

// Lightweight job row returned by GET /api/jobs (used by the apply flow).
export interface JobSummary {
  id: number;
  poster_id: number;
  job_title: string;
  company_name: string | null;
  summary: string | null;
  work_model: string | null;
  office_locations_json: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  employment_type: string | null;
  job_level: string | null;
}

export interface NegotiationMessage {
  turn_index: number;
  sender: 'applicant_agent' | 'recruiter_agent';
  content: string;
  created_at: string;
}

export interface ConversationParty {
  id: number;
  username: string;
  role: Role | string;
}

export interface ConversationSummary {
  id: number;
  job_posting_id: number | null;
  job_title: string | null;
  job_company: string | null;
  active: 0 | 1;
  created_at: string;
  last_message: string | null;
  last_message_at: string | null;
  last_message_from_me: boolean | null;
  other_party: ConversationParty;
}

export interface ApplicantConversationsResponse {
  conversations: ConversationSummary[];
}

export interface ConversationDetail {
  id: number;
  job_posting_id: number | null;
  job_title: string | null;
  job_company: string | null;
  active: 0 | 1;
  created_at: string;
  other_party: ConversationParty;
}

export interface ConversationMessage {
  index: number;
  user_id: number;
  content: string;
  created_at: string;
  from_me: boolean;
}

export interface ApplicantConversationMessagesResponse {
  conversation: ConversationDetail;
  messages: ConversationMessage[];
}

export interface SendMessageResponse {
  message: ConversationMessage;
}

export interface ApplicantConversationsQuery {
  q?: string;
  active?: boolean;
}

export const api = {
  worldIdContext: () => request<WorldIdContext>('/api/auth/world-id-context'),

  applicantHome: (token: string) =>
    request<ApplicantHomeResponse>('/api/applicant/home', {}, token),

  recruiterHome: (token: string) =>
    request<RecruiterHomeResponse>('/api/recruiter/home', {}, token),

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
    role: Role;
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

  applicantConversations: (
    token: string,
    query: ApplicantConversationsQuery = {},
  ) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (typeof query.active === 'boolean') {
      params.set('active', query.active ? '1' : '0');
    }
    const qs = params.toString();
    return request<ApplicantConversationsResponse>(
      `/api/applicant/conversations${qs ? `?${qs}` : ''}`,
      {},
      token,
    );
  },

  applicantConversationMessages: (token: string, conversationId: number) =>
    request<ApplicantConversationMessagesResponse>(
      `/api/applicant/conversations/${conversationId}/messages`,
      {},
      token,
    ),

  applicantSendMessage: (
    token: string,
    conversationId: number,
    content: string,
  ) =>
    request<SendMessageResponse>(
      `/api/applicant/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) },
      token,
    ),

  listJobs: (token: string) =>
    request<{ jobs: JobSummary[] }>('/api/jobs', {}, token),

  apply: (token: string, jobPostingId: number) =>
    request<{ application: Application }>(
      '/api/applications',
      { method: 'POST', body: JSON.stringify({ job_posting_id: jobPostingId }) },
      token,
    ),

  getApplication: (token: string, id: number) =>
    request<{ application: Application; messages: NegotiationMessage[] }>(
      `/api/applications/${id}`,
      {},
      token,
    ),
};
