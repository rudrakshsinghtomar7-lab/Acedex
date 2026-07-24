// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Study design system — a project row: subtle fill + 4px status spine, Spectral
// title, right-aligned meta (% or status text), faint course line, and a 3px
// status-coloured progress bar. Grounded with a whisper shadow, NOT a floating
// card. A done project recedes: receded fill, greyed text, and NO progress bar.
import { ladder, isDoneState } from '../../utils/status.js';

export default function ProjectItem({ project, onOpen }) {
  const { state, label } = ladder(project.status);
  const done = isDoneState(project.status);
  // Meta reads as a percentage while in-flight; a done project shows its state
  // word instead of a bar-less "100%".
  const meta = done ? label : `${project.progress ?? 0}%`;

  return (
    <button
      type="button"
      className={`study-proj s-${state}${done ? ' is-done' : ''}`}
      onClick={() => onOpen?.(project)}
    >
      <div className="study-proj-head">
        <span className="study-proj-title">{project.title}</span>
        <span className="study-proj-meta">{meta}</span>
      </div>
      {project.course && <div className="study-proj-course">{project.course}</div>}
      {!done && (
        <div className="study-proj-bar">
          <span style={{ width: `${Math.max(0, Math.min(100, project.progress ?? 0))}%` }} />
        </div>
      )}
    </button>
  );
}
