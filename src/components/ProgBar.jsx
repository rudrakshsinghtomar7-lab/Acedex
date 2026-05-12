export default function ProgBar({value}) {
  return <div className="pb"><div className="pb-fill" style={{width:`${value}%`}} /></div>;
}
