import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { PROJECTS } from './data/projects.js';
import PhoneFrame from './components/PhoneFrame.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import BottomNav from './components/BottomNav.jsx';
import { useApiKey } from './hooks/useApiKey.js';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Projects from './screens/Projects.jsx';
import AIScreen from './screens/AIScreen.jsx';
import Profile from './screens/Profile.jsx';
import ProjectDetail from './screens/ProjectDetail/index.jsx';
import Login from './screens/auth/Login.jsx';
import Signup from './screens/auth/Signup.jsx';
import Reset from './screens/auth/Reset.jsx';
import { SessionProvider } from './providers/SessionProvider.jsx';

function ScreenLayout() {
  return <div className="screen"><Outlet/></div>;
}

function BottomNavLayout({role, insightBadgeCount}) {
  return (
    <>
      <Outlet/>
      <BottomNav role={role} insightBadgeCount={insightBadgeCount}/>
    </>
  );
}

function ProjectDetailRoute({role, apiKey}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const project = PROJECTS.find(p => String(p.id) === id);
  if (!project) return <Navigate to="/home" replace/>;
  const onBack = () => {
    if (location.key === 'default') navigate('/projects', {replace: true});
    else navigate(-1);
  };
  return <ProjectDetail project={project} role={role} apiKey={apiKey} onBack={onBack}/>;
}

function AppShell() {
  const [role, setRole] = useState("student");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useApiKey();
  const projects = PROJECTS;
  const openSettings = () => setShowSettings(true);

  const totalInsights = projects.reduce((a, p) => a + p.insights.filter(i => i.type !== "positive").length, 0);

  return (
    <PhoneFrame>
      <Routes>
        <Route path="/" element={<Navigate to="/onboard" replace/>}/>
        <Route path="/onboard" element={<Onboarding role={role} setRole={setRole}/>}/>
        <Route path="/login"  element={<div className="screen"><Login/></div>}/>
        <Route path="/signup" element={<div className="screen"><Signup/></div>}/>
        <Route path="/reset"  element={<div className="screen"><Reset/></div>}/>
        <Route path="/projects/:id" element={
          <div className="screen"><ProjectDetailRoute role={role} apiKey={apiKey}/></div>
        }/>
        <Route element={<BottomNavLayout role={role} insightBadgeCount={totalInsights}/>}>
          <Route path="/ai" element={<AIScreen role={role} projects={projects} apiKey={apiKey}/>}/>
          <Route element={<ScreenLayout/>}>
            <Route path="/home" element={<Home role={role} projects={projects} setRole={setRole} openSettings={openSettings}/>}/>
            <Route path="/projects" element={<Projects role={role} projects={projects}/>}/>
            <Route path="/profile" element={<Profile role={role} projects={projects} openSettings={openSettings}/>}/>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/home" replace/>}/>
      </Routes>
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} apiKey={apiKey} setApiKey={setApiKey}/>}
    </PhoneFrame>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter basename="/Acedex">
        <AppShell/>
      </BrowserRouter>
    </SessionProvider>
  );
}
