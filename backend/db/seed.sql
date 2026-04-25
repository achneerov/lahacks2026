-- Sample data. Password hashes are placeholders ("password123" pretend-bcrypt'd).

PRAGMA foreign_keys = ON;

-- Users: 3 applicants, 2 recruiters
INSERT INTO users (id, role, worldu_id, email, username, password_hash) VALUES
  (1, 'Applicant', 'wu_alice_001',  'alice@example.com',   'alice',   '$2b$10$placeholderhashforalice000000000000'),
  (2, 'Applicant', 'wu_bob_002',    'bob@example.com',     'bob',     '$2b$10$placeholderhashforbob0000000000000'),
  (3, 'Applicant', 'wu_carol_003',  'carol@example.com',   'carol',   '$2b$10$placeholderhashforcarol00000000000'),
  (4, 'Recruiter', 'wu_dana_004',   'dana@acme.com',       'dana_r',  '$2b$10$placeholderhashfordana0000000000000'),
  (5, 'Recruiter', 'wu_eric_005',   'eric@globex.com',     'eric_r',  '$2b$10$placeholderhashforeric0000000000000');

-- Profiles for the Applicants only. JSON columns hold the 1:N collections from applicant.json.
INSERT INTO user_profiles (
  user_id,
  first_name, last_name, preferred_name, pronouns, date_of_birth,
  phone_number, linkedin_url, website_portfolio, github_or_other_portfolio,
  street_address, city, state, zip_code,
  documents_json,
  work_experience_json, education_json,
  technical_skills_json, languages_json, certifications_json, professional_memberships_json,
  references_json,
  challenge_you_overcame, greatest_strength, greatest_weakness, five_year_goals, leadership_experience, anything_else,
  us_work_authorization, requires_sponsorship, over_18,
  gender, race_ethnicity
) VALUES
  (1,
    'Alice', 'Anderson', 'Alice', 'she/her', '1996-04-12',
    '+1-415-555-0101', 'https://linkedin.com/in/alice', 'https://alice.dev', 'https://github.com/alice',
    '123 Market St', 'San Francisco', 'CA', '94103',
    '{"resume":"https://example.com/alice/resume.pdf","writing_samples":[],"portfolio_work_samples":["https://alice.dev/case-studies"],"transcripts":[],"certifications":[],"other_documents":[]}',
    '[{"job_title":"Senior Software Engineer","company":"Stripe","city":"San Francisco","state":"CA","employment_type":"FullTime","start_date":"2022-06-01","end_date":"","current_job":true,"responsibilities":"Owned the payment intents API surface; led migration from Ruby to Go for high-throughput services.","key_achievements":"Reduced p99 latency on intents create from 380ms to 95ms. Mentored 4 junior engineers."},{"job_title":"Software Engineer","company":"Square","city":"San Francisco","state":"CA","employment_type":"FullTime","start_date":"2019-08-01","end_date":"2022-05-30","current_job":false,"responsibilities":"Built internal tooling for the Cash App fraud team in TypeScript and Postgres.","key_achievements":"Shipped a real-time rule engine that caught $4M/yr in fraud."}]',
    '[{"school":"UC Berkeley","city":"Berkeley","state":"CA","degree":"B.S.","major":"Electrical Engineering and Computer Science","minor":"","start_date":"2015-08-01","graduation_date":"2019-05-15","graduated":true,"gpa":"3.78","honors":"Cum Laude","relevant_coursework":["Operating Systems","Distributed Systems","Databases","Algorithms"]}]',
    '[{"skill":"TypeScript","proficiency":"Expert","years":6},{"skill":"Go","proficiency":"Advanced","years":3},{"skill":"Postgres","proficiency":"Advanced","years":5},{"skill":"Kubernetes","proficiency":"Intermediate","years":3},{"skill":"React","proficiency":"Advanced","years":5}]',
    '[{"language":"English","proficiency":"Native"},{"language":"French","proficiency":"Conversational"}]',
    '["AWS Solutions Architect Associate"]',
    '[]',
    '[{"name":"Jordan Lee","relationship":"Manager at Stripe","company":"Stripe","title":"Engineering Manager","phone":"+1-415-555-0199","email":"jordan@stripe.com"}]',
    'In my first year at Stripe I owned a critical migration that fell six weeks behind. I rebuilt the rollout plan around incremental shadow traffic, brought a skeptical SRE team along, and shipped on time without an outage.',
    'Calm under pressure and good at decomposing ambiguous problems into shippable milestones.',
    'I sometimes go too deep into root-causing a bug when a quick fix would unblock the team.',
    'Become a tech lead on a payments or infra team, mentor more juniors, and ship something with measurable user-visible reliability impact.',
    'Tech lead on the payment intents team (4 engineers). Ran the on-call rotation for 18 months.',
    '',
    1, 0, 1,
    'Female', 'Asian'
  ),
  (2,
    'Bob', 'Brown', 'Bob', 'he/him', '1992-09-23',
    '+1-212-555-0102', 'https://linkedin.com/in/bob', '', 'https://github.com/bob',
    '456 Broadway', 'New York', 'NY', '10013',
    '{"resume":"https://example.com/bob/resume.pdf","writing_samples":[],"portfolio_work_samples":[],"transcripts":[],"certifications":[],"other_documents":[]}',
    '[{"job_title":"Staff Backend Engineer","company":"Datadog","city":"New York","state":"NY","employment_type":"FullTime","start_date":"2020-03-01","end_date":"","current_job":true,"responsibilities":"Owned the metrics ingestion pipeline; designed sharding for 10M points/sec.","key_achievements":"Cut ingest cost per metric by 40% via columnar batching."},{"job_title":"Software Engineer","company":"MongoDB","city":"New York","state":"NY","employment_type":"FullTime","start_date":"2017-07-01","end_date":"2020-02-28","current_job":false,"responsibilities":"Worked on the storage engine team, focusing on WiredTiger compaction.","key_achievements":"Authored 3 patches to upstream WiredTiger."}]',
    '[{"school":"Carnegie Mellon University","city":"Pittsburgh","state":"PA","degree":"M.S.","major":"Computer Science","minor":"","start_date":"2015-08-01","graduation_date":"2017-05-15","graduated":true,"gpa":"3.91","honors":"","relevant_coursework":["Distributed Systems","Database Systems","Storage Systems"]},{"school":"University of Michigan","city":"Ann Arbor","state":"MI","degree":"B.S.","major":"Computer Science","minor":"Math","start_date":"2011-08-01","graduation_date":"2015-05-01","graduated":true,"gpa":"3.85","honors":"","relevant_coursework":[]}]',
    '[{"skill":"Go","proficiency":"Expert","years":7},{"skill":"C++","proficiency":"Advanced","years":5},{"skill":"Distributed Systems","proficiency":"Expert","years":6},{"skill":"Kafka","proficiency":"Advanced","years":4},{"skill":"Cassandra","proficiency":"Advanced","years":3}]',
    '[{"language":"English","proficiency":"Native"}]',
    '[]',
    '["ACM"]',
    '[]',
    'Migrated metrics ingestion to a new sharding scheme during a quarter when ingest doubled. Caught a data-loss edge case at 2am the night before flip; held the launch a week and shipped it correctly.',
    'Deep systems intuition - I can read a flame graph and know which subsystem to suspect.',
    'I write fewer tests than I should at the prototype stage and pay for it later.',
    'Lead a database or storage team. Either at Datadog or at a younger company where I can shape the architecture from earlier.',
    'Tech lead for ingest team (6 engineers).',
    '',
    1, 0, 1,
    'Male', 'White'
  ),
  (3,
    'Carol', 'Chen', 'Carol', 'she/her', '1998-11-30',
    '+1-310-555-0103', 'https://linkedin.com/in/carol', 'https://carol.design', 'https://github.com/carol',
    '789 Sunset Blvd', 'Los Angeles', 'CA', '90028',
    '{"resume":"https://example.com/carol/resume.pdf","writing_samples":[],"portfolio_work_samples":["https://carol.design/work"],"transcripts":[],"certifications":[],"other_documents":[]}',
    '[{"job_title":"Design Engineer","company":"Linear","city":"Remote","state":"","employment_type":"FullTime","start_date":"2023-01-15","end_date":"","current_job":true,"responsibilities":"Build polished UI components for the Linear app, focused on motion and micro-interactions.","key_achievements":"Owned the new command menu redesign that shipped to all users in Q3 2024."}]',
    '[{"school":"Art Center College of Design","city":"Pasadena","state":"CA","degree":"B.F.A.","major":"Interaction Design","minor":"","start_date":"2017-08-01","graduation_date":"2021-05-15","graduated":true,"gpa":"3.92","honors":"Magna Cum Laude","relevant_coursework":["Motion Design","Front-End Engineering","Interaction Design Studio"]}]',
    '[{"skill":"React","proficiency":"Expert","years":4},{"skill":"TypeScript","proficiency":"Advanced","years":4},{"skill":"Framer Motion","proficiency":"Expert","years":3},{"skill":"Figma","proficiency":"Expert","years":5},{"skill":"CSS / Tailwind","proficiency":"Expert","years":5}]',
    '[{"language":"English","proficiency":"Native"},{"language":"Mandarin","proficiency":"Conversational"}]',
    '[]',
    '[]',
    '[]',
    'I joined Linear with no production React experience - I was a designer who had only prototyped. I shipped my first end-to-end feature within 6 weeks by pairing aggressively and reading the entire frontend codebase top to bottom.',
    'Taste. I can tell when an interaction feels right and iterate fast until it does.',
    'My systems-engineering knowledge is thinner than my product-engineering knowledge.',
    'Be a senior design engineer at a product-led company - or co-found one.',
    '',
    '',
    1, 0, 1,
    'Female', 'Asian'
  );

-- Job postings by recruiters
INSERT INTO job_postings (
  id, poster_id, job_title, employment_type, job_level,
  office_locations_json, work_model,
  salary_min, salary_max, currency,
  summary, key_responsibilities_json,
  req_years_of_experience, req_education_level, req_technical_skills_json,
  nice_technical_skills_json,
  company_name, industry, company_size, mission_values,
  recruiter_system_prompt,
  is_active
) VALUES
  (1, 4, 'Senior Backend Engineer', 'FullTime', 'Senior',
    '["San Francisco, CA"]', 'Hybrid',
    160000, 210000, 'USD',
    'Own core API services for our payments product. Node.js + Postgres at high throughput.',
    '["Design and own one or more high-traffic API surfaces","Mentor mid-level engineers","Drive p99 latency improvements"]',
    5, 'Bachelor''s', '["TypeScript","Node.js","Postgres","Distributed Systems"]',
    '["Go","Kubernetes"]',
    'Acme Corp', 'Fintech', 200, 'We move money safely and ship fast.',
    'Be skeptical of buzzwords. Push hard on real ownership of high-traffic systems and concrete latency or reliability wins. We care less about academic background, more about shipped impact.',
    1
  ),
  (2, 4, 'Frontend Engineer', 'FullTime', 'Mid',
    '["Remote (US)"]', 'Remote',
    130000, 170000, 'USD',
    'Build the new customer dashboard. React, TypeScript, design-system-first.',
    '["Build production React components in the design system","Own one or more dashboard surfaces end-to-end","Collaborate closely with designers"]',
    3, 'None required', '["React","TypeScript","CSS"]',
    '["Framer Motion","Figma"]',
    'Acme Corp', 'Fintech', 200, 'We move money safely and ship fast.',
    'We want someone with strong product taste and willingness to own UI quality. Ship-velocity matters more than years of experience.',
    1
  ),
  (3, 5, 'Software Engineering Intern', 'Internship', 'Intern',
    '["New York, NY"]', 'Onsite',
    8000, 10000, 'USD',
    'Summer 2026 internship on the platform team.',
    '["Pair with a mentor on a scoped project","Ship at least one production change"]',
    NULL, 'Currently enrolled', '["Any modern programming language"]',
    '[]',
    'Globex', 'SaaS', 1500, 'Tools that make engineers happy.',
    'Look for genuine curiosity and willingness to learn. Heavy resumes are not required.',
    1
  ),
  (4, 5, 'Staff ML Engineer', 'FullTime', 'Staff',
    '["Remote (US)"]', 'Remote',
    240000, 320000, 'USD',
    'Lead ML infra. PyTorch, Ray, Kubernetes.',
    '["Set the architecture for our training and serving stack","Mentor senior engineers","Partner with research"]',
    8, 'Master''s preferred', '["PyTorch","Ray","Kubernetes","Distributed Systems"]',
    '["CUDA","Triton"]',
    'Globex', 'SaaS', 1500, 'Tools that make engineers happy.',
    'Push hard on whether the candidate has actually owned an ML training or serving system in production at scale, not just used one. We want depth over breadth.',
    1
  );

-- Applications submitted by applicants
INSERT INTO applications
  (id, applicant_id, job_posting_id, status, notes, created_at, updated_at)
VALUES
  (1, 1, 1, 'SentToRecruiter',
   'AI screen passed - strong Node.js + Postgres background.',
   datetime('now', '-7 days'), datetime('now', '-6 days')),
  (2, 1, 2, 'Pending',
   NULL,
   datetime('now', '-2 days'), datetime('now', '-2 days')),
  (3, 1, 4, 'Declined',
   'Looking for more senior ML infra experience.',
   datetime('now', '-10 days'), datetime('now', '-8 days')),
  (4, 2, 4, 'SentToRecruiter',
   'Distributed systems experience matches role well.',
   datetime('now', '-5 days'), datetime('now', '-4 days')),
  (5, 2, 1, 'Pending',
   NULL,
   datetime('now', '-1 days'), datetime('now', '-1 days')),
  (6, 3, 2, 'SentToRecruiter',
   'Portfolio shows strong design-engineering chops.',
   datetime('now', '-3 days'), datetime('now', '-2 days')),
  (7, 3, 3, 'Declined',
   'Internship requires current student status.',
   datetime('now', '-12 days'), datetime('now', '-11 days'));

-- A live human conversation (independent of agent negotiations).
INSERT INTO conversations (id, user_1_id, user_2_id, job_posting_id, active) VALUES
  (1, 1, 4, 1, 1);

INSERT INTO messages (conversation_id, conversation_index, user_id, conversation_content) VALUES
  (1, 0, 4, 'Hi Alice! Saw your profile, interested in chatting about our Senior Backend role?'),
  (1, 1, 1, 'Hey Dana, yes definitely. Is it remote-friendly?'),
  (1, 2, 4, 'Hybrid SF, but flexible.');
