// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Study Home — derive REAL, specific content from whatever each project carries.
// Demo projects are rich (milestones, activity); live projects currently carry
// only title/course/status/progress/dueDate, so these helpers degrade to real
// project-level deadlines rather than inventing generic filler.
import { isDoneState } from '../../utils/status.js';

export function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// "2h ago" / "1d ago" / "30m ago" → minutes, for recency sort. Unknown → last.
function agoMinutes(t) {
  const m = /(\d+)\s*([mhd])/.exec(t || '');
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = Number(m[1]);
  return m[2] === 'd' ? n * 1440 : m[2] === 'h' ? n * 60 : n;
}

// DUE SOON — the next thing each project needs. A project with milestones
// contributes its open (not-done) ones; otherwise the project's own deadline.
export function buildDueSoon(projects, limit = 5) {
  const out = [];
  for (const p of projects) {
    const open = (p.milestones ?? []).filter(m => m.title && m.status && m.status !== 'done');
    if (open.length) {
      for (const m of open) out.push({ id: `${p.id}:${m.id}`, name: m.title, when: m.due, status: m.status });
    } else if (p.status && !isDoneState(p.status) && p.dueDate) {
      out.push({ id: p.id, name: p.title, when: p.dueDate, status: p.status });
    }
  }
  return out.slice(0, limit);
}

const VERB_RE = /\b(approved|commented on|uploaded|submitted|flagged|completed|requested|raised|ran)\b/i;

// Split an activity string into a plain lead + one accent-coloured object phrase.
// Approvals read green; everything else (links, docs, comments) reads plum.
export function accentActivity(html) {
  const text = String(html || '').replace(/<\/?strong>/g, '').trim();
  const m = VERB_RE.exec(text);
  if (!m) return { before: text, accent: '', tone: 'link' };
  const cut = m.index + m[0].length;
  return {
    before: text.slice(0, cut).trim(),
    accent: text.slice(cut).trim(),
    tone: /approv/i.test(m[0]) ? 'approve' : 'link',
  };
}

// RECENT — most-recent activity across all visible projects.
export function buildRecent(projects, limit = 5) {
  const all = projects.flatMap(p =>
    (p.activity ?? []).map(a => ({ text: a.text, time: a.time, pid: p.id }))
  );
  all.sort((a, b) => agoMinutes(a.time) - agoMinutes(b.time));
  return all.slice(0, limit).map((a, i) => ({ id: `${a.pid}:${i}`, ...accentActivity(a.text), time: a.time }));
}

// Projects that still need the user (in-flight — not done/archived).
export function needCount(projects) {
  return projects.filter(p => p.status && !isDoneState(p.status)).length;
}
