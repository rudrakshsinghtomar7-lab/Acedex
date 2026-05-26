// © 2026 Rudraksh Singh Tomar. All rights reserved.
export default function ProgCircle({value, size=48}) {
  const r=(size-6)/2, circ=2*Math.PI*r, off=circ-(value/100)*circ;
  const id=`g${value}_${Math.random().toString(36).slice(2,6)}`;
  return (
    <div className="pc" style={{width:size,height:size}}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--indigo)"/>
            <stop offset="100%" stopColor="var(--violet)"/>
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--bg-3)" strokeWidth="3" fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={`url(#${id})`} strokeWidth="3" fill="none" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{transition:"stroke-dashoffset 600ms cubic-bezier(.22,.61,.36,1)"}}/>
      </svg>
      <span className="pct">{value}</span>
    </div>
  );
}
