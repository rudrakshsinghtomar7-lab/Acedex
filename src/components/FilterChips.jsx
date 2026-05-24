// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { useLayoutEffect, useRef, useState } from 'react';

// Variable-width sliding pill behind the active filter chip. Refs +
// useLayoutEffect snapshot each chip's offsetLeft/Top/Width/Height after
// layout; a sibling .chip-pill animates between snapshots. Because the pill
// lives inside the overflow-x:auto .chips container its coordinates are
// content-space — it scrolls with the chips automatically.
//
// Items: [[key, label], ...]. Active is the key string.
export default function FilterChips({ items, active, onChange, className = '' }) {
  const refs = useRef({});
  const [pill, setPill] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });

  useLayoutEffect(() => {
    const el = refs.current[active];
    if (!el) { setPill(p => ({ ...p, ready: false })); return; }
    setPill({
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      ready: true,
    });
  }, [active, items.map(([k]) => k).join('|')]);

  return (
    <div className={`chips ${className}`}>
      <span
        className="chip-pill"
        aria-hidden
        style={{
          left: pill.left,
          top: pill.top,
          width: pill.width,
          height: pill.height,
          opacity: pill.ready ? 1 : 0,
        }}
      />
      {items.map(([k, t]) => (
        <button
          key={k}
          ref={el => { refs.current[k] = el; }}
          type="button"
          className={`chip ${active === k ? 'active' : ''}`}
          onClick={() => onChange(k)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
