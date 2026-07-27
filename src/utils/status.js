// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Status ladder — maps every status value the app uses (projects, milestones,
// tasks, assignments, submissions) onto the five Library design states:
//   active · approved · attention · ontrack · done
// Mapping confirmed with product; keep exhaustive so nothing renders blank.
const MAP = {
  // — projects —
  active:             { state: 'active',    label: 'Active' },
  at_risk:            { state: 'attention', label: 'At risk' },
  'at-risk':          { state: 'attention', label: 'At risk' },
  completed:          { state: 'done',      label: 'Completed' },
  archived:           { state: 'done',      label: 'Archived' },
  // — milestones / tasks (not_started → on-track: queued, nothing flagged) —
  not_started:        { state: 'ontrack',   label: 'Not started' },
  in_progress:        { state: 'active',    label: 'In progress' },
  submitted:          { state: 'ontrack',   label: 'Submitted' },
  done:               { state: 'done',      label: 'Done' },
  // — assignment lifecycle —
  late:               { state: 'attention', label: 'Late' },
  graded:             { state: 'approved',  label: 'Graded' },
  // — submissions —
  under_review:       { state: 'active',    label: 'Under review' },
  reviewed:           { state: 'approved',  label: 'Reviewed' },
  approved:           { state: 'approved',  label: 'Approved' },
  rejected:           { state: 'attention', label: 'Rejected' },
  needs_resubmission: { state: 'attention', label: 'Needs resubmission' },
  resubmit_requested: { state: 'attention', label: 'Resubmit requested' },
  resubmit_needed:    { state: 'attention', label: 'Resubmit needed' },
};

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—');

export function ladder(status) {
  return MAP[status] || { state: 'active', label: cap(status) };
}
export const spineClass = (status) => `spine s-${ladder(status).state}`;
export const isDoneState = (status) => ladder(status).state === 'done';
