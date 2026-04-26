-- Sample data. All seeded accounts use password: password123 (bcrypt below).

PRAGMA foreign_keys = ON;

-- Users: 3 applicants, 2 recruiters, 1 agent
INSERT INTO users (id, role, worldu_id, email, username, password_hash, verification_level, trust_score) VALUES
  (1, 'Applicant', 'wu_alice_001',  'applicant@gmail.com',   'applicant',   '$2b$10$x2iS5NjBj/JUgPB630EwKO0RL/Hk66DJetWJ2e2iOdRRnMoWOBtPC', 'orb',    96),
  (2, 'Applicant', 'wu_bob_002',    'bob@example.com',     'bob',     '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'document', 88),
  (3, 'Applicant', 'wu_carol_003',  'carol@example.com',   'carol',   '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'device', 72),
  (7, 'Applicant', 'wu_dave_007',   'dave@example.com',    'dave',    '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'orb', 91),
  (8, 'Applicant', 'wu_eve_008',    'eve@example.com',     'eve',     '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'document', 85),
  (4, 'Recruiter', 'wu_recruiter_01', 'recruiter@gmail.com', 'recruiter', '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'orb', 90),
  (5, 'Agent',     'wu_frank_006',  'frank@agentcorp.com', 'frank_a', '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'device', 85),
  (6, 'Recruiter', 'wu_recruiter_02', 'recruiter2@gmail.com', 'recruiter2', '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'orb', 88);

-- Profiles (personal info + address)`
INSERT INTO user_profiles
  (user_id, first_name, last_name, pronouns, date_of_birth, phone_number,
   street_address, city, state, zip_code,
   linkedin_url, github_or_other_portfolio)
VALUES
  (1, 'Alice', 'Anderson', 'she/her', '1996-03-15', '+1-415-555-0101',
   '123 Market St', 'San Francisco', 'CA', '94103',
   'https://linkedin.com/in/alice', 'https://github.com/alice'),
  (2, 'Bob', 'Brown', 'he/him', '1993-07-22', '+1-212-555-0102',
   '456 Broadway', 'New York', 'NY', '10013',
   'https://linkedin.com/in/bob', 'https://github.com/bob'),
  (3, 'Carol', 'Chen', 'she/her', '1998-11-08', '+1-310-555-0103',
   '789 Sunset Blvd', 'Los Angeles', 'CA', '90028',
   'https://linkedin.com/in/carol', 'https://github.com/carol'),
  (7, 'Dave', 'Dawson', 'he/him', '1990-01-20', '+1-617-555-0104',
   '321 Beacon St', 'Boston', 'MA', '02116',
   'https://linkedin.com/in/dave-dawson', 'https://github.com/ddawson'),
  (8, 'Eve', 'Evans', 'she/her', '1994-06-12', '+1-312-555-0105',
   '555 Michigan Ave', 'Chicago', 'IL', '60611',
   'https://linkedin.com/in/eve-evans', 'https://github.com/eevans');

INSERT INTO user_documents (user_id, resume) VALUES
  (1, 'https://example.com/alice/resume.pdf'),
  (2, 'https://example.com/bob/resume.pdf'),
  (3, 'https://example.com/carol/resume.pdf'),
  (7, 'https://example.com/dave/resume.pdf'),
  (8, 'https://example.com/eve/resume.pdf');

-- Work experience
INSERT INTO user_work_experience
  (user_id, job_title, company, city, state, employment_type, start_date, end_date, current_job, responsibilities, key_achievements)
VALUES
  (1, 'Full-stack Engineer', 'TechStartup Inc', 'San Francisco', 'CA', 'FullTime', '2022-01', '', 1,
   'Build and maintain React + Node.js web applications', 'Led migration to TypeScript, reducing bugs by 40%'),
  (1, 'Junior Developer', 'WebAgency', 'San Francisco', 'CA', 'FullTime', '2020-06', '2022-01', 0,
   'Frontend development with React', 'Shipped 3 client projects on time'),
  (2, 'Backend Engineer', 'DistributedCo', 'New York', 'NY', 'FullTime', '2019-03', '', 1,
   'Design and scale distributed systems', 'Reduced API latency by 60% through caching layer'),
  (3, 'Frontend Engineer', 'DesignStudio', 'Los Angeles', 'CA', 'FullTime', '2021-09', '', 1,
   'React, animations, design systems', 'Built component library used across 5 products'),
  (7, 'VP of Engineering', 'ScaleUp Corp', 'Boston', 'MA', 'FullTime', '2020-01', '', 1,
   'Lead engineering org of 40, own technical strategy and delivery', 'Grew team from 12 to 40, shipped platform rebuild on time'),
  (7, 'Engineering Director', 'MidStage Inc', 'Boston', 'MA', 'FullTime', '2016-03', '2019-12', 0,
   'Managed 3 teams across backend, infra, and data', 'Reduced infrastructure costs by 35% through cloud migration'),
  (8, 'Senior Software Engineer', 'CloudScale', 'Chicago', 'IL', 'FullTime', '2021-01', '', 1,
   'Lead backend services team, own API platform', 'Migrated monolith to microservices, 99.99% uptime'),
  (8, 'Software Engineer', 'DataFlow Inc', 'Chicago', 'IL', 'FullTime', '2018-06', '2020-12', 0,
   'Built data pipelines and internal tools', 'Automated reporting pipeline saving 20 hours/week');

-- Education
INSERT INTO user_education
  (user_id, school, city, state, degree, major, graduation_date, graduated, gpa)
VALUES
  (1, 'UC Berkeley', 'Berkeley', 'CA', 'B.S.', 'Computer Science', '2020-05', 1, '3.7'),
  (2, 'Columbia University', 'New York', 'NY', 'M.S.', 'Computer Science', '2019-01', 1, '3.9'),
  (2, 'NYU', 'New York', 'NY', 'B.A.', 'Mathematics', '2016-05', 1, '3.6'),
  (3, 'UCLA', 'Los Angeles', 'CA', 'B.A.', 'Design Media Arts', '2021-06', 1, '3.8'),
  (7, 'MIT', 'Cambridge', 'MA', 'M.S.', 'Computer Science', '2015-06', 1, '3.9'),
  (7, 'Boston University', 'Boston', 'MA', 'B.S.', 'Computer Engineering', '2012-05', 1, '3.7'),
  (8, 'University of Illinois', 'Champaign', 'IL', 'B.S.', 'Computer Science', '2018-05', 1, '3.6');

-- Skills
INSERT INTO user_skills (user_id, skill, proficiency, years) VALUES
  (1, 'TypeScript', 'Advanced', 4),
  (1, 'React', 'Advanced', 4),
  (1, 'Node.js', 'Advanced', 4),
  (1, 'PostgreSQL', 'Intermediate', 3),
  (2, 'Python', 'Advanced', 6),
  (2, 'Go', 'Intermediate', 3),
  (2, 'Kubernetes', 'Intermediate', 2),
  (3, 'React', 'Advanced', 3),
  (3, 'Figma', 'Advanced', 4),
  (3, 'CSS/Animations', 'Advanced', 3),
  (7, 'Engineering Leadership', 'Advanced', 10),
  (7, 'Cloud Architecture', 'Advanced', 8),
  (7, 'Hiring & Org Design', 'Advanced', 6),
  (8, 'TypeScript', 'Advanced', 5),
  (8, 'Distributed Systems', 'Advanced', 4),
  (8, 'PostgreSQL', 'Advanced', 5);

-- Languages
INSERT INTO user_languages (user_id, language, proficiency) VALUES
  (1, 'English', 'Native'),
  (2, 'English', 'Native'),
  (2, 'Spanish', 'Conversational'),
  (3, 'English', 'Native'),
  (3, 'Mandarin', 'Native'),
  (7, 'English', 'Native'),
  (8, 'English', 'Native');

-- References
INSERT INTO user_references (user_id, name, relationship, company, title, phone, email) VALUES
  (1, 'Jane Smith', 'Former Manager', 'TechStartup Inc', 'Engineering Director', '+1-415-555-9999', 'jane@techstartup.com'),
  (2, 'Mike Johnson', 'Team Lead', 'DistributedCo', 'Principal Engineer', '+1-212-555-8888', 'mike@distributedco.com');

-- About me
INSERT INTO user_about_me
  (user_id, challenge_you_overcame, greatest_strength, greatest_weakness, five_year_goals, leadership_experience)
VALUES
  (1, 'Led a major TypeScript migration with tight deadlines', 'Bridging frontend and backend concerns', 'Can over-engineer solutions', 'Lead a platform engineering team', 'Mentored 2 junior developers'),
  (2, 'Scaled a service from 100 to 10k RPS under pressure', 'Deep systems thinking', 'Sometimes too focused on backend', 'Architect distributed systems at scale', 'Led a team of 4 on infra projects'),
  (3, 'Redesigned a legacy UI with zero downtime', 'Eye for design + engineering execution', 'Less experience with backend', 'Start a design engineering consultancy', 'Led design system initiative across teams');

-- Legal
INSERT INTO user_legal (user_id, us_work_authorization, requires_sponsorship, over_18) VALUES
  (1, 1, 0, 1),
  (2, 1, 0, 1),
  (3, 1, 0, 1);

-- EEO
INSERT INTO user_eeo (user_id, gender, race_ethnicity) VALUES
  (1, 'Female', 'White'),
  (2, 'Male', 'White'),
  (3, 'Female', 'Asian');

-- Three listings posted at different times
-- recruiter (id 4) owns Senior SWE + CTO
-- recruiter2 (id 6) owns Software Engineer
INSERT INTO job_postings
  (id, poster_id, title, company, employment_type, salary_min, salary_max, salary_currency,
   is_active, description, location, remote, recruiter_system_prompt,
   department, job_level, work_model, summary, key_responsibilities,
   req_years_of_experience, req_technical_skills, req_education_level,
   benefits_overview, paid_time_off_days, company_website, industry, company_size, company_stage,
   created_at)
VALUES
  -- Posted 21 days ago
  (1, 6, 'Software Engineer', 'Lahack Labs', 'FullTime', 130000, 160000, 'USD',
   1, 'Own end-to-end delivery for features across services and the web app.', 'Remote', 1,
   'We want a mid-level full-stack track record, not a specialist who avoids parts of the stack.',
   'Product Engineering', 'Mid', 'remote',
   'Build features, improve reliability, and work cross-functionally with product and design.',
   '["Design and ship features across React and API layers","Mentor juniors informally","Improve testing and monitoring","Contribute to technical design docs"]',
   3, '["TypeScript","Node.js","React","SQL"]', 'Bachelor''s',
   'Health, dental, vision, learning stipend, 401k', 22,
   'https://lahack-labs.example.com', 'Technology', 120, 'seed',
   datetime('now', '-21 days')),

  -- Posted 14 days ago
  (2, 4, 'Senior Software Engineer', 'Nexus AI', 'FullTime', 180000, 220000, 'USD',
   1, 'Lead hard technical work: scale, refactors, and long-term quality.', 'San Francisco, CA', 1,
   'Must show ownership of non-trivial systems, not just feature tickets.',
   'Product Engineering', 'Senior', 'hybrid',
   'Drive architecture decisions, unstick complex projects, and set engineering standards.',
   '["Own design for larger initiatives","Refactor and harden performance-critical areas","Mentor engineers and review architecture","Partner with product on roadmap tradeoffs"]',
   5, '["TypeScript","Distributed systems","Postgres or similar","System design"]', 'Bachelor''s or equivalent',
   'Health, dental, vision, equity, 401k, flexible PTO', 25,
   'https://nexus-ai.example.com', 'Artificial Intelligence', 85, 'Series B',
   datetime('now', '-14 days')),

  -- Posted 7 days ago
  (3, 4, 'Chief Technology Officer', 'Greenfield Ventures', 'FullTime', 250000, 350000, 'USD',
   1, 'Set technology vision, build the engineering org, and own delivery vs. risk for the product.', 'New York, NY', 1,
   'We need a leader with prior exec or VP-level product engineering scope; deep IC-only background is not enough.',
   'Executive', 'CTO', 'hybrid',
   'Lead the engineering function: strategy, hiring, delivery, and alignment with the executive team.',
   '["Set multi-year technology strategy and roadmap","Hire and develop engineering leaders","Oversee security, compliance, and reliability as we scale","Represent engineering to board and customers"]',
   10, '["Engineering leadership","Hiring and org design","Cloud/platform strategy","Stakeholder communication"]', 'Bachelor''s or higher',
   'Equity, executive benefits, flexible PTO', 30,
   'https://greenfield.example.com', 'FinTech', 45, 'Series A',
   datetime('now', '-7 days')),

  -- Posted 3 days ago (left unapplied in seed on purpose)
  (4, 4, 'Senior CTO', 'Helix Dynamics', 'FullTime', 320000, 420000, 'USD',
   1, 'Lead multi-product engineering strategy while still driving deep technical execution across platform and AI infrastructure.', 'San Francisco, CA', 1,
   'Need a hands-on executive who has scaled teams and architecture through hypergrowth.',
   'Executive', 'Senior Executive', 'hybrid',
   'Own technology direction, org design, and delivery quality across all engineering functions.',
   '["Set company-wide architecture standards","Hire and mentor engineering directors","Own reliability/security roadmap","Partner with CEO and board on strategy"]',
   12, '["Executive engineering leadership","Platform architecture","Org scaling","Cloud cost and reliability"]', 'Bachelor''s or higher',
   'Executive equity package, health, 401k, flexible PTO', 30,
   'https://helix-dynamics.example.com', 'Enterprise Software', 220, 'Series C',
   datetime('now', '-3 days')),

  -- Posted 1 day ago (left unapplied in seed on purpose)
  (5, 6, 'Chief Executive Officer (CEO)', 'Orbit Forge', 'FullTime', 380000, 550000, 'USD',
   1, 'Define company strategy, lead the executive team, and drive growth across product, go-to-market, and operations.', 'Remote', 1,
   'Founder-market fit plus prior P&L ownership and team-building experience are required.',
   'Executive', 'C-Level', 'remote',
   'Own company vision and execution while building a durable leadership team and operating cadence.',
   '["Set company strategy and annual operating plan","Lead fundraising and investor communications","Build and coach executive leadership team","Own business outcomes and organizational health"]',
   15, '["Executive leadership","Fundraising","P&L ownership","Organizational design"]', 'Bachelor''s or equivalent',
   'Executive benefits, equity, performance bonus, flexible PTO', 30,
   'https://orbit-forge.example.com', 'Climate Tech', 60, 'Series A',
   datetime('now', '-1 days'));

-- ═══════════════════════════════════════════════════════════════════════════
-- Applications
--
-- Recruiter2 (id 6) — Software Engineer at Lahack Labs (job 1):
--   Alice (85), Bob (88), Carol (78) — all accepted
--
-- Recruiter (id 4) — Senior SWE at Nexus AI (job 2):
--   Alice (75), Bob (90), Eve (82) — all accepted, mix of strong and regular
--
-- Recruiter (id 4) — CTO at Greenfield (job 3):
--   Dave (88), Carol (45) — Dave strong match, Carol weak
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO applications
  (id, applicant_id, job_posting_id, status, notes, agent_reasoning, match_score,
   created_at, updated_at, decided_at)
VALUES
  -- === Software Engineer at Lahack Labs (job 1, recruiter2) ===
  (1, 1, 1, 'SentToRecruiter',
   'Full-stack experience aligns well with mid-level expectations.',
   'Candidate owns both frontend and backend. Node.js + React match. Approved.',
   85,
   datetime('now', '-18 days'), datetime('now', '-17 days'), datetime('now', '-17 days')),
  (2, 2, 1, 'SentToRecruiter',
   'Distributed systems background is a strong plus for mid-level.',
   'Go + Python + k8s experience. Strong backend. Approved.',
   88,
   datetime('now', '-16 days'), datetime('now', '-15 days'), datetime('now', '-15 days')),
  (3, 3, 1, 'SentToRecruiter',
   'Design-engineering hybrid is a unique strength.',
   'Strong React + design system experience. Approved.',
   78,
   datetime('now', '-14 days'), datetime('now', '-13 days'), datetime('now', '-13 days')),

  -- === Senior SWE at Nexus AI (job 2, recruiter) ===
  (4, 1, 2, 'SentToRecruiter',
   'Solid TypeScript and Node.js background, stretch for senior.',
   'Candidate has 4 years experience. Approved but flagged as stretch candidate.',
   75,
   datetime('now', '-12 days'), datetime('now', '-11 days'), datetime('now', '-11 days')),
  (5, 2, 2, 'SentToRecruiter',
   'Scaling experience from 100 to 10k RPS is impressive.',
   'Deep systems work, led team of 4. Meets senior bar. Approved.',
   90,
   datetime('now', '-11 days'), datetime('now', '-10 days'), datetime('now', '-10 days')),
  (6, 8, 2, 'SentToRecruiter',
   'Strong backend and distributed systems experience.',
   'Migrated monolith to microservices, 99.99% uptime. Solid senior candidate. Approved.',
   82,
   datetime('now', '-10 days'), datetime('now', '-9 days'), datetime('now', '-9 days')),

  -- === CTO at Greenfield (job 3, recruiter) ===
  (7, 7, 3, 'SentToRecruiter',
   'VP-level engineering leadership with org-building experience.',
   'Candidate grew eng team from 12 to 40, owns technical strategy. Strong CTO fit. Approved.',
   88,
   datetime('now', '-5 days'), datetime('now', '-4 days'), datetime('now', '-4 days')),
  (8, 3, 3, 'SentToRecruiter',
   'Creative leader but limited executive experience.',
   'Led design system initiative across teams. Some leadership but no exec scope. Borderline.',
   45,
   datetime('now', '-4 days'), datetime('now', '-3 days'), datetime('now', '-3 days'));

-- ═══════════════════════════════════════════════════════════════════════════
-- Conversations — all start with interview_request card
-- Timestamps follow: job posted → applied → accepted → conversation starts
-- ═══════════════════════════════════════════════════════════════════════════

-- Agent thread (Carol ↔ Agent, no job)
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active, interview_status) VALUES
  (1, 3, 5, NULL, 1, 'none');

INSERT INTO messages (conversation_id, conversation_index, user_id, conversation_content, created_at) VALUES
  (1, 0, 5, 'Carol — I can help match you to roles that fit your design-engineer profile when you are ready to apply widely.', datetime('now', '-25 days')),
  (1, 1, 3, 'Sounds good, thanks!', datetime('now', '-25 days', '+2 hours'));

-- Alice ↔ Recruiter2 (id 6) for Software Engineer at Lahack Labs: interview scheduled
-- Conversation started 15 days ago (2 days after acceptance)
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active, interview_status) VALUES
  (2, 1, 6, 1, 1, 'scheduled');

INSERT INTO messages (conversation_id, conversation_index, user_id, conversation_content, kind, metadata, created_at) VALUES
  (2, 0, 6, 'Hi! I''d like to schedule an interview with you for the Software Engineer role at Lahack Labs. Could you share a few times that work this week?', 'interview_request', '{"role":"Software Engineer","company":"Lahack Labs","format":"30-min video call"}', datetime('now', '-15 days')),
  (2, 1, 1, 'Here are 3 times that work for me — let me know which is best.', 'availability_proposal', '{"slots":[{"label":"Mon, Apr 14, 10:00 AM","start_iso":"2026-04-14T10:00:00","end_iso":"2026-04-14T10:30:00"},{"label":"Tue, Apr 15, 2:00 PM","start_iso":"2026-04-15T14:00:00","end_iso":"2026-04-15T14:30:00"},{"label":"Wed, Apr 16, 4:00 PM","start_iso":"2026-04-16T16:00:00","end_iso":"2026-04-16T16:30:00"}]}', datetime('now', '-15 days', '+5 hours')),
  (2, 2, 6, 'Software Engineer — interview', 'calendar_invite', '{"title":"Software Engineer — interview","start_iso":"2026-04-14T10:00:00","end_iso":"2026-04-14T10:30:00","location":"Video call (link in description)","slot_label":"Mon, Apr 14, 10:00 AM","description":"Looking forward to chatting. Use the calendar invite link to add this to your schedule.","google_calendar_url":"https://calendar.google.com/calendar/render?action=TEMPLATE&text=Software+Engineer+interview&dates=20260414T100000/20260414T103000"}', datetime('now', '-14 days'));

-- Bob ↔ Recruiter (id 4) for Senior SWE at Nexus AI: interview scheduled
-- Conversation started 8 days ago (2 days after acceptance)
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active, interview_status) VALUES
  (3, 2, 4, 2, 1, 'scheduled');

INSERT INTO messages (conversation_id, conversation_index, user_id, conversation_content, kind, metadata, created_at) VALUES
  (3, 0, 4, 'Hi! I''d like to schedule an interview with you for the Senior Software Engineer role at Nexus AI. Could you share a few times that work this week?', 'interview_request', '{"role":"Senior Software Engineer","company":"Nexus AI","format":"45-min video call"}', datetime('now', '-8 days')),
  (3, 1, 2, 'Here are 3 times that work for me — let me know which is best.', 'availability_proposal', '{"slots":[{"label":"Thu, Apr 20, 1:00 PM","start_iso":"2026-04-20T13:00:00","end_iso":"2026-04-20T13:45:00"},{"label":"Fri, Apr 21, 3:00 PM","start_iso":"2026-04-21T15:00:00","end_iso":"2026-04-21T15:45:00"},{"label":"Mon, Apr 23, 9:00 AM","start_iso":"2026-04-23T09:00:00","end_iso":"2026-04-23T09:45:00"}]}', datetime('now', '-8 days', '+4 hours')),
  (3, 2, 4, 'Senior Software Engineer — interview', 'calendar_invite', '{"title":"Senior Software Engineer — interview","start_iso":"2026-04-20T13:00:00","end_iso":"2026-04-20T13:45:00","location":"Video call (link in description)","slot_label":"Thu, Apr 20, 1:00 PM","description":"Looking forward to chatting. Use the calendar invite link to add this to your schedule.","google_calendar_url":"https://calendar.google.com/calendar/render?action=TEMPLATE&text=Senior+Software+Engineer+interview&dates=20260420T130000/20260420T134500"}', datetime('now', '-7 days'));

-- Dave ↔ Recruiter (id 4) for CTO at Greenfield: just invited, awaiting response
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active, interview_status) VALUES
  (6, 4, 7, 3, 1, 'requested');

INSERT INTO messages (conversation_id, conversation_index, user_id, conversation_content, kind, metadata, created_at) VALUES
  (6, 0, 4, 'Hi! I''d like to schedule an interview with you for the Chief Technology Officer role at Greenfield Ventures. Could you share a few times that work this week?', 'interview_request', '{"role":"Chief Technology Officer","company":"Greenfield Ventures","format":"60-min video call"}', datetime('now', '-3 days'));

-- Carol ↔ Recruiter2 (id 6) for Software Engineer at Lahack Labs: just invited, awaiting response
-- Conversation started 2 days ago
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active, interview_status) VALUES
  (4, 3, 6, 1, 1, 'requested');

INSERT INTO messages (conversation_id, conversation_index, user_id, conversation_content, kind, metadata, created_at) VALUES
  (4, 0, 6, 'Hi! I''d like to schedule an interview with you for the Software Engineer role at Lahack Labs. Could you share a few times that work this week?', 'interview_request', '{"role":"Software Engineer","company":"Lahack Labs","format":"30-min video call"}', datetime('now', '-2 days'));
-- Bob ↔ Recruiter2 (id 6) for Software Engineer at Lahack Labs: interview complete, closed
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active, interview_status, closed_at) VALUES
  (5, 2, 6, 1, 0, 'complete', datetime('now', '-5 days'));

INSERT INTO messages (conversation_id, conversation_index, user_id, conversation_content, kind, metadata, created_at) VALUES
  (5, 0, 6, 'Hi! I''d like to schedule an interview with you for the Software Engineer role at Lahack Labs. Could you share a few times that work this week?', 'interview_request', '{"role":"Software Engineer","company":"Lahack Labs","format":"30-min video call"}', datetime('now', '-12 days')),
  (5, 1, 2, 'Here are 3 times that work for me — let me know which is best.', 'availability_proposal', '{"slots":[{"label":"Thu, Apr 16, 1:00 PM","start_iso":"2026-04-16T13:00:00","end_iso":"2026-04-16T13:30:00"},{"label":"Fri, Apr 17, 3:00 PM","start_iso":"2026-04-17T15:00:00","end_iso":"2026-04-17T15:30:00"},{"label":"Mon, Apr 20, 9:00 AM","start_iso":"2026-04-20T09:00:00","end_iso":"2026-04-20T09:30:00"}]}', datetime('now', '-12 days', '+3 hours')),
  (5, 2, 6, 'Software Engineer — interview', 'calendar_invite', '{"title":"Software Engineer — interview","start_iso":"2026-04-16T13:00:00","end_iso":"2026-04-16T13:30:00","location":"Video call (link in description)","slot_label":"Thu, Apr 16, 1:00 PM","description":"Looking forward to chatting. Use the calendar invite link to add this to your schedule.","google_calendar_url":"https://calendar.google.com/calendar/render?action=TEMPLATE&text=Software+Engineer+interview&dates=20260416T130000/20260416T133000"}', datetime('now', '-11 days')),
  (5, 3, 2, 'Interview went well, thanks for the opportunity!', 'text', NULL, datetime('now', '-6 days')),
  (5, 4, 6, 'Thanks Bob. We will be in touch with next steps.', 'text', NULL, datetime('now', '-6 days', '+1 hour')),
  (5, 5, 6, 'Conversation closed.', 'system', NULL, datetime('now', '-5 days'));
