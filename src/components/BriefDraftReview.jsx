// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Presentational review surface for the brief-to-draft plan. Fully controlled:
// all state lives in useBriefDraft; this only renders rows and calls actions.
// Editing works on rows that have already streamed in while others are still
// arriving (each row is keyed by its stable cid).
import SectionLabel from './study/SectionLabel.jsx';

export default function BriefDraftReview({ milestones, status, actions }) {
  const streaming = status === 'drafting';
  const last = milestones.length - 1;

  return (
    <div className="bd-review">
      <div className="bd-review-head">
        <SectionLabel>Drafted plan</SectionLabel>
        {streaming && (
          <span className="bd-streaming"><span className="bd-streaming-dot" aria-hidden="true" />Drafting…</span>
        )}
      </div>

      {milestones.map((m, i) => (
        <div key={m.cid} className="bd-ms">
          <div className="bd-ms-top">
            <input
              className="bd-ms-name"
              value={m.name}
              onChange={(e) => actions.renameMilestone(m.cid, e.target.value)}
              placeholder="Milestone name"
              aria-label="Milestone name"
            />
            <div className="bd-ms-ctrls">
              <button type="button" className="bd-ictrl" title="Move up"
                onClick={() => actions.moveMilestone(m.cid, -1)} disabled={i === 0} aria-label="Move milestone up">↑</button>
              <button type="button" className="bd-ictrl" title="Move down"
                onClick={() => actions.moveMilestone(m.cid, 1)} disabled={i === last} aria-label="Move milestone down">↓</button>
              <button type="button" className="bd-ictrl bd-ictrl-del" title="Remove milestone"
                onClick={() => actions.removeMilestone(m.cid)} aria-label="Remove milestone">✕</button>
            </div>
          </div>

          <label className="bd-date">
            <span className="bd-date-label">Due date</span>
            <input
              type="date"
              className="bd-date-input"
              value={m.dueAt || ''}
              onChange={(e) => actions.setMilestoneDate(m.cid, e.target.value)}
            />
          </label>

          <div className="bd-tasks">
            {m.tasks.map((t) => (
              <div key={t.cid} className="bd-task">
                <div className="bd-task-main">
                  <input
                    className="bd-task-name"
                    value={t.name}
                    onChange={(e) => actions.renameTask(m.cid, t.cid, e.target.value)}
                    placeholder="Task name"
                    aria-label="Task name"
                  />
                  <input
                    className="bd-task-desc"
                    value={t.description}
                    onChange={(e) => actions.setTaskDesc(m.cid, t.cid, e.target.value)}
                    placeholder="One-line description"
                    aria-label="Task description"
                  />
                </div>
                <button type="button" className="bd-ictrl bd-ictrl-del" title="Remove task"
                  onClick={() => actions.removeTask(m.cid, t.cid)} aria-label="Remove task">✕</button>
              </div>
            ))}
            <button type="button" className="bd-add" onClick={() => actions.addTask(m.cid)}>+ Add task</button>
          </div>
        </div>
      ))}

      <button type="button" className="bd-add bd-add-ms" onClick={actions.addMilestone}>+ Add milestone</button>
    </div>
  );
}
