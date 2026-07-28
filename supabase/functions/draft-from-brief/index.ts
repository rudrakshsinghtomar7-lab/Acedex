// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// draft-from-brief — STEP 2. Proves the full network path
//   browser → auth → Edge Function → real SSE stream → progressive render
// while the payload is STILL the fixture. NO Anthropic API, NO key, NO spend.
// Step 3 swaps only the data source (the fixture loop below) for a real model
// stream; the auth, validation, rate-limit, transport, and SSE protocol here
// stay exactly the same.
//
// Emits the SAME event protocol the frontend already consumes, as SSE frames:
//   event: description  data: { text }
//   event: milestone    data: { ref, name }          (ref = milestone index)
//   event: task         data: { ref, name, description }
//   event: done         data: {}
//   event: error        data: { code, message }       (mid-stream failures only)
// No cids on the wire — the client assigns those (they are client-only keys).
//
// verify_jwt is DISABLED for this function (see config.toml) so we own the auth
// error messages; we verify the JWT manually below.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Server-side cap — mirrors MAX_BRIEF_CHARS in src/lib/aiDraft.js. The client
// also caps input, but never trust it: this is the authoritative limit.
const MAX_BRIEF_CHARS = 6000;
const STAGGER_MS = 120;         // perceived-speed pacing between SSE frames
const RATE_LIMIT = 5;           // drafts per user per window
const RATE_WINDOW_MS = 60_000;

// The fixture. Shape is the contract locked in src/data/aiDraftFixture.js — keep
// the two in sync until Step 3 replaces this with a real model stream. No dates.
const FIXTURE = {
  description:
    'A semester-long study measuring how retrieval-augmented generation affects factual accuracy in open-domain question answering. Teams build a small RAG pipeline, run a controlled evaluation, and report where grounding helps and where it fails.',
  milestones: [
    {
      name: 'Scope & literature review',
      tasks: [
        { name: 'Define the research question', description: 'Write one testable hypothesis about RAG and factual accuracy.' },
        { name: 'Survey prior work', description: 'Summarize five recent papers on retrieval-augmented generation.' },
        { name: 'Pick evaluation datasets', description: 'Choose two open-domain QA benchmarks with gold answers.' },
      ],
    },
    {
      name: 'Build the pipeline',
      tasks: [
        { name: 'Set up the retriever', description: 'Index a document corpus and return top-k passages per query.' },
        { name: 'Wire the generator', description: 'Feed retrieved context to the model and capture answers.' },
        { name: 'Add a no-retrieval baseline', description: 'Run the same model without any retrieved context.' },
        { name: 'Log every run', description: 'Store queries, contexts, and outputs for later analysis.' },
      ],
    },
    {
      name: 'Evaluate & analyze',
      tasks: [
        { name: 'Score answer accuracy', description: 'Compare model answers against gold labels on both sets.' },
        { name: 'Measure grounding', description: 'Check whether answers are supported by retrieved passages.' },
        { name: 'Error analysis', description: 'Categorize the twenty most common failure cases.' },
      ],
    },
    {
      name: 'Write-up & presentation',
      tasks: [
        { name: 'Draft the report', description: 'Cover method, results, and threats to validity.' },
        { name: 'Build result figures', description: 'Plot accuracy and grounding across both baselines.' },
        { name: 'Prepare the talk', description: 'Ten-minute presentation with a live demo.' },
      ],
    },
  ],
};

const CORS = {
  'Access-Control-Allow-Origin': '*', // Bearer-token auth, no cookies → * is safe
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  });
}

// Per-user sliding window, in-memory at module scope. Basic by design (Step 2):
// effective within a warm isolate, which catches the common "hammering" case.
// Step 3 (real spend) should promote this to a DB/Redis-backed limiter shared
// across isolates.
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) { hits.set(userId, recent); return true; }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { code: 'method', message: 'Use POST.' });

  // — AUTH: verify the JWT ourselves so the messages are ours —
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { code: 'unauthorized', message: 'Sign in to draft from a brief.' });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json(401, { code: 'unauthorized', message: 'Your session has expired — sign in again.' });

  // Auth-only by decision: any signed-in user may draft (matches the create-
  // project flow, and drafting writes nothing + spends nothing). Role gating
  // belongs in Step 3 when a real API call is involved.

  // — INPUT VALIDATION —
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const brief = typeof (body as { brief?: unknown })?.brief === 'string' ? (body as { brief: string }).brief : '';
  if (!brief.trim()) return json(400, { code: 'empty', message: 'Paste an assignment brief to draft from.' });
  if (brief.length > MAX_BRIEF_CHARS) {
    return json(413, { code: 'too_long', message: `Brief is too long — keep it under ${MAX_BRIEF_CHARS.toLocaleString()} characters.` });
  }

  // — RATE LIMIT —
  if (rateLimited(user.id)) {
    return json(429, { code: 'rate_limited', message: "You're drafting too fast — wait a moment and try again." }, { 'Retry-After': '60' });
  }

  // — STREAM (200): SSE frames from the fixture —
  const encoder = new TextEncoder();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed || req.signal.aborted) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        if (req.signal.aborted) return;
        send('description', { text: FIXTURE.description });
        await sleep(STAGGER_MS);
        for (let i = 0; i < FIXTURE.milestones.length; i += 1) {
          if (req.signal.aborted) break;               // client cancelled → stop
          const m = FIXTURE.milestones[i];
          send('milestone', { ref: i, name: m.name });
          await sleep(STAGGER_MS);
          for (const t of m.tasks) {
            if (req.signal.aborted) break;
            send('task', { ref: i, name: t.name, description: t.description });
            await sleep(STAGGER_MS);
          }
        }
        if (!req.signal.aborted) send('done', {});
      } catch (_e) {
        // Mid-stream failure (200 already sent) → error frame, never a hang.
        send('error', { code: 'internal', message: 'Something went wrong while drafting. Try again.' });
      } finally {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    // Consumer disconnected / cancelled: the loop above sees req.signal.aborted
    // and stops enqueuing; nothing else to release.
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
});
