// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Custom word-level selection overlay (Adobe-style). Native browser selection
// is suppressed on the text layer (see index.css); this transparent overlay
// owns the gesture: long-press to start, press-drag or handle-drag to extend,
// always snapping to whole words. Reports the live selection up so the parent
// can float a toolbar and save real word-range rects.
import { useCallback, useEffect, useRef, useState } from 'react';
import { bandsForRange, wordAtPoint, normalizeBands } from './words.js';

const LONG_PRESS_MS = 320;
const MOVE_CANCEL_PX = 10;

export default function SelectionLayer({
  words, pageW, pageH, clearToken, onSelectionChange,
}) {
  // selection = { start, end } word indices (inclusive), or null.
  const [sel, setSel] = useState(null);
  const overlayRef = useRef(null);
  const press = useRef(null);      // { x, y, t, timer, fired }
  const dragHandle = useRef(null); // 'start' | 'end' | null (active handle drag)

  // Parent bumps clearToken to drop the selection after a save / close.
  useEffect(() => { setSel(null); }, [clearToken]);
  // If the page's words change (page flip / re-measure), drop stale selection.
  useEffect(() => { setSel(null); }, [words]);

  const pagePoint = useCallback((e) => {
    const r = overlayRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  // Report selection (or null) up to the parent whenever it changes.
  useEffect(() => {
    if (!sel || !words.length) { onSelectionChange?.(null); return; }
    const bands = bandsForRange(words, sel.start, sel.end);
    if (!bands.length) { onSelectionChange?.(null); return; }
    const lo = Math.min(sel.start, sel.end);
    const hi = Math.max(sel.start, sel.end);
    const text = words.slice(lo, hi + 1).map(w => w.text).join(' ');
    const ov = overlayRef.current?.getBoundingClientRect();
    // screenRect: union of bands in viewport px, for toolbar positioning.
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const bd of bands) {
      l = Math.min(l, bd.x); t = Math.min(t, bd.y);
      r = Math.max(r, bd.x + bd.w); b = Math.max(b, bd.y + bd.h);
    }
    onSelectionChange?.({
      text,
      normBands: normalizeBands(bands, pageW, pageH),
      screenRect: ov ? { left: ov.left + l, top: ov.top + t, right: ov.left + r, bottom: ov.top + b } : null,
    });
  }, [sel, words, pageW, pageH, onSelectionChange]);

  function clearPress() {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
  }

  function onPointerDown(e) {
    if (dragHandle.current) return;          // handle has its own handlers
    if (!words.length) return;
    const p = pagePoint(e);
    const pt = { x: p.x, y: p.y, t: Date.now(), fired: false, pointerId: e.pointerId };
    pt.timer = setTimeout(() => {
      pt.fired = true;
      const idx = wordAtPoint(words, p.x, p.y);
      if (idx >= 0) {
        setSel({ start: idx, end: idx });
        // Continue this same gesture as an end-extend drag. Panning is already
        // locked in highlight mode (touch-action:none, see index.css), so the
        // drag stays captured for selection — no per-gesture lock needed here.
        dragHandle.current = { mode: 'extend', anchor: idx };
      }
      try { overlayRef.current.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }, LONG_PRESS_MS);
    press.current = pt;
  }

  function onPointerMove(e) {
    const pt = press.current;
    if (pt && !pt.fired) {
      const p = pagePoint(e);
      if (Math.hypot(p.x - pt.x, p.y - pt.y) > MOVE_CANCEL_PX) clearPress(); // it's a scroll
      return;
    }
    // Press-drag extend (same finger after long-press).
    if (dragHandle.current?.mode === 'extend') {
      e.preventDefault();
      const p = pagePoint(e);
      const idx = wordAtPoint(words, p.x, p.y);
      if (idx >= 0) setSel({ start: dragHandle.current.anchor, end: idx });
    }
  }

  function onPointerUp(e) {
    const pt = press.current;
    const wasLong = pt?.fired;
    clearPress();
    if (dragHandle.current?.mode === 'extend') {
      dragHandle.current = null;
      try { overlayRef.current.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      return;
    }
    // Short tap on empty area clears an existing selection.
    if (!wasLong && sel) setSel(null);
  }

  // --- Handle dragging (after the initial gesture) -----------------------
  function startHandleDrag(which) {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragHandle.current = { mode: which }; // 'start' | 'end'
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    };
  }
  function onHandleMove(e) {
    const h = dragHandle.current;
    if (!h || (h.mode !== 'start' && h.mode !== 'end')) return;
    e.preventDefault();
    const p = pagePoint(e);
    const idx = wordAtPoint(words, p.x, p.y);
    if (idx < 0) return;
    setSel(cur => {
      if (!cur) return cur;
      if (h.mode === 'start') return { start: Math.min(idx, cur.end), end: cur.end };
      return { start: cur.start, end: Math.max(idx, cur.start) };
    });
  }
  function endHandleDrag(e) {
    if (dragHandle.current?.mode === 'start' || dragHandle.current?.mode === 'end') {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      dragHandle.current = null;
    }
  }

  const bands = sel ? bandsForRange(words, sel.start, sel.end) : [];
  // Handle anchor points: start = top-left of first band; end = bottom-right of last.
  const startBand = bands[0];
  const endBand = bands[bands.length - 1];

  return (
    <div
      ref={overlayRef}
      className="pdf-sel-overlay"
      style={{ width: pageW, height: pageH }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {bands.map((b, i) => (
        <div
          key={i}
          className="pdf-sel-band"
          style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
        />
      ))}

      {startBand && (
        <div
          className="pdf-sel-handle pdf-sel-handle-start"
          style={{ left: startBand.x, top: startBand.y, height: startBand.h }}
          onPointerDown={startHandleDrag('start')}
          onPointerMove={onHandleMove}
          onPointerUp={endHandleDrag}
          onPointerCancel={endHandleDrag}
          aria-label="Selection start"
        >
          <span className="pdf-sel-handle-dot" />
        </div>
      )}
      {endBand && (
        <div
          className="pdf-sel-handle pdf-sel-handle-end"
          style={{ left: endBand.x + endBand.w, top: endBand.y, height: endBand.h }}
          onPointerDown={startHandleDrag('end')}
          onPointerMove={onHandleMove}
          onPointerUp={endHandleDrag}
          onPointerCancel={endHandleDrag}
          aria-label="Selection end"
        >
          <span className="pdf-sel-handle-dot" />
        </div>
      )}
    </div>
  );
}
