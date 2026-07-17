import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRecording } from '../api';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function RecordingDetail() {
  const { id } = useParams();
  const [recording, setRecording] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getRecording(id);
      setRecording(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (recording?.status === 'processing' && !pollRef.current) {
      pollRef.current = setInterval(refresh, 4000);
    } else if (recording?.status !== 'processing' && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [recording, refresh]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(recording.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div className="page">
        <Link to="/" className="back-link">← Back</Link>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="page">
        <Link to="/" className="back-link">← Back</Link>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">← Back</Link>
      <header className="page-header">
        <div>
          <h1>{recording.originalName}</h1>
          <p className="muted">{formatDate(recording.recordedAt)}</p>
        </div>
        {recording.status === 'done' && (
          <button className="upload-btn" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy text'}
          </button>
        )}
      </header>

      {recording.status === 'processing' && <p className="muted">Transcribing… this page will update automatically.</p>}
      {recording.status === 'failed' && (
        <div className="error-banner">Transcription failed: {recording.errorMessage}</div>
      )}
      {recording.status === 'done' && (
        <pre className="transcript">{recording.transcript}</pre>
      )}
    </div>
  );
}
