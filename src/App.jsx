import { useState } from 'react';
import { PROJECTS } from './data/projects.js';
import PhoneFrame from './components/PhoneFrame.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import { useApiKey } from './hooks/useApiKey.js';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Projects from './screens/Projects.jsx';
import AIScreen from './screens/AIScreen.jsx';
import Profile from './screens/Profile.jsx';
import ProjectDetail from './screens/ProjectDetail/index.jsx';

function App() {
  const [showOnboard, setShowOnboard] = useState(true);
  const [role, setRole] = useState("student");
  const [tab, setTab] = useState("home");
  const [openProject, setOpenProject] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useApiKey();
  const projects = PROJECTS;

  const totalInsights = projects.reduce((a,p)=>a+p.insights.filter(i=>i.type!=="positive").length,0);
  const tabs = [
    {id:"home",icon:"⌂",label:"Home"},
    {id:"projects",icon:"▦",label:"Projects"},
    {id:"ai",icon:"✦",label:"AI",badge:role==="professor"?totalInsights:0},
    {id:"profile",icon:"◉",label:"Profile"}
  ];

  return (
    <PhoneFrame>
      {showOnboard && <Onboarding role={role} setRole={setRole} onComplete={()=>setShowOnboard(false)}/>}
      {!showOnboard && (
        openProject
          ? <div className="screen"><ProjectDetail project={openProject} role={role} apiKey={apiKey} onBack={()=>setOpenProject(null)}/></div>
          : tab==="ai"
            ? <AIScreen role={role} projects={projects} apiKey={apiKey}/>
            : <div className="screen">
                {tab==="home" && <Home role={role} projects={projects} onOpenProject={p=>setOpenProject(p)} setRole={setRole} openSettings={()=>setShowSettings(true)}/>}
                {tab==="projects" && <Projects role={role} projects={projects} onOpenProject={p=>setOpenProject(p)}/>}
                {tab==="profile" && <Profile role={role} projects={projects} openSettings={()=>setShowSettings(true)}/>}
              </div>
      )}
      {!showOnboard && !openProject && (
        <div className="bnav">
          {tabs.map(t => (
            <button key={t.id} className={`nav ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
              <span className="nav-i">{t.icon}</span>
              <span className="nav-l">{t.label}</span>
              {t.badge>0 && <span className="nav-b">{t.badge}</span>}
            </button>
          ))}
        </div>
      )}
      {showSettings && <SettingsSheet onClose={()=>setShowSettings(false)} apiKey={apiKey} setApiKey={setApiKey}/>}
    </PhoneFrame>
  );
}

export default App;
