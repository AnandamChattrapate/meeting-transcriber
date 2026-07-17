import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRecording, renameRecording } from '../api';

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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const pollRef = useRef(null);
  const titleInputRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getRecording(id);
      setRecording(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (recording?.status === 'processing' && !pollRef.current) {
      pollRef.current = setInterval(refresh, 4000);
    } else if (recording?.status !== 'processing' && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [recording, refresh]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  const handleCopy = async () => {
    const text = recording.cleanedTranscript || recording.transcript;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const name = (recording.title || recording.originalName).replace(/\.[^.]+$/, '');
    const text = recording.cleanedTranscript || recording.transcript;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = () => {
    setTitleInput(recording.title || recording.originalName);
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    const trimmed = titleInput.trim();
    if (!trimmed) { setEditingTitle(false); return; }
    try {
      const updated = await renameRecording(id, trimmed);
      setRecording((prev) => ({ ...prev, title: updated.title }));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setEditingTitle(false);
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') saveTitle();
    if (e.key === 'Escape') setEditingTitle(false);
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

  const displayTitle = recording.title || recording.originalName;
  const transcript = recording.cleanedTranscript || recording.transcript;
  const isDone = recording.status === 'done';

  return (
    <div className="page">
      <Link to="/" className="back-link">← Back</Link>

      <header className="page-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <div className="title-row">
              <input
                ref={titleInputRef}
                className="title-input"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={handleTitleKeyDown}
              />
              <button className="upload-btn" style={{ fontSize: 14, padding: '8px 16px' }} onClick={saveTitle}>Save</button>
              <button className="btn-ghost" onClick={() => setEditingTitle(false)}>Cancel</button>
            </div>
          ) : (
            <div className="title-row">
              <h1>{displayTitle}</h1>
              <button className="edit-btn" onClick={startEdit} title="Rename">✏</button>
            </div>
          )}
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>{formatDate(recording.recordedAt)}</p>
        </div>

        {isDone && (
          <div className="toolbar">
            <button className="btn-ghost" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="btn-ghost" onClick={handleDownload}>Download .txt</button>
          </div>
        )}
      </header>

      {recording.status === 'processing' && (
        <p className="muted">Transcribing and processing… this page will update automatically.</p>
      )}
      {recording.status === 'failed' && (
        <div className="error-banner">Transcription failed: {recording.errorMessage}</div>
      )}

      {isDone && (
        <>
          {recording.summary?.length > 0 && (
            <div className="section-card" style={{ animationDelay: '0.08s' }}>
              <p className="section-title">Summary</p>
              <ul className="summary-list">
                {recording.summary.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {recording.actionItems?.length > 0 && (
            <div className="section-card" style={{ animationDelay: '0.14s' }}>
              <p className="section-title">Action Items</p>
              <ul className="action-list">
                {recording.actionItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="section-card" style={{ animationDelay: '0.20s' }}>
            <p className="section-title">Transcript</p>
            <pre className="transcript">{transcript}</pre>
          </div>
        </>
      )}
    </div>
  );
}
