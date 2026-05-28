// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Renders a saved highlight as colored bands over the exact selected words
// (new highlights carry normalized rects in bbox.rects). Tapping a band opens
// the author / delete popover — same affordance as the legacy chip.
import { denormalizeBands } from './words.js';

export default function HighlightBands({
  row, pageW, pageH, isActive, onClick, onDelete,
}) {
  const author = row.author?.full_name || 'User';
  const bands = denormalizeBands(row.bbox.rects, pageW, pageH);
  if (!bands.length) return null;
  const last = bands[bands.length - 1];
  return (
    <>
      {bands.map((b, i) => (
        <button
          key={i}
          type="button"
          className={`pdf-hl-band ${isActive ? 'active' : ''}`}
          style={{ left: b.x, top: b.y, width: b.w, height: b.h, background: row.color || '#facc15' }}
          onClick={e => { e.stopPropagation(); onClick?.(row); }}
          aria-label={`Highlight by ${author}`}
        />
      ))}
      {isActive && (
        <span
          className="pdf-highlight-popover"
          style={{ left: last.x, top: last.y + last.h + 6 }}
          onClick={e => e.stopPropagation()}
          role="dialog"
        >
          <span>Highlighted by <strong>{author}</strong></span>
          {onDelete && (
            <button
              type="button"
              className="pdf-link-btn pdf-link-btn-warn"
              onClick={() => onDelete(row)}
            >Delete</button>
          )}
        </span>
      )}
    </>
  );
}
