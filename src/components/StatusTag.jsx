// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { ladder } from '../utils/status.js';

// Status-ladder pill. Colour + label come from the shared mapping so projects,
// milestones and submissions all read off one source of truth.
export default function StatusTag({ status }) {
  const { state, label } = ladder(status);
  return <span className={`spill spill-${state}`}>{label}</span>;
}
