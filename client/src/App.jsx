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

export default function App() {
  return (
    <>
      <BgMesh />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recordings/:id" element={<RecordingDetail />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
