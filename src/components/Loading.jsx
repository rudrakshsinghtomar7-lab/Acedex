// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Study loading screen — the Acedex mark with a gold light sweeping its outline.
//
// The sweep is a motion-path animation: each spark rides `offset-path` and the
// only animated property is `offset-distance`, which resolves to a transform
// (Blink composites it) and never touches layout. The comet tail is NOT an
// animation — it is six sparks on the same loop with negative delays, so they
// sit at fixed distances behind the head. Their opacity and size are static.
// That keeps the whole effect to transform-only, which is what makes it smooth
// on a phone.
import { useMemo } from 'react';

// ONE source of truth for the outline. The <path> below and every spark's
// offset-path read from this, so the light can never drift off the shape.
// Rounded triangle in a 120x120 box — the corners are eased so the light turns
// rather than snapping.
export const MARK_PATH =
  'M64.34 27.88 L99.66 92.12 Q104 100 95 100 L25 100 Q16 100 20.34 92.12 ' +
  'L55.66 27.88 Q60 20 64.34 27.88 Z';

// Head first, then the tail: seconds behind the head, and how bright/large each
// sits. Falls off quickly so it reads as a comet, not a string of beads.
const SPARKS = [
  { delay: 0,     size: 13, opacity: 1    },
  { delay: -0.05, size: 11, opacity: 0.62 },
  { delay: -0.10, size: 10, opacity: 0.40 },
  { delay: -0.16, size: 9,  opacity: 0.26 },
  { delay: -0.23, size: 8,  opacity: 0.15 },
  { delay: -0.31, size: 7,  opacity: 0.08 },
];

export default function Loading({ message = 'Waking the workspace…' }) {
  const sparks = useMemo(
    () =>
      SPARKS.map((s, i) => (
        <span
          key={i}
          className="ldg-spark"
          style={{
            offsetPath: `path("${MARK_PATH}")`,
            animationDelay: `${s.delay}s`,
            width: s.size,
            height: s.size,
            marginLeft: -s.size / 2,
            marginTop: -s.size / 2,
            opacity: s.opacity,
          }}
        />
      )),
    [],
  );

  return (
    <div className="ldg" role="status" aria-live="polite">
      <div className="ldg-mark">
        <svg className="ldg-art" viewBox="0 0 120 120" aria-hidden="true">
          {/* Faint plum underlay so the path reads even where the light isn't. */}
          <path className="ldg-outline" d={MARK_PATH} />
          <path className="ldg-link" d="M44 62 Q60 69 76 62" />
          <circle className="ldg-node" cx="44" cy="62" r="3.4" />
          <circle className="ldg-node" cx="76" cy="62" r="3.4" />
        </svg>
        {sparks}
      </div>
      {/* Quiet, and only after ~3s — a fast load never shows it. The delay is
          pure CSS, so nothing here schedules work or holds the app up. */}
      <p className="ldg-msg">{message}</p>
    </div>
  );
}
