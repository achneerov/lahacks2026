import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  api,
  ApiError,
  type ApplicationStatus,
  type EmploymentType,
  type RecruiterAgentConversationResponse,
  type RecruiterApplicantDetailResponse,
  type RecruiterJob,
  type RecruiterJobApplicant,
  type RecruiterJobConversation,
  type RecruiterJobDetailStats,
} from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import {
  MatchScoreBadge,
  TrustScoreBadge,
  VerificationLevelBadge,
} from '../../components/Badges';

type Tab = 'overview' | 'applicants' | 'messages';

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  FullTime: 'Full-time',
  PartTime: 'Part-time',
  Contract: 'Contract',
  Internship: 'Internship',
  Temporary: 'Temporary',
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  Pending: 'Pending',
  SentToRecruiter: 'Sent to recruiter',
  Declined: 'Declined',
};

const STATUS_TONE: Record<
  ApplicationStatus,
  { color: string; bg: string; border: string }
> = {
  Pending: {
    color: 'var(--warning)',
    bg: 'var(--warning-bg)',
    border: 'var(--warning-border)',
  },
  SentToRecruiter: {
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    border: 'var(--success-border)',
  },
  Declined: {
    color: 'var(--danger)',
    bg: 'var(--danger-bg)',
    border: 'var(--danger-border)',
  },
};

export default function RecruiterJobDetail() {
  const params = useParams();
  const jobId = params.id ? Number(params.id) : null;
  const { token } = useAuth();

  const [tab, setTab] = useState<Tab>('overview');

  const [job, setJob] = useState<RecruiterJob | null>(null);
  const [stats, setStats] = useState<RecruiterJobDetailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [applicants, setApplicants] = useState<RecruiterJobApplicant[] | null>(null);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [applicantFilter, setApplicantFilter] = useState<'strong' | 'all'>('strong');

  const [conversations, setConversations] = useState<RecruiterJobConversation[] | null>(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const [selectedApplicant, setSelectedApplicant] = useState<RecruiterJobApplicant | null>(null);

  const loadJob = useCallback(() => {
    if (!token || !jobId) return;
    setLoading(true);
    setError(null);
    api
      .recruiterGetJob(token, jobId)
      .then((d) => {
        setJob(d.job);
        setStats(d.stats);
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load this posting.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token, jobId]);

  useEffect(loadJob, [loadJob]);

  useEffect(() => {
    if (tab !== 'applicants') return;
    if (!token || !jobId) return;
    setApplicantsLoading(true);
    api
      .recruiterJobApplicants(token, jobId, { filter: applicantFilter })
      .then((d) => setApplicants(d.applicants))
      .catch((err) => {
        const msg =
          err instanceof ApiError ? err.detail || err.code : 'Could not load applicants.';
        setError(msg);
      })
      .finally(() => setApplicantsLoading(false));
  }, [tab, applicantFilter, token, jobId]);

  useEffect(() => {
    if (tab !== 'messages' || conversations !== null) return;
    if (!token || !jobId) return;
    setConversationsLoading(true);
    api
      .recruiterJobConversations(token, jobId)
      .then((d) => setConversations(d.conversations))
      .catch((err) => {
        const msg =
          err instanceof ApiError ? err.detail || err.code : 'Could not load messages.';
        setError(msg);
      })
      .finally(() => setConversationsLoading(false));
  }, [tab, conversations, token, jobId]);

  if (loading && !job) {
    return (
      <div style={styles.page}>
        <p style={styles.loading}>Loading posting…</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBanner}>
          {error || 'Posting not found.'}
        </div>
        <Link to="/recruiter/jobs" style={styles.backLink}>
          ← Back to postings
        </Link>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Link to="/recruiter/jobs" style={styles.backLink}>
            ← All postings
          </Link>
          <div style={styles.titleRow}>
            <h1 style={styles.title}>{job.title}</h1>
            <span
              style={{
                ...styles.statusPill,
                ...(job.is_active
                  ? styles.statusPillActive
                  : styles.statusPillClosed),
              }}
            >
              {job.is_active ? 'Active' : 'Closed'}
            </span>
          </div>
          <div style={styles.metaRow}>
            {job.company && <span style={styles.metaStrong}>{job.company}</span>}
            {job.location && (
              <span style={styles.metaMuted}>· {job.location}</span>
            )}
            {job.remote === 1 && <span style={styles.metaMuted}>· Remote</span>}
            {job.employment_type && (
              <span style={styles.pill}>
                {EMPLOYMENT_LABELS[job.employment_type]}
              </span>
            )}
            <span style={styles.metaMuted}>· {formatSalary(job)}</span>
            <span style={styles.metaMuted}>
              · Posted {formatRelative(job.created_at)}
            </span>
          </div>
        </div>
        <Link to={`/recruiter/jobs/${job.id}/edit`} style={styles.primaryBtn}>
          Edit posting
        </Link>
      </header>

      {error && (
        <div role="alert" style={styles.errorBanner}>
          {error}
        </div>
      )}

      <section style={styles.statsGrid}>
        <StatCard label="Applicants" value={stats?.applicant_count ?? 0} />
        <StatCard label="Pending" value={stats?.pending_count ?? 0} />
        <StatCard label="Sent to you" value={stats?.sent_count ?? 0} />
        <StatCard label="Declined" value={stats?.declined_count ?? 0} />
        <StatCard label="New (7d)" value={stats?.new_applicants_7d ?? 0} />
      </section>

      <div style={styles.tabBar} role="tablist">
        <TabBtn
          active={tab === 'overview'}
          onClick={() => setTab('overview')}
          label="Overview"
        />
        <TabBtn
          active={tab === 'applicants'}
          onClick={() => setTab('applicants')}
          label={`Applicants${stats ? ` (${stats.applicant_count})` : ''}`}
        />
        <TabBtn
          active={tab === 'messages'}
          onClick={() => setTab('messages')}
          label="Human messages"
        />
      </div>

      {tab === 'overview' && (
        <section style={styles.cardCol}>
          <article style={styles.card}>
            <h2 style={styles.cardTitle}>Description</h2>
            {job.description ? (
              <p style={styles.descriptionText}>{job.description}</p>
            ) : (
              <p style={styles.empty}>
                No description yet. Edit this posting to add one.
              </p>
            )}
          </article>
          <article style={styles.card}>
            <h2 style={styles.cardTitle}>At a glance</h2>
            <dl style={styles.dl}>
              <Detail label="Compensation" value={formatSalary(job)} />
              <Detail
                label="Employment type"
                value={
                  job.employment_type ? EMPLOYMENT_LABELS[job.employment_type] : '—'
                }
              />
              <Detail label="Location" value={job.location || '—'} />
              <Detail
                label="Remote"
                value={job.remote === 1 ? 'Yes' : 'No'}
              />
              <Detail
                label="Status"
                value={job.is_active === 1 ? 'Active' : 'Closed'}
              />
              <Detail label="Created" value={new Date(job.created_at).toLocaleString()} />
            </dl>
          </article>
        </section>
      )}

      {tab === 'applicants' && (
        <section style={styles.cardCol}>
          <div style={styles.filterBar}>
            <span style={styles.filterLabel}>Show:</span>
            <button
              type="button"
              onClick={() => setApplicantFilter('strong')}
              style={{
                ...styles.filterChip,
                ...(applicantFilter === 'strong' ? styles.filterChipActive : null),
              }}
            >
              Strong matches
            </button>
            <button
              type="button"
              onClick={() => setApplicantFilter('all')}
              style={{
                ...styles.filterChip,
                ...(applicantFilter === 'all' ? styles.filterChipActive : null),
              }}
            >
              All applicants
            </button>
            <span style={styles.filterHint}>
              {applicantFilter === 'strong'
                ? 'AI screen recommended · match score ≥ 70'
                : 'Including pending and declined'}
            </span>
          </div>
          {applicantsLoading && !applicants ? (
            <div style={styles.empty}>Loading applicants…</div>
          ) : !applicants || applicants.length === 0 ? (
            <div style={styles.empty}>
              {applicantFilter === 'strong'
                ? 'No strong matches yet. Switch to All applicants to see everyone.'
                : 'Nobody has applied to this posting yet.'}
            </div>
          ) : (
            <ul style={styles.list}>
              {applicants.map((a) => (
                <ApplicantRow
                  key={a.application_id}
                  applicant={a}
                  onOpen={() => setSelectedApplicant(a)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'messages' && (
        <section>
          {conversationsLoading && !conversations ? (
            <div style={styles.empty}>Loading conversations…</div>
          ) : !conversations || conversations.length === 0 ? (
            <div style={styles.empty}>
              No human messages tied to this posting yet.
            </div>
          ) : (
            <ul style={styles.list}>
              {conversations.map((c) => (
                <ConversationRow key={c.id} conversation={c} />
              ))}
            </ul>
          )}
        </section>
      )}

      {selectedApplicant && (
        <ApplicantModal
          applicant={selectedApplicant}
          jobId={job.id}
          onClose={() => setSelectedApplicant(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        ...styles.tabBtn,
        ...(active ? styles.tabBtnActive : null),
      }}
    >
      {label}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.detailItem}>
      <dt style={styles.detailLabel}>{label}</dt>
      <dd style={styles.detailValue}>{value}</dd>
    </div>
  );
}

function ApplicantRow({
  applicant: a,
  onOpen,
}: {
  applicant: RecruiterJobApplicant;
  onOpen: () => void;
}) {
  const tone = STATUS_TONE[a.status];
  const p = a.applicant;
  const location = [p.city, p.state].filter(Boolean).join(', ');
  return (
    <li style={styles.row}>
      <button type="button" onClick={onOpen} style={styles.rowMainBtn}>
        <div style={styles.rowTopRow}>
          <span style={styles.applicantName}>
            {p.full_name || `@${p.username}`}
          </span>
          <span
            style={{
              ...styles.statusBadge,
              color: tone.color,
              background: tone.bg,
              borderColor: tone.border,
            }}
          >
            {STATUS_LABELS[a.status]}
          </span>
        </div>
        <div style={styles.badgeRow}>
          <MatchScoreBadge score={a.match_score} />
          <TrustScoreBadge score={p.trust_score} />
          <VerificationLevelBadge level={p.verification_level} />
        </div>
        <div style={styles.rowMeta}>
          <span style={styles.metaMuted}>@{p.username}</span>
          {location && <span style={styles.metaMuted}>· {location}</span>}
          <span style={styles.metaMuted}>· Applied {formatRelative(a.applied_at)}</span>
        </div>
        {a.agent_reasoning && (
          <p style={styles.reasoningPreview}>
            <span style={styles.reasoningLabel}>AI screen ·</span>{' '}
            {truncate(a.agent_reasoning, 220)}
          </p>
        )}
      </button>
    </li>
  );
}

function ConversationRow({
  conversation: c,
}: {
  conversation: RecruiterJobConversation;
}) {
  return (
    <li style={styles.row}>
      <div style={styles.rowMain}>
        <div style={styles.rowTopRow}>
          <span style={styles.applicantName}>
            {c.other_party.full_name || `@${c.other_party.username}`}
          </span>
          <span
            style={{
              ...styles.statusPill,
              ...(c.active === 1 ? styles.statusPillActive : styles.statusPillClosed),
            }}
          >
            {c.active === 1 ? 'Active' : 'Closed'}
          </span>
        </div>
        <div style={styles.rowMeta}>
          <span style={styles.metaMuted}>@{c.other_party.username}</span>
          <span style={styles.metaMuted}>· {c.other_party.role}</span>
          <span style={styles.metaMuted}>
            · {c.message_count} message{c.message_count === 1 ? '' : 's'}
          </span>
        </div>
        {c.last_message && (
          <p style={styles.lastMessage}>
            <span style={styles.lastMessageAuthor}>
              {c.last_message_from_me ? 'You: ' : `${c.other_party.username}: `}
            </span>
            {truncate(c.last_message, 200)}
          </p>
        )}
        <div style={styles.rowMeta}>
          <span style={styles.metaMuted}>
            {c.last_message_at
              ? `Last message ${formatRelative(c.last_message_at)}`
              : `Started ${formatRelative(c.created_at)}`}
          </span>
        </div>
      </div>
    </li>
  );
}

function ApplicantModal({
  applicant: a,
  jobId,
  onClose,
}: {
  applicant: RecruiterJobApplicant;
  jobId: number;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [showAgent, setShowAgent] = useState(false);
  const [agentData, setAgentData] = useState<RecruiterAgentConversationResponse | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecruiterApplicantDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setDetailLoading(true);
    setDetailError(null);
    api
      .recruiterApplicationDetail(token, a.application_id)
      .then((d) => setDetail(d))
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load applicant details.';
        setDetailError(msg);
      })
      .finally(() => setDetailLoading(false));
  }, [token, a.application_id]);

  useEffect(() => {
    if (!showAgent || agentData || !token) return;
    setAgentLoading(true);
    setAgentError(null);
    api
      .recruiterAgentConversation(token, a.applicant.id, jobId)
      .then((d) => setAgentData(d))
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.detail || err.code
            : 'Could not load the AI conversation.';
        setAgentError(msg);
      })
      .finally(() => setAgentLoading(false));
  }, [showAgent, agentData, token, a.applicant.id, jobId]);

  async function handleScheduleInterview() {
    if (!token) return;
    setScheduling(true);
    setScheduleError(null);
    try {
      const { conversation_id } = await api.recruiterScheduleInterview(
        token,
        a.application_id,
      );
      navigate(`/recruiter/messages?conversation=${conversation_id}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail || err.code
          : 'Could not start the interview chat.';
      setScheduleError(msg);
    } finally {
      setScheduling(false);
    }
  }

  const tone = STATUS_TONE[a.status];
  const p = a.applicant;
  const location = [p.city, p.state].filter(Boolean).join(', ');
  const trustSignals = detail?.trust_signals;
  const work = detail?.applicant.work_experience ?? [];
  const education = detail?.applicant.education ?? [];
  const skills = detail?.applicant.skills ?? [];

  return (
    <div
      style={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="applicant-modal-title"
      >
        <header style={styles.modalHeader}>
          <div>
            <span style={styles.modalEyebrow}>Applicant</span>
            <h2 id="applicant-modal-title" style={styles.modalTitle}>
              {p.full_name || `@${p.username}`}
            </h2>
            <div style={styles.modalBadgeRow}>
              <span
                style={{
                  ...styles.statusBadge,
                  color: tone.color,
                  background: tone.bg,
                  borderColor: tone.border,
                }}
              >
                {STATUS_LABELS[a.status]}
              </span>
              <MatchScoreBadge score={a.match_score} size="md" />
              <TrustScoreBadge score={p.trust_score} size="md" />
              <VerificationLevelBadge level={p.verification_level} size="md" />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={styles.modalClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div style={styles.modalBody}>
          {scheduleError && (
            <div role="alert" style={styles.errorBanner}>
              {scheduleError}
            </div>
          )}

          <div style={styles.actionRow}>
            <button
              type="button"
              onClick={handleScheduleInterview}
              disabled={scheduling}
              style={{
                ...styles.primaryActionBtn,
                ...(scheduling ? styles.primaryActionBtnDisabled : null),
              }}
            >
              {scheduling ? 'Opening chat…' : '📅 Schedule interview'}
            </button>
            {detail?.application.id && (
              <Link
                to={`/applications/${detail.application.id}`}
                style={styles.secondaryActionBtn}
              >
                View AI screen →
              </Link>
            )}
          </div>

          <section style={styles.modalSection}>
            <h3 style={styles.modalSectionTitle}>Trust score view</h3>
            {detailLoading ? (
              <p style={styles.empty}>Loading trust signals…</p>
            ) : detailError ? (
              <p style={{ ...styles.empty, color: 'var(--danger)' }}>{detailError}</p>
            ) : (
              <div style={styles.trustGrid}>
                <TrustStat
                  label="Trust score"
                  value={`${Math.round(p.trust_score ?? 0)} / 100`}
                  hint="Updated by past recruiter feedback"
                />
                <TrustStat
                  label="Verification"
                  value={verificationLabel(p.verification_level)}
                  hint="World ID credential strength"
                />
                <TrustStat
                  label="AI match"
                  value={
                    a.match_score == null
                      ? 'Pending'
                      : `${Math.round(a.match_score)} / 100`
                  }
                  hint="Applicant↔recruiter agent screen"
                />
                <TrustStat
                  label="Profile edits"
                  value={`${trustSignals?.profile_edit_approvals ?? 0} approved · ${trustSignals?.profile_edit_rejections ?? 0} rejected`}
                  hint="Credibility agent history"
                />
                <TrustStat
                  label="Past interviews"
                  value={`${trustSignals?.closed_conversations ?? 0} completed`}
                  hint="Closed conversations on Verified"
                />
              </div>
            )}
            {a.agent_reasoning && (
              <p style={styles.notes}>
                <strong>AI screen verdict:</strong> {a.agent_reasoning}
              </p>
            )}
          </section>

          <section style={styles.modalSection}>
            <h3 style={styles.modalSectionTitle}>Profile</h3>
            <dl style={styles.dl}>
              <Detail label="Username" value={`@${p.username}`} />
              <Detail label="Email" value={p.email} />
              {p.pronouns && <Detail label="Pronouns" value={p.pronouns} />}
              {location && <Detail label="Location" value={location} />}
            </dl>

            {(p.resume_url ||
              p.linkedin_url ||
              p.github_or_other_portfolio ||
              p.website_portfolio) && (
              <div style={styles.linkRow}>
                {p.resume_url && (
                  <a href={p.resume_url} target="_blank" rel="noreferrer" style={styles.extLink}>
                    Resume ↗
                  </a>
                )}
                {p.linkedin_url && (
                  <a href={p.linkedin_url} target="_blank" rel="noreferrer" style={styles.extLink}>
                    LinkedIn ↗
                  </a>
                )}
                {p.github_or_other_portfolio && (
                  <a
                    href={p.github_or_other_portfolio}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.extLink}
                  >
                    GitHub ↗
                  </a>
                )}
                {p.website_portfolio && (
                  <a
                    href={p.website_portfolio}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.extLink}
                  >
                    Portfolio ↗
                  </a>
                )}
              </div>
            )}
          </section>

          {work.length > 0 && (
            <section style={styles.modalSection}>
              <h3 style={styles.modalSectionTitle}>Work experience</h3>
              <ul style={styles.timeline}>
                {work.map((w, i) => (
                  <li key={`${w.company}-${i}`} style={styles.timelineItem}>
                    <div style={styles.timelineHead}>
                      <span style={styles.timelineRole}>{w.job_title || 'Role'}</span>
                      {w.company && (
                        <span style={styles.timelineCompany}>· {w.company}</span>
                      )}
                    </div>
                    <span style={styles.timelineDates}>
                      {w.start_date || ''}
                      {w.start_date || w.end_date ? ' – ' : ''}
                      {w.current_job ? 'Present' : w.end_date || ''}
                    </span>
                    {w.responsibilities && (
                      <p style={styles.timelineBody}>{w.responsibilities}</p>
                    )}
                    {w.key_achievements && (
                      <p style={{ ...styles.timelineBody, fontStyle: 'italic' }}>
                        {w.key_achievements}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {education.length > 0 && (
            <section style={styles.modalSection}>
              <h3 style={styles.modalSectionTitle}>Education</h3>
              <ul style={styles.timeline}>
                {education.map((e, i) => (
                  <li key={`${e.school}-${i}`} style={styles.timelineItem}>
                    <div style={styles.timelineHead}>
                      <span style={styles.timelineRole}>
                        {e.degree || 'Degree'}
                        {e.major ? `, ${e.major}` : ''}
                      </span>
                      {e.school && (
                        <span style={styles.timelineCompany}>· {e.school}</span>
                      )}
                    </div>
                    <span style={styles.timelineDates}>
                      {e.graduation_date || ''}
                      {e.gpa ? ` · GPA ${e.gpa}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {skills.length > 0 && (
            <section style={styles.modalSection}>
              <h3 style={styles.modalSectionTitle}>Skills</h3>
              <div style={styles.skillRow}>
                {skills.map((s, i) => (
                  <span key={`${s.skill}-${i}`} style={styles.skillChip}>
                    {s.skill}
                    {s.proficiency ? ` · ${s.proficiency}` : ''}
                    {s.years != null ? ` · ${s.years}y` : ''}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section style={styles.modalSection}>
            <h3 style={styles.modalSectionTitle}>Application</h3>
            <dl style={styles.dl}>
              <Detail label="Status" value={STATUS_LABELS[a.status]} />
              <Detail label="Applied" value={new Date(a.applied_at).toLocaleString()} />
              <Detail label="Updated" value={new Date(a.updated_at).toLocaleString()} />
            </dl>
            {a.notes && <p style={styles.notes}>"{a.notes}"</p>}
          </section>

          <section style={styles.modalSection}>
            <div style={styles.modalSectionTitleRow}>
              <h3 style={styles.modalSectionTitle}>AI agent conversation</h3>
              <button
                type="button"
                onClick={() => setShowAgent((v) => !v)}
                style={styles.toggleBtn}
              >
                {showAgent ? 'Hide' : 'View transcript'}
              </button>
            </div>
            {showAgent && (
              <div style={styles.agentBox}>
                {agentLoading && <p style={styles.empty}>Loading transcript…</p>}
                {agentError && (
                  <p style={{ ...styles.empty, color: 'var(--danger)' }}>{agentError}</p>
                )}
                {!agentLoading && !agentError && agentData && (
                  agentData.conversation == null || agentData.messages.length === 0 ? (
                    <p style={styles.empty}>
                      No AI agent transcript available for this applicant yet.
                    </p>
                  ) : (
                    <ol style={styles.transcript}>
                      {agentData.messages.map((m) => (
                        <li
                          key={m.index}
                          style={{
                            ...styles.transcriptItem,
                            ...(m.from_agent
                              ? styles.transcriptAgent
                              : styles.transcriptApplicant),
                          }}
                        >
                          <span style={styles.transcriptAuthor}>
                            {m.from_agent
                              ? `Agent · @${agentData.conversation?.agent.username}`
                              : `Applicant · @${agentData.conversation?.applicant.username}`}
                          </span>
                          <p style={styles.transcriptText}>{m.content}</p>
                          <span style={styles.transcriptTime}>
                            {formatRelative(m.created_at)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TrustStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div style={styles.trustStat}>
      <span style={styles.trustStatLabel}>{label}</span>
      <span style={styles.trustStatValue}>{value}</span>
      {hint && <span style={styles.trustStatHint}>{hint}</span>}
    </div>
  );
}

function verificationLabel(level: string | null | undefined): string {
  switch (level) {
    case 'orb':
      return 'Proof of Human (Orb)';
    case 'document':
      return 'Document-verified';
    case 'face':
      return 'Selfie Face-verified';
    default:
      return 'Device-only';
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function formatSalary(j: {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
}) {
  const cur = j.salary_currency || 'USD';
  if (j.salary_min == null && j.salary_max == null) {
    return 'Compensation not disclosed';
  }
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(n);
  if (j.salary_min != null && j.salary_max != null) {
    return `${fmt(j.salary_min)} – ${fmt(j.salary_max)}`;
  }
  return fmt((j.salary_min ?? j.salary_max) as number);
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(ts)) return iso;
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.round(diffSec / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

const styles: Record<string, CSSProperties> = {
  page: {
    flex: 1,
    width: '100%',
    boxSizing: 'border-box',
    padding: '40px 32px 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    textAlign: 'left',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 280 },
  backLink: {
    fontSize: 13,
    color: 'var(--text)',
    textDecoration: 'none',
    width: 'fit-content',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 28,
    color: 'var(--text-h)',
    letterSpacing: '-0.5px',
    lineHeight: 1.15,
  },
  metaRow: {
    fontSize: 13,
    color: 'var(--text)',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaStrong: { color: 'var(--text-h)', fontWeight: 500 },
  metaMuted: { color: 'var(--text)' },
  pill: {
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 8px',
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.3,
  },
  statusPill: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 999,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    border: '1px solid',
  },
  statusPillActive: {
    color: 'var(--success)',
    background: 'var(--success-bg)',
    borderColor: 'var(--success-border)',
  },
  statusPillClosed: {
    color: 'var(--text)',
    background: 'transparent',
    borderColor: 'var(--border)',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background: 'var(--accent)',
    padding: '10px 16px',
    borderRadius: 10,
    textDecoration: 'none',
  },
  errorBanner: {
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--danger-strong)',
    background: 'var(--danger-strong-bg)',
    border: '1px solid var(--danger-strong-border)',
    borderRadius: 10,
  },
  loading: { color: 'var(--text)', fontSize: 14 },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '14px 16px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--bg)',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 600,
    color: 'var(--text-h)',
    lineHeight: 1.1,
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    borderBottom: '1px solid var(--border)',
  },
  tabBtn: {
    padding: '10px 16px',
    fontSize: 14,
    color: 'var(--text)',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabBtnActive: {
    color: 'var(--accent)',
    fontWeight: 500,
    borderBottom: '2px solid var(--accent)',
  },
  cardCol: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
  },
  cardTitle: { margin: 0, fontSize: 16, color: 'var(--text-h)' },
  descriptionText: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text-h)',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  empty: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text)',
    padding: 24,
    border: '1px dashed var(--border)',
    borderRadius: 12,
    textAlign: 'center',
  },
  dl: {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  detailItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  detailLabel: {
    fontSize: 11,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: { margin: 0, fontSize: 14, color: 'var(--text-h)' },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  row: {
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg)',
    overflow: 'hidden',
  },
  rowMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 18,
  },
  rowMainBtn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 18,
    width: '100%',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
  },
  rowTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  applicantName: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  rowMeta: {
    fontSize: 13,
    color: 'var(--text)',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    border: '1px solid',
    borderRadius: 999,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  lastMessage: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-h)',
    lineHeight: 1.5,
    paddingLeft: 12,
    borderLeft: '2px solid var(--border)',
  },
  lastMessageAuthor: { fontWeight: 500, color: 'var(--text)' },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '5vh 16px',
    zIndex: 100,
    overflowY: 'auto',
  },
  modal: {
    width: 'min(720px, 100%)',
    background: 'var(--bg)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    boxShadow: '0 30px 60px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
  },
  modalHeader: {
    padding: 24,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    borderBottom: '1px solid var(--border)',
  },
  modalEyebrow: {
    display: 'inline-block',
    padding: '4px 12px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    color: 'var(--text-h)',
  },
  modalClose: {
    appearance: 'none',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text)',
    fontSize: 16,
  },
  modalBody: {
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    overflowY: 'auto',
  },
  modalSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  modalSectionTitle: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text-h)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalSectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleBtn: {
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  linkRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  extLink: {
    fontSize: 13,
    color: 'var(--accent)',
    textDecoration: 'none',
    padding: '6px 12px',
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    borderRadius: 8,
  },
  notes: {
    margin: 0,
    fontSize: 14,
    fontStyle: 'italic',
    color: 'var(--text)',
    lineHeight: 1.5,
    paddingLeft: 12,
    borderLeft: '2px solid var(--border)',
  },
  agentBox: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--accent-bg)',
    padding: 12,
    maxHeight: 360,
    overflowY: 'auto',
  },
  transcript: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  transcriptItem: {
    padding: 12,
    borderRadius: 10,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  transcriptAgent: {
    border: '1px solid var(--accent-border)',
  },
  transcriptApplicant: {},
  transcriptAuthor: {
    fontSize: 11,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: 500,
  },
  transcriptText: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text-h)',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  transcriptTime: { fontSize: 11, color: 'var(--text)' },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--bg)',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginRight: 4,
  },
  filterChip: {
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  filterChipActive: {
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    fontWeight: 600,
  },
  filterHint: {
    fontSize: 12,
    color: 'var(--text)',
    marginLeft: 'auto',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  reasoningPreview: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-h)',
    lineHeight: 1.5,
    paddingLeft: 12,
    borderLeft: '2px solid var(--accent-border)',
  },
  reasoningLabel: {
    fontWeight: 600,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  modalBadgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  primaryActionBtn: {
    appearance: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 10,
    padding: '10px 18px',
  },
  primaryActionBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  secondaryActionBtn: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--accent)',
    textDecoration: 'none',
    padding: '10px 16px',
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    borderRadius: 10,
  },
  trustGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 10,
  },
  trustStat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '12px 14px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--bg)',
  },
  trustStatLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trustStatValue: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  trustStatHint: {
    fontSize: 11,
    color: 'var(--text)',
    opacity: 0.85,
  },
  timeline: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  timelineItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingLeft: 12,
    borderLeft: '2px solid var(--border)',
  },
  timelineHead: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 6,
  },
  timelineRole: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-h)',
  },
  timelineCompany: {
    fontSize: 14,
    color: 'var(--text)',
  },
  timelineDates: {
    fontSize: 12,
    color: 'var(--text)',
    opacity: 0.85,
  },
  timelineBody: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-h)',
    lineHeight: 1.5,
  },
  skillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillChip: {
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
  },
};
