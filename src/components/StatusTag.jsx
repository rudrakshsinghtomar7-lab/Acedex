export default function StatusTag({status}) {
  const m={"active":{c:"tag-a",t:"Active"},"at-risk":{c:"tag-w",t:"At risk"},"completed":{c:"tag-s",t:"Completed"}};
  const s=m[status]||m.active;
  return <span className={`tag ${s.c}`}>{s.t}</span>;
}
