// © 2026 Rudraksh Singh Tomar. All rights reserved.
// Study design system — a plain activity line with exactly one accent-coloured
// noun: `tone="link"` → plum (documents, comments, uploads), `tone="approve"`
// → green (approvals, sign-offs). Hairline between rows is applied by the list.
export default function ActivityRow({ before, accent, after, tone = 'link' }) {
  const cls = tone === 'approve' ? 'apr' : 'lnk';
  return (
    <div className="study-act">
      {before}
      {accent && <> <span className={cls}>{accent}</span></>}
      {after ? ` ${after}` : ''}
    </div>
  );
}
