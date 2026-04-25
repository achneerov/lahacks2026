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

-- Profiles for the Applicants only
INSERT INTO user_profiles
  (user_id, full_name, phone, address_line1, city, state, postal_code, country,
   headline, bio, resume_url, linkedin_url, github_url, portfolio_url, years_experience)
VALUES
  (1, 'Alice Anderson', '+1-415-555-0101', '123 Market St', 'San Francisco', 'CA', '94103', 'USA',
   'Full-stack engineer', 'Loves TypeScript and Postgres.', 'https://example.com/alice/resume.pdf',
   'https://linkedin.com/in/alice', 'https://github.com/alice', 'https://alice.dev', 4),
  (2, 'Bob Brown', '+1-212-555-0102', '456 Broadway', 'New York', 'NY', '10013', 'USA',
   'Backend engineer', 'Distributed systems nerd.', 'https://example.com/bob/resume.pdf',
   'https://linkedin.com/in/bob', 'https://github.com/bob', NULL, 6),
  (3, 'Carol Chen', '+1-310-555-0103', '789 Sunset Blvd', 'Los Angeles', 'CA', '90028', 'USA',
   'Frontend / design engineer', 'React, animations, design systems.', 'https://example.com/carol/resume.pdf',
   'https://linkedin.com/in/carol', 'https://github.com/carol', 'https://carol.design', 3);

-- Job postings by recruiters
INSERT INTO job_postings
  (id, poster_id, title, company, description, location, remote, employment_type,
   salary_min, salary_max, salary_currency, is_active)
VALUES
  (1, 4, 'Senior Backend Engineer', 'Acme Corp',
   'Own core API services. Node.js + Postgres.', 'San Francisco, CA', 1, 'FullTime',
   160000, 210000, 'USD', 1),
  (2, 4, 'Frontend Engineer', 'Acme Corp',
   'Build the new customer dashboard with React.', 'Remote', 1, 'FullTime',
   130000, 170000, 'USD', 1),
  (3, 5, 'Software Engineering Intern', 'Globex',
   'Summer 2026 internship on the platform team.', 'New York, NY', 0, 'Internship',
   8000, 10000, 'USD', 1),
  (4, 5, 'Staff ML Engineer', 'Globex',
   'Lead ML infra. PyTorch, Ray, k8s.', 'Remote', 1, 'FullTime',
   240000, 320000, 'USD', 1);

-- Conversations
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active) VALUES
  (1, 1, 4, 1,    1), -- Alice (Applicant) <-> Dana (Recruiter), about Senior Backend role
  (2, 2, 5, 4,    1), -- Bob   (Applicant) <-> Eric (Recruiter), about Staff ML role
  (3, 3, 6, NULL, 1), -- Carol (Applicant) <-> Frank (Agent), general
  (4, 1, 6, 2,    0); -- Alice (Applicant) <-> Frank (Agent), about Frontend role, inactive

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
