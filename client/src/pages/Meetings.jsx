import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listMeetings, startMeeting } from '../api';

function formatDate(d) {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    listMeetings()
      .then(setMeetings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleNew = async () => {
    navigate('/live/new');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Live Meetings</h1>
        <button className="upload-btn" onClick={handleNew}>🎙 New Meeting</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : meetings.length === 0 ? (
        <p className="muted">No meetings yet. Start one to begin recording live.</p>
      ) : (
        <ul className="recording-list">
          {meetings.map((m, i) => (
            <li key={m._id} className="recording-row" style={{ animationDelay: `${i * 0.05}s` }}>
              <Link to={`/meetings/${m._id}`} className="recording-item">
                <span className="recording-name">{m.title || 'Untitled Meeting'}</span>
                <span className="recording-date">{formatDate(m.startedAt)}</span>
                <span className={`status-pill ${m.status === 'active' ? 'status-processing' : 'status-done'}`}>
                  {m.status === 'active' ? 'Live' : 'Done'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
