import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listRecordings, uploadRecording, deleteRecording } from '../api';

const STATUS_LABEL = {
  processing: 'Transcribing…',
  done: 'Ready',
  failed: 'Failed',
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const tilt = (e) => {
  const el = e.currentTarget;
  el.style.transition = 'transform 0.06s linear, box-shadow 0.3s ease, border-color 0.25s ease';
  const rect = el.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  el.style.setProperty('--rx', `${y * -7}deg`);
  el.style.setProperty('--ry', `${x * 7}deg`);
};

const resetTilt = (e) => {
  const el = e.currentTarget;
  el.style.transition = 'transform 0.5s ease, box-shadow 0.3s ease, border-color 0.25s ease';
  el.style.removeProperty('--rx');
  el.style.removeProperty('--ry');
};

export default function Home() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listRecordings();
      setRecordings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const hasProcessing = recordings.some((r) => r.status === 'processing');
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(refresh, 4000);
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [recordings, refresh]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setUploadProgress(0);
    try {
      await uploadRecording(file, setUploadProgress);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRecording(id);
      setRecordings((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const filtered = recordings.filter((r) => {
    const q = search.toLowerCase();
    return !q || (r.title || r.originalName).toLowerCase().includes(q);
  });

  return (
    <div className="page">
      <header className="page-header">
        <h1>Meeting Recordings</h1>
        <label className="upload-btn">
          {uploadProgress === null ? 'Upload recording' : `Uploading… ${uploadProgress}%`}
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,.ogg,audio/*"
            onChange={handleFileChange}
            disabled={uploadProgress !== null}
            hidden
          />
        </label>
      </header>

      {recordings.length > 0 && (
        <input
          className="search-input"
          placeholder="Search recordings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">
          {recordings.length === 0
            ? 'No recordings yet. Upload one to get started.'
            : 'No recordings match your search.'}
        </p>
      ) : (
        <ul className="recording-list">
          {filtered.map((rec, i) => (
            <li
              key={rec._id}
              className="recording-row"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <Link
                to={`/recordings/${rec._id}`}
                className="recording-item"
                onMouseMove={tilt}
                onMouseLeave={resetTilt}
              >
                <span className="recording-name">{rec.title || rec.originalName}</span>
                <span className="recording-date">{formatDate(rec.recordedAt)}</span>
                <span className={`status-pill status-${rec.status}`}>
                  {STATUS_LABEL[rec.status] || rec.status}
                </span>
              </Link>
              {confirmDelete === rec._id ? (
                <div className="confirm-delete">
                  <span className="muted" style={{ fontSize: 13 }}>Delete?</span>
                  <button className="btn-danger" onClick={() => handleDelete(rec._id)}>Yes</button>
                  <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>No</button>
                </div>
              ) : (
                <button
                  className="btn-ghost delete-btn"
                  onClick={() => setConfirmDelete(rec._id)}
                  title="Delete recording"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
