// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Demo data — DEV-only.
//
// Imported via dynamic import('./demo.js') from useDemoMode, behind a DEV/admin
// guard, so the whole module is tree-shaken out of production builds.
//
// THREE curated pitch projects, each leaning into a different slice of the app
// with no feature demonstrated identically twice:
//   1. LLM Hallucination Study   — team research: milestones w/ task rollup,
//      a team assignment per distribution mode (professor / team-leader /
//      self-pick), PDFs + highlights/comments, balanced contributions.
//   2. Individual Coursework     — individual track: per-student assignments
//      through the full submit → review → grade → approve loop (grades stay on
//      the prof/submission layer; tasks show status only). Auto-tasks.
//   3. Mixed In-Progress Project — mid-flight: milestones at 60% / 25% / 0%,
//      standalone + auto + subtask tasks across every status, and a deliberately
//      uneven contribution split (the "who actually did what" story).
//
// Alex Chen (demo-student-1) is the signed-in demo persona and a member of all
// three, so the student view is populated everywhere.

const PROF = {
  id: 'demo-prof-1',
  full_name: 'Dr. Sarah Rivera',
  email: 'rivera@demo.edu',
  avatar_url: null,
  role: 'professor',
  title: 'associate',
  department: 'Computer Science',
  research_areas: ['NLP', 'AI ethics', 'language models'],
  office_location: 'Engineering 308',
  office_hours: 'Tue & Thu 2–4pm',
  homepage_url: 'https://rivera.example.edu',
  bio: 'Associate professor working on language models, evaluation, and the boundaries between AI assistance and academic integrity.',
};

export const DEMO_STUDENTS = [
  { id: 'demo-student-1', full_name: 'Alex Chen',     email: 'alex@demo.edu',    role: 'student', major: 'Computer Science', year: 'junior',   interests: ['NLP', 'distributed systems', 'evaluation'], bio: 'Junior CS student focused on language model evaluation and reasoning benchmarks.' },
  { id: 'demo-student-2', full_name: 'Priya Sharma',  email: 'priya@demo.edu',   role: 'student', major: 'Computer Science', year: 'senior',   interests: ['machine learning', 'graphics', 'systems'], bio: 'Senior with a focus on probabilistic ML and graphics. Hackathon regular.' },
  { id: 'demo-student-3', full_name: 'Marcus Lee',    email: 'marcus@demo.edu',  role: 'student', major: 'Data Science',     year: 'graduate', interests: ['causal inference', 'experiment design'], bio: 'MS Data Science, second year. Interested in honest evaluation methodology.' },
  { id: 'demo-student-4', full_name: 'Yuki Tanaka',   email: 'yuki@demo.edu',    role: 'student', major: 'Computer Science', year: 'senior',   interests: ['UX', 'design systems', 'accessibility'], bio: 'Senior CS, design-leaning. Builds clean interfaces for research tools.' },
  { id: 'demo-student-5', full_name: 'Jordan Kim',    email: 'jordan@demo.edu',  role: 'student', major: 'Cognitive Science', year: 'sophomore', interests: ['psycholinguistics', 'reading research'], bio: 'Sophomore exploring intersections of language and cognition.' },
];

export const DEMO_PROFESSORS = [PROF];

const memberRecord = (student, roleInTeam = 'member') => ({
  role_in_team: roleInTeam,
  joined_at: '2026-03-15T10:00:00Z',
  profile: { id: student.id, full_name: student.full_name, avatar_url: null, role: 'student' },
});

// Task assignee helper → matches the { student: {...} } join shape Tasks.jsx
// and Milestones.jsx read (assignees[].student).
const A = (student) => ({ student: { id: student.id, full_name: student.full_name, avatar_url: null, role: 'student' } });
const S = DEMO_STUDENTS; // shorthand

export const DEMO_PROJECTS = [
  // ── PROJECT 1 — LLM Hallucination Study (team research) ───────────────────
  {
    id: 'demo-proj-1',
    title: 'LLM Hallucination Study',
    description: 'A four-person research team detecting and mitigating factual errors in large language models, building an evaluation suite over a curated dataset of common-knowledge questions.',
    course: 'CS 4890 · Advanced NLP',
    courseCode: 'CS 4890',
    courseName: 'Advanced NLP',
    status: 'active',
    progress: 58,
    dueDate: 'May 30',
    members: ['Alex Chen', 'Priya Sharma', 'Marcus Lee', 'Yuki Tanaka'],
    memberRecords: [
      memberRecord(S[0], 'leader'),
      memberRecord(S[1]),
      memberRecord(S[2]),
      memberRecord(S[3]),
    ],
    professor: PROF,
    // Milestone rollup is DERIVED from linked tasks (milestone_id). These three
    // are seeded to land on Done / In progress / Not started so the rollup
    // badges + progress bars are all visible. Legacy status/owner/due kept for
    // the Overview + AI tabs.
    milestones: [
      { id: 'demo-ms1a', order_idx: 1, title: 'Project Proposal',   status: 'done',    due: 'Apr 1',  owner: 'Alex Chen',    submissions: 2 },
      { id: 'demo-ms1b', order_idx: 2, title: 'Literature Review',  status: 'active',  due: 'Apr 18', owner: 'Priya Sharma', submissions: 3 },
      { id: 'demo-ms1c', order_idx: 3, title: 'Methodology Design', status: 'pending', due: 'May 10', owner: 'Marcus Lee',   submissions: 0 },
    ],
    tasks: [
      // Milestone tasks — also demonstrate all three assignee modes on
      // standalone (Phase-1) tasks. ms1a → 2/2 done (Done); ms1b → 1/2 (In
      // progress); ms1c → 0/2 (Not started).
      { id: 'demo-t1-1', title: 'Define the research question',        status: 'done',        assignee_mode: 'professor',   milestone_id: 'demo-ms1a', assignees: [A(S[0])] },
      { id: 'demo-t1-2', title: 'Draft the proposal document',         status: 'done',        assignee_mode: 'professor',   milestone_id: 'demo-ms1a', assignees: [A(S[1])] },
      { id: 'demo-t1-3', title: 'Survey RAG mitigation methods',       status: 'done',        assignee_mode: 'self_pick',   milestone_id: 'demo-ms1b', assignees: [A(S[2])] },
      { id: 'demo-t1-4', title: 'Synthesize the calibration section',  status: 'in_progress', assignee_mode: 'team_leader', leader_id: 'demo-student-1', milestone_id: 'demo-ms1b', assignees: [A(S[1])] },
      { id: 'demo-t1-5', title: 'Define the annotation protocol',      status: 'not_started', assignee_mode: 'professor',   milestone_id: 'demo-ms1c', assignees: [A(S[3])] },
      { id: 'demo-t1-6', title: 'Choose evaluation metrics',           status: 'not_started', assignee_mode: 'self_pick',   milestone_id: 'demo-ms1c', assignees: [] },
      // Subtask-tasks — mirror a SUBTASK of each of the three team assignments
      // below (one per distribution mode), labelled with the parent assignment.
      { id: 'demo-t1-sub-a', title: 'Data analysis pass',  status: 'in_progress', assignee_mode: 'professor', milestone_id: null, subtask_id: 'demo-st-1a-3', subtask: { id: 'demo-st-1a-3', status: 'in_progress', assignment: { id: 'demo-asgn-1a', title: 'Annotated hallucination dataset' } }, assignees: [A(S[1])] },
      { id: 'demo-t1-sub-b', title: 'Metrics module',      status: 'in_progress', assignee_mode: 'professor', milestone_id: null, subtask_id: 'demo-st-1b-1', subtask: { id: 'demo-st-1b-1', status: 'in_progress', assignment: { id: 'demo-asgn-1b', title: 'Evaluation harness' } }, assignees: [A(S[2])] },
      { id: 'demo-t1-sub-c', title: 'Medical-domain error pass', status: 'submitted', assignee_mode: 'professor', milestone_id: null, subtask_id: 'demo-st-1c-1', subtask: { id: 'demo-st-1c-1', status: 'submitted', assignment: { id: 'demo-asgn-1c', title: 'Domain error taxonomy' } }, assignees: [A(S[0])] },
    ],
    contributions: [
      { name: 'Alex Chen',    pct: 34 },
      { name: 'Priya Sharma', pct: 28 },
      { name: 'Marcus Lee',   pct: 22 },
      { name: 'Yuki Tanaka',  pct: 16 },
    ],
    activity: [
      { text: '<strong>Marcus Lee</strong> uploaded Methodology Draft.pdf',     time: '2h ago' },
      { text: '<strong>Priya Sharma</strong> commented on Literature Review',   time: '5h ago' },
      { text: '<strong>Alex Chen</strong> completed task: Define research question', time: '1d ago' },
      { text: '<strong>Claude AI</strong> flagged §2.1 for similarity review',   time: '1d ago' },
    ],
    insights: [
      { id: 1, type: 'workflow',   title: 'Submission timing consistent across team', body: 'All four members submit drafts 24–48 hours before deadlines; no last-minute crunch.', evidence: ['Median submission: 18:32 local', 'No submissions after 23:00', '0 last-minute submissions in last 4 milestones'], confidence: 4 },
      { id: 2, type: 'similarity', title: 'Minor paragraph similarity to Smith et al. 2023', body: 'Methodology §2.1 shares 14% phrasing with a published paper — likely common vocabulary, but worth a quick review.', evidence: ['Closest match: Smith et al. 2023, p.4', 'Similarity score: 14%', 'Domain-specific phrasing — common in this subfield'], confidence: 3 },
      { id: 3, type: 'positive',   title: 'Exemplary balanced workload', body: 'All four members within 18 percentage points of each other.', evidence: ['34% / 28% / 22% / 16%', 'No member below 15%', 'All on track with personal milestones'], confidence: 5 },
    ],
    pdfs: [
      { id: 'demo-pdf-1', title: 'Research Proposal v2', uploaded_by: 'Alex Chen',    uploaded_at: 'Apr 1',  pages: 5,  annotations: 6, status: 'reviewed', file_size_bytes: 612400  },
      { id: 'demo-pdf-2', title: 'Literature Review',    uploaded_by: 'Priya Sharma', uploaded_at: 'Apr 18', pages: 12, annotations: 3, status: 'reviewed', file_size_bytes: 1432800 },
      { id: 'demo-pdf-3', title: 'Methodology Draft',    uploaded_by: 'Marcus Lee',   uploaded_at: 'May 2',  pages: 8,  annotations: 3, status: 'pending',  file_size_bytes: 945200  },
    ],
    aiVerdict: { kind: 'review', label: 'Review', confidence: 3, relevance: 92 },
    isDemo: true,
  },

  // ── PROJECT 2 — Individual Coursework (individual track, grading) ─────────
  {
    id: 'demo-proj-2',
    title: 'Individual Coursework',
    description: 'Per-student assignments for the AI Ethics seminar — essays and problem sets that flow through the full submit → review → grade → approve loop. Grades stay private to the professor; the team sees status only.',
    course: 'CS 4710 · AI Ethics & Society',
    courseCode: 'CS 4710',
    courseName: 'AI Ethics & Society',
    status: 'active',
    progress: 64,
    dueDate: 'Jun 2',
    members: ['Alex Chen', 'Priya Sharma', 'Marcus Lee'],
    memberRecords: [
      memberRecord(S[0]),
      memberRecord(S[1]),
      memberRecord(S[2]),
    ],
    professor: PROF,
    milestones: [],
    // Auto-tasks: each mirrors an individual assignment (assignment_id set).
    // Status flows from the assignment's submission/review state — Submit
    // routes into the assignment flow; no manual claim/start here.
    tasks: [
      { id: 'demo-t2-auto-a', title: 'Essay 1 — AI & Authorship', status: 'done',        assignee_mode: 'professor', milestone_id: null, assignment_id: 'demo-asgn-2a', assignees: [A(S[0])] },
      { id: 'demo-t2-auto-b', title: 'Problem Set 3 — Fairness metrics', status: 'submitted', assignee_mode: 'professor', milestone_id: null, assignment_id: 'demo-asgn-2b', assignees: [A(S[0])] },
      { id: 'demo-t2-auto-c', title: 'Reflection memo — Algorithmic bias', status: 'not_started', assignee_mode: 'professor', milestone_id: null, assignment_id: 'demo-asgn-2c', assignees: [A(S[0])] },
      { id: 'demo-t2-auto-d', title: 'Midterm paper — Accountability', status: 'submitted', assignee_mode: 'professor', milestone_id: null, assignment_id: 'demo-asgn-2d', assignees: [A(S[0])] },
    ],
    contributions: [
      { name: 'Alex Chen',    pct: 38 },
      { name: 'Priya Sharma', pct: 34 },
      { name: 'Marcus Lee',   pct: 28 },
    ],
    activity: [
      { text: '<strong>Dr. Sarah Rivera</strong> approved Essay 1 · HD',        time: '3h ago' },
      { text: '<strong>Alex Chen</strong> submitted Problem Set 3',             time: '8h ago' },
      { text: '<strong>Dr. Sarah Rivera</strong> requested a resubmit on the Midterm paper', time: '1d ago' },
      { text: '<strong>Claude AI</strong> ran an originality check on Essay 1 — clear', time: '3h ago' },
    ],
    insights: [
      { id: 1, type: 'positive',   title: 'Originality check clear on Essay 1', body: 'No significant overlap with submitted or published sources; citation density is healthy.', evidence: ['Top match: 6% (common phrasing)', '14 citations across 1,800 words', 'No uncited verbatim spans'], confidence: 5 },
      { id: 2, type: 'workflow',   title: 'Steady submission cadence', body: 'Alex submits 1–2 days before each deadline — no late-night-only edits.', evidence: ['3 of 4 submitted early', 'Median lead time: 31h'], confidence: 4 },
    ],
    pdfs: [
      { id: 'demo-pdf-4', title: 'Essay 1 — AI & Authorship', uploaded_by: 'Alex Chen', uploaded_at: 'May 20', pages: 6, annotations: 4, status: 'reviewed', file_size_bytes: 712800 },
      { id: 'demo-pdf-5', title: 'Problem Set 3 writeup',     uploaded_by: 'Alex Chen', uploaded_at: 'May 28', pages: 4, annotations: 1, status: 'pending',  file_size_bytes: 488200 },
    ],
    aiVerdict: { kind: 'clear', label: 'Clear', confidence: 5, relevance: 95 },
    isDemo: true,
  },

  // ── PROJECT 3 — Mixed In-Progress Project (live status + contributions) ───
  {
    id: 'demo-proj-3',
    title: 'Mixed In-Progress Project',
    description: 'A climate-data dashboard mid-flight: milestones at varied completion, every task type and status in play, and a visibly uneven contribution split that surfaces who is actually carrying the work.',
    course: 'CS 3550 · Data Visualization',
    courseCode: 'CS 3550',
    courseName: 'Data Visualization',
    status: 'at_risk',
    progress: 38,
    dueDate: 'Jun 12',
    members: ['Alex Chen', 'Yuki Tanaka', 'Jordan Kim'],
    memberRecords: [
      memberRecord(S[0], 'leader'),
      memberRecord(S[3]),
      memberRecord(S[4]),
    ],
    professor: PROF,
    // Milestones seeded to land on 60% / 25% / 0% via done-fraction of their
    // linked tasks (3/5, 1/4, 0/3).
    milestones: [
      { id: 'demo-ms3a', order_idx: 1, title: 'Data Pipeline', status: 'active',  due: 'May 10', owner: 'Alex Chen',   submissions: 3 },
      { id: 'demo-ms3b', order_idx: 2, title: 'Modeling',      status: 'active',  due: 'May 28', owner: 'Yuki Tanaka', submissions: 1 },
      { id: 'demo-ms3c', order_idx: 3, title: 'Writeup',       status: 'pending', due: 'Jun 12', owner: 'All',         submissions: 0 },
    ],
    tasks: [
      // ms3a → 3/5 done = 60%
      { id: 'demo-t3-1', title: 'Ingest NOAA dataset',        status: 'done',        assignee_mode: 'professor', milestone_id: 'demo-ms3a', assignees: [A(S[0])] },
      { id: 'demo-t3-2', title: 'Dedupe + normalize records', status: 'done',        assignee_mode: 'professor', milestone_id: 'demo-ms3a', assignees: [A(S[0])] },
      { id: 'demo-t3-3', title: 'Missing-value imputation',   status: 'done',        assignee_mode: 'self_pick',  milestone_id: 'demo-ms3a', assignees: [A(S[3])] },
      { id: 'demo-t3-4', title: 'Schema validation',          status: 'in_progress', assignee_mode: 'professor', milestone_id: 'demo-ms3a', assignees: [A(S[0])] },
      { id: 'demo-t3-5', title: 'Pipeline tests',             status: 'not_started', assignee_mode: 'self_pick',  milestone_id: 'demo-ms3a', assignees: [] },
      // ms3b → 1/4 done = 25%
      { id: 'demo-t3-6', title: 'Baseline model',             status: 'done',        assignee_mode: 'professor', milestone_id: 'demo-ms3b', assignees: [A(S[3])] },
      { id: 'demo-t3-7', title: 'Feature engineering',        status: 'submitted',   assignee_mode: 'professor', milestone_id: 'demo-ms3b', assignees: [A(S[0])] },
      { id: 'demo-t3-8', title: 'Hyperparameter sweep',       status: 'in_progress', assignee_mode: 'team_leader', leader_id: 'demo-student-1', milestone_id: 'demo-ms3b', assignees: [A(S[4])] },
      { id: 'demo-t3-9', title: 'Model card',                 status: 'not_started', assignee_mode: 'self_pick',  milestone_id: 'demo-ms3b', assignees: [] },
      // ms3c → 0/3 done = 0%
      { id: 'demo-t3-10', title: 'Results section', status: 'in_progress', assignee_mode: 'professor', milestone_id: 'demo-ms3c', assignees: [A(S[0])] },
      { id: 'demo-t3-11', title: 'Discussion',      status: 'not_started', assignee_mode: 'professor', milestone_id: 'demo-ms3c', assignees: [A(S[3])] },
      { id: 'demo-t3-12', title: 'Abstract',        status: 'not_started', assignee_mode: 'self_pick',  milestone_id: 'demo-ms3c', assignees: [] },
      // Standalone task (no milestone, no assignment) — Phase-1 plain task.
      { id: 'demo-t3-standalone', title: 'Set up CI for the dashboard repo', status: 'in_progress', assignee_mode: 'self_pick', milestone_id: null, assignees: [A(S[0])] },
      // Auto-task — mirrors an individual assignment (assignment_id).
      { id: 'demo-t3-auto', title: 'Weekly progress report', status: 'submitted', assignee_mode: 'professor', milestone_id: null, assignment_id: 'demo-asgn-3a', assignees: [A(S[0])] },
      // Subtask-task — mirrors a team-assignment subtask (subtask_id).
      { id: 'demo-t3-sub', title: 'Interactive viz prototype', status: 'not_started', assignee_mode: 'professor', milestone_id: null, subtask_id: 'demo-st-3b-1', subtask: { id: 'demo-st-3b-1', status: 'open', assignment: { id: 'demo-asgn-3b', title: 'Dashboard build' } }, assignees: [A(S[3])] },
    ],
    contributions: [
      { name: 'Alex Chen',   pct: 58 },
      { name: 'Yuki Tanaka', pct: 30 },
      { name: 'Jordan Kim',  pct: 12 },
    ],
    activity: [
      { text: '<strong>Claude AI</strong> flagged a contribution imbalance', time: '6h ago' },
      { text: '<strong>Alex Chen</strong> submitted Feature engineering',    time: '1d ago' },
      { text: '<strong>Yuki Tanaka</strong> completed Baseline model',       time: '2d ago' },
      { text: '<strong>Alex Chen</strong> raised a milestone-slippage concern', time: '2d ago' },
    ],
    insights: [
      { id: 1, type: 'contribution_imbalance', title: 'Jordan Kim well behind expected contribution', body: 'Jordan is at 12% by week 7 — peers in a similar role typically reach 25–30%. Worth a check-in.', evidence: ['Last commit: 9 days ago', 'No comments on the last 2 milestones', '0 tasks marked done this sprint'], confidence: 4 },
      { id: 2, type: 'timing_anomaly',         title: 'Modeling milestone likely to slip', body: 'Current modeling progress projects a June 3 completion vs. the May 28 deadline.', evidence: ['25% of milestone tasks done by date', 'Hyperparameter sweep still in progress'], confidence: 3 },
    ],
    pdfs: [
      { id: 'demo-pdf-6', title: 'Pipeline Spec',  uploaded_by: 'Alex Chen',   uploaded_at: 'May 4', pages: 7, annotations: 3, status: 'reviewed', file_size_bytes: 836000 },
      { id: 'demo-pdf-7', title: 'Modeling Notes', uploaded_by: 'Yuki Tanaka', uploaded_at: 'May 20', pages: 5, annotations: 2, status: 'pending',  file_size_bytes: 604800 },
    ],
    aiVerdict: { kind: 'flagged', label: 'Needs attention', confidence: 4, relevance: 88 },
    isDemo: true,
  },
];

// Flat pdf_documents-shaped view for any consumer needing a lookup.
export const DEMO_PDFS = DEMO_PROJECTS.flatMap(p =>
  (p.pdfs || []).map(pdf => ({
    id: pdf.id,
    team_id: p.id,
    title: pdf.title,
    uploaded_by: pdf.uploaded_by,
    uploaded_at: pdf.uploaded_at,
    page_count: pdf.pages,
    file_size_bytes: pdf.file_size_bytes,
    status: pdf.status,
  }))
);

function demoAuthor(student) {
  return { id: student.id, full_name: student.full_name, avatar_url: null, role: 'student' };
}
function demoAuthorProf() {
  return { id: PROF.id, full_name: PROF.full_name, avatar_url: null, role: 'professor' };
}
function hoursAgo(h) { const d = new Date(); d.setHours(d.getHours() - h); return d.toISOString(); }
function daysAgo(n)  { const d = new Date(); d.setDate(d.getDate() - n);   return d.toISOString(); }

const noBox = { x: 0, y: 0, w: 0, h: 0 };
const cmt = (id, doc, page, content, author, opts = {}) => ({
  id, document_id: doc, annotation_type: 'comment', page_number: page, content,
  resolved: opts.resolved ?? false, color: null, bbox: noBox,
  created_at: opts.created_at ?? hoursAgo(opts.hoursAgo ?? 6), author,
});
const hl = (id, doc, page, text, author, color = '#facc15', created_at = null) => ({
  id, document_id: doc, annotation_type: 'highlight', page_number: page, content: text,
  resolved: false, color, bbox: { ...noBox, text }, created_at: created_at ?? daysAgo(2), author,
});

export const DEMO_PDF_COMMENTS = [
  // P1 demo-pdf-1 — Research Proposal (a fresh prof comment + student reply drive the preview)
  cmt('demo-c-1', 'demo-pdf-1', 1, 'Strong framing — consider moving the research question above the dataset description.', demoAuthor(S[1]), { created_at: '2026-04-02T14:12:00Z', resolved: false }),
  cmt('demo-c-2', 'demo-pdf-1', 2, 'Can we tighten scope? Three eval domains feels ambitious for the timeline.',          demoAuthor(S[2]), { created_at: '2026-04-03T09:40:00Z', resolved: true }),
  cmt('demo-c-3', 'demo-pdf-1', 1, 'Great work on the methodology framing — that is the strongest part of the proposal.', demoAuthorProf(), { hoursAgo: 3 }),
  cmt('demo-c-4', 'demo-pdf-1', 2, 'Should we add more citations for the §2 claims? A couple feel under-supported.',       demoAuthor(S[2]), { hoursAgo: 1 }),
  // P1 demo-pdf-2 — Literature Review
  cmt('demo-c-5', 'demo-pdf-2', 4, 'Smith et al. 2023 belongs in §3, not §2 — different evaluation regime.',               demoAuthor(S[0]), { created_at: '2026-04-19T11:20:00Z' }),
  cmt('demo-c-6', 'demo-pdf-2', 9, 'Could you expand the calibration-failure section? It is the most novel angle here.',    demoAuthorProf(), { hoursAgo: 7 }),
  // P1 demo-pdf-3 — Methodology Draft
  cmt('demo-c-7', 'demo-pdf-3', 2, 'BERTScore alone will not catch factual errors — pair it with an NLI-based check?',      demoAuthor(S[0]), { created_at: '2026-05-03T10:10:00Z' }),
  cmt('demo-c-8', 'demo-pdf-3', 5, 'Sample-size justification needs a power calculation.',                                  demoAuthor(S[1]), { hoursAgo: 28 }),
  // P2 demo-pdf-4 — Essay 1 (prof review comments — integrity/grading feel)
  cmt('demo-c-9',  'demo-pdf-4', 1, 'Clear thesis. Tie the authorship argument back to the Floridi reading in your intro.', demoAuthorProf(), { hoursAgo: 4 }),
  cmt('demo-c-10', 'demo-pdf-4', 3, 'This paragraph is the crux — consider leading the section with it.',                    demoAuthor(S[1]), { hoursAgo: 30 }),
  cmt('demo-c-11', 'demo-pdf-4', 5, 'Originality check came back clear; nice citation hygiene throughout.',                 demoAuthorProf(), { hoursAgo: 3, resolved: true }),
  // P2 demo-pdf-5 — Problem Set 3
  cmt('demo-c-12', 'demo-pdf-5', 2, 'Double-check the demographic-parity vs. equalized-odds distinction in Q2.',            demoAuthorProf(), { hoursAgo: 5 }),
  // P3 demo-pdf-6 — Pipeline Spec
  cmt('demo-c-13', 'demo-pdf-6', 1, 'Link the actual NOAA license page, not the landing site.',                            demoAuthor(S[3]), { created_at: '2026-05-05T12:00:00Z' }),
  cmt('demo-c-14', 'demo-pdf-6', 3, 'A missing-station coverage map would really help the reader here.',                    demoAuthor(S[0]), { hoursAgo: 26 }),
  // P3 demo-pdf-7 — Modeling Notes
  cmt('demo-c-15', 'demo-pdf-7', 2, 'Lock the random seed before the hyperparameter sweep so results are reproducible.',    demoAuthor(S[0]), { hoursAgo: 9 }),
];

export const DEMO_PDF_HIGHLIGHTS = [
  hl('demo-h-1', 'demo-pdf-1', 1, 'detects and mitigates factual errors in large language', demoAuthor(S[1]), '#facc15', '2026-04-02T14:13:00Z'),
  hl('demo-h-2', 'demo-pdf-1', 3, 'curated dataset of common knowledge questions',          demoAuthor(S[3]), '#86efac', '2026-04-04T16:06:00Z'),
  hl('demo-h-3', 'demo-pdf-2', 4, 'retrieval augmented generation reduces fabrication',     demoAuthor(S[0]), '#facc15', '2026-04-19T11:21:00Z'),
  hl('demo-h-4', 'demo-pdf-3', 2, 'across three evaluated domains',                          demoAuthor(S[0]), '#fda4af'),
  hl('demo-h-5', 'demo-pdf-4', 1, 'careful human study',                                     demoAuthor(S[1]), '#86efac'),
  hl('demo-h-6', 'demo-pdf-6', 1, 'consistent gains over the baseline approach',             demoAuthor(S[0]), '#facc15'),
  hl('demo-h-7', 'demo-pdf-7', 2, 'reduces fabrication across three evaluated domains',      demoAuthor(S[3]), '#86efac'),
];

// ── Assignments ────────────────────────────────────────────────────────────
function demoSub(student, status, opts = {}) {
  const id = opts.id ?? `demo-sub-${student.id}-${Date.now() + Math.floor(Math.random() * 1000)}`;
  return {
    id,
    assignment_id: opts.assignment_id ?? null,
    team_id: opts.team_id ?? null,
    submitter_id: student.id,
    submitter: { id: student.id, full_name: student.full_name, avatar_url: null, role: 'student' },
    status,
    version: opts.version ?? 1,
    notes: opts.notes ?? null,
    feedback: opts.feedback ?? null,
    pdf_document_id: null,
    storage_path: null,
    pdf: opts.pdfTitle ? { id: `demo-pdf-${id}`, title: opts.pdfTitle, file_size_bytes: 712800, page_count: 8 } : null,
    submitted_at: opts.submitted_at ?? hoursAgo(opts.submittedHoursAgo ?? 18),
    reviewed_at: opts.reviewed_at ?? null,
    reviewer: opts.reviewer ?? null,
    points_awarded: opts.points_awarded ?? null,
    letter_grade: opts.letter_grade ?? null,
    created_at: opts.created_at ?? (opts.submitted_at ?? hoursAgo(opts.submittedHoursAgo ?? 18)),
  };
}
const _PROF_AS_REVIEWER = { id: PROF.id, full_name: PROF.full_name, avatar_url: null, role: 'professor' };
const subRow = (id, asg, title, desc, student, status, opts = {}) => ({
  id, assignment_id: asg, title, description: desc,
  assigned_to: student ? student.id : null,
  assignee: student ? { id: student.id, full_name: student.full_name, avatar_url: null, role: 'student' } : null,
  assigned_by: opts.assigned_by ?? null,
  status, claimed_at: opts.claimed_at ?? null, created_at: opts.created_at ?? daysAgo(6),
});

// PROJECT 1 — three TEAM assignments, one per distribution mode.
DEMO_PROJECTS[0].assignments = [
  {
    id: 'demo-asgn-1a', team_id: 'demo-proj-1',
    title: 'Annotated hallucination dataset',
    description: '1,000 annotated samples across three eval domains. Subtasks land in an open pool — any member can claim one.',
    due_at: daysAgo(-4), owner_id: PROF.id, owner: _PROF_AS_REVIEWER,
    status: 'active', order_idx: 1, created_at: daysAgo(20), updated_at: daysAgo(2),
    assignment_type: 'team', distribution_mode: 'self_pick',
    max_points: 100, deadline_type: 'grace', grace_days: 3, ai_plagiarism_check: false,
    team_points_awarded: null, team_letter_grade: null,
    assignees: [],
    subtasks: [
      subRow('demo-st-1a-1', 'demo-asgn-1a', 'Literature scan',  'Survey existing hallucination-eval methods.', null, 'open', { claimed_at: null }),
      subRow('demo-st-1a-2', 'demo-asgn-1a', 'Annotation guide', 'Write the inter-rater protocol.',             null, 'open', { claimed_at: null }),
      subRow('demo-st-1a-3', 'demo-asgn-1a', 'Data analysis pass', 'Run BERTScore + NLI across the labeled set.', S[1], 'in_progress', { claimed_at: daysAgo(2) }),
    ],
    leaders: [],
    submissions: [],
  },
  {
    id: 'demo-asgn-1b', team_id: 'demo-proj-1',
    title: 'Evaluation harness',
    description: 'Reusable eval harness for the three domains. The team leader assigns each subtask.',
    due_at: daysAgo(-9), owner_id: PROF.id, owner: _PROF_AS_REVIEWER,
    status: 'active', order_idx: 2, created_at: daysAgo(16), updated_at: daysAgo(3),
    assignment_type: 'team', distribution_mode: 'team_leader',
    max_points: 100, deadline_type: 'hard', grace_days: null, ai_plagiarism_check: true,
    assignees: [],
    subtasks: [
      subRow('demo-st-1b-1', 'demo-asgn-1b', 'Metrics module',  'Implement BERTScore + NLI scorers.',  S[2], 'in_progress', { assigned_by: S[0].id, claimed_at: daysAgo(3) }),
      subRow('demo-st-1b-2', 'demo-asgn-1b', 'Runner + caching', 'Batch runner with result caching.',  S[3], 'open',        { assigned_by: S[0].id }),
    ],
    leaders: [
      { id: 'demo-lead-1b', assignment_id: 'demo-asgn-1b', leader_id: S[0].id, leader: { id: S[0].id, full_name: S[0].full_name, avatar_url: null, role: 'student' }, designated_by: PROF.id, designated_at: daysAgo(16) },
    ],
    submissions: [],
  },
  {
    id: 'demo-asgn-1c', team_id: 'demo-proj-1',
    title: 'Domain error taxonomy',
    description: 'A per-domain taxonomy of error types. The professor assigns each subtask directly.',
    due_at: daysAgo(-2), owner_id: PROF.id, owner: _PROF_AS_REVIEWER,
    status: 'active', order_idx: 3, created_at: daysAgo(12), updated_at: daysAgo(1),
    assignment_type: 'team', distribution_mode: 'professor',
    max_points: 80, deadline_type: 'hard', grace_days: null, ai_plagiarism_check: false,
    assignees: [],
    subtasks: [
      subRow('demo-st-1c-1', 'demo-asgn-1c', 'Medical-domain error pass', 'Tag factual-error types in the medical split.', S[0], 'submitted',  { assigned_by: PROF.id }),
      subRow('demo-st-1c-2', 'demo-asgn-1c', 'Legal-domain error pass',   'Tag factual-error types in the legal split.',   S[2], 'in_progress', { assigned_by: PROF.id }),
    ],
    leaders: [],
    submissions: [],
  },
];

// PROJECT 2 — INDIVIDUAL assignments through the full review/grade loop.
DEMO_PROJECTS[1].assignments = [
  {
    // Done / graded — full approve.
    id: 'demo-asgn-2a', team_id: 'demo-proj-2',
    title: 'Essay 1 — AI & Authorship',
    description: '1,800-word essay: when does AI assistance cross into co-authorship? Cite at least three course readings.',
    due_at: daysAgo(6), owner_id: PROF.id, owner: _PROF_AS_REVIEWER,
    status: 'active', order_idx: 1, created_at: daysAgo(20), updated_at: hoursAgo(3),
    assignment_type: 'individual', max_points: 100, deadline_type: 'hard',
    submissions: [
      demoSub(S[0], 'approved', { assignment_id: 'demo-asgn-2a', team_id: 'demo-proj-2', pdfTitle: 'Essay 1 - Alex.pdf', submittedHoursAgo: 40, reviewed_at: hoursAgo(3), reviewer: _PROF_AS_REVIEWER, points_awarded: 91, letter_grade: 'HD', feedback: 'Excellent — the authorship-spectrum framing is original. Tighten the Floridi tie-in and this is publishable as an op-ed.' }),
    ],
    assignees: [],
  },
  {
    // Submitted — awaiting review.
    id: 'demo-asgn-2b', team_id: 'demo-proj-2',
    title: 'Problem Set 3 — Fairness metrics',
    description: 'Work the demographic-parity vs. equalized-odds problems; show your derivations.',
    due_at: daysAgo(-1), owner_id: PROF.id, owner: _PROF_AS_REVIEWER,
    status: 'active', order_idx: 2, created_at: daysAgo(8), updated_at: hoursAgo(8),
    assignment_type: 'individual', max_points: 50, deadline_type: 'hard',
    submissions: [
      demoSub(S[0], 'submitted', { assignment_id: 'demo-asgn-2b', team_id: 'demo-proj-2', pdfTitle: 'Problem Set 3 - Alex.pdf', submittedHoursAgo: 8 }),
    ],
    assignees: [],
  },
  {
    // Not started — no submission yet.
    id: 'demo-asgn-2c', team_id: 'demo-proj-2',
    title: 'Reflection memo — Algorithmic bias',
    description: 'One-pager reflecting on a real-world algorithmic-bias case of your choosing.',
    due_at: daysAgo(-6), owner_id: PROF.id, owner: _PROF_AS_REVIEWER,
    status: 'active', order_idx: 3, created_at: daysAgo(3), updated_at: daysAgo(3),
    assignment_type: 'individual', max_points: 20, deadline_type: 'hard',
    submissions: [],
    assignees: [],
  },
  {
    // Review loop — resubmit requested on v1, approved on v2 (both in history).
    id: 'demo-asgn-2d', team_id: 'demo-proj-2',
    title: 'Midterm paper — Accountability',
    description: '2,000-word paper on accountability gaps in automated decision systems.',
    due_at: daysAgo(4), owner_id: PROF.id, owner: _PROF_AS_REVIEWER,
    status: 'active', order_idx: 4, created_at: daysAgo(18), updated_at: hoursAgo(20),
    assignment_type: 'individual', max_points: 100, deadline_type: 'hard',
    submissions: [
      demoSub(S[0], 'submitted', { id: 'demo-sub-2d-v2', assignment_id: 'demo-asgn-2d', team_id: 'demo-proj-2', version: 2, pdfTitle: 'Midterm v2 - Alex.pdf', submittedHoursAgo: 20 }),
      demoSub(S[0], 'resubmit_requested', { id: 'demo-sub-2d-v1', assignment_id: 'demo-asgn-2d', team_id: 'demo-proj-2', version: 1, pdfTitle: 'Midterm v1 - Alex.pdf', submittedHoursAgo: 72, reviewed_at: hoursAgo(48), reviewer: _PROF_AS_REVIEWER, feedback: 'Good core argument, but §3 needs the Mittelstadt framework and a concrete case. Please revise and resubmit.' }),
    ],
    assignees: [],
  },
];

// PROJECT 3 — one INDIVIDUAL (→ auto-task) + one TEAM (→ subtask-task).
DEMO_PROJECTS[2].assignments = [
  {
    id: 'demo-asgn-3a', team_id: 'demo-proj-3',
    title: 'Weekly progress report',
    description: 'Short individual status report: what you shipped this week, blockers, next steps.',
    due_at: daysAgo(-1), owner_id: PROF.id, owner: _PROF_AS_REVIEWER,
    status: 'active', order_idx: 1, created_at: daysAgo(7), updated_at: hoursAgo(10),
    assignment_type: 'individual', max_points: 10, deadline_type: 'hard',
    submissions: [
      demoSub(S[0], 'submitted', { assignment_id: 'demo-asgn-3a', team_id: 'demo-proj-3', pdfTitle: 'Progress report - Alex.pdf', submittedHoursAgo: 10 }),
    ],
    assignees: [],
  },
  {
    id: 'demo-asgn-3b', team_id: 'demo-proj-3',
    title: 'Dashboard build',
    description: 'Build the interactive climate dashboard. Professor assigns the subtasks.',
    due_at: daysAgo(-12), owner_id: PROF.id, owner: _PROF_AS_REVIEWER,
    status: 'active', order_idx: 2, created_at: daysAgo(10), updated_at: daysAgo(2),
    assignment_type: 'team', distribution_mode: 'professor',
    max_points: 100, deadline_type: 'hard', grace_days: null, ai_plagiarism_check: false,
    assignees: [],
    subtasks: [
      subRow('demo-st-3b-1', 'demo-asgn-3b', 'Interactive viz prototype', 'D3 prototype for the temperature series.', S[3], 'open',        { assigned_by: PROF.id }),
      subRow('demo-st-3b-2', 'demo-asgn-3b', 'Accessibility pass',        'Colour-contrast + keyboard nav.',          S[4], 'in_progress', { assigned_by: PROF.id }),
    ],
    leaders: [],
    submissions: [],
  },
];

// ── Notifications ────────────────────────────────────────────────────────────
const _PROJ1 = { id: 'demo-proj-1', name: 'LLM Hallucination Study' };
const _PROJ2 = { id: 'demo-proj-2', name: 'Individual Coursework' };
const _PROJ3 = { id: 'demo-proj-3', name: 'Mixed In-Progress Project' };

export const DEMO_NOTIFICATIONS = [
  { id: 'demo-n-1',  type: 'submission_reviewed', title: 'Submission approved', body: 'Dr. Sarah Rivera approved your "Essay 1 — AI & Authorship" · HD (91/100) · Excellent — the authorship-spectrum framing is original.', link: '/projects/demo-proj-2', related_team_id: _PROJ2.id, team: _PROJ2, read: false, created_at: hoursAgo(3) },
  { id: 'demo-n-2',  type: 'pdf_comment',  title: 'New PDF comment',  body: 'Dr. Sarah Rivera commented on Research Proposal v2: Great work on the methodology framing — that is the str…', link: '/projects/demo-proj-1/pdfs/demo-pdf-1?page=1', related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: hoursAgo(3) },
  { id: 'demo-n-3',  type: 'ai_insight',   title: 'AI flagged a contribution imbalance', body: 'Jordan Kim is at 12% by week 7 on Mixed In-Progress Project — peers average 25–30%.', link: '/projects/demo-proj-3', related_team_id: _PROJ3.id, team: _PROJ3, read: false, created_at: hoursAgo(6) },
  { id: 'demo-n-4',  type: 'submission_received', title: 'New submission', body: 'Alex Chen submitted Problem Set 3 — Fairness metrics.', link: '/projects/demo-proj-2', related_team_id: _PROJ2.id, team: _PROJ2, read: false, created_at: hoursAgo(8) },
  { id: 'demo-n-5',  type: 'pdf_comment',  title: 'New PDF comment', body: 'Marcus Lee commented on Research Proposal v2: Should we add more citations for the §2 claims? A couple fe…', link: '/projects/demo-proj-1/pdfs/demo-pdf-1?page=2', related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: hoursAgo(1) },
  { id: 'demo-n-6',  type: 'subtask_assigned', title: 'You were assigned a subtask', body: 'Dr. Sarah Rivera assigned you "Medical-domain error pass" on Domain error taxonomy.', link: '/projects/demo-proj-1', related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: hoursAgo(9) },
  { id: 'demo-n-7',  type: 'submission_reviewed', title: 'Resubmission requested', body: 'Dr. Sarah Rivera asked for a resubmit on "Midterm paper — Accountability": §3 needs the Mittelstadt framework.', link: '/projects/demo-proj-2', related_team_id: _PROJ2.id, team: _PROJ2, read: true, created_at: daysAgo(1) },
  { id: 'demo-n-8',  type: 'pdf_uploaded', title: 'New PDF uploaded', body: 'Yuki Tanaka uploaded Modeling Notes to Mixed In-Progress Project.', link: '/projects/demo-proj-3/pdfs/demo-pdf-7', related_team_id: _PROJ3.id, team: _PROJ3, read: true, created_at: daysAgo(1) },
  { id: 'demo-n-9',  type: 'deadline_reminder', title: 'Due soon', body: '"Annotated hallucination dataset" has open subtasks: Literature scan, Annotation guide.', link: '/projects/demo-proj-1', related_team_id: _PROJ1.id, team: _PROJ1, read: true, created_at: daysAgo(2) },
  { id: 'demo-n-10', type: 'decision_required', title: 'Review needed: 14% similarity in LLM Study §2.1', body: 'Closest match: Smith et al. 2023. Likely common phrasing.', link: '/projects/demo-proj-1', related_team_id: _PROJ1.id, team: _PROJ1, read: true, created_at: daysAgo(2) },
];

// Weekday-weighted contribution heatmap (mid-week peak, quiet weekends, tapering recent weeks).
function buildDemoHeatmap() {
  const pattern = [];
  for (let week = 0; week < 12; week++) {
    for (let day = 0; day < 7; day++) {
      const weekdayBoost = day >= 1 && day <= 4 ? 1 : 0;
      const peakDay = day === 2 || day === 3 ? 1 : 0;
      const recency = week >= 10 ? -1 : week >= 6 ? 0 : 1;
      const noise = (week * 7 + day) % 3;
      pattern.push(Math.max(0, Math.min(4, weekdayBoost + peakDay + recency + noise - 1)));
    }
  }
  return pattern;
}
export const DEMO_HEATMAP = buildDemoHeatmap();

export const DEMO_CURRENT_STUDENT_ID = 'demo-student-1';

export function getDemoProjectsForStudent(studentId, projects = DEMO_PROJECTS) {
  return projects.filter(p => (p.memberRecords ?? []).some(m => m.profile?.id === studentId));
}

export function findDemoProfileById(id) {
  if (!id || !id.startsWith('demo-')) return null;
  if (id.startsWith('demo-prof'))    return DEMO_PROFESSORS.find(p => p.id === id) ?? null;
  if (id.startsWith('demo-student')) return DEMO_STUDENTS.find(s => s.id === id) ?? null;
  return null;
}

const STUDENT_DEMO_PROJECT_COUNT = getDemoProjectsForStudent(DEMO_CURRENT_STUDENT_ID).length;

export const DEMO_STATS = {
  professor: { projects: DEMO_PROJECTS.length, students: DEMO_STUDENTS.length, atRisk: DEMO_PROJECTS.filter(p => p.status === 'at_risk').length },
  student:   { projects: STUDENT_DEMO_PROJECT_COUNT },
};
