-- Sample data. Password hashes are placeholders ("password123" pretend-bcrypt'd).

PRAGMA foreign_keys = ON;

-- Users: 3 applicants, 2 recruiters, 1 agent
INSERT INTO users (id, role, worldu_id, email, username, password_hash) VALUES
  (1, 'Applicant', 'wu_alice_001',  'alice@example.com',   'alice',   '$2b$10$placeholderhashforalice000000000000'),
  (2, 'Applicant', 'wu_bob_002',    'bob@example.com',     'bob',     '$2b$10$placeholderhashforbob0000000000000'),
  (3, 'Applicant', 'wu_carol_003',  'carol@example.com',   'carol',   '$2b$10$placeholderhashforcarol00000000000'),
  (4, 'Recruiter', 'wu_dana_004',   'dana@acme.com',       'dana_r',  '$2b$10$placeholderhashfordana0000000000000'),
  (5, 'Recruiter', 'wu_eric_005',   'eric@globex.com',     'eric_r',  '$2b$10$placeholderhashforeric0000000000000'),
  (6, 'Agent',     'wu_frank_006',  'frank@agentcorp.com', 'frank_a', '$2b$10$placeholderhashforfrank000000000000');

-- Profiles (personal info + address)
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
   'https://linkedin.com/in/carol', 'https://github.com/carol');

-- Documents
INSERT INTO user_documents (user_id, resume) VALUES
  (1, 'https://example.com/alice/resume.pdf'),
  (2, 'https://example.com/bob/resume.pdf'),
  (3, 'https://example.com/carol/resume.pdf');

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
   'React, animations, design systems', 'Built component library used across 5 products');

-- Education
INSERT INTO user_education
  (user_id, school, city, state, degree, major, graduation_date, graduated, gpa)
VALUES
  (1, 'UC Berkeley', 'Berkeley', 'CA', 'B.S.', 'Computer Science', '2020-05', 1, '3.7'),
  (2, 'Columbia University', 'New York', 'NY', 'M.S.', 'Computer Science', '2019-01', 1, '3.9'),
  (2, 'NYU', 'New York', 'NY', 'B.A.', 'Mathematics', '2016-05', 1, '3.6'),
  (3, 'UCLA', 'Los Angeles', 'CA', 'B.A.', 'Design Media Arts', '2021-06', 1, '3.8');

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
  (3, 'CSS/Animations', 'Advanced', 3);

-- Languages
INSERT INTO user_languages (user_id, language, proficiency) VALUES
  (1, 'English', 'Native'),
  (2, 'English', 'Native'),
  (2, 'Spanish', 'Conversational'),
  (3, 'English', 'Native'),
  (3, 'Mandarin', 'Native');

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

-- Job postings by recruiters
INSERT INTO job_postings
  (id, poster_id, title, company, description, location, remote, employment_type,
   salary_min, salary_max, salary_currency, is_active, recruiter_system_prompt)
VALUES
  (1, 4, 'Senior Backend Engineer', 'Acme Corp',
   'Own core API services. Node.js + Postgres.', 'San Francisco, CA', 1, 'FullTime',
   160000, 210000, 'USD', 1,
   'Push hard on real Postgres expertise (query plans, indexing, transactions) — generic SQL knowledge is not enough. Must have shipped production Node.js services.'),
  (2, 4, 'Frontend Engineer', 'Acme Corp',
   'Build the new customer dashboard with React.', 'Remote', 1, 'FullTime',
   130000, 170000, 'USD', 1,
   'Looking for a senior React engineer who has owned a real design system. Probe for component API design and accessibility, not just shipping screens.'),
  (3, 5, 'Software Engineering Intern', 'Globex',
   'Summer 2026 internship on the platform team.', 'New York, NY', 0, 'Internship',
   8000, 10000, 'USD', 1,
   'Mandatory: candidate must currently be enrolled in an undergraduate program and able to work onsite in New York for summer 2026. Decline immediately if either is not true.'),
  (4, 5, 'Staff ML Engineer', 'Globex',
   'Lead ML infra. PyTorch, Ray, k8s.', 'Remote', 1, 'FullTime',
   240000, 320000, 'USD', 1,
   'Need a true staff-level ML infra engineer. Must have shipped Ray or similar at scale. Decline if they only have ML researcher / notebook experience.');

-- Applications submitted by applicants
-- Status reasoning is stored in agent_reasoning to mimic a completed negotiation.
INSERT INTO applications
  (id, applicant_id, job_posting_id, status, notes, agent_reasoning,
   created_at, updated_at, decided_at)
VALUES
  (1, 1, 1, 'SentToRecruiter',
   'AI screen passed - strong Node.js + Postgres background.',
   'Candidate explicitly described production Node.js + Postgres ownership, including a TypeScript migration that reduced bugs by 40%. Aligned with recruiter directive on real Postgres expertise.',
   datetime('now', '-7 days'), datetime('now', '-6 days'), datetime('now', '-6 days')),
  (3, 1, 4, 'Declined',
   'Looking for more senior ML infra experience.',
   'Candidate has no ML infra background — primary experience is full-stack web. Fails the staff-level Ray/PyTorch requirement.',
   datetime('now', '-10 days'), datetime('now', '-8 days'), datetime('now', '-8 days')),
  (4, 2, 4, 'SentToRecruiter',
   'Distributed systems experience matches role well.',
   'Strong distributed systems background scaling 100->10k RPS, plus k8s. Lacks explicit Ray, but recruiter accepted equivalent infra depth.',
   datetime('now', '-5 days'), datetime('now', '-4 days'), datetime('now', '-4 days')),
  (6, 3, 2, 'SentToRecruiter',
   'Portfolio shows strong design-engineering chops.',
   'Built a component library used across 5 products; led a design system initiative. Solid match for the senior React + design-system bar.',
   datetime('now', '-3 days'), datetime('now', '-2 days'), datetime('now', '-2 days')),
  (7, 3, 3, 'Declined',
   'Internship requires current student status.',
   'Candidate already graduated UCLA in 2021 and is employed full-time. Fails the mandatory current-undergraduate-enrollment requirement.',
   datetime('now', '-12 days'), datetime('now', '-11 days'), datetime('now', '-11 days'));

-- Conversations
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active) VALUES
  (1, 1, 4, 1,    1),
  (2, 2, 5, 4,    1),
  (3, 3, 6, NULL, 1),
  (4, 1, 6, 2,    0);

-- Messages
INSERT INTO messages (conversation_id, conversation_index, user_id, conversation_content) VALUES
  (1, 0, 4, 'Hi Alice! Saw your profile, interested in chatting about our Senior Backend role?'),
  (1, 1, 1, 'Hey Dana, yes definitely. Is it remote-friendly?'),
  (1, 2, 4, 'Yep, remote is fine within US time zones.'),
  (2, 0, 2, 'Hi Eric, I applied for the Staff ML role last week.'),
  (2, 1, 5, 'Hey Bob, thanks - reviewing now, will follow up tomorrow.'),
  (3, 0, 6, 'Carol, I have two design-engineer leads that match your portfolio.'),
  (3, 1, 3, 'Sweet, send them over!'),
  (4, 0, 6, 'Alice, closing this thread - the role got filled.'),
  (4, 1, 1, 'No worries, thanks for letting me know.');
