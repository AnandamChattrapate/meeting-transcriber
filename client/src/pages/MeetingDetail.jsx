import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMeeting } from '../api';

function formatDate(d) {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MeetingDetail() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMeeting(id).then(setMeeting).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="page"><Link to="/meetings" className="back-link">← Back</Link><div className="error-banner">{error}</div></div>;
  if (!meeting) return <div className="page"><Link to="/meetings" className="back-link">← Back</Link><p className="muted">Loading…</p></div>;

  const transcript = meeting.cleanedTranscript || meeting.rawTranscript || '';

  return (
    <div className="page">
      <Link to="/meetings" className="back-link">← Back</Link>
      <div className="page-header">
        <div>
          <h1>{meeting.title || 'Untitled Meeting'}</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{formatDate(meeting.startedAt)}</p>
        </div>
        {transcript && (
          <button className="btn-ghost" onClick={() => {
            const blob = new Blob([transcript], { type: 'text/plain' });
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${meeting.title || 'meeting'}.txt` });
            a.click();
          }}>Download .txt</button>
        )}
      </div>

      {meeting.summary?.length > 0 && (
        <div className="section-card">
          <p className="section-title">Summary</p>
          <ul className="summary-list">{meeting.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {meeting.actionItems?.length > 0 && (
        <div className="section-card">
          <p className="section-title">Action Items</p>
          <ul className="action-list">{meeting.actionItems.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}

      {transcript && (
        <div className="section-card">
          <p className="section-title">Transcript</p>
          <pre className="transcript">{transcript}</pre>
        </div>
      )}

      {!transcript && <p className="muted">No transcript yet — this meeting may still be processing.</p>}
    </div>
  );
}
