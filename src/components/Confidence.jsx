export default function Confidence({level}) {
  return (
    <div className="conf">
      <span>AI Confidence</span>
      <div className="conf-d">
        {[1,2,3,4,5].map(i => <span key={i} className={i<=level?"f":""}/>)}
      </div>
      <span style={{marginLeft:4}}>{level>=4?"High":level>=3?"Moderate":"Low"}</span>
    </div>
  );
}
