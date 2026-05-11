I have what I need — read every file, grepped for `Collabify`, traced auth flow, and walked through the demo data flow. Here's the honest audit:

---

# Acedex Audit

## 1. STACK & ARCHITECTURE

**Hard truth: there are two parallel apps in this repo that don't talk to each other.**

- **`index.html` (1,211 lines)** — the actual production MVP. React 18 UMD + `@babel/standalone` loaded from unpkg, all JSX transformed in the browser. Single file. Demo data hardcoded. This is what GitHub Pages serves.
- **`src/` Vite skeleton** — completely separate React app (`src/App.jsx:4` — `export function App`) that builds an OpenAI "key + prompt" tester. Has its own `main.jsx`, `styles.css`, `ai.js`. Nothing imports from `index.html`; nothing in `index.html` references `src/`. The Vite build output isn't even wired to GH Pages.

So the answer to "Vite vs UMD" is: **both exist, only the UMD `index.html` is live, the Vite skeleton is orphaned scaffolding.**

**Dependencies**

`package.json:11-18` (Vite app only):
- `react ^18.3.1`, `react-dom ^18.3.1`
- dev: `@vitejs/plugin-react ^4.4.1`, `vite ^5.4.11`
- **`@supabase/supabase-js` is imported at `src/src/supabaseClient.js:1` but is NOT in `package.json`** — `npm install` will leave this unresolved. The Vite app is broken as-is.

`index.html` CDN scripts (lines 12-16):
- `react@18.3.1` UMD prod
- `react-dom@18.3.1` UMD prod
- `@babel/standalone@7.24.7`
- Google Fonts: Inter (lines 8-10)

**File-by-file**
- `index.html` — the actual app. React UMD + Babel, all components, all demo data, Claude API call.
- `package.json` — Vite config for the orphaned `src/` skeleton; missing `@supabase/supabase-js`.
- `vite.config.js` — plain `@vitejs/plugin-react` setup; never used in production.
- `README.md` — accurate marketing copy; describes the not-yet-built features as if shipped.
- `src/main.jsx` — Vite entry for the orphan; mounts `<App/>` from `src/App.jsx`.
- `src/App.jsx` — the OpenAI tester UI (not Acedex). Calls `getAiReply` on submit.
- `src/ai.js` — `fetch` wrapper to `api.openai.com/v1/responses`. Uses OpenAI, not Claude. Contradicts the README.
- `src/styles.css` — light-mode styles for the OpenAI tester only. Conflicts with the dark theme in `index.html` (won't actually clash because `index.html` doesn't import it).
- `src/src/supabaseClient.js` — **misnested under `src/src/`** (typo'd dir). Exports a `supabase` client with hardcoded URL + anon key. **Imported by nothing.**

---

## 2. WORKING FEATURES (end-to-end, in `index.html`)

| Flow | Files / Lines | Actually functions? |
|---|---|---|
| Onboarding (2 steps, role pick) | `index.html:443-494` | ✅ Works. Never shown again? Actually `showOnboard` initial state is `true` (line 1153), no persistence — **shows every page load.** |
| Role switcher (Student/Professor) | `526-528`, `471-473` | ✅ Works, in-memory only. No persistence. |
| Home dashboard with stats/cards | `497-607` | ✅ Renders from `PROJECTS` const. |
| Projects list with search + filter chips | `610-670` | ✅ Works. |
| Project detail tabs (overview/milestones/tasks/team/activity/insights/ai) | `673-700` | ✅ Renders. |
| Task checkbox toggle | `783-829` | ⚠️ Works but **state is local to `<Tasks>`** (line 784) and resets when you leave the project. No persistence. |
| Insights "Mark reviewed / Follow-up" | `872-907` | ⚠️ Same — local `useState` (line 873), lost on unmount. |
| Project AI chat (per-project) | `909-976` | ✅ Real Claude calls if key set; context built at lines 927-935. |
| Global AI tab | `979-1057` | ✅ Same as above, with project selector. |
| Settings sheet (API key save/clear) | `1114-1149` | ✅ Persists to `localStorage` key `Acedex_api_key`. |
| Profile screen | `1060-1111` | ⚠️ Renders, but stats are hardcoded ("23", "12", "4/9"). "Sign out" button does nothing (no `onClick`). |
| Bottom-nav badge for professor insights | `1170`, `1196-1197` | ✅ Live count from data. |

**Polished-looking but broken/half-built:**
- The **`···`** menu button on project detail (`index.html:681`) has no handler.
- **"Submit work"** button on active milestones (`index.html:774`) has no handler — pure visual.
- **FAB style is defined** (`.fab` at `index.html:118-119`) **but never rendered.**
- **Profile rows** for Notifications / Appearance / Privacy / Help & support (`index.html:1095-1106`) are non-functional rows.
- **"Sign out"** button (`index.html:1107`) — no handler.

---

## 3. SUPABASE INTEGRATION

**This is the biggest gap between your description and reality.** You said "Supabase wired for auth (username/password, OTP login, password reset — OTP is functional)." That is **not in this codebase.**

- The *only* Supabase artifact is `src/src/supabaseClient.js` (8 lines): it creates a client and exports it. **Nothing imports it.** There is **no signup, no login, no OTP, no password reset code anywhere** in `index.html` or `src/`.
- No `auth.signUp`, no `auth.signInWithPassword`, no `auth.signInWithOtp`, no `auth.resetPasswordForEmail` references anywhere (grepped).
- **No tables, no columns referenced in code.** No `.from(...)`, no `.select(...)`, no schema implied.
- `@supabase/supabase-js` is not in `package.json` (see §1).

**Auth flow status:** all stubs / nothing wired. The only "auth" the live app has is `showOnboard` state and the role switcher.

**Hardcoded keys / env concerns:**
- `src/src/supabaseClient.js:4-5` — Supabase URL `https://jnmqcqvnibhsltnxpuve.supabase.co` and publishable anon key `sb_publishable_6A_B92Njk714cB_13OqH5A_5waCRTTJ` hardcoded. Anon keys are designed to be public, but committing them couples the repo to a specific project and leaks the project ref — move to `import.meta.env.VITE_*` once Vite is real.
- `index.html` Claude API key handling (`1117-1118`, `1162-1163`) is **localStorage in cleartext**, sent direct from browser with `anthropic-dangerous-direct-browser-access: true` (line 356). Fine for solo demo, **never acceptable in production** (any XSS = key exfiltration, and the key bills your account).

If you had a working Supabase auth flow before, it's either on another branch or got lost. `git branch -a` shows only `main` and `codex/transfer-mvp-and-integrate-ai`.

---

## 4. CODE QUALITY ISSUES

**Collabify check:** zero references anywhere. ✅ Confirmed clean.

**Dead code / unused files:**
- Entire `src/` Vite app — unused (`App.jsx`, `main.jsx`, `ai.js`, `styles.css`).
- `src/src/supabaseClient.js` — orphan, plus misnested directory `src/src/`.
- `package.json` + `vite.config.js` exist only to support the orphan.
- `.fab` style class (`index.html:118-119`) — defined, never rendered.

**Duplication:**
- Project card markup is duplicated between `Home` (`index.html:559-583`) and `ProjectsList` (`642-660`) — extract a `<ProjectCard>`.
- Two near-identical chat components: `ProjectAI` (`909-976`) and `AIScreen` (`979-1057`). Same `send`, same context-builder shape, same UI primitives — extract a `<ClaudeChat>`.
- Two `role-switch` toggles (`471-473` in onboarding, `526-528` in Home) — fine, just noting.

**Naming / conventions:**
- localStorage key is `Acedex_api_key` (`1118`, `1123`, `1162`) — capital + underscore is inconsistent with everything else in the codebase. Prefer `acedex.api_key` or `acedex:api_key`.
- Many cryptic 2–4 char classnames in CSS (`.pb`, `.pc`, `.av`, `.ms`, `.ins`, `.ob`, `.tv`, `.tl`, `.gh`, `.ctb`, `.dtab`) — fine when isolated to one file, will not scale once you split into modules.

**State management:**
- Single source of truth for projects: `const PROJECTS` (`index.html:280-311`) — read-only constant. Everything that "mutates" (task toggle, insight decision) lives in component-local state and is lost on unmount.
- No reducer / no context — all state in `App` (`1152-1158`): `showOnboard`, `role`, `tab`, `openProject`, `showSettings`, `apiKey`. Manageable now, will explode when you add real data.

**Magic numbers / inline styles:** heavy mix of CSS variables + inline `style={{...}}` everywhere (margins, sizes, colors). Hard to theme later.

**Error handling:**
- `askClaude` (`index.html:323-378`) handles 401/429 and a generic non-ok branch — decent.
- `data.content?.[0]?.text` (line 374) — good null-safety.
- No retry, no timeout, no abort on unmount → if you navigate away mid-call, `setMessages` runs on a dead component (React 18 will warn).

**Heatmap is non-deterministic:** `Math.random()` runs at module load (`index.html:313`) — different heatmap every reload, including in screenshots.

---

## 5. UI / DESIGN CONSISTENCY

**Theme variables** (`index.html:19-33`) — well-defined and used consistently. Indigo/violet `--grad` is reused in 30+ places via `var(--grad)`. ✅

**One-off colors creeping in?** Almost none in `index.html`. The orphan `src/styles.css:39` uses `#175cd3` (blue, not indigo) — irrelevant since unused.

**Spacing/typography/buttons:** Largely uniform. Buttons go through `.btn .btn-p / .btn-g / .btn-sm / .btn-bl` (lines 171-176). Cards through `.card`. Spacing uses 24px gutters consistently.

**Inconsistencies:**
- Sometimes `var(--r-md)` (14px), sometimes raw `12px` / `14px` border-radius inline.
- "Send" button corner radius 14px (line 207), other primary buttons 12px (line 171) — close but not identical.
- Multiple "stat tile" styles: `.stat` (line 77), `.tile` (line 228), `.pstat` (line 236) — three near-equivalent layouts.

**Mobile responsiveness:** The app is **literally framed as an iPhone** at 390×844 with a chrome notch (`.phone` at line 41). On `max-width:480px` the frame collapses to fullscreen (line 42). **On a tablet or laptop, you see a tiny phone in the center of a wide black screen.** No responsive desktop layout. If this is intentional for the demo, fine — but real users on laptops will think it's broken.

**Accessibility red flags (significant):**
- Every interactive element is a `<div onClick={...}>` rather than a `<button>`: role tabs (471-473, 526-528), filter chips (638), insight action chips, settings rows (1101), card containers (560, 643), milestone rows. Means no keyboard focus, no Enter/Space activation, no screenreader announcement.
- `<div className="check">` (line 803) is a checkbox without `<input type="checkbox">`, no aria-role, no aria-checked.
- Bottom nav uses unicode glyphs `⌂ ▦ ✦ ◉` with no `aria-label`. Screen readers will read "Black Up-Pointing Triangle" etc.
- `--muted-2: #5a6080` on `#0a0b10` body bg is ~3.8:1 contrast — fails WCAG AA for body text.
- No `:focus-visible` styles defined anywhere. Active styles only on `:active` (mouse press).
- `dangerouslySetInnerHTML` used at line 863 (activity strings) and 956/1040 (AI message text via `formatText`). Activity strings are hardcoded so safe today; **AI message content is rendered HTML-style** — once you let project metadata (PDF titles, comments) flow into prompts or context, a prompt-injection attack can return HTML/JS in the response and it will execute. **This is a real XSS vector waiting for real data.**

---

## 6. GAPS BEFORE THE NEXT FEATURE LAYER

What you'll need that doesn't exist yet:

1. **A real build / module system.** You can't extend a single 1,211-line `index.html` with Babel-in-browser into Projects/Tasks/Submissions cleanly. Either (a) commit to Vite and split components, or (b) keep `index.html` but accept it'll cross 5k lines fast. The Vite skeleton in `src/` is the wrong starting point — it's an OpenAI tester, not Acedex.
2. **Auth.** Nothing exists. You'll need a `SessionProvider`, route guards, and `role` derived from the `users` table rather than a local toggle.
3. **A `users.role` column** (or `profiles.role` if you use Supabase's pattern). The current `role` switcher (line 1154) needs to become a value read from the session, with the toggle removed (or gated behind admin).
4. **Routing.** App currently uses `tab` state (1155) and `openProject` state (1156). No URL changes. Sharing a project link, reloading on a detail page, deep-linking — none work. You need `react-router` or hash routes.
5. **DB schema + queries.** `PROJECTS` (280-311) needs to become four tables: `projects`, `tasks`, `submissions`, `access_grants` (matches your model). Plus RLS policies — students see only their assignments, profs see their projects.
6. **File upload (PDFs).** Zero scaffolding. Will need Supabase Storage bucket + signed URLs + size limits.
7. **AI verdict pipeline.** Currently insights are static data (line 286 etc.). You need a `submissions.verdict` enum and a service that runs the three checks. The browser-side `askClaude` call (323-378) won't cut it — verdicts need to happen server-side (Supabase Edge Function or similar) so the API key isn't in the browser and the run is auditable.
8. **Notifications.** Gmail wiring is zero. Needs an outbound queue or Supabase function + SMTP/Resend/SendGrid.
9. **Persisted state.** Task toggles (784), insight decisions (873), role pick — all evaporate. None of this will survive the next feature layer.

**Where to add the role column / role-based routing (cleanest):**
- Put `role` on `profiles` (Supabase convention: `profiles` table keyed by `auth.users.id`).
- Wrap `App` in a session/profile provider that reads role on mount.
- Replace the in-component `role` state (1154) with `useProfile().role`.
- Gate the role toggle (526-528) behind a dev flag — in prod, role is fixed by the row.

**Where Projects/Tasks/Submissions data should live in the current code:**
- `PROJECTS` (280-311) becomes `useProjects(role, userId)` — a hook that hits Supabase. Same shape (so components don't need rewriting) but async.
- Tasks subarray becomes a join or separate `useTasks(projectId)`.
- Submissions are new — they don't exist in the current shape. Add to project detail as a new tab or under each milestone.

---

## 7. RISKS & TECH DEBT

**Will bite you at scale:**
- **Browser-side Claude key** (`index.html:354-356`). Once Acedex has multiple users, you cannot ship a model where each professor types their key into localStorage. You need a backend that holds the key and bills against a single org account, or per-user keys held server-side. The gear-icon UI you're planning to add **must not** be the long-term solution.
- **No build pipeline → no minification, no tree-shake.** `@babel/standalone` parses JSX in the browser on every load (~3MB script). Acceptable for a demo, not for production.
- **`PROJECTS` constant baked into the bundle.** Once data is dynamic, you need pagination/optimistic-UI patterns the codebase doesn't have.
- **Single-file React without modules** makes code review and PR diffs painful and merge conflicts inevitable once you have collaborators.

**Security:**
- `dangerouslySetInnerHTML` consuming AI output (lines 956, 1040). Today the data is trusted; once submissions feed prompts, a prompt injection → HTML → script tag is plausible. Either render plain text + a safe markdown subset (e.g., `marked` with sanitize) or escape strictly.
- Supabase anon key in source (`src/src/supabaseClient.js:5`) — by design public, but RLS becomes the *only* thing standing between users and each other's data. Plan to write RLS carefully *before* turning on writes.
- No CSRF / origin restriction story. Once you have a real backend, this matters.
- `localStorage.Acedex_api_key` (1118) survives until the user clears site data. An XSS anywhere in the app drains the key.

**Refactor NOW vs later:**

| Refactor | When |
|---|---|
| Delete `src/` orphan and `src/src/supabaseClient.js` (or rename to `src/lib/supabase.js` and actually use it) | **Now** — confuses readers, blocks understanding. |
| Add proper Vite build + split `index.html` into modules | **Now**, before role/auth work. |
| Replace `dangerouslySetInnerHTML` in AI messages with a real markdown renderer + sanitizer | **Now**, before user-influenced content flows in. |
| Move Claude key off the browser | Before public launch / before adding paying users. |
| Extract `<ProjectCard>` and `<ClaudeChat>` duplications | After the Vite split (cheap to do then). |
| Convert `<div onClick>` to `<button>` everywhere | After Vite split — easier when components are smaller. |
| Add routing | When you add Projects/Tasks deep-linking. |

---

## 8. TOP 5 PRIORITIZED ACTIONS

1. **Decide build target and consolidate.** [Medium] Either (a) port `index.html` into the Vite `src/` tree as proper modules and delete the OpenAI-tester `App.jsx`/`ai.js`, or (b) commit to keeping `index.html` and delete the entire `src/` orphan. Right now the repo lies about what it is. Recommendation: (a) — you cannot grow into a multi-table CRUD app from a Babel-in-browser file.

2. **Actually wire Supabase auth.** [Medium-Large] The README and your description claim it's done; the code says it isn't. Add `@supabase/supabase-js` to `package.json`, build a real `signUp` / `signInWithPassword` / `signInWithOtp` / `resetPasswordForEmail` flow, and persist session. Until this exists, you can't build role-based access on top.

3. **Introduce a `profiles` table with `role` and derive `role` from session.** [Small once §2 lands] Replace `useState("student")` (`index.html:1154`) with a profile lookup; gate or remove the in-app role toggle. This unblocks every Prof/Student diverging feature.

4. **Sanitize AI output before rendering.** [Small] Swap `dangerouslySetInnerHTML` with `formatText` (lines 956, 1040) for a vetted markdown renderer (e.g., `marked` + `DOMPurify`). Do this *before* PDFs or user metadata can influence prompt context — once those flow in, you have an XSS vector.

5. **Plan to move the Claude API key off the browser.** [Large, but design now] Even if the gear-icon UI ships short-term, document that the production path is a backend proxy (Supabase Edge Function with a stored secret). Don't build features that assume client-side keys forever.

---

**Final note on the description-vs-reality gap:** The biggest signal in this audit is that what you described to me (Supabase auth, OTP working, password reset) **is not in the code at all**. Before spending time on Prof/Student roles, double-check whether you have an unmerged branch or a different repo where that work lives — otherwise you're building on a foundation that doesn't exist yet.