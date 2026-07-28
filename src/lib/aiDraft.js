// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// AI brief-to-draft — pure logic, no React, no network. Two jobs:
//   1. parseDraft(raw): coerce an UNTRUSTED draft blob into a safe internal
//      plan. Written defensively from day one (Step 1 runs it on a fixture) so
//      swapping in a real API response needs no rework — missing fields, empty
//      arrays, and wrong types all degrade to safe defaults instead of throwing.
//   2. streamDraft(plan, handlers): emit the plan one item at a time on a small
//      stagger. The event protocol (description → milestone → task → done) is
//      exactly what a real token stream will emit, so the UI that consumes it
//      does not change when the fixture is replaced by SSE.

// Caps — keep the review readable and bound untrusted input.
export const MAX_BRIEF_CHARS = 6000;
const MAX_MILESTONES = 12;
const MAX_TASKS_PER_MILESTONE = 20;
const MAX_NAME = 120;
const MAX_DESC = 200;
const MAX_PROJECT_DESC = 1200;

let _cid = 0;
// Monotonic client-side id. NOT a DB id — only used to key rows and target
// edits/appends while streaming. Real DB ids are assigned on confirm.
export function nextCid(prefix = 'c') {
  _cid += 1;
  return `${prefix}${_cid}`;
}

const asString = (v) => (typeof v === 'string' ? v : '');
const clamp = (s, n) => asString(s).replace(/\s+/g, ' ').trim().slice(0, n);
const asArray = (v) => (Array.isArray(v) ? v : []);

function normalizeTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = clamp(raw.name, MAX_NAME);
  if (!name) return null; // a task with no name is noise — drop it
  return { cid: nextCid('t'), name, description: clamp(raw.description, MAX_DESC) };
}

function normalizeMilestone(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = clamp(raw.name, MAX_NAME);
  if (!name) return null;
  const tasks = asArray(raw.tasks)
    .slice(0, MAX_TASKS_PER_MILESTONE)
    .map(normalizeTask)
    .filter(Boolean);
  // dueAt is NEVER read from the draft — the professor sets it in the UI.
  return { cid: nextCid('m'), name, dueAt: null, tasks };
}

// Untrusted blob → { description, milestones:[{cid,name,dueAt,tasks:[{cid,name,description}]}] }.
// Always returns a well-formed object; never throws on shape.
export function parseDraft(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const milestones = asArray(src.milestones)
    .slice(0, MAX_MILESTONES)
    .map(normalizeMilestone)
    .filter(Boolean);
  return { description: clamp(src.description, MAX_PROJECT_DESC), milestones };
}

// Emit a parsed plan progressively. Returns a cancel() that stops pending
// emissions (call on discard/unmount). Handlers:
//   onDescription(str) · onMilestone({cid,name,dueAt,tasks:[]}) ·
//   onTask(milestoneCid, {cid,name,description}) · onDone()
// The milestone is emitted as a shell first (empty tasks), then its tasks arrive
// one by one — the same ordering a real stream produces.
export function streamDraft(plan, handlers = {}, { stagger = 130 } = {}) {
  const { onDescription, onMilestone, onTask, onDone } = handlers;
  const timers = [];
  let cancelled = false;
  let step = 0;
  const at = (fn) => {
    step += 1;
    timers.push(setTimeout(() => { if (!cancelled) fn(); }, step * stagger));
  };

  if (plan.description) at(() => onDescription && onDescription(plan.description));

  for (const m of plan.milestones) {
    const shell = { cid: m.cid, name: m.name, dueAt: m.dueAt, tasks: [] };
    at(() => onMilestone && onMilestone(shell));
    for (const t of m.tasks) {
      at(() => onTask && onTask(m.cid, t));
    }
  }
  at(() => onDone && onDone());

  return function cancel() {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}
