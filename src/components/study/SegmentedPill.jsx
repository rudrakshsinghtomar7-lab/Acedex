// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Study design system — a segmented control with a single plum pill that springs
// between segments. Drives the pill purely off --seg-i/--seg-n so the slide is
// GPU-cheap and re-runs whenever `value` changes.
export default function SegmentedPill({ options, value, onChange }) {
  const idx = Math.max(0, options.findIndex(o => o.value === value));
  return (
    <div className="study-seg" role="tablist" style={{ '--seg-n': options.length, '--seg-i': idx }}>
      <span className="study-seg-pill" aria-hidden="true" />
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`study-seg-opt${o.value === value ? ' active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
