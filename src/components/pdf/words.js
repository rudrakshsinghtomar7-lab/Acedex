// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Word-geometry extraction for the custom selection engine. We model selection
// at WORD granularity (Adobe-style) rather than relying on native browser
// selection, which on react-pdf's text layer snaps to arbitrary PDF.js runs
// (often whole lines or mid-word fragments) and can't be restyled on iOS.
//
// Both demo and real PDFs funnel into one words[] model:
//   { idx, x, y, w, h, text, line }  — page-local pixels, line = row bucket.
// Hit-testing and band rendering are then pure geometry, identical for both.

// Group words whose vertical center falls within TOL px into the same line.
const LINE_TOL = 6;

function assignLines(words) {
  // words arrive in DOM order (top-to-bottom, left-to-right per row). Bucket by
  // rounded baseline so band-merging knows which words share a row.
  const rows = [];
  for (const w of words) {
    const mid = w.y + w.h / 2;
    let row = rows.find(r => Math.abs(r.mid - mid) <= LINE_TOL);
    if (!row) { row = { mid, id: rows.length }; rows.push(row); }
    w.line = row.id;
  }
  return words;
}

// Split a text node into per-word client rects using Range.getClientRects().
// The browser already laid out the (transformed) text-layer span, so the rects
// are pixel-accurate to what's painted — better than recomputing PDF.js
// transforms by hand.
function wordsFromTextNode(node, originX, originY, out) {
  const text = node.textContent;
  if (!text || !text.trim()) return;
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const rects = range.getClientRects();
    if (!rects.length) continue;
    // Union the rects (a word can wrap into >1 rect in rare cases).
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const rc of rects) {
      l = Math.min(l, rc.left); t = Math.min(t, rc.top);
      r = Math.max(r, rc.right); b = Math.max(b, rc.bottom);
    }
    if (!isFinite(l) || r - l <= 0 || b - t <= 0) continue;
    out.push({
      x: l - originX, y: t - originY,
      w: r - l, h: b - t,
      text: m[0],
    });
  }
}

// Real PDFs: read react-pdf's rendered text layer, split each span into words.
// pageEl is the .react-pdf__Page element; rects are made page-local.
export function wordsFromTextLayer(pageEl) {
  if (!pageEl) return [];
  const layer = pageEl.querySelector('.react-pdf__Page__textContent, .textLayer');
  if (!layer) return [];
  const origin = pageEl.getBoundingClientRect();
  const out = [];
  const spans = layer.querySelectorAll('span');
  for (const span of spans) {
    // Skip the end-of-content marker react-pdf appends.
    if (span.getAttribute('role') === 'presentation' && !span.textContent.trim()) continue;
    for (const child of span.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        wordsFromTextNode(child, origin.left, origin.top, out);
      }
    }
  }
  // DOM order isn't guaranteed top-to-bottom; sort by (line bucket, x).
  out.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  assignLines(out);
  return out.map((w, idx) => ({ ...w, idx }));
}

// Demo pages: we render one [data-w] span per word, so each is already a word.
export function wordsFromDemoSpans(pageEl) {
  if (!pageEl) return [];
  const origin = pageEl.getBoundingClientRect();
  const out = [];
  const spans = pageEl.querySelectorAll('[data-w]');
  for (const span of spans) {
    const rc = span.getBoundingClientRect();
    if (rc.width <= 0 || rc.height <= 0) continue;
    out.push({
      x: rc.left - origin.left, y: rc.top - origin.top,
      w: rc.width, h: rc.height,
      text: span.textContent,
    });
  }
  out.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  assignLines(out);
  return out.map((w, idx) => ({ ...w, idx }));
}

// Merge a selected word range into one band rect per line (for both the live
// selection overlay and saved highlight rendering).
export function bandsForRange(words, fromIdx, toIdx) {
  if (!words.length) return [];
  const lo = Math.max(0, Math.min(fromIdx, toIdx));
  const hi = Math.min(words.length - 1, Math.max(fromIdx, toIdx));
  const byLine = new Map();
  for (let i = lo; i <= hi; i++) {
    const w = words[i];
    const cur = byLine.get(w.line);
    if (!cur) byLine.set(w.line, { x: w.x, y: w.y, r: w.x + w.w, b: w.y + w.h });
    else {
      cur.x = Math.min(cur.x, w.x); cur.y = Math.min(cur.y, w.y);
      cur.r = Math.max(cur.r, w.x + w.w); cur.b = Math.max(cur.b, w.y + w.h);
    }
  }
  return [...byLine.values()].map(c => ({ x: c.x, y: c.y, w: c.r - c.x, h: c.b - c.y }));
}

// Nearest word to a page-local point. Prefer the word whose rect contains the
// point; otherwise the closest by center distance, lightly biased to the same
// row so horizontal drags don't jump lines.
export function wordAtPoint(words, px, py) {
  let best = -1, bestD = Infinity;
  for (const w of words) {
    if (px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h) return w.idx;
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    const dy = Math.abs(py - cy);
    const d = Math.hypot(px - cx, (py - cy)) + dy * 2; // row bias
    if (d < bestD) { bestD = d; best = w.idx; }
  }
  return best;
}

// Normalize page-local px rects to 0..1 so saved highlights are zoom/size
// independent; denormalize when rendering at the current page size.
export function normalizeBands(bands, pageW, pageH) {
  return bands.map(b => ({
    x: b.x / pageW, y: b.y / pageH, w: b.w / pageW, h: b.h / pageH,
  }));
}
export function denormalizeBands(bands, pageW, pageH) {
  return bands.map(b => ({
    x: b.x * pageW, y: b.y * pageH, w: b.w * pageW, h: b.h * pageH,
  }));
}
