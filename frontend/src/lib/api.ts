const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

export const API_BASE_URL = API_BASE;

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
  // personal info
  first_name?: string;
  middle_initial?: string;
  last_name?: string;
  preferred_name?: string;
  pronouns?: string;
  date_of_birth?: string;
  phone_number?: string;
  alternative_phone?: string;
  // address
  street_address?: string;
  apt_suite_unit?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  // links
  linkedin_url?: string;
  website_portfolio?: string;
  github_or_other_portfolio?: string;
  // sub-sections
  documents?: DocumentsInput;
  work_experience?: WorkExperienceInput[];
  education?: EducationInput[];
  skills?: SkillInput[];
  languages?: LanguageInput[];
  references?: ReferenceInput[];
  about_me?: AboutMeInput;
  legal?: LegalInput;
  eeo?: EeoInput;
}

export interface DocumentsInput {
  resume?: string;
  writing_samples?: string[];
  portfolio_work_samples?: string[];
  transcripts?: string[];
  certifications?: string[];
  other_documents?: string[];
}

export interface WorkExperienceInput {
  job_title?: string;
  company?: string;
  city?: string;
  state?: string;
  employment_type?: string;
  start_date?: string;
  end_date?: string;
  current_job?: boolean;
  responsibilities?: string;
  key_achievements?: string;
}

export interface EducationInput {
  school?: string;
  city?: string;
  state?: string;
  degree?: string;
  major?: string;
  minor?: string;
  start_date?: string;
  graduation_date?: string;
  graduated?: boolean;
  gpa?: string;
  honors?: string;
  relevant_coursework?: string[];
}

export interface SkillInput {
  skill: string;
  proficiency?: string;
  years?: number | null;
}

export interface LanguageInput {
  language: string;
  proficiency?: string;
}

export interface ReferenceInput {
  name?: string;
  relationship?: string;
  company?: string;
  title?: string;
  phone?: string;
  email?: string;
}

export interface AboutMeInput {
  challenge_you_overcame?: string;
  greatest_strength?: string;
  greatest_weakness?: string;
  five_year_goals?: string;
  leadership_experience?: string;
  anything_else?: string;
}

export interface LegalInput {
  us_work_authorization?: boolean;
  requires_sponsorship?: boolean;
  visa_type?: string;
  over_18?: boolean;
  security_clearance?: string;
  needs_accommodation?: boolean;
}

export interface EeoInput {
  gender?: string;
  race_ethnicity?: string;
  disability_status?: string;
  veteran_status?: string;
}

export interface ApplicantProfile {
  personal_information: {
    first_name: string | null;
    middle_initial: string | null;
    last_name: string | null;
    preferred_name: string | null;
    pronouns: string | null;
    date_of_birth: string | null;
    phone_number: string | null;
    alternative_phone: string | null;
    street_address: string | null;
    apt_suite_unit: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    linkedin_url: string | null;
    website_portfolio: string | null;
    github_or_other_portfolio: string | null;
    updated_at?: string | null;
  };
  documents: DocumentsInput | null;
  work_experience: (WorkExperienceInput & { id?: number })[];
  education: (EducationInput & { id?: number })[];
  skills: (SkillInput & { id?: number })[];
  languages: (LanguageInput & { id?: number })[];
  references: (ReferenceInput & { id?: number })[];
  about_me: AboutMeInput | null;
  legal: LegalInput | null;
  eeo: EeoInput | null;
}

export interface ProfileLockState {
  locked: boolean;
  reason: string | null;
  locked_at: string | null;
}

export interface ApplicantProfileResponse {
  profile: ApplicantProfile;
  lock: ProfileLockState;
}

export interface ApplicantProfileReviewResponse {
  warnings: Record<string, string>;
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
  title: string;
  company: string | null;
  location: string | null;
  remote: 0 | 1;
  employment_type:
    | 'FullTime'
    | 'PartTime'
    | 'Contract'
    | 'Internship'
    | 'Temporary'
    | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
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
    title: string;
    company: string | null;
  };
  applicant: {
    id: number;
    username: string;
    full_name: string | null;
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

export interface RecruiterConversationsResponse {
  conversations: ConversationSummary[];
}

export interface RecruiterConversationMessagesResponse {
  conversation: ConversationDetail;
  messages: ConversationMessage[];
}

export interface RecruiterConversationsQuery {
  q?: string;
  active?: boolean;
}

export interface RecruiterJob {
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
  is_active: 0 | 1;
  created_at: string;
}

export interface RecruiterJobListItem extends RecruiterJob {
  applicant_count: number;
  pending_count: number;
  sent_count: number;
  new_applicants_7d: number;
}

export interface RecruiterJobsResponse {
  total: number;
  limit: number;
  offset: number;
  counts: { active: number; closed: number; total: number };
  jobs: RecruiterJobListItem[];
}

export interface RecruiterJobInput {
  title?: string;
  company?: string | null;
  description?: string | null;
  location?: string | null;
  remote?: boolean;
  employment_type?: EmploymentType | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  is_active?: boolean;
}

export interface RecruiterJobDetailStats {
  applicant_count: number;
  pending_count: number;
  sent_count: number;
  declined_count: number;
  new_applicants_7d: number;
}

export interface RecruiterJobDetailResponse {
  job: RecruiterJob;
  stats: RecruiterJobDetailStats;
}

export interface RecruiterJobMutateResponse {
  job: RecruiterJob;
}

export type JobReviewSeverity = 'info' | 'warning' | 'error';

export interface JobReviewIssue {
  field:
    | 'title'
    | 'company'
    | 'description'
    | 'location'
    | 'employment_type'
    | 'salary_min'
    | 'salary_max'
    | 'salary_currency';
  severity: JobReviewSeverity;
  message: string;
}

export interface JobReviewResponse {
  issues: JobReviewIssue[];
  source: 'llm' | 'heuristic';
}

export interface RecruiterJobApplicant {
  application_id: number;
  status: ApplicationStatus;
  notes: string | null;
  applied_at: string;
  updated_at: string;
  applicant: {
    id: number;
    username: string;
    email: string;
    full_name: string | null;
    headline: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    years_experience: number | null;
    linkedin_url: string | null;
    github_url: string | null;
    portfolio_url: string | null;
    resume_url: string | null;
  };
}

export interface RecruiterJobApplicantsResponse {
  applicants: RecruiterJobApplicant[];
}

export interface RecruiterJobConversation {
  id: number;
  active: 0 | 1;
  created_at: string;
  message_count: number;
  last_message: string | null;
  last_message_at: string | null;
  last_message_from_me: boolean | null;
  other_party: {
    id: number;
    username: string;
    role: Role | string;
    full_name: string | null;
    headline: string | null;
  };
}

export interface RecruiterJobConversationsResponse {
  conversations: RecruiterJobConversation[];
}

export interface RecruiterAgentMessage {
  index: number;
  user_id: number;
  content: string;
  created_at: string;
  from_agent: boolean;
}

export interface RecruiterAgentConversationResponse {
  conversation: {
    id: number;
    job_posting_id: number | null;
    active: 0 | 1;
    created_at: string;
    agent: { id: number; username: string; role: Role | string };
    applicant: { id: number; username: string; role: Role | string };
  } | null;
  messages: RecruiterAgentMessage[];
}

// Two-agent negotiation
// One row per turn in the applicant_agent <-> recruiter_agent conversation.
export interface NegotiationMessage {
  turn_index: number;
  sender: 'applicant_agent' | 'recruiter_agent';
  content: string;
  created_at: string;
}

// The richer application shape returned by GET /api/applications/:id and
// POST /api/applications. Distinct from the list-row `Application` above.
export interface ApplicationDetail {
  id: number;
  applicant_id: number;
  job_posting_id: number;
  status: ApplicationStatus;
  notes: string | null;
  agent_reasoning: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
  job_title: string;
  job_company: string | null;
  job_poster_id: number;
  applicant_username: string;
  poster_username: string;
}

export interface CreateApplicationResponse {
  application: ApplicationDetail;
}

export interface GetApplicationResponse {
  application: ApplicationDetail;
  messages: NegotiationMessage[];
}

export const api = {
  worldIdContext: () => request<WorldIdContext>('/api/auth/world-id-context'),

  apply: (token: string, jobPostingId: number) =>
    request<CreateApplicationResponse>(
      '/api/applications',
      {
        method: 'POST',
        body: JSON.stringify({ job_posting_id: jobPostingId }),
      },
      token,
    ),

  getApplication: (token: string, id: number) =>
    request<GetApplicationResponse>(`/api/applications/${id}`, {}, token),

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

  recruiterListJobs: (
    token: string,
    query: { q?: string; status?: 'active' | 'closed'; limit?: number; offset?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.status) params.set('status', query.status);
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.offset != null) params.set('offset', String(query.offset));
    const qs = params.toString();
    return request<RecruiterJobsResponse>(
      `/api/recruiter/jobs${qs ? `?${qs}` : ''}`,
      {},
      token,
    );
  },

  recruiterGetJob: (token: string, id: number) =>
    request<RecruiterJobDetailResponse>(`/api/recruiter/jobs/${id}`, {}, token),

  recruiterCreateJob: (token: string, job: RecruiterJobInput) =>
    request<RecruiterJobMutateResponse>(
      '/api/recruiter/jobs',
      { method: 'POST', body: JSON.stringify({ job }) },
      token,
    ),

  recruiterUpdateJob: (token: string, id: number, job: RecruiterJobInput) =>
    request<RecruiterJobMutateResponse>(
      `/api/recruiter/jobs/${id}`,
      { method: 'PATCH', body: JSON.stringify({ job }) },
      token,
    ),

  recruiterReviewJob: (token: string, job: RecruiterJobInput) =>
    request<JobReviewResponse>(
      '/api/recruiter/jobs/review',
      { method: 'POST', body: JSON.stringify({ job }) },
      token,
    ),

  recruiterJobApplicants: (token: string, id: number) =>
    request<RecruiterJobApplicantsResponse>(
      `/api/recruiter/jobs/${id}/applicants`,
      {},
      token,
    ),

  recruiterJobConversations: (token: string, id: number) =>
    request<RecruiterJobConversationsResponse>(
      `/api/recruiter/jobs/${id}/conversations`,
      {},
      token,
    ),

  recruiterConversations: (
    token: string,
    query: RecruiterConversationsQuery = {},
  ) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (typeof query.active === 'boolean') {
      params.set('active', query.active ? '1' : '0');
    }
    const qs = params.toString();
    return request<RecruiterConversationsResponse>(
      `/api/recruiter/conversations${qs ? `?${qs}` : ''}`,
      {},
      token,
    );
  },

  recruiterConversationMessages: (token: string, conversationId: number) =>
    request<RecruiterConversationMessagesResponse>(
      `/api/recruiter/conversations/${conversationId}/messages`,
      {},
      token,
    ),

  recruiterSendMessage: (
    token: string,
    conversationId: number,
    content: string,
  ) =>
    request<SendMessageResponse>(
      `/api/recruiter/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) },
      token,
    ),

  recruiterAgentConversation: (token: string, applicantId: number, jobId?: number) => {
    const qs = jobId != null ? `?job_id=${jobId}` : '';
    return request<RecruiterAgentConversationResponse>(
      `/api/recruiter/applicants/${applicantId}/agent-conversation${qs}`,
      {},
      token,
    );
  },
};
