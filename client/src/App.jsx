import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import RecordingDetail from './pages/RecordingDetail';
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

function ThemeFab({ isDark, onToggle }) {
  return (
    <button className="theme-fab" onClick={onToggle} aria-label="Toggle theme" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {isDark ? '☀︎' : '⏾'}
    </button>
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
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      setIsDark(true);
    } else if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      setIsDark(false);
    } else {
      root.removeAttribute('data-theme');
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    localStorage.setItem('mt-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <>
      <BgMesh />
      <ThemeFab isDark={isDark} onToggle={toggleTheme} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recordings/:id" element={<RecordingDetail />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
