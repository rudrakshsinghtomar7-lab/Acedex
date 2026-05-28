// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Floating action bar that appears above the live selection (Adobe-style):
// Highlight (expands to color swatches), Comment, Copy. Positioned from the
// selection's viewport rect, made container-local, and edge-flipped/clamped.
import { useLayoutEffect, useRef, useState } from 'react';

export default function FloatingToolbar({
  selection, containerRef, colors, busy, onHighlight, onComment, onCopy,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const [picking, setPicking] = useState(false);

  // Reset to the action row whenever a new selection starts.
  useLayoutEffect(() => { setPicking(false); }, [selection?.text]);

  useLayoutEffect(() => {
    const el = ref.current;
    const cont = containerRef.current;
    const r = selection?.screenRect;
    if (!el || !cont || !r) { setPos(null); return; }
    const cb = cont.getBoundingClientRect();
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const selCx = (r.left + r.right) / 2 - cb.left;
    const GAP = 10;
    let top = (r.top - cb.top) - th - GAP;       // above the selection
    if (top < 8) top = (r.bottom - cb.top) + GAP; // flip below if no room
    let left = selCx - tw / 2;                     // center on selection
    left = Math.max(8, Math.min(left, cb.width - tw - 8)); // clamp to edges
    setPos({ top, left });
  }, [selection, containerRef, picking]);

  if (!selection) return null;

  return (
    <div
      ref={ref}
      className="pdf-fl-toolbar"
      style={pos ? { top: pos.top, left: pos.left } : { opacity: 0 }}
      onPointerDown={e => e.stopPropagation()}
      role="toolbar"
    >
      {!picking ? (
        <>
          <button type="button" className="pdf-fl-btn" disabled={busy} onClick={() => setPicking(true)}>
            <span className="pdf-fl-ico" aria-hidden>▦</span>Highlight
          </button>
          <span className="pdf-fl-sep" />
          <button type="button" className="pdf-fl-btn" disabled={busy} onClick={onComment}>
            <span className="pdf-fl-ico" aria-hidden>💬</span>Comment
          </button>
          <span className="pdf-fl-sep" />
          <button type="button" className="pdf-fl-btn" disabled={busy} onClick={onCopy}>
            <span className="pdf-fl-ico" aria-hidden>⧉</span>Copy
          </button>
        </>
      ) : (
        <>
          {colors.map(c => (
            <button
              key={c.value}
              type="button"
              className="pdf-fl-swatch"
              style={{ background: c.value }}
              aria-label={c.label}
              disabled={busy}
              onClick={() => onHighlight(c.value)}
            />
          ))}
          <span className="pdf-fl-sep" />
          <button type="button" className="pdf-fl-btn pdf-fl-btn-ghost" disabled={busy} onClick={() => setPicking(false)}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
