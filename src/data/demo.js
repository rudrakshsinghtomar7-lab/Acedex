// Demo data — DEV-only.
//
// This file is imported via a dynamic `import('./demo.js')` from
// `useDemoMode`, behind an `if (!DEV) return` guard. With Vite's static
// analysis, the prod bundle never reaches the import, so this entire
// module + its chunk are dead in production builds. Verified by inspecting
// `dist/assets/` after `npm run build`.

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

export const DEMO_PROJECTS = [
  {
    id: 'demo-proj-1',
    title: 'LLM Hallucination Study',
    description: 'Investigating ways to detect and mitigate factual errors in large language models. Building an evaluation suite over a curated dataset of common-knowledge questions.',
    course: 'CS 4890 · Advanced NLP',
    courseCode: 'CS 4890',
    courseName: 'Advanced NLP',
    status: 'active',
    progress: 62,
    dueDate: 'May 30',
    members: ['Alex Chen', 'Priya Sharma', 'Marcus Lee', 'Yuki Tanaka'],
    memberRecords: [
      memberRecord(DEMO_STUDENTS[0], 'leader'),
      memberRecord(DEMO_STUDENTS[1]),
      memberRecord(DEMO_STUDENTS[2]),
      memberRecord(DEMO_STUDENTS[3]),
    ],
    professor: PROF,
    milestones: [
      { id: 1, title: 'Project Proposal',    status: 'done',    due: 'Apr 1',  owner: 'Alex Chen',     submissions: 2 },
      { id: 2, title: 'Literature Review',   status: 'done',    due: 'Apr 14', owner: 'Priya Sharma',  submissions: 3 },
      { id: 3, title: 'Methodology Design',  status: 'active',  due: 'May 5',  owner: 'Marcus Lee',    submissions: 1 },
      { id: 4, title: 'Experiments & Results', status: 'pending', due: 'May 20', owner: 'Yuki Tanaka', submissions: 0 },
      { id: 5, title: 'Final Paper',         status: 'pending', due: 'May 30', owner: 'All',           submissions: 0 },
    ],
    tasks: [
      { id: 1, title: 'Annotate hallucination dataset (1000 samples)', done: false, assignee: 'Alex Chen',     priority: 'high', due: 'May 10' },
      { id: 2, title: 'Implement BERTScore evaluator',                 done: false, assignee: 'Marcus Lee',    priority: 'high', due: 'May 12' },
      { id: 3, title: 'Write methods section draft',                   done: false, assignee: 'Priya Sharma',  priority: 'med',  due: 'May 15' },
      { id: 4, title: 'Create result visualizations',                  done: false, assignee: 'Yuki Tanaka',   priority: 'med',  due: 'May 18' },
      { id: 5, title: 'Peer review pass',                              done: true,  assignee: 'Alex Chen',     priority: 'low',  due: 'Apr 28' },
      { id: 6, title: 'Citation cleanup',                              done: true,  assignee: 'Priya Sharma',  priority: 'low',  due: 'Apr 25' },
    ],
    contributions: [
      { name: 'Alex Chen',    pct: 34 },
      { name: 'Priya Sharma', pct: 28 },
      { name: 'Marcus Lee',   pct: 22 },
      { name: 'Yuki Tanaka',  pct: 16 },
    ],
    activity: [
      { text: '<strong>Marcus Lee</strong> uploaded methodology_draft_v2.pdf',  time: '2h ago' },
      { text: '<strong>Priya Sharma</strong> commented on Literature Review',   time: '5h ago' },
      { text: '<strong>Alex Chen</strong> completed task: Peer review pass',    time: '1d ago' },
      { text: '<strong>Yuki Tanaka</strong> joined the team',                   time: '6d ago' },
      { text: '<strong>Claude AI</strong> flagged §2.1 for similarity review',  time: '1d ago' },
      { text: '<strong>Priya Sharma</strong> submitted Literature Review v3',   time: '2d ago' },
    ],
    insights: [
      { id: 1, type: 'workflow',   title: 'Submission timing consistent across team', body: 'All four members submit drafts 24–48 hours before deadlines; no late-night-only patterns.', evidence: ['Median submission: 18:32 local', 'No submissions after 23:00', '0 last-minute submissions in last 4 milestones'], confidence: 4 },
      { id: 2, type: 'similarity', title: 'Minor paragraph similarity to Smith et al. 2023', body: 'Methodology section §2.1 shares 14% phrasing with a published paper. Likely common-vocabulary, but worth a quick review.', evidence: ['Closest match: Smith et al. 2023, p.4', 'Similarity score: 14%', 'Domain-specific phrasing — common in this subfield'], confidence: 3 },
      { id: 3, type: 'positive',   title: 'Exemplary balanced workload',                    body: 'All four members within 18 percentage points of each other.', evidence: ['34% / 28% / 22% / 16%', 'No member below 15%', 'All on track with personal milestones'], confidence: 5 },
    ],
    pdfs: [
      { id: 'demo-pdf-1', title: 'Project Proposal v2',  uploaded_by: 'Alex Chen',    uploaded_at: 'Apr 1',  pages: 5,  annotations: 7,  status: 'reviewed', file_size_bytes: 612400  },
      { id: 'demo-pdf-2', title: 'Literature Review',    uploaded_by: 'Priya Sharma', uploaded_at: 'Apr 14', pages: 12, annotations: 14, status: 'reviewed', file_size_bytes: 1432800 },
      { id: 'demo-pdf-3', title: 'Methodology v1',       uploaded_by: 'Marcus Lee',   uploaded_at: 'May 1',  pages: 8,  annotations: 3,  status: 'pending',  file_size_bytes: 945200  },
    ],
    aiVerdict: { kind: 'review', label: 'Review', confidence: 3, relevance: 92 },
    isDemo: true,
  },
  {
    id: 'demo-proj-2',
    title: 'Distributed Systems Capstone',
    description: 'Building a fault-tolerant key-value store with consensus. Focused on correctness under network partitions.',
    course: 'CS 4980 · Capstone Project',
    courseCode: 'CS 4980',
    courseName: 'Capstone Project',
    status: 'active',
    progress: 41,
    dueDate: 'Jun 10',
    members: ['Priya Sharma', 'Marcus Lee', 'Jordan Kim'],
    memberRecords: [
      memberRecord(DEMO_STUDENTS[1], 'leader'),
      memberRecord(DEMO_STUDENTS[2]),
      memberRecord(DEMO_STUDENTS[4]),
    ],
    professor: PROF,
    milestones: [
      { id: 1, title: 'Architecture Plan',     status: 'done',   due: 'Apr 5',  owner: 'Priya Sharma', submissions: 1 },
      { id: 2, title: 'Consensus Prototype',   status: 'active', due: 'May 12', owner: 'Marcus Lee',   submissions: 2 },
      { id: 3, title: 'Partition Test Suite',  status: 'pending', due: 'May 25', owner: 'Jordan Kim',  submissions: 0 },
      { id: 4, title: 'Final Demo',            status: 'pending', due: 'Jun 10', owner: 'All',          submissions: 0 },
    ],
    tasks: [
      { id: 1, title: 'Raft leader election write-up',     done: true,  assignee: 'Priya Sharma', priority: 'high', due: 'Apr 18' },
      { id: 2, title: 'Implement log replication',         done: false, assignee: 'Marcus Lee',   priority: 'high', due: 'May 8'  },
      { id: 3, title: 'Set up Jepsen-style test harness',  done: false, assignee: 'Jordan Kim',   priority: 'high', due: 'May 14' },
      { id: 4, title: 'Benchmark throughput vs etcd',      done: false, assignee: 'Priya Sharma', priority: 'med',  due: 'May 22' },
    ],
    contributions: [
      { name: 'Priya Sharma', pct: 42 },
      { name: 'Marcus Lee',   pct: 35 },
      { name: 'Jordan Kim',   pct: 23 },
    ],
    activity: [
      { text: '<strong>Marcus Lee</strong> pushed log_replication.rs',         time: '4h ago' },
      { text: '<strong>Priya Sharma</strong> opened discussion: Raft variant', time: '1d ago' },
      { text: '<strong>Claude AI</strong> highlighted consistent test patterns', time: '2d ago' },
    ],
    insights: [
      { id: 1, type: 'workflow', title: 'Strong code review hygiene', body: 'Every PR has at least two reviewer comments before merge.', evidence: ['Avg comments/PR: 3.4', 'No PRs merged without review'], confidence: 5 },
      { id: 2, type: 'positive', title: 'Jordan Kim ramping fast',     body: 'Newest member is contributing at 23% by week 6 — typical for week 10.', evidence: ['Joined Apr 1', '5 PRs merged', 'Active on every milestone discussion'], confidence: 4 },
    ],
    pdfs: [
      { id: 'demo-pdf-4', title: 'Architecture Plan v3', uploaded_by: 'Priya Sharma', uploaded_at: 'Apr 5', pages: 9, annotations: 11, status: 'reviewed', file_size_bytes: 1108400 },
      { id: 'demo-pdf-5', title: 'Consensus Prototype',  uploaded_by: 'Marcus Lee',   uploaded_at: 'May 1', pages: 6, annotations: 4,  status: 'pending',  file_size_bytes: 728300  },
    ],
    aiVerdict: { kind: 'clear', label: 'Clear', confidence: 5, relevance: 96 },
    isDemo: true,
  },
  {
    id: 'demo-proj-3',
    title: 'Climate Data Visualization',
    description: 'Interactive visualization of 50 years of regional climate data. Public-facing dashboard for non-technical readers.',
    course: 'CS 3550 · Data Visualization',
    courseCode: 'CS 3550',
    courseName: 'Data Visualization',
    status: 'at_risk',
    progress: 28,
    dueDate: 'Jun 5',
    members: ['Yuki Tanaka', 'Jordan Kim', 'Alex Chen'],
    memberRecords: [
      memberRecord(DEMO_STUDENTS[3], 'leader'),
      memberRecord(DEMO_STUDENTS[4]),
      memberRecord(DEMO_STUDENTS[0]),
    ],
    professor: PROF,
    milestones: [
      { id: 1, title: 'Data Sourcing',         status: 'done',    due: 'Apr 20', owner: 'Yuki Tanaka', submissions: 1 },
      { id: 2, title: 'Cleaning Pipeline',     status: 'active',  due: 'May 8',  owner: 'Alex Chen',   submissions: 1 },
      { id: 3, title: 'Visualization Designs', status: 'pending', due: 'May 22', owner: 'Yuki Tanaka', submissions: 0 },
      { id: 4, title: 'Interactive Prototype', status: 'pending', due: 'Jun 5',  owner: 'All',          submissions: 0 },
    ],
    tasks: [
      { id: 1, title: 'NOAA dataset ingest script',  done: true,  assignee: 'Yuki Tanaka', priority: 'high', due: 'Apr 15' },
      { id: 2, title: 'Handle missing-station data', done: false, assignee: 'Alex Chen',   priority: 'high', due: 'May 6'  },
      { id: 3, title: 'Sketch 5 visualization options', done: false, assignee: 'Yuki Tanaka', priority: 'med', due: 'May 12' },
      { id: 4, title: 'Accessibility audit',         done: false, assignee: 'Jordan Kim',  priority: 'med',  due: 'May 25' },
    ],
    contributions: [
      { name: 'Yuki Tanaka', pct: 48 },
      { name: 'Alex Chen',   pct: 38 },
      { name: 'Jordan Kim',  pct: 14 },
    ],
    activity: [
      { text: '<strong>Yuki Tanaka</strong> raised concern about milestone slippage', time: '2d ago' },
      { text: '<strong>Claude AI</strong> flagged contribution imbalance',            time: '1d ago' },
      { text: '<strong>Alex Chen</strong> requested help with data cleaning',         time: '3d ago' },
    ],
    insights: [
      { id: 1, type: 'contribution_imbalance', title: 'Jordan Kim significantly behind expected contribution', body: 'Jordan is at 14% by week 6 — peers in similar role typically reach 25–30%. Worth a check-in.', evidence: ['Last commit: 8 days ago', 'No comments on last 2 milestones', '0 tasks marked done this sprint'], confidence: 4 },
      { id: 2, type: 'timing_anomaly',         title: 'Milestone 2 likely to miss deadline',                  body: 'Current cleaning pipeline progress projects May 14 completion vs. May 8 deadline.', evidence: ['43% of expected commits by date', 'No PR opened for milestone 2 yet'], confidence: 3 },
    ],
    pdfs: [
      { id: 'demo-pdf-6', title: 'Data Source Audit',      uploaded_by: 'Yuki Tanaka', uploaded_at: 'Apr 20', pages: 4, annotations: 6, status: 'reviewed', file_size_bytes: 487200 },
      { id: 'demo-pdf-7', title: 'Cleaning Pipeline Spec', uploaded_by: 'Alex Chen',   uploaded_at: 'May 2',  pages: 7, annotations: 9, status: 'pending',  file_size_bytes: 836000 },
    ],
    aiVerdict: { kind: 'flagged', label: 'Needs attention', confidence: 4, relevance: 88 },
    isDemo: true,
  },
  {
    id: 'demo-proj-4',
    title: 'Mobile Reading App',
    description: 'Cross-platform reading companion app focused on long-form articles, with offline support and shared annotation lists.',
    course: 'CS 4250 · Software Engineering',
    courseCode: 'CS 4250',
    courseName: 'Software Engineering',
    status: 'completed',
    progress: 100,
    dueDate: 'Apr 30',
    members: ['Marcus Lee', 'Priya Sharma', 'Yuki Tanaka'],
    memberRecords: [
      memberRecord(DEMO_STUDENTS[2], 'leader'),
      memberRecord(DEMO_STUDENTS[1]),
      memberRecord(DEMO_STUDENTS[3]),
    ],
    professor: PROF,
    milestones: [
      { id: 1, title: 'Requirements',  status: 'done', due: 'Feb 10', owner: 'Marcus Lee',    submissions: 1 },
      { id: 2, title: 'MVP Build',     status: 'done', due: 'Mar 15', owner: 'Priya Sharma',  submissions: 2 },
      { id: 3, title: 'Usability Test', status: 'done', due: 'Apr 10', owner: 'Yuki Tanaka',   submissions: 1 },
      { id: 4, title: 'Final Release', status: 'done', due: 'Apr 30', owner: 'All',            submissions: 1 },
    ],
    tasks: [],
    contributions: [
      { name: 'Marcus Lee',   pct: 34 },
      { name: 'Priya Sharma', pct: 33 },
      { name: 'Yuki Tanaka',  pct: 33 },
    ],
    activity: [
      { text: '<strong>Marcus Lee</strong> archived the project',           time: 'May 1' },
      { text: '<strong>Yuki Tanaka</strong> submitted final retrospective', time: 'Apr 30' },
    ],
    insights: [
      { id: 1, type: 'positive', title: 'Exceptional balance and timing throughout', body: 'Three members within 1pp of each other; every milestone on or ahead of schedule.', evidence: ['Contribution stddev: 0.6', 'All milestones met early', 'Zero late submissions'], confidence: 5 },
    ],
    pdfs: [
      { id: 'demo-pdf-8', title: 'Final Report',           uploaded_by: 'Marcus Lee',   uploaded_at: 'Apr 30', pages: 18, annotations: 22, status: 'reviewed', file_size_bytes: 2256000 },
      { id: 'demo-pdf-9', title: 'Usability Test Results', uploaded_by: 'Yuki Tanaka', uploaded_at: 'Apr 15', pages: 10, annotations: 15, status: 'reviewed', file_size_bytes: 1232000 },
    ],
    aiVerdict: { kind: 'clear', label: 'Clear', confidence: 5, relevance: 98 },
    isDemo: true,
  },
  {
    id: 'demo-proj-5',
    title: 'Causal Inference Reading Group',
    description: 'Independent study: working through Pearl & Mackenzie\'s "The Book of Why" with weekly writeups and applied problems.',
    course: 'CS 4990 · Independent Study',
    courseCode: 'CS 4990',
    courseName: 'Independent Study',
    status: 'active',
    progress: 55,
    dueDate: 'Jul 15',
    members: ['Marcus Lee'],
    memberRecords: [
      memberRecord(DEMO_STUDENTS[2], 'leader'),
    ],
    professor: PROF,
    milestones: [
      { id: 1, title: 'Chapters 1–4 writeup', status: 'done',    due: 'Mar 30', owner: 'Marcus Lee', submissions: 1 },
      { id: 2, title: 'Chapters 5–7 writeup', status: 'done',    due: 'Apr 30', owner: 'Marcus Lee', submissions: 1 },
      { id: 3, title: 'Chapters 8–10 writeup', status: 'active', due: 'May 30', owner: 'Marcus Lee', submissions: 0 },
      { id: 4, title: 'Final synthesis paper', status: 'pending', due: 'Jul 15', owner: 'Marcus Lee', submissions: 0 },
    ],
    tasks: [
      { id: 1, title: 'Summarize Chapter 8: counterfactuals', done: false, assignee: 'Marcus Lee', priority: 'med', due: 'May 18' },
      { id: 2, title: 'Work problem set 7',                   done: false, assignee: 'Marcus Lee', priority: 'med', due: 'May 22' },
    ],
    contributions: [
      { name: 'Marcus Lee', pct: 100 },
    ],
    activity: [
      { text: '<strong>Marcus Lee</strong> submitted Chapter 5–7 writeup',     time: '5d ago' },
      { text: '<strong>Dr. Sarah Rivera</strong> left feedback on writeup',    time: '4d ago' },
    ],
    insights: [],
    pdfs: [
      { id: 'demo-pdf-10', title: 'Chapters 1–4 writeup', uploaded_by: 'Marcus Lee', uploaded_at: 'Mar 30', pages: 6, annotations: 4, status: 'reviewed', file_size_bytes: 712800 },
      { id: 'demo-pdf-11', title: 'Chapters 5–7 writeup', uploaded_by: 'Marcus Lee', uploaded_at: 'Apr 30', pages: 7, annotations: 5, status: 'reviewed', file_size_bytes: 824400 },
    ],
    aiVerdict: { kind: 'clear', label: 'Clear', confidence: 5, relevance: 94 },
    isDemo: true,
  },
];

// Flat view of all demo PDFs across projects, shaped like pdf_documents rows.
// PDFs.jsx adapts directly from project.pdfs, but consumers that need a flat
// lookup (notifications, search) can use this.
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

// Demo annotations shaped like pdf_annotations rows so PDFs.jsx can render
// them without further adaptation. Keyed by document_id; author is a demo
// student or the professor so Avatar resolves a name and the preview can
// surface a professor badge.
function demoAuthor(student) {
  return { id: student.id, full_name: student.full_name, avatar_url: null, role: 'student' };
}
function demoAuthorProf() {
  return { id: PROF.id, full_name: PROF.full_name, avatar_url: null, role: 'professor' };
}

// Anchor a handful of preview comments to "now" so the list shows live
// relative timestamps ("2h ago", "1d ago") regardless of when the demo is
// opened. The remaining static dates give the impression of historical
// review threads behind the freshest activity.
function hoursAgo(h) {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const DEMO_PDF_COMMENTS = [
  // demo-pdf-1: Project Proposal v2 — preview pulls the prof comment + a fresh student reply.
  { id: 'demo-c-1',  document_id: 'demo-pdf-1', annotation_type: 'comment', page_number: 1, content: 'Strong framing — consider moving the research question above the dataset description.', resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: '2026-04-02T14:12:00Z', author: demoAuthor(DEMO_STUDENTS[1]) },
  { id: 'demo-c-2',  document_id: 'demo-pdf-1', annotation_type: 'comment', page_number: 2, content: 'Can we tighten the scope? Three eval domains feels ambitious for the timeline.',         resolved: true,  color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: '2026-04-03T09:40:00Z', author: demoAuthor(DEMO_STUDENTS[2]) },
  { id: 'demo-c-3',  document_id: 'demo-pdf-1', annotation_type: 'comment', page_number: 3, content: 'Add a sentence about ethical review — Dr. Rivera will ask.',                              resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: '2026-04-04T16:05:00Z', author: demoAuthor(DEMO_STUDENTS[3]) },
  { id: 'demo-c-13', document_id: 'demo-pdf-1', annotation_type: 'comment', page_number: 1, content: 'Great work on the methodology section — your evaluation framing is the strongest part.', resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: hoursAgo(3),          author: demoAuthorProf() },
  { id: 'demo-c-14', document_id: 'demo-pdf-1', annotation_type: 'comment', page_number: 2, content: 'Should we add more citations for the §2 claims? A couple feel under-supported.',         resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: hoursAgo(1),          author: demoAuthor(DEMO_STUDENTS[2]) },

  // demo-pdf-2: Literature Review
  { id: 'demo-c-4',  document_id: 'demo-pdf-2', annotation_type: 'comment', page_number: 4, content: 'Smith et al. 2023 belongs in §3, not §2 — different evaluation regime.',                 resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: '2026-04-15T11:20:00Z', author: demoAuthor(DEMO_STUDENTS[0]) },
  { id: 'demo-c-5',  document_id: 'demo-pdf-2', annotation_type: 'comment', page_number: 7, content: 'Nice synthesis of the retrieval-vs-parametric debate.',                                   resolved: true,  color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: '2026-04-16T13:55:00Z', author: demoAuthor(DEMO_STUDENTS[2]) },
  { id: 'demo-c-15', document_id: 'demo-pdf-2', annotation_type: 'comment', page_number: 9, content: 'Could you expand the section on calibration failure modes? It\'s the most novel angle.', resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: hoursAgo(7),          author: demoAuthorProf() },

  // demo-pdf-3: Methodology v1
  { id: 'demo-c-6',  document_id: 'demo-pdf-3', annotation_type: 'comment', page_number: 2, content: 'BERTScore alone won\'t catch factual errors — pair with NLI-based check?',                resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: '2026-05-02T10:10:00Z', author: demoAuthor(DEMO_STUDENTS[0]) },
  { id: 'demo-c-7',  document_id: 'demo-pdf-3', annotation_type: 'comment', page_number: 5, content: 'Sample size justification needs a power calc.',                                           resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: hoursAgo(28),         author: demoAuthor(DEMO_STUDENTS[1]) },

  // demo-pdf-4: Architecture Plan v3
  { id: 'demo-c-8',  document_id: 'demo-pdf-4', annotation_type: 'comment', page_number: 3, content: 'Are we committing to Raft over Multi-Paxos? Worth a paragraph on the trade-off.',         resolved: true,  color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: '2026-04-06T15:00:00Z', author: demoAuthor(DEMO_STUDENTS[2]) },
  { id: 'demo-c-9',  document_id: 'demo-pdf-4', annotation_type: 'comment', page_number: 6, content: 'Storage layer diagram is clean — keep it.',                                               resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: daysAgo(2),           author: demoAuthor(DEMO_STUDENTS[4]) },

  // demo-pdf-6: Data Source Audit
  { id: 'demo-c-10', document_id: 'demo-pdf-6', annotation_type: 'comment', page_number: 1, content: 'NOAA license terms — link to the actual page, not the landing site.',                     resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: '2026-04-21T12:00:00Z', author: demoAuthor(DEMO_STUDENTS[0]) },
  { id: 'demo-c-11', document_id: 'demo-pdf-6', annotation_type: 'comment', page_number: 3, content: 'Missing-station coverage map would help the reader.',                                     resolved: false, color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: daysAgo(1),           author: demoAuthor(DEMO_STUDENTS[4]) },

  // demo-pdf-8: Final Report
  { id: 'demo-c-12', document_id: 'demo-pdf-8', annotation_type: 'comment', page_number: 9, content: 'Usability section reads great — promote two of the quotes to the abstract.',              resolved: true,  color: null, bbox: { x: 0, y: 0, w: 0, h: 0 }, created_at: '2026-04-30T18:00:00Z', author: demoAuthor(DEMO_STUDENTS[1]) },
];

export const DEMO_PDF_HIGHLIGHTS = [
  // demo-pdf-1
  { id: 'demo-h-1',  document_id: 'demo-pdf-1', annotation_type: 'highlight', page_number: 1, content: 'detect and mitigate factual errors in large language models', resolved: false, color: '#facc15', bbox: { x: 0, y: 0, w: 0, h: 0, text: 'detect and mitigate factual errors in large language models' }, created_at: '2026-04-02T14:13:00Z', author: demoAuthor(DEMO_STUDENTS[1]) },
  { id: 'demo-h-2',  document_id: 'demo-pdf-1', annotation_type: 'highlight', page_number: 3, content: 'curated dataset of common-knowledge questions',                resolved: false, color: '#86efac', bbox: { x: 0, y: 0, w: 0, h: 0, text: 'curated dataset of common-knowledge questions' },                created_at: '2026-04-04T16:06:00Z', author: demoAuthor(DEMO_STUDENTS[3]) },

  // demo-pdf-2
  { id: 'demo-h-3',  document_id: 'demo-pdf-2', annotation_type: 'highlight', page_number: 4, content: 'retrieval-augmented generation reduces fabrication by 38%',     resolved: false, color: '#facc15', bbox: { x: 0, y: 0, w: 0, h: 0, text: 'retrieval-augmented generation reduces fabrication by 38%' }, created_at: '2026-04-15T11:21:00Z', author: demoAuthor(DEMO_STUDENTS[0]) },

  // demo-pdf-3
  { id: 'demo-h-4',  document_id: 'demo-pdf-3', annotation_type: 'highlight', page_number: 2, content: 'BERTScore evaluator',                                          resolved: false, color: '#fda4af', bbox: { x: 0, y: 0, w: 0, h: 0, text: 'BERTScore evaluator' },                                          created_at: '2026-05-02T10:11:00Z', author: demoAuthor(DEMO_STUDENTS[0]) },
  { id: 'demo-h-5',  document_id: 'demo-pdf-3', annotation_type: 'highlight', page_number: 5, content: 'n = 1000 questions across three domains',                       resolved: false, color: '#facc15', bbox: { x: 0, y: 0, w: 0, h: 0, text: 'n = 1000 questions across three domains' },                       created_at: '2026-05-03T08:31:00Z', author: demoAuthor(DEMO_STUDENTS[1]) },

  // demo-pdf-4
  { id: 'demo-h-6',  document_id: 'demo-pdf-4', annotation_type: 'highlight', page_number: 3, content: 'Raft consensus with single-leader election',                    resolved: false, color: '#86efac', bbox: { x: 0, y: 0, w: 0, h: 0, text: 'Raft consensus with single-leader election' },                    created_at: '2026-04-06T15:01:00Z', author: demoAuthor(DEMO_STUDENTS[2]) },

  // demo-pdf-6
  { id: 'demo-h-7',  document_id: 'demo-pdf-6', annotation_type: 'highlight', page_number: 1, content: 'NOAA Global Historical Climatology Network',                    resolved: false, color: '#facc15', bbox: { x: 0, y: 0, w: 0, h: 0, text: 'NOAA Global Historical Climatology Network' },                    created_at: '2026-04-21T12:01:00Z', author: demoAuthor(DEMO_STUDENTS[0]) },

  // demo-pdf-8
  { id: 'demo-h-8',  document_id: 'demo-pdf-8', annotation_type: 'highlight', page_number: 9, content: 'all five participants completed the core task unaided',         resolved: false, color: '#86efac', bbox: { x: 0, y: 0, w: 0, h: 0, text: 'all five participants completed the core task unaided' },         created_at: '2026-04-30T18:01:00Z', author: demoAuthor(DEMO_STUDENTS[1]) },
];

// Shaped to match the NOTIFICATION_SELECT projection the panel reads against
// the live DB: created_at (ISO) drives relativeTime; link is what tapping a
// row navigates to; related_team_id + team.name surface the team in the meta
// line. Sorted newest-first.
const _PROJ1 = { id: 'demo-proj-1', name: 'LLM Hallucination Study' };
const _PROJ2 = { id: 'demo-proj-2', name: 'Distributed Systems Capstone' };
const _PROJ3 = { id: 'demo-proj-3', name: 'Climate Data Visualization' };
const _PROJ5 = { id: 'demo-proj-5', name: 'Causal Inference Reading Group' };

export const DEMO_NOTIFICATIONS = [
  // PDF activity — drives the tap-to-open-viewer demo.
  { id: 'demo-n-9',  type: 'pdf_comment',  title: 'New PDF comment',    body: 'Marcus Lee commented on Project Proposal v2: Should we add more citations for the §2 claims? A couple fee…', link: '/projects/demo-proj-1/pdfs/demo-pdf-1?page=2', related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: hoursAgo(1)   },
  { id: 'demo-n-10', type: 'pdf_comment',  title: 'New PDF comment',    body: 'Dr. Sarah Rivera commented on Project Proposal v2: Great work on the methodology section — your evalu…',      link: '/projects/demo-proj-1/pdfs/demo-pdf-1?page=1', related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: hoursAgo(3)   },
  { id: 'demo-n-11', type: 'pdf_uploaded', title: 'New PDF uploaded',   body: 'Marcus Lee uploaded Methodology v1 to LLM Hallucination Study.',                                            link: '/projects/demo-proj-1/pdfs/demo-pdf-3',       related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: hoursAgo(6)   },
  { id: 'demo-n-12', type: 'pdf_comment',  title: 'New PDF comment',    body: 'Dr. Sarah Rivera commented on Literature Review: Could you expand the section on calibration failure mod…', link: '/projects/demo-proj-1/pdfs/demo-pdf-2?page=9', related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: hoursAgo(7)   },
  { id: 'demo-n-13', type: 'pdf_uploaded', title: 'New PDF uploaded',   body: 'Priya Sharma uploaded Architecture Plan v3 to Distributed Systems Capstone.',                              link: '/projects/demo-proj-2/pdfs/demo-pdf-4',       related_team_id: _PROJ2.id, team: _PROJ2, read: true,  created_at: daysAgo(1)    },
  { id: 'demo-n-14', type: 'pdf_uploaded', title: 'New PDF uploaded',   body: 'Yuki Tanaka uploaded Cleaning Pipeline Spec to Climate Data Visualization.',                              link: '/projects/demo-proj-3/pdfs/demo-pdf-7',       related_team_id: _PROJ3.id, team: _PROJ3, read: true,  created_at: daysAgo(3)    },

  // Existing non-PDF activity — converted to the canonical shape.
  { id: 'demo-n-1',  type: 'team_invite',         title: 'Dr. Sarah Rivera invited you to LLM Hallucination Study', body: 'You\'ve been invited to join a 4-person project for CS 4890.',  link: null,                                          related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: hoursAgo(3.5) },
  { id: 'demo-n-2',  type: 'submission_received', title: 'Priya Sharma submitted Literature Review v3',             body: '12 pages, 3 sources flagged for review.',                        link: null,                                          related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: hoursAgo(5)   },
  { id: 'demo-n-3',  type: 'ai_insight',          title: 'AI flagged contribution imbalance on Climate Data Viz',   body: 'Jordan Kim is 14% by week 6 — peers average 25–30%.',            link: null,                                          related_team_id: _PROJ3.id, team: _PROJ3, read: false, created_at: daysAgo(1)    },
  { id: 'demo-n-4',  type: 'decision_required',   title: 'Review needed: 14% similarity in LLM Study §2.1',         body: 'Closest match: Smith et al. 2023. Likely common phrasing.',      link: null,                                          related_team_id: _PROJ1.id, team: _PROJ1, read: false, created_at: daysAgo(1)    },
  { id: 'demo-n-5',  type: 'mention',             title: 'Marcus Lee mentioned you in a comment',                   body: '"@alex — should we drop the GPT-4 column from Table 3?"',        link: null,                                          related_team_id: _PROJ1.id, team: _PROJ1, read: true,  created_at: daysAgo(2)    },
  { id: 'demo-n-6',  type: 'assignment_due',      title: 'Annotate hallucination dataset due in 2 days',            body: 'Milestone 3 of LLM Hallucination Study.',                        link: null,                                          related_team_id: _PROJ1.id, team: _PROJ1, read: true,  created_at: daysAgo(2)    },
  { id: 'demo-n-7',  type: 'submission_received', title: 'Yuki Tanaka submitted Visualization Designs draft',       body: '5 design options for stakeholder review.',                       link: null,                                          related_team_id: _PROJ3.id, team: _PROJ3, read: true,  created_at: daysAgo(4)    },
  { id: 'demo-n-8',  type: 'team_invite',         title: 'Marcus Lee invited you to Causal Inference Reading Group',body: 'Independent study, weekly writeups.',                            link: null,                                          related_team_id: _PROJ5.id, team: _PROJ5, read: true,  created_at: daysAgo(6)    },
];

// Realistic contribution heatmap pattern — weekday-weighted, slight Tue/Wed peak,
// no activity past last week, low weekend activity.
function buildDemoHeatmap() {
  const pattern = [];
  for (let week = 0; week < 12; week++) {
    for (let day = 0; day < 7; day++) {
      // weekends quiet, weekdays mid-week peak, older weeks slightly heavier
      const weekdayBoost = day >= 1 && day <= 4 ? 1 : 0;
      const peakDay = day === 2 || day === 3 ? 1 : 0;
      const recency = week >= 10 ? -1 : week >= 6 ? 0 : 1;
      const noise = (week * 7 + day) % 3;
      const v = Math.max(0, Math.min(4, weekdayBoost + peakDay + recency + noise - 1));
      pattern.push(v);
    }
  }
  return pattern;
}

export const DEMO_HEATMAP = buildDemoHeatmap();

// The signed-in student is treated as this demo persona for filtering purposes.
// Demo data isn't tied to a real auth account, so we pick a fixed persona
// (Alex Chen) and surface only the demo projects that include her as a member.
export const DEMO_CURRENT_STUDENT_ID = 'demo-student-1';

export function getDemoProjectsForStudent(studentId, projects = DEMO_PROJECTS) {
  return projects.filter(p =>
    (p.memberRecords ?? []).some(m => m.profile?.id === studentId)
  );
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
