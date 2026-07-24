// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Study design system — 7px status-coloured dot. `state` is a Study ladder state
// (active · ontrack · attention · approved · done); pass a raw status and it's
// mapped through the shared ladder.
import { ladder } from '../../utils/status.js';

export default function StatusDot({ state, status }) {
  const s = state ?? ladder(status).state;
  return <span className={`study-dot s-${s}`} aria-hidden="true" />;
}
