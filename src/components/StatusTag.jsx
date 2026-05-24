// © 2026 Rudraksh Singh Tomar. All rights reserved.
export default function StatusTag({status}) {
  const m={"active":{c:"tag-a",t:"Active"},"at-risk":{c:"tag-w",t:"At risk"},"at_risk":{c:"tag-w",t:"At risk"},"completed":{c:"tag-s",t:"Completed"},"archived":{c:"tag-s",t:"Archived"}};
  const s=m[status]||m.active;
  return <span className={`tag ${s.c}`}>{s.t}</span>;
}
