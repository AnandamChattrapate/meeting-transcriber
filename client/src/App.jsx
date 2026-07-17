import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import RecordingDetail from './pages/RecordingDetail';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recordings/:id" element={<RecordingDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
