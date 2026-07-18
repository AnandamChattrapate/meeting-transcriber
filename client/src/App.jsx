import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import RecordingDetail from './pages/RecordingDetail';
import Meetings from './pages/Meetings';
import MeetingDetail from './pages/MeetingDetail';
import { NewLiveMeeting, LiveMeetingRoom } from './pages/LiveMeeting';
import './App.css';

function BgMesh() {
  return (
    <div className="bg-mesh" aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    </div>
  );
}

function Nav({ isDark, onToggle }) {
  return (
    <nav className="top-nav">
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Recordings
        </NavLink>
        <NavLink to="/meetings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Live Meetings
        </NavLink>
      </div>
      <button className="theme-fab" onClick={onToggle} aria-label="Toggle theme" title={isDark ? 'Light mode' : 'Dark mode'}>
        {isDark ? '☀︎' : '⏾'}
      </button>
    </nav>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('mt-theme') || 'system');
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('mt-theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') { root.setAttribute('data-theme', 'dark'); setIsDark(true); }
    else if (theme === 'light') { root.setAttribute('data-theme', 'light'); setIsDark(false); }
    else { root.removeAttribute('data-theme'); setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches); }
    localStorage.setItem('mt-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e) => setIsDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <>
      <BgMesh />
      <BrowserRouter>
        <Nav isDark={isDark} onToggle={toggleTheme} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recordings/:id" element={<RecordingDetail />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/meetings/:id" element={<MeetingDetail />} />
          <Route path="/live/new" element={<NewLiveMeeting />} />
          <Route path="/live/:id" element={<LiveMeetingRoom />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
