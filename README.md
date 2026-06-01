# Acedex

**AI-assisted academic collaboration platform for professors and students** — workflow, secure document review, and integrity/contribution signals in one place.

📱 Live: **https://rudrakshsinghtomar7-lab.github.io/Acedex/**

Acedex is a mobile-first (390×844 phone-frame) web app where a professor runs a course, students join project teams, work is submitted and reviewed as secure PDFs, and the whole team gets a clear, real-time picture of *who is doing what* — without ever leaking grades or private feedback.

---

## Highlights

- **Three roles, university-scoped** — `student` / `professor` / `admin`, every row protected by Postgres Row-Level Security.
- **Secure PDF workspace** — upload, an in-app full-page viewer with word-snap highlighting, threaded comments/annotations, watermarking and download/print blocking, signed-URL access.
- **Assignments & review loop** — individual *and* team assignments, three assignee-distribution modes, versioned submissions with resubmission flow, a dual-grade model (team + per-student) with per-student grade privacy.
- **Tasks & Milestones system** — team-visible tasks, milestone containers with live status rollups, and automatic assignment→task mirroring (see below).
- **AI insights** — Claude-powered analysis/chat over a project (plagiarism/quality/contribution framing), with a server-side analysis schema ready for deeper jobs.
- **Notifications** — in-app fan-out on assignment posts, submissions, and reviews.
- **Demo mode** — a fully populated, admin-only, in-memory dataset for showcasing the app without touching the database.

---

## The Tasks / Milestones system

Built and shipped in phases, each backed by real RLS and verified against the live database before release:

- **Phase 1 — Tasks**: real, team-visible tasks with a status ladder (`Not started → In progress → Submitted → Done`) and the three-mode assignee system (professor-assigns / team-leader-assigns / student-self-picks). Status is team-visible; grades/feedback are not. Students advance status only through guarded RPCs that can **never** set `Done` — only a professor approves.
- **Phase 2 — Milestones**: professor-created, team-context containers (no owner). A milestone's status and progress bar **roll up live** from its child tasks. "Remove from milestone" detaches a task back to standalone — it is never deleted.
- **Phase 3 — Assignment → Task auto-link**: creating an assignment auto-creates a mirror task that inherits the assignee(s) and whose status **flows from the assignment** (submit → Submitted, prof approve → Done) via database triggers — the assignment stays the single source of truth. Editing the assignment updates the task; deleting it removes only the mirror task, never submission/grade data.
- **Phase 3.1 — Subtasks as tasks**: a team assignment is mirrored **per subtask** (each assigned student gets their own task labelled with the parent assignment), rather than one empty parent task.

Sync is implemented with `SECURITY DEFINER` triggers (not app-layer code) so status reflects the source through *any* path. Submissions reuse the existing PDF flow — no parallel submission path.

---

## Security model

RLS is enabled on **every** table; helper functions (`is_team_member`, `is_team_professor`, `is_admin`, …) are `SECURITY DEFINER` with locked `search_path` so policies don't recurse. Privacy boundary: a task row carries only *title / assignee / status* — grades and feedback live in the assignment/submission layer under their own policies and never touch tasks.

Every phase was shipped under a **"prove, don't trust"** discipline — boundary tests run in rolled-back transactions against the live DB (impersonating student / professor / non-member) before merge. That process also surfaced and closed three pre-existing latent RLS holes: an over-broad `tasks` write policy, and `submissions` / `assignment_subtasks` update policies that would have let a student mark their own work *approved*. Now only a professor can drive a task to `Done`.

---

## Tech stack

- **React 18 + Vite**, React Router, client-rendered phone-frame UI
- **Supabase** — Postgres + Row-Level Security, Auth, Storage (`pdfs`, `submissions`, `avatars`, `resources` buckets)
- **react-pdf** (pdf.js) for the in-app secure viewer
- **Claude API** (via `lib/claude.js`, with a user-supplied key) for AI insights, plus `marked` + `dompurify` for safe Markdown rendering
- **GitHub Pages** for hosting (auto-deploy on push to `main`)

---

## Project structure

```
src/
  screens/
    Home.jsx, Projects.jsx, ProjectCreate.jsx, Profile*.jsx, Onboarding.jsx, AIScreen.jsx
    auth/            Login, Signup, Reset, UpdatePassword
    ProjectDetail/   Overview, Milestones, Tasks, Assignments, Team, PDFs, Activity, Insights, ProjectAI
  components/        PhoneFrame, BottomNav, PDF viewer suite, Task/Assignment modals, …
  lib/               supabase, teams, invitations, pdfs, assignments, tasks, milestones,
                     activity, notifications, profile, claude
  data/              demo.js (admin-only demo dataset)
supabase/
  migrations/        001–022 (schema, RLS, triggers, workflow)
```

## Database

22 sequential migrations (`001`–`022`) cover the schema, RLS, triggers, and feature workflow — from the initial 14-table foundation through the assignments review loop, dual-grade model, and the Tasks/Milestones system. Migration history is reconciled with the repo's `0NN_` filenames, so `supabase db push --linked` tracks cleanly.

## Demo mode

Admin-only. Toggle in **Settings → Developer**. The demo dataset (`src/data/demo.js`) is dynamically imported and tree-shaken out of production builds — components branch on `isDemo` (project ids prefixed `demo-`) to read/mutate in-memory fixtures instead of the database.

## Development

```bash
npm install
npm run dev          # local dev server
npm run build        # production build (postbuild copies index.html → 404.html for SPA routing)
```

Set Supabase keys in `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

A Claude API key for AI features is entered in-app (Settings) and stored locally — never committed.

## Status

Core platform is live: auth & roles, profiles, teams/workspaces + invitations, the secure PDF system, assignments + submissions/review with grading, notifications, AI insights, and the complete Tasks/Milestones system (Phases 1–3.1).

Schema-ready / not yet surfaced in the UI: resource hub, personalized dashboard widgets, bookmarks, the admin control panel, and the server-side AI analysis engine. Intentionally out of scope for the Tasks system: contribution-percentage rollups, due-date enforcement, individual-context milestones.

## License

© 2026 Rudraksh Singh Tomar. All rights reserved. See [LICENSE](LICENSE).
