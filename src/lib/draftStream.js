// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Draft "drivers" — a driver is `(handlers, signal) => Promise<void>` that emits
// the draft event protocol into `handlers` and stops when `signal` aborts. This
// is the ONE seam the transport hides behind: useBriefDraft neither knows nor
// cares whether events come from the network or the local fixture.
//
//   handlers = { onDescription(text), onMilestone({cid,name,dueAt,tasks}),
//                onTask(mCid,{cid,name,description}), onDone(), onError({code,message}) }
//
// Two drivers ship:
//   • serverDraftDriver — POSTs the brief to the draft-from-brief Edge Function
//     and parses its SSE stream (the real path, Step 2 onward).
//   • fixtureDraftDriver — the local simulated stream, kept as a dev/offline
//     fallback (do not delete the fixture module).
import { parseDraft, streamDraft, nextCid, safeName, safeDesc, safeDescription } from './aiDraft.js';
import { getDraftFixture } from '../data/aiDraftFixture.js';

// Abort the whole draft if no SSE frame arrives for this long — guards against a
// silently wedged connection (a case the local fixture never had).
const STALL_MS = 20_000;

// Parse one SSE frame ("event: x\ndata: {...}") into { event, data }.
function parseFrame(frame) {
  let event = 'message';
  const dataLines = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  let data = {};
  try { data = JSON.parse(dataLines.join('\n')); } catch { data = {}; }
  return { event, data };
}

// Apply one parsed event to the handlers. cids are assigned HERE (client-only);
// `refToCid` maps a server milestone index → its client cid so tasks land right.
// Every field is re-clamped defensively — the network response is untrusted.
function applyEvent(ev, handlers, refToCid) {
  switch (ev.event) {
    case 'description': {
      const text = safeDescription(ev.data?.text);
      if (text && handlers.onDescription) handlers.onDescription(text);
      break;
    }
    case 'milestone': {
      const name = safeName(ev.data?.name);
      if (!name) { refToCid.set(ev.data?.ref, null); break; } // drop nameless + its tasks
      const cid = nextCid('m');
      refToCid.set(ev.data?.ref, cid);
      handlers.onMilestone && handlers.onMilestone({ cid, name, dueAt: null, tasks: [] });
      break;
    }
    case 'task': {
      const mCid = refToCid.get(ev.data?.ref);
      if (!mCid) break;                          // unknown/dropped milestone → skip
      const name = safeName(ev.data?.name);
      if (!name) break;
      handlers.onTask && handlers.onTask(mCid, { cid: nextCid('t'), name, description: safeDesc(ev.data?.description) });
      break;
    }
    case 'error':
      handlers.onError && handlers.onError({ code: ev.data?.code || 'internal', message: safeDescription(ev.data?.message) || 'Something went wrong while drafting.' });
      break;
    case 'done':
      handlers.onDone && handlers.onDone();
      break;
    default:
      break;
  }
}

export function serverDraftDriver({ url, token, apikey, brief }) {
  return async function drive(handlers, signal) {
    // Chain the caller's signal to an inner controller we also trip on stall.
    const inner = new AbortController();
    let timedOut = false;
    const onOuterAbort = () => inner.abort();
    if (signal) {
      if (signal.aborted) inner.abort();
      else signal.addEventListener('abort', onOuterAbort, { once: true });
    }
    let stall;
    const bump = () => {
      clearTimeout(stall);
      stall = setTimeout(() => { timedOut = true; inner.abort(); }, STALL_MS);
    };

    let res;
    try {
      bump();
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(apikey ? { apikey } : {}),
        },
        body: JSON.stringify({ brief }),
        signal: inner.signal,
      });
    } catch (e) {
      clearTimeout(stall);
      signal?.removeEventListener('abort', onOuterAbort);
      if (timedOut) { const err = new Error('The draft timed out. Try again, or fill in the plan manually.'); err.code = 'timeout'; throw err; }
      if (e?.name === 'AbortError') throw e; // user cancelled — bubble up untouched
      const err = new Error('Could not reach the draft service. Fill in the plan manually.');
      err.code = 'network';
      throw err;
    }

    if (!res.ok || !res.body) {
      clearTimeout(stall);
      signal?.removeEventListener('abort', onOuterAbort);
      // Pre-stream failure: the function returned JSON { code, message }.
      let message = 'The draft service is unavailable. Fill in the plan manually.';
      let code = `http_${res.status}`;
      try { const j = await res.json(); if (j?.message) message = j.message; if (j?.code) code = j.code; } catch { /* keep defaults */ }
      const err = new Error(message);
      err.code = code;
      err.status = res.status;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const refToCid = new Map();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        // Belt-and-suspenders: real fetch rejects the reader on abort, but don't
        // depend on the transport for it — stop deterministically on cancel/stall.
        if (inner.signal.aborted) throw new DOMException('aborted', 'AbortError');
        bump();
        buf += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const ev = parseFrame(frame);
          if (ev) applyEvent(ev, handlers, refToCid);
        }
      }
    } catch (e) {
      if (timedOut) { const err = new Error('The draft timed out. Try again, or fill in the plan manually.'); err.code = 'timeout'; throw err; }
      if (e?.name === 'AbortError') throw e; // user cancelled mid-stream
      // Stream dropped mid-way — surface it; the hook keeps the partial plan.
      const err = new Error('The draft stopped early. Finish the plan by hand, or try again.');
      err.code = 'stream_drop';
      throw err;
    } finally {
      clearTimeout(stall);
      signal?.removeEventListener('abort', onOuterAbort);
    }
  };
}

// Local simulated stream — the Step-1 path, retained as a dev/offline fallback.
export function fixtureDraftDriver() {
  return async function drive(handlers, signal) {
    const plan = parseDraft(await getDraftFixture());
    if (plan.milestones.length === 0) {
      handlers.onError && handlers.onError({ code: 'empty', message: 'The draft came back empty. Fill in the plan manually.' });
      return;
    }
    await new Promise((resolve) => {
      const cancel = streamDraft(plan, {
        onDescription: handlers.onDescription,
        onMilestone: handlers.onMilestone,
        onTask: handlers.onTask,
        onDone: () => { handlers.onDone && handlers.onDone(); resolve(); },
      });
      if (signal) {
        if (signal.aborted) { cancel(); resolve(); }
        else signal.addEventListener('abort', () => { cancel(); resolve(); }, { once: true });
      }
    });
  };
}
