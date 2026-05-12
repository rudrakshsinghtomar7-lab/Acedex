import StatusBar from './StatusBar.jsx';

export default function PhoneFrame({children}) {
  return (
    <div className="phone">
      <div className="island"/>
      <StatusBar/>
      {children}
    </div>
  );
}
