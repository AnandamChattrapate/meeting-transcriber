import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { startMeeting, sendChunk, endMeeting, getMeeting } from '../api';

const CHUNK_MS = 30_000;
const SNAPSHOT_POLL_MS = 60_000; // poll server every minute; server updates snapshot every 5 min

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function FloatingCard({ snapshot, expanded, onToggle }) {
  return (
    <div className={`floating-card ${expanded ? 'expanded' : ''}`}>
      <button className="floating-card-handle" onClick={onToggle}>
        <span className="floating-card-icon">◉</span>
        <span className="floating-card-label">Live Summary</span>
        <span className="floating-card-chevron">{expanded ? '▾' : '▴'}</span>
      </button>
      {expanded && (
        <div className="floating-card-body">
          {snapshot
            ? snapshot.split('\n').map((line, i) => <p key={i}>{line}</p>)
            : <p className="muted">Listening… summary appears after 5 minutes of speech.</p>}
        </div>
      )}
    </div>
  );
}

export function NewLiveMeeting() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async (e) => {
    e.preventDefault();
    setStarting(true);
    try {
      const meeting = await startMeeting(title.trim());
      navigate(`/live/${meeting._id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setStarting(false);
    }
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 8 }}>New Live Meeting</h1>
      <p className="muted" style={{ marginBottom: 28 }}>
        Your mic will be recorded in 30-second chunks. A rolling summary appears every 5 minutes.
        At the end you'll receive an email with the full summary.
      </p>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleStart} className="new-meeting-form">
        <input
          className="search-input"
          placeholder="Meeting title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <button className="upload-btn" type="submit" disabled={starting}>
          {starting ? 'Starting…' : '🎙 Start Recording'}
        </button>
      </form>
    </div>
  );
}

export function LiveMeetingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [snapshot, setSnapshot] = useState('');
  const [cardExpanded, setCardExpanded] = useState(true);
  const [email, setEmail] = useState(() => localStorage.getItem('mt-email') || '');
  const [showEnd, setShowEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const elapsedRef = useRef(null);
  const chunkTimerRef = useRef(null);
  const pollRef = useRef(null);

  const flushChunk = useCallback(async (meetingId) => {
    if (!chunksRef.current.length) return;
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];
    setProcessing(true);
    try {
      const res = await sendChunk(meetingId, blob);
      if (res.rollingSnapshot) setSnapshot(res.rollingSnapshot);
    } catch (_) {}
    setProcessing(false);
  }, []);

  const startRecording = useCallback(async (meetingId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(1000); // collect in 1-second slices
      setRecording(true);

      // Rotate chunk every 30s
      chunkTimerRef.current = setInterval(() => flushChunk(meetingId), CHUNK_MS);

      // Poll server for updated snapshot every minute
      pollRef.current = setInterval(async () => {
        const m = await getMeeting(meetingId).catch(() => null);
        if (m?.rollingSnapshot) setSnapshot(m.rollingSnapshot);
      }, SNAPSHOT_POLL_MS);
    } catch (err) {
      setError('Microphone access denied. Please allow mic in your browser and reload.');
    }
  }, [flushChunk]);

  useEffect(() => {
    getMeeting(id).then(setMeeting).catch(() => navigate('/'));
  }, [id, navigate]);

  useEffect(() => {
    if (!meeting) return;
    setSnapshot(meeting.rollingSnapshot || '');
    startRecording(meeting._id);
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(elapsedRef.current);
      clearInterval(chunkTimerRef.current);
      clearInterval(pollRef.current);
      mediaRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, [meeting, startRecording]);

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    clearInterval(chunkTimerRef.current);
    clearInterval(pollRef.current);
    clearInterval(elapsedRef.current);

    mediaRef.current?.stop();
    await new Promise((r) => setTimeout(r, 600)); // let final ondataavailable fire
    await flushChunk(id);

    mediaRef.current?.stream?.getTracks().forEach((t) => t.stop());
    setRecording(false);

    localStorage.setItem('mt-email', email);
    try {
      await endMeeting(id, email);
    } catch (_) {}
    navigate(`/meetings/${id}`);
  };

  if (!meeting) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page live-page">
      {/* Header */}
      <div className="live-header">
        <div>
          <h1 style={{ marginBottom: 4 }}>{meeting.title || 'Untitled Meeting'}</h1>
          <div className="live-status">
            <span className={`rec-dot ${recording ? 'active' : ''}`} />
            <span className="muted" style={{ fontSize: 14 }}>
              {recording ? 'Recording' : 'Starting…'}
            </span>
            {processing && <span className="muted" style={{ fontSize: 13, marginLeft: 10 }}>· Transcribing…</span>}
            <span className="live-timer">{formatTime(elapsed)}</span>
          </div>
        </div>
        <button className="end-btn" onClick={() => setShowEnd(true)}>
          ◼ End Meeting
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Floating summary card */}
      <FloatingCard snapshot={snapshot} expanded={cardExpanded} onToggle={() => setCardExpanded((v) => !v)} />

      {/* End meeting modal */}
      {showEnd && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2 style={{ marginBottom: 8 }}>End meeting?</h2>
            <p className="muted" style={{ marginBottom: 20, fontSize: 14 }}>
              The final summary will be emailed to you. Leave blank to skip the email.
            </p>
            <input
              className="search-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowEnd(false)} disabled={ending}>Cancel</button>
              <button className="end-btn" onClick={handleEnd} disabled={ending}>
                {ending ? 'Ending…' : 'End & Send Summary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
