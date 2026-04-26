const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001';

export const API_BASE_URL = API_BASE;

export type Role = 'Applicant' | 'Recruiter' | 'Agent';
export type SignupRole = 'Applicant' | 'Recruiter';

export type VerificationLevel = 'orb' | 'document' | 'face' | 'device';

export interface User {
  id: number;
  role: Role;
  email: string;
  username: string;
  created_at?: string;
  verification_level?: VerificationLevel;
  trust_score?: number;
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

export type ApplicantDocumentKind =
  | 'transcript'
  | 'letter_of_recommendation'
  | 'other';

export interface ApplicantDocument {
  id: number;
  kind: ApplicantDocumentKind;
  title: string | null;
  filename: string;
  byte_size: number;
  has_text: boolean;
  created_at: string;
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
  min_verification_level: VerificationLevel;
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

/** Counterparty on a thread or list — chat identity only (no trust fields). */
export interface ConversationParty {
  id: number;
  username: string;
  role: Role | string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
}

/** User row slice for the counterparty; trust lives here, not under `conversation`. */
export interface ConversationPeerUser extends ConversationParty {
  trust_score?: number;
  verification_level?: VerificationLevel;
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
  unread_count?: number;
  other_party: ConversationParty;
}

export interface ApplicantConversationsResponse {
  conversations: ConversationSummary[];
}

export type InterviewStatus =
  | 'none'
  | 'requested'
  | 'availability_proposed'
  | 'scheduled'
  | 'complete';

export type InterviewGateState =
  | 'none'
  | 'awaiting_identity'
  | 'awaiting_availability'
  | 'availability_received'
  | 'scheduled'
  | 'complete';

export interface ConversationDetail {
  id: number;
  job_posting_id: number | null;
  job_title: string | null;
  job_company: string | null;
  active: 0 | 1;
  created_at: string;
  interview_status?: InterviewStatus;
  interview_gate_state?: InterviewGateState;
  invite_requires_identity?: boolean;
  invite_identity_verified_at?: string | null;
  closed_at?: string | null;
  closure_responses?: ClosureResponses | null;
  other_party: ConversationParty;
}

export type MessageKind =
  | 'text'
  | 'interview_request'
  | 'availability_proposal'
  | 'calendar_invite'
  | 'system'
  | 'offer_proposal'
  | 'offer_settled';

export interface AvailabilitySlot {
  label: string;
  start_iso: string;
  end_iso: string;
}

export interface InterviewRequestMetadata {
  job_id: number;
  job_title: string | null;
  job_company: string | null;
  suggested_format?: string;
  requires_face_id?: boolean;
  verification_provider?: 'world' | string;
  verification_method?: 'face_id' | string;
}

export interface AvailabilityMetadata {
  slots: AvailabilitySlot[];
}

export interface CalendarInviteMetadata {
  title: string;
  description?: string;
  location: string;
  start_iso: string;
  end_iso: string;
  slot_label?: string;
  google_calendar_url: string;
}

export type MessageMetadata =
  | InterviewRequestMetadata
  | AvailabilityMetadata
  | CalendarInviteMetadata
  | Record<string, unknown>
  | null;

export interface ConversationMessage {
  index: number;
  user_id: number;
  content: string;
  kind?: MessageKind;
  metadata?: MessageMetadata;
  created_at: string;
  from_me: boolean;
}

export interface TrustQuestion {
  id: string;
  label: string;
  helper: string;
}

export interface TrustResponse {
  question_id: string;
  score: number;
  note?: string;
}

export interface ClosureResponses {
  responses: TrustResponse[];
  closed_by: number;
  closed_at: string;
}

export interface ApplicantConversationMessagesResponse {
  conversation: ConversationDetail;
  other_user: ConversationPeerUser;
  messages: ConversationMessage[];
}

export interface SendMessageResponse {
  message: ConversationMessage;
}

export interface VerifyInviteIdentityResponse {
  ok: true;
  already_verified: boolean;
  message: ConversationMessage | null;
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
  other_user: ConversationPeerUser;
  messages: ConversationMessage[];
}

export interface RecruiterConversationsQuery {
  q?: string;
  active?: boolean;
}

export type OfferNegotiationStatus =
  | 'awaiting_applicant'
  | 'running'
  | 'complete'
  | 'accepted_initial';

export interface OfferNegotiationDetail {
  id: number;
  conversation_id: number;
  status: OfferNegotiationStatus;
  initial_terms: string;
  applicant_counter: string | null;
  /** Short phrases the candidate asked to watch; optional. */
  intervention_topics: string[];
  final_terms: string | null;
  final_summary: string | null;
  key_points: string[];
  error_message: string | null;
  recruiter_confirmed_at: string | null;
  applicant_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfirmOfferTermsResponse {
  ok: true;
  already: boolean;
  both_confirmed: boolean;
  negotiation: OfferNegotiationDetail;
  system_message: ConversationMessage | null;
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
  min_verification_level: VerificationLevel;
  // Job basics
  job_id_requisition: string | null;
  department: string | null;
  team: string | null;
  reporting_to: string | null;
  number_of_direct_reports: number | null;
  permanent_or_fixed_term: string | null;
  contract_duration: string | null;
  job_level: string | null;
  // Location
  office_locations: string | null;
  work_model: string | null;
  hybrid_days_in_office: number | null;
  willing_to_hire_internationally: 0 | 1;
  travel_required: 0 | 1;
  travel_percentage: string | null;
  relocation_assistance: 0 | 1;
  // Compensation
  pay_frequency: string | null;
  bonus_commission_structure: string | null;
  equity_stock_options: string | null;
  benefits_overview: string | null;
  retirement_plan: string | null;
  paid_time_off_days: number | null;
  parental_leave_policy: string | null;
  other_perks: string | null;
  // Role description
  summary: string | null;
  key_responsibilities: string | null;
  why_role_is_open: string | null;
  team_size: number | null;
  team_structure: string | null;
  cross_functional_collaborators: string | null;
  // Requirements
  req_years_of_experience: number | null;
  req_education_level: string | null;
  req_field_of_study: string | null;
  req_certifications: string | null;
  req_technical_skills: string | null;
  req_languages: string | null;
  req_work_authorization: string | null;
  // Nice to haves
  nice_years_of_experience: number | null;
  nice_education: string | null;
  nice_technical_skills: string | null;
  nice_industry_background: string | null;
  // Company info
  company_website: string | null;
  industry: string | null;
  company_size: number | null;
  company_stage: string | null;
  mission_values: string | null;
  culture_description: string | null;
  dei_statement: string | null;
  // Application process
  application_deadline: string | null;
  how_to_apply: string | null;
  documents_required: string | null;
  interview_rounds: number | null;
  interview_format: string | null;
  expected_time_to_hire: string | null;
  contact_person: string | null;
  contact_email_phone: string | null;
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
  min_verification_level?: VerificationLevel;
  // Job basics
  job_id_requisition?: string | null;
  department?: string | null;
  team?: string | null;
  reporting_to?: string | null;
  number_of_direct_reports?: number | null;
  permanent_or_fixed_term?: string | null;
  contract_duration?: string | null;
  job_level?: string | null;
  // Location
  office_locations?: string[] | null;
  work_model?: string | null;
  hybrid_days_in_office?: number | null;
  willing_to_hire_internationally?: boolean;
  travel_required?: boolean;
  travel_percentage?: string | null;
  relocation_assistance?: boolean;
  // Compensation
  pay_frequency?: string | null;
  bonus_commission_structure?: string | null;
  equity_stock_options?: string | null;
  benefits_overview?: string | null;
  retirement_plan?: string | null;
  paid_time_off_days?: number | null;
  parental_leave_policy?: string | null;
  other_perks?: string[] | null;
  // Role description
  summary?: string | null;
  key_responsibilities?: string[] | null;
  why_role_is_open?: string | null;
  team_size?: number | null;
  team_structure?: string | null;
  cross_functional_collaborators?: string[] | null;
  // Requirements
  req_years_of_experience?: number | null;
  req_education_level?: string | null;
  req_field_of_study?: string | null;
  req_certifications?: string[] | null;
  req_technical_skills?: string[] | null;
  req_languages?: { language: string; proficiency: string }[] | null;
  req_work_authorization?: string | null;
  // Nice to haves
  nice_years_of_experience?: number | null;
  nice_education?: string | null;
  nice_technical_skills?: string[] | null;
  nice_industry_background?: string | null;
  // Company info
  company_website?: string | null;
  industry?: string | null;
  company_size?: number | null;
  company_stage?: string | null;
  mission_values?: string | null;
  culture_description?: string | null;
  dei_statement?: string | null;
  // Application process
  application_deadline?: string | null;
  how_to_apply?: string | null;
  documents_required?: string[] | null;
  interview_rounds?: number | null;
  interview_format?: string[] | null;
  expected_time_to_hire?: string | null;
  contact_person?: string | null;
  contact_email_phone?: string | null;
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
    | 'summary'
    | 'location'
    | 'employment_type'
    | 'salary_min'
    | 'salary_max'
    | 'salary_currency'
    | 'job_level'
    | 'work_model'
    | 'key_responsibilities'
    | 'req_years_of_experience'
    | 'req_technical_skills'
    | 'benefits_overview';
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
  agent_reasoning: string | null;
  match_score: number | null;
  applied_at: string;
  updated_at: string;
  applicant: {
    id: number;
    username: string;
    email: string;
    verification_level: VerificationLevel;
    trust_score: number;
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    pronouns: string | null;
    full_name: string | null;
    city: string | null;
    state: string | null;
    linkedin_url: string | null;
    website_portfolio: string | null;
    github_or_other_portfolio: string | null;
    resume_url: string | null;
  };
}

export interface RecruiterJobApplicantsResponse {
  applicants: RecruiterJobApplicant[];
  filter: 'strong' | 'all';
}

export interface RecruiterApplicantWorkExperience {
  job_title: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  current_job: 0 | 1;
  responsibilities: string | null;
  key_achievements: string | null;
}

export interface RecruiterApplicantEducation {
  school: string | null;
  degree: string | null;
  major: string | null;
  graduation_date: string | null;
  gpa: string | null;
  honors: string | null;
}

export interface RecruiterApplicantSkill {
  skill: string;
  proficiency: string | null;
  years: number | null;
}

export interface RecruiterApplicantLanguage {
  language: string;
  proficiency: string | null;
}

export interface RecruiterApplicantDetailResponse {
  application: {
    id: number;
    status: ApplicationStatus;
    notes: string | null;
    agent_reasoning: string | null;
    match_score: number | null;
    applied_at: string;
    updated_at: string;
    decided_at: string | null;
    job: { id: number; title: string; company: string | null };
  };
  applicant: {
    id: number;
    username: string;
    email: string;
    verification_level: VerificationLevel;
    trust_score: number;
    member_since: string | null;
    profile: {
      first_name: string | null;
      middle_initial: string | null;
      last_name: string | null;
      preferred_name: string | null;
      pronouns: string | null;
      city: string | null;
      state: string | null;
      linkedin_url: string | null;
      website_portfolio: string | null;
      github_or_other_portfolio: string | null;
    } | null;
    documents: { resume: string | null } | null;
    work_experience: RecruiterApplicantWorkExperience[];
    education: RecruiterApplicantEducation[];
    skills: RecruiterApplicantSkill[];
    languages: RecruiterApplicantLanguage[];
  };
  trust_signals: {
    profile_edit_approvals: number;
    profile_edit_rejections: number;
    closed_conversations: number;
    recent_feedback: ClosureResponses[];
  };
}

export interface ScheduleInterviewResponse {
  conversation_id: number;
  created: boolean;
  message: ConversationMessage;
}

export interface CalendarInviteInput {
  start_iso: string;
  end_iso: string;
  title?: string;
  description?: string;
  location?: string;
  slot_label?: string;
}

export interface CloseConversationInput {
  responses: TrustResponse[];
}

export interface CloseConversationResponse {
  ok: true;
  conversation_id: number;
  new_trust_score: number | null;
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
  other_user: {
    id: number;
    trust_score?: number;
    verification_level?: VerificationLevel;
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
  match_score: number | null;
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

  applicantListDocuments: (token: string) =>
    request<{ documents: ApplicantDocument[] }>(
      '/api/applicant/documents',
      {},
      token,
    ),

  applicantUploadDocument: async (
    token: string,
    file: File,
    kind: ApplicantDocumentKind,
    title?: string,
  ): Promise<{ document: ApplicantDocument }> => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (title && title.trim() !== '') form.append('title', title.trim());
    const res = await fetch(`${API_BASE}/api/applicant/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error || 'request_failed', data.detail);
    return data as { document: ApplicantDocument };
  },

  applicantDeleteDocument: (token: string, id: number) =>
    request<{ ok: true }>(
      `/api/applicant/documents/${id}`,
      { method: 'DELETE' },
      token,
    ),

  applicantOpenDocument: async (token: string, id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/applicant/documents/${id}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(res.status, data.error || 'request_failed', data.detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

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

  recruiterJobApplicants: (
    token: string,
    id: number,
    opts: { filter?: 'strong' | 'all' } = {},
  ) => {
    const qs = opts.filter === 'strong' ? '?filter=strong' : '';
    return request<RecruiterJobApplicantsResponse>(
      `/api/recruiter/jobs/${id}/applicants${qs}`,
      {},
      token,
    );
  },

  recruiterApplicationDetail: (token: string, applicationId: number) =>
    request<RecruiterApplicantDetailResponse>(
      `/api/recruiter/applications/${applicationId}/applicant`,
      {},
      token,
    ),

  recruiterScheduleInterview: (
    token: string,
    applicationId: number,
    note?: string,
  ) =>
    request<ScheduleInterviewResponse>(
      `/api/recruiter/applications/${applicationId}/schedule-interview`,
      {
        method: 'POST',
        body: JSON.stringify({ note: note ?? '' }),
      },
      token,
    ),

  recruiterSendCalendarInvite: (
    token: string,
    conversationId: number,
    invite: CalendarInviteInput,
  ) =>
    request<{ message: ConversationMessage }>(
      `/api/recruiter/conversations/${conversationId}/calendar-invite`,
      {
        method: 'POST',
        body: JSON.stringify(invite),
      },
      token,
    ),

  recruiterTrustQuestions: (token: string) =>
    request<{ questions: TrustQuestion[] }>(
      '/api/recruiter/trust-questions',
      {},
      token,
    ),

  recruiterCloseConversation: (
    token: string,
    conversationId: number,
    body: CloseConversationInput,
  ) =>
    request<CloseConversationResponse>(
      `/api/recruiter/conversations/${conversationId}/close`,
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  applicantRecruiterTrustQuestions: (token: string) =>
    request<{ questions: TrustQuestion[] }>(
      '/api/applicant/trust-questions-recruiter',
      {},
      token,
    ),

  applicantCloseConversation: (
    token: string,
    conversationId: number,
    body: CloseConversationInput,
  ) =>
    request<CloseConversationResponse>(
      `/api/applicant/conversations/${conversationId}/close`,
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  applicantSendAvailability: (
    token: string,
    conversationId: number,
    slots: AvailabilitySlot[],
  ) =>
    request<{ message: ConversationMessage }>(
      `/api/applicant/conversations/${conversationId}/availability`,
      { method: 'POST', body: JSON.stringify({ slots }) },
      token,
    ),

  applicantVerifyInviteIdentity: (
    token: string,
    conversationId: number,
    worldIdResult: WorldIdResult,
  ) =>
    request<VerifyInviteIdentityResponse>(
      `/api/applicant/conversations/${conversationId}/verify-invite-identity`,
      {
        method: 'POST',
        body: JSON.stringify({ world_id_result: worldIdResult }),
      },
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

  recruiterExtendOffer: (token: string, conversationId: number, terms: string) =>
    request<{
      negotiation_id: number;
      message: ConversationMessage;
    }>(`/api/recruiter/conversations/${conversationId}/extend-offer`, {
      method: 'POST',
      body: JSON.stringify({ terms }),
    }, token),

  applicantOfferRespond: (
    token: string,
    conversationId: number,
    body: {
      negotiation_id: number;
      action: 'accept' | 'counter';
      counter?: string;
      /** Optional. If set when action is counter, each non-empty string is checked (LLM) before candidate-side agent turns. */
      intervention_topics?: string[];
    },
  ) =>
    request<
      | {
          ok: true;
          outcome: 'accepted_initial';
          message: ConversationMessage;
        }
      | { ok: true; outcome: 'counter'; negotiation_id: number }
    >(`/api/applicant/conversations/${conversationId}/offer-respond`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  getOfferNegotiation: (token: string, negotiationId: number) =>
    request<{ negotiation: OfferNegotiationDetail }>(
      `/api/offer-negotiations/${negotiationId}`,
      {},
      token,
    ),

  applicantOfferIntervene: (
    token: string,
    negotiationId: number,
    body: { turn_index: number; use_agent: true } | { turn_index: number; message: string },
  ) =>
    request<
      { ok: true; outcome: 'agent' } | { ok: true; outcome: 'human' }
    >(`/api/offer-negotiations/${negotiationId}/intervene`, {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  applicantConfirmOfferTerms: (
    token: string,
    conversationId: number,
    negotiationId: number,
  ) =>
    request<ConfirmOfferTermsResponse>(
      `/api/applicant/conversations/${conversationId}/confirm-offer-terms`,
      { method: 'POST', body: JSON.stringify({ negotiation_id: negotiationId }) },
      token,
    ),

  recruiterConfirmOfferTerms: (
    token: string,
    conversationId: number,
    negotiationId: number,
  ) =>
    request<ConfirmOfferTermsResponse>(
      `/api/recruiter/conversations/${conversationId}/confirm-offer-terms`,
      { method: 'POST', body: JSON.stringify({ negotiation_id: negotiationId }) },
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
