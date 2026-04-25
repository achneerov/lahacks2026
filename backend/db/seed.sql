-- Sample data. All seeded accounts use password: password123 (bcrypt below).

PRAGMA foreign_keys = ON;

-- Users: 3 applicants, 1 recruiter (recruiter@gmail.com), 1 agent
INSERT INTO users (id, role, worldu_id, email, username, password_hash, verification_level, trust_score) VALUES
  (1, 'Applicant', 'wu_alice_001',  'alice@example.com',   'alice',   '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'orb',    96),
  (2, 'Applicant', 'wu_bob_002',    'bob@example.com',     'bob',     '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'passport', 88),
  (3, 'Applicant', 'wu_carol_003',  'carol@example.com',   'carol',   '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'device', 72),
  (4, 'Recruiter', 'wu_recruiter_01', 'recruiter@gmail.com', 'recruiter', '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'orb', 90),
  (5, 'Agent',     'wu_frank_006',  'frank@agentcorp.com', 'frank_a', '$2b$10$.VsfQUmExIa0pHfkkAy5UOJWgptKjeQPa8Ti.MrkdeZTd4E3HkVVm', 'device', 85);

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

-- Four listings from junior through CTO (single recruiter)
INSERT INTO job_postings
  (id, poster_id, title, company, employment_type, salary_min, salary_max, salary_currency,
   is_active, description, location, remote, recruiter_system_prompt,
   department, job_level, work_model, summary, key_responsibilities,
   req_years_of_experience, req_technical_skills, req_education_level,
   benefits_overview, paid_time_off_days, company_website, industry, company_size, company_stage)
VALUES
  (1, 4, 'Junior Software Engineer', 'Lahack Labs', 'FullTime', 95000, 120000, 'USD',
   1, 'Ship product features and grow with a senior team.', 'Remote', 1,
   'Favor teachable, collaborative candidates who show growth mindset.',
   'Product Engineering', 'Junior', 'remote',
   'Write well-tested code in our TypeScript and React stack with regular mentorship.',
   '["Implement UI and API features with code review","Fix bugs and add tests","Participate in design and estimation","Learn the codebase with guidance from senior engineers"]',
   0, '["TypeScript","JavaScript","Git"]', 'Bachelor''s (or strong bootcamp + portfolio)',
   'Health, dental, vision, learning stipend', 20,
   'https://lahack-labs.example.com', 'Technology', 120, 'seed'),

  (2, 4, 'Software Engineer', 'Lahack Labs', 'FullTime', 130000, 160000, 'USD',
   1, 'Own end-to-end delivery for features across services and the web app.', 'Remote', 1,
   'We want a mid-level full-stack track record, not a specialist who avoids parts of the stack.',
   'Product Engineering', 'Mid', 'remote',
   'Build features, improve reliability, and work cross-functionally with product and design.',
   '["Design and ship features across React and API layers","Mentor juniors informally","Improve testing and monitoring","Contribute to technical design docs"]',
   3, '["TypeScript","Node.js","React","SQL"]', 'Bachelor''s',
   'Health, dental, vision, learning stipend, 401k', 22,
   'https://lahack-labs.example.com', 'Technology', 120, 'seed'),

  (3, 4, 'Senior Software Engineer', 'Lahack Labs', 'FullTime', 180000, 220000, 'USD',
   1, 'Lead hard technical work: scale, refactors, and long-term quality.', 'Remote', 1,
   'Must show ownership of non-trivial systems, not just feature tickets.',
   'Product Engineering', 'Senior', 'remote',
   'Drive architecture decisions, unstick complex projects, and set engineering standards.',
   '["Own design for larger initiatives","Refactor and harden performance-critical areas","Mentor engineers and review architecture","Partner with product on roadmap tradeoffs"]',
   5, '["TypeScript","Distributed systems","Postgres or similar","System design"]', 'Bachelor''s or equivalent',
   'Health, dental, vision, equity, 401k, flexible PTO', 25,
   'https://lahack-labs.example.com', 'Technology', 120, 'seed'),

  (4, 4, 'Chief Technology Officer', 'Lahack Labs', 'FullTime', 250000, 350000, 'USD',
   1, 'Set technology vision, build the engineering org, and own delivery vs. risk for the product.', 'Remote', 1,
   'We need a leader with prior exec or VP-level product engineering scope; deep IC-only background is not enough.',
   'Executive', 'CTO', 'hybrid',
   'Lead the engineering function: strategy, hiring, delivery, and alignment with the executive team.',
   '["Set multi-year technology strategy and roadmap","Hire and develop engineering leaders","Oversee security, compliance, and reliability as we scale","Represent engineering to board and customers"]',
   10, '["Engineering leadership","Hiring and org design","Cloud/platform strategy","Stakeholder communication"]', 'Bachelor''s or higher',
   'Equity, executive benefits, flexible PTO', 30,
   'https://lahack-labs.example.com', 'Technology', 120, 'seed');

-- One agent thread (applicant 3) — no job posting attached
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active) VALUES
  (1, 3, 5, NULL, 1);

INSERT INTO messages (conversation_id, conversation_index, user_id, conversation_content) VALUES
  (1, 0, 5, 'Carol — I can help match you to roles that fit your design-engineer profile when you are ready to apply widely.'),
  (1, 1, 3, 'Sounds good, thanks!');
