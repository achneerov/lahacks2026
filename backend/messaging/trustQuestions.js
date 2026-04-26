// Two questions when someone closes a chat (1..5 each). The backend rounds
// the average of those two scores and applies a small trust_score step (−2..+2).
//
// IDs are stable so historical closure_responses JSON stays meaningful.
const TRUST_QUESTIONS = [
  {
    id: 'resume_accuracy',
    label: "How accurate was their resume and background vs. what you saw?",
    helper: '1 = misleading · 5 = fully accurate',
  },
  {
    id: 'reliability',
    label: 'How reliable were they (timeliness, responsiveness, follow-through)?',
    helper: '1 = poor · 5 = excellent',
  },
];

// When an applicant closes with a recruiter: same trust step on the recruiter.
const RECRUITER_RATING_QUESTIONS = [
  {
    id: 'role_process_clarity',
    label: 'How clear and fair was the recruiter about the role and process?',
    helper: '1 = vague or misleading · 5 = transparent and fair',
  },
  {
    id: 'recruiter_professionalism',
    label: 'How professional was their communication?',
    helper: '1 = unprofessional · 5 = excellent',
  },
];

module.exports = { TRUST_QUESTIONS, RECRUITER_RATING_QUESTIONS };
