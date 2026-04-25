// Questions a recruiter answers when closing a conversation. Each is scored
// 1..5 and the average is folded back into the applicant's trust_score.
//
// IDs are stable so the frontend can localize labels later without breaking
// historical closure_responses payloads.
const TRUST_QUESTIONS = [
  {
    id: 'resume_accuracy',
    label: "How accurate was the candidate's resume vs. what you saw in the interview?",
    helper: '1 = significantly exaggerated · 5 = matched perfectly',
  },
  {
    id: 'skills_honesty',
    label: 'Did the candidate honestly represent their skills?',
    helper: '1 = misrepresented · 5 = exactly as claimed',
  },
  {
    id: 'professionalism',
    label: 'Were they professional during the interview?',
    helper: '1 = unprofessional · 5 = exemplary',
  },
  {
    id: 'reliability',
    label: 'Did they follow through (show up on time, respond promptly)?',
    helper: '1 = no-show or unresponsive · 5 = perfectly reliable',
  },
  {
    id: 'recommend_again',
    label: 'Would you trust them to represent your company in front of others?',
    helper: '1 = no · 5 = absolutely',
  },
];

module.exports = { TRUST_QUESTIONS };
