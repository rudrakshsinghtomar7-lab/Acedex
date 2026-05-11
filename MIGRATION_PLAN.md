Your message cut off mid-section 6 (right after "AUTH SCAFFOLDING (SHAPE ONLY, NO LOGIC)"). I'll write up sections 1–5 in full, then deliver my best inference for 6–11 based on your 10 hard constraints, and flag what I assumed so you can correct me. No files touched, no code yet.

---

# Acedex — Vite Migration Plan (Path A)

## 1. NEW FILE STRUCTURE

```
Acedex/
├── index.html                  ← Vite shell only: <div id="root"/> + module script tag. No CDN React, no Babel, no inline JSX.
├── package.json                ← Updated deps (see §3)
├── vite.config.js              ← Adds base:'/Acedex/' for GH Pages
├── .env.local                  ← Gitignored. VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── .env.example                ← Committed. Same keys, empty values.
├── .gitignore                  ← Adds .env.local, dist/
├── public/
│   └── 404.html                ← SPA fallback for GH Pages (copy of index.html shell)
├── .github/
│   └── workflows/
│       └── deploy.yml          ← Build + publish dist/ to gh-pages branch on push to main
└── src/
    ├── main.jsx                ← Vite entry. Imports './styles/index.css', mounts <App/>.
    ├── App.jsx                 ← <BrowserRouter> + <SessionProvider> + route map.
    │
    ├── styles/
    │   └── index.css           ← ALL 250 lines of CSS from index.html, verbatim. Single global stylesheet.
    │
    ├── data/
    │   ├── projects.js         ← PROJECTS const, copied verbatim from index.html:280-311
    │   └── heatmap.js          ← HEATMAP array + heatColor helper (lines 313-314)
    │
    ├── lib/
    │   ├── claude.js           ← askClaude() — moved verbatim from index.html:323-378
    │   └── supabase.js         ← createClient(import.meta.env.VITE_SUPABASE_URL, ...). No queries.
    │
    ├── hooks/
    │   └── useApiKey.js        ← localStorage read/write for 'Acedex_api_key' (preserves current key name)
    │
    ├── providers/
    │   └── SessionProvider.jsx ← Context shape only. Returns { session:null, profile:null, role:'student' } stub.
    │
    ├── utils/
    │   ├── sanitize.js         ← marked + DOMPurify wrapper. Replaces formatText().
    │   ├── avatar.js           ← avatarBg() + initials() — from index.html:316-320
    │   └── format.js           ← Any shared formatters (date strings if needed; none currently)
    │
    ├── components/
    │   ├── PhoneFrame.jsx      ← .phone + .island + StatusBar wrapper
    │   ├── StatusBar.jsx       ← lines 409-420
    │   ├── BottomNav.jsx       ← lines 1190-1200, NavLink-based but visually identical
    │   ├── Avatar.jsx          ← lines 381-383
    │   ├── ProgBar.jsx         ← lines 385-387
    │   ├── ProgCircle.jsx      ← lines 389-407
    │   ├── Confidence.jsx      ← lines 422-432
    │   ├── StatusTag.jsx       ← lines 434-438
    │   ├── ClaudeChat.jsx      ← (Stage 7+) shared chat UI used by ProjectAI and AIScreen.
    │   ├── SettingsSheet.jsx   ← lines 1114-1149
    │   └── ProtectedRoute.jsx  ← Pass-through stub for now. Future: redirect if !session.
    │
    ├── screens/
    │   ├── Onboarding.jsx      ← lines 443-494
    │   ├── Home.jsx            ← lines 497-607
    │   ├── Projects.jsx        ← ProjectsList — lines 610-670
    │   ├── Profile.jsx         ← lines 1060-1111
    │   ├── AIScreen.jsx        ← lines 979-1057
    │   ├── ProjectDetail/
    │   │   ├── index.jsx       ← Container + tab switcher (lines 673-701)
    │   │   ├── Overview.jsx    ← lines 703-757
    │   │   ├── Milestones.jsx  ← lines 759-781
    │   │   ├── Tasks.jsx       ← lines 783-829
    │   │   ├── Team.jsx        ← lines 831-852
    │   │   ├── Activity.jsx    ← lines 854-870
    │   │   ├── Insights.jsx    ← lines 872-907
    │   │   └── ProjectAI.jsx   ← lines 909-976
    │   └── auth/
    │       ├── Login.jsx       ← Placeholder UI matching theme. No logic.
    │       ├── Signup.jsx      ← Placeholder. No logic.
    │       └── Reset.jsx       ← Placeholder. No logic.
    │
    └── (legacy removed: src/App.jsx, src/main.jsx, src/ai.js, src/styles.css, src/src/supabaseClient.js)
```

**Notes:**
- `src/main.jsx` is **rewritten**, not kept as-is (current one mounts the OpenAI tester).
- `src/src/supabaseClient.js` is deleted; new `src/lib/supabase.js` is env-driven.
- Top-level `index.html` becomes a clean Vite shell — the 1,211-line file is gone.

---

## 2. COMPONENT EXTRACTION MAP

Every component currently defined in `index.html`, with new file, source lines, props, and state owned. State preserved exactly as today.

| Component | New file | Source lines | Props | State owned |
|---|---|---|---|---|
| `App` | `src/App.jsx` | 1152-1204 | none | `showOnboard`, `apiKey` (lifted into hook), navigation via router |
| `PhoneFrame` (new wrapper) | `components/PhoneFrame.jsx` | 41-49, 1175-1177 (`.phone`, `.island`) | `children` | none |
| `StatusBar` | `components/StatusBar.jsx` | 409-420 | none | none |
| `BottomNav` | `components/BottomNav.jsx` | 1167-1172 + 1190-1200 | `role`, `insightBadgeCount` | none — uses `useLocation` for active state |
| `Onboarding` | `screens/Onboarding.jsx` | 443-494 | `role`, `setRole`, `onComplete` | `step` |
| `Home` | `screens/Home.jsx` | 497-607 | `role`, `projects`, `onOpenProject`, `setRole`, `openSettings` | none |
| `ProjectsList` (→ `Projects`) | `screens/Projects.jsx` | 610-670 | `role`, `projects`, `onOpenProject` | `search`, `filter` |
| `ProjectDetail` | `screens/ProjectDetail/index.jsx` | 673-701 | `project`, `role`, `onBack`, `apiKey` | `tab` (kept as local state — see §5) |
| `Overview` | `screens/ProjectDetail/Overview.jsx` | 703-757 | `project`, `role` | none |
| `Milestones` | `screens/ProjectDetail/Milestones.jsx` | 759-781 | `project` | none |
| `Tasks` | `screens/ProjectDetail/Tasks.jsx` | 783-829 | `project` | `tasks` (preserves "resets on unmount" quirk per constraint 6) |
| `Team` | `screens/ProjectDetail/Team.jsx` | 831-852 | `project` | none |
| `Activity` | `screens/ProjectDetail/Activity.jsx` | 854-870 | `project` | none |
| `Insights` | `screens/ProjectDetail/Insights.jsx` | 872-907 | `project` | `decided` (preserves resets-on-unmount quirk) |
| `ProjectAI` | `screens/ProjectDetail/ProjectAI.jsx` | 909-976 | `project`, `role`, `apiKey` | `messages`, `input`, `loading` |
| `AIScreen` | `screens/AIScreen.jsx` | 979-1057 | `role`, `projects`, `apiKey` | `selected`, `messages`, `input`, `loading` |
| `Profile` | `screens/Profile.jsx` | 1060-1111 | `role`, `projects`, `openSettings` | none |
| `SettingsSheet` | `components/SettingsSheet.jsx` | 1114-1149 | `onClose`, `apiKey`, `setApiKey` | `draft` |
| `Avatar` | `components/Avatar.jsx` | 381-383 | `name`, `size` | none |
| `ProgBar` | `components/ProgBar.jsx` | 385-387 | `value` | none |
| `ProgCircle` | `components/ProgCircle.jsx` | 389-407 | `value`, `size` | none |
| `Confidence` | `components/Confidence.jsx` | 422-432 | `level` | none |
| `StatusTag` | `components/StatusTag.jsx` | 434-438 | `status` | none |
| `Login` (placeholder) | `screens/auth/Login.jsx` | n/a | none | none |
| `Signup` (placeholder) | `screens/auth/Signup.jsx` | n/a | none | none |
| `Reset` (placeholder) | `screens/auth/Reset.jsx` | n/a | none | none |
| `SessionProvider` | `providers/SessionProvider.jsx` | n/a | `children` | stub session context |
| `ProtectedRoute` | `components/ProtectedRoute.jsx` | n/a | `children` | none (pass-through) |

**Helpers/data (not components):**

| Item | New file | Source lines |
|---|---|---|
| `PROJECTS` const | `data/projects.js` | 280-311 |
| `HEATMAP` + `heatColor` | `data/heatmap.js` | 313-314 |
| `avatarBg`, `initials` | `utils/avatar.js` | 316-320 |
| `askClaude` | `lib/claude.js` | 323-378 |
| `formatText` (replaced) | `utils/sanitize.js` | 440 (replaced by marked+DOMPurify) |

**Intentionally NOT de-duplicated this phase** (per constraint 4):
- The two project-card render blocks in `Home` (559-583) and `Projects` (642-660) differ slightly (Home shows "Due {dueDate}", Projects shows `StatusTag`). Keep inline in each screen. De-dup is a follow-up.
- `ProjectAI` and `AIScreen` share chat UI logic but differ in chrome (header, project selector). I'll create `components/ClaudeChat.jsx` *only* if extraction is purely visual-equivalent; otherwise keep two siblings. Decision deferred to Stage 7.

---

## 3. DEPENDENCIES TO ADD

Pinned versions, no `latest`, no caret-floats beyond minor.

**Runtime:**
| Package | Version | Reason |
|---|---|---|
| `react-router-dom` | `^6.26.2` | Replace tab state with routes. v6 is stable; v7 just released and would force migration churn. |
| `@supabase/supabase-js` | `^2.45.4` | Set up client now (used in §6 stub provider); auth logic comes next phase. Also fixes the current "imported but not installed" gap. |
| `marked` | `^14.1.2` | Markdown → HTML for AI replies (currently `**bold**` via regex). Required for constraint 4's security-fix exception. |
| `dompurify` | `^3.1.6` | Sanitize the marked output before insertion. Pairs with marked. |

**Dev:** No additions. Existing `vite ^5.4.11` and `@vitejs/plugin-react ^4.4.1` already cover us.

**Removed:** None from package.json (Vite deps stay). The CDN scripts in old `index.html` (`react`, `react-dom`, `@babel/standalone`) go away when we delete the inline script tag.

**`gh-pages` package:** *not* added. Using GitHub Actions workflow + `actions/deploy-pages` instead (cleaner audit trail, no `gh-pages` branch to maintain manually). See §9.

---

## 4. STYLES MIGRATION STRATEGY

**Recommendation: (a) Single global `theme.css` (renamed `index.css`).**

**Why (a) over (b) CSS Modules or (c) mixed:**

1. **Constraint 1 (zero UI/UX regression) demands minimal risk.** The current 250 lines are deeply interconnected: `.phone .screen .header .stats .stat` etc. cascade is load-bearing. CSS Modules would force renaming every class and rewriting every selector — guaranteed to surface visual regressions.
2. **Class names are already short and unique** (`.av`, `.pc`, `.ins`, `.dtab`, `.ms-n`). They don't pollute a global namespace in any harmful way — they're effectively pseudo-scoped by their short, app-specific names.
3. **The CSS variable system (`--bg-0`, `--grad`, `--r-md`, etc.) is the whole theme.** Keeping it in one place where every file picks it up via the cascade is exactly what we want.
4. **Migration cost = near-zero**: copy the contents of `<style>...</style>` (lines 18-267) into `src/styles/index.css` verbatim, import once from `main.jsx`. Done.

**How key visuals are preserved:**

- **Phone frame:** `.phone` rule (line 41) moves verbatim. `<PhoneFrame>` component renders `<div className="phone">{children}</div>` and includes `<div className="island"/>` and `<StatusBar/>` — identical DOM.
- **Indigo/violet gradient:** `--grad: linear-gradient(135deg,#7c6cff 0%,#a875ff 100%)` (line 24) moves verbatim. Every `background: var(--grad)` reference works unchanged.
- **Buttons:** `.btn .btn-p .btn-g .btn-sm .btn-bl` (171-176) — verbatim.
- **Cards:** `.card .card-head .card-title .card-sub .card-meta` (84-89) — verbatim.
- **Bottom-nav blur:** `backdrop-filter:blur(24px) saturate(160%)` (110) — verbatim.
- **Mobile collapse:** `@media(max-width:480px){...}` (42) — verbatim.

**One change I'd accept (not a regression):** wrap the Google Fonts `<link>` (currently in `<head>` of index.html, lines 8-10) by either keeping it in the new Vite shell `index.html` or moving to a CSS `@import url(...)` at the top of `index.css`. Same load behavior. Prefer keeping in `<head>` for preconnect.

**What I will NOT do this phase:** convert to Tailwind, convert to CSS-in-JS, split into per-component files, deduplicate near-identical rules. All deferred.

---

## 5. ROUTING PLAN

**Top-level routes** (replaces `tab` state in `App`):

| Route | Renders | Notes |
|---|---|---|
| `/` | Redirect → `/onboard` if `!onboarded`, else `/home`. Onboarded flag persisted to localStorage. **Note:** this is a tiny behavior change vs. today (currently onboarding shows every reload because `showOnboard` defaults to `true`). I will preserve the current behavior — onboarding shows every reload — to satisfy constraint 6 (state behavior preservation, including quirks). The redirect just routes to `/onboard` first each session. |
| `/onboard` | `<Onboarding/>` | Completing → `navigate('/home')`. |
| `/login`, `/signup`, `/reset` | `screens/auth/*` placeholders | No logic. Routes exist for §6 scaffold only. |
| `/home` | `<Home/>` | Default landing. |
| `/projects` | `<Projects/>` | List + filters. |
| `/projects/:id` | `<ProjectDetail/>` | Project loaded by id from `data/projects.js`. |
| `/ai` | `<AIScreen/>` | Global chat. |
| `/profile` | `<Profile/>` | Profile + settings entry. |
| `*` | Redirect → `/home` | Fallback. |

**Project Detail sub-tabs — recommendation: keep as local state, NOT nested routes.**

Trade-off:
- **Nested routes** (`/projects/:id/overview`, `/projects/:id/tasks`, …) give shareable deep links and natural back-button between tabs. BUT changing the back button to navigate between tabs *is* a behavior change vs today, where the back button leaves the project entirely. Constraint 1 says zero UI/UX regression. Constraint 6 says preserve state behavior.
- **Local `tab` state** (current behavior at index.html:674) keeps back-button = leave project, exactly as today. Pixel and behavior identical.

Pick local state for this migration. Convert to nested routes later when we explicitly want deep-linking (separate phase, separate decision).

**`BottomNav` routing:** Replace `onClick={()=>setTab(t.id)}` with `<NavLink to={...}>`. Active state derives from `useLocation()` matching the prefix. Visual `.nav.active` class is set conditionally — looks identical.

**Hidden nav on certain screens:** Today, `BottomNav` is hidden when `openProject` is truthy (index.html:1190) and when onboarding shows. New approach: BottomNav renders inside a layout route that wraps `/home`, `/projects`, `/ai`, `/profile` ONLY — auth/onboard/project-detail routes don't include the layout. Same visual behavior.

**GitHub Pages SPA fallback:**
- GitHub Pages serves `404.html` for any unmatched path under the project subpath.
- We add `public/404.html` containing a copy of the Vite shell (same `<div id="root"/>` + module script) so that direct loads of `/Acedex/projects/3` work after a refresh.
- `vite.config.js` must set `base: '/Acedex/'` so generated asset URLs include the subpath.
- BrowserRouter must use `basename="/Acedex"`.

---

## 6. AUTH SCAFFOLDING (shape only, no logic) — *inferred, your message cut off here*

`src/providers/SessionProvider.jsx`:

```
Context value shape (stub):
{
  session: null,             // Will be Supabase Session object later
  profile: null,             // Will be a row from `profiles` table
  role: 'student',           // Derived from profile.role; defaults to 'student' for now
  loading: false,            // Will reflect Supabase session-load state
  signIn: async () => {},    // Stubs that throw 'not implemented' if called
  signOut: async () => {},
  signUp: async () => {},
  requestPasswordReset: async () => {},
}
```

Implementation in this phase: returns the stub object verbatim. No `supabase.auth.*` calls. Imports `supabase` from `lib/supabase.js` so the wiring is ready.

`src/components/ProtectedRoute.jsx`:

```
Shape:
  <ProtectedRoute>
    <SomeScreen/>
  </ProtectedRoute>

This phase: pass-through. Just renders children.
Next phase: read session from useSession(); if null, redirect to /login.
```

**Routes are NOT wrapped in `<ProtectedRoute>` yet** — that turns on with real auth. The component exists only to land the shape.

`src/screens/auth/Login.jsx`, `Signup.jsx`, `Reset.jsx`:
- Render a phone-framed form using existing `.input`, `.btn-p`, `.field` classes. No submit handler beyond `event.preventDefault()`. No Supabase calls.
- Purpose: make sure `/login` `/signup` `/reset` routes resolve without errors and that the visual design language is consistent with the rest of the app.

`src/lib/supabase.js`:
```
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```
Nothing else. No queries, no helpers.

---

## 7. STAGED MIGRATION (commit-per-stage) — *inferred*

Each stage builds, runs, deploys identically to current. Each stage = one commit.

| Stage | What | Why this size |
|---|---|---|
| **0. Branch setup** | Create `pre-vite-migration` branch off main (rollback). Create `vite-migration` working branch. No code changes. Push both. | Constraint 10. |
| **1. Vite bootstrap (monolithic)** | Delete `src/App.jsx`, `src/main.jsx`, `src/ai.js`, `src/styles.css`, `src/src/`. Create new `src/main.jsx`, new `src/App.jsx` containing the *entire* contents of the old `<script type="text/babel">` block, new `src/styles/index.css` with the full `<style>` block. Rewrite root `index.html` as Vite shell. Update `vite.config.js` with `base: '/Acedex/'`. Verify `npm run dev` and `npm run build` produce a visually identical app. | Largest single move. Everything still works because it's the same code, just relocated. App is now Vite-buildable. |
| **2. Extract data + helpers** | `data/projects.js`, `data/heatmap.js`, `utils/avatar.js`. Import into `App.jsx`. | Pure relocation, zero behavior risk. |
| **3. Extract Claude API** | `lib/claude.js` (`askClaude`). | Pure relocation. |
| **4. Sanitization swap (security fix)** | Add `marked` + `dompurify`. Create `utils/sanitize.js`. Replace `formatText` and the two `dangerouslySetInnerHTML` AI uses (956, 1040) and Activity (863). Output must render identically for current data (markdown `**bold**` → `<strong>`). | Constraint 4 exception. Test current copy renders unchanged. |
| **5. Extract primitives** | `Avatar`, `ProgBar`, `ProgCircle`, `StatusBar`, `Confidence`, `StatusTag`, `PhoneFrame`. | Smallest, leafiest components first. |
| **6. Extract `SettingsSheet` + `useApiKey` hook** | `components/SettingsSheet.jsx`, `hooks/useApiKey.js`. App switches to `const [apiKey, setApiKey] = useApiKey()`. | Self-contained. |
| **7. Extract screens (non-detail)** | `Onboarding`, `Home`, `Projects`, `Profile`, `AIScreen`. One commit per screen if any feel risky, otherwise batch. | Each is a closed unit. |
| **8. Extract `ProjectDetail` family** | `ProjectDetail/index.jsx` + 7 sub-screens (`Overview`, `Milestones`, `Tasks`, `Team`, `Activity`, `Insights`, `ProjectAI`). | Biggest cluster; tabs stay as local state. |
| **9. Add router** | Add `react-router-dom`. Replace `tab` state with routes. `BottomNav` switches to `NavLink`. Add layout route. Set `basename="/Acedex"`. Add `public/404.html`. Visual: identical. | One concept change at a time. |
| **10. Auth scaffolding** | Add `@supabase/supabase-js`. Create `lib/supabase.js`, `providers/SessionProvider.jsx`, `components/ProtectedRoute.jsx`, three auth screen placeholders. Wire `SessionProvider` at `App.jsx` root. | Constraint 7. No auth logic yet. |
| **11. GH Pages deploy** | Add `.github/workflows/deploy.yml`. Switch repo Pages settings to deploy from Actions. Verify live URL renders the new build identically. | Constraint 9. |
| **12. Final verification + merge** | Side-by-side visual diff `pre-vite-migration` vs `vite-migration`. Smoke test all flows. PR + merge after your approval. | Constraint 10. |

If any stage feels too big once we start, I'll split it further rather than rolling forward broken.

---

## 8. ENV VARS — *inferred*

`.env.example` (committed):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env.local` (gitignored, you create locally):
```
VITE_SUPABASE_URL=https://jnmqcqvnibhsltnxpuve.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_6A_B92Njk714cB_13OqH5A_5waCRTTJ
```

`.gitignore` additions:
```
.env.local
.env.*.local
dist/
node_modules/
```

The hardcoded values currently in `src/src/supabaseClient.js:4-5` are NOT carried into the new `src/lib/supabase.js`. They get retyped into your local `.env.local` only.

For GitHub Pages deploy: Supabase URL and anon key are added as **GitHub Actions secrets** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and injected at build time in the workflow.

**Note:** Vite bakes `import.meta.env.VITE_*` values into the built bundle. The anon key is *designed* to be public, so this is acceptable. But understand: any future non-public key must NOT be `VITE_`-prefixed.

The Claude API key stays exactly as today — user-entered, in `localStorage`. Not an env var.

---

## 9. GITHUB PAGES DEPLOY — *inferred*

**Current state:** `e42f3f1 index.html` (commit on main) is served directly from root. No build step. Custom domain (CNAME) was removed in recent commits, so URL is `rudrakshsinghtomar7-lab.github.io/Acedex/`.

**New state:** GitHub Actions builds Vite, publishes `dist/` to Pages.

**Workflow (`.github/workflows/deploy.yml`):**
1. Trigger: push to `main`.
2. Checkout, setup Node, `npm ci`, `npm run build`.
3. Inject `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from repo secrets.
4. Upload `dist/` as Pages artifact.
5. Deploy step via `actions/deploy-pages@v4`.

**Repo settings change:** Settings → Pages → Source: "GitHub Actions" (not "Deploy from branch").

**Vite config:** `base: '/Acedex/'` so asset paths resolve under the subpath.

**Router config:** `<BrowserRouter basename="/Acedex">`.

**SPA fallback:** `public/404.html` is a copy of `index.html`. Vite copies `public/` contents to `dist/` as-is. GH Pages serves `404.html` on any non-asset 404, which loads our app shell and React Router resolves the path. This makes `/Acedex/projects/3` work on direct load and refresh.

**Test before merging:** Push the workflow to `vite-migration` branch; configure a separate Pages preview if possible, or do a one-off deploy from the branch to confirm the build serves correctly.

**Rollback:** If the new deploy breaks, revert to `pre-vite-migration` branch on `main`, switch Pages source back to "Deploy from branch: main / root". Site returns to the current `index.html` immediately.

---

## 10. ROLLBACK + BRANCH STRATEGY — *inferred*

- `pre-vite-migration` branch: snapshot of `main` at the moment we start. Permanent. Never deleted. This is the bail-out target.
- `vite-migration` branch: where all work happens. PRs to `main` only after your approval.
- Per-stage commits with clear prefixes (`stage 1: …`, `stage 4: …`) so `git revert <sha>` undoes a single stage cleanly.
- After merge, keep `pre-vite-migration` for ~30 days minimum before deletion.
- If a stage is reverted mid-migration, the next stage rebases on the revert before continuing.

---

## 11. ACCEPTANCE CRITERIA — *inferred; tell me if you want different gates*

Before merging `vite-migration` → `main`:

1. `npm run dev` opens an app visually identical to current `index.html` (side-by-side comparison at 390×844 viewport).
2. `npm run build` succeeds. `dist/` is < 300 KB gzipped (sanity check; current Babel-in-browser is ~3 MB).
3. Every flow from §2 of the audit still works: onboarding, role switch, projects list, project tabs, task toggle, insight decide, AI chat (with Claude key), settings sheet save/clear/cancel, profile.
4. Demo data matches exactly: `JSON.stringify(PROJECTS)` from old vs new produces the same string.
5. No console errors, no React key warnings, no hydration warnings.
6. Live deploy at `rudrakshsinghtomar7-lab.github.io/Acedex/` renders identically post-deploy.
7. Direct-load of a deep URL like `/Acedex/projects/3` works (no 404 from Pages).
8. No Supabase calls fire on any flow (Network tab shows zero requests to supabase.co).
9. AI rendering: feeding a string with `**bold**` produces `<strong>bold</strong>`, exactly as today.
10. AI rendering: feeding `<script>alert(1)</script>` as Claude output renders as text, not executes. (New: validates the sanitize fix.)

---

## Where I had to guess

Sections **6–11** were inferred — your message cut off mid-section 6's header. If any of those sections were meant to cover something different (e.g., section 11 was meant to be "team / RACI" or "timeline estimate" rather than acceptance criteria), tell me and I'll redo.

Also flag if you want any of these decisions changed before I start:
- **Project detail tabs as local state, not nested routes** (§5) — recommended for zero behavior regression.
- **Single `index.css`, not CSS Modules** (§4) — recommended for lowest visual-regression risk.
- **`react-router-dom` v6, not v7** (§3) — v7 just released; stability over recency.
- **GitHub Actions deploy, not `gh-pages` package** (§9) — cleaner audit trail.
- **Replace `dangerouslySetInnerHTML` in Stage 4** (§7) — your explicit constraint 4 exception, but want to confirm it goes that early.

Awaiting your review. No files have been touched.