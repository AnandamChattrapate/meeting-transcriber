import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listRecordings, uploadRecording } from '../api';

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

export default function Home() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState('');
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const hasProcessing = recordings.some((r) => r.status === 'processing');
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(refresh, 4000);
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
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

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : recordings.length === 0 ? (
        <p className="muted">No recordings yet. Upload one to get started.</p>
      ) : (
        <ul className="recording-list">
          {recordings.map((rec) => (
            <li key={rec._id}>
              <Link to={`/recordings/${rec._id}`} className="recording-item">
                <span className="recording-name">{rec.originalName}</span>
                <span className="recording-date">{formatDate(rec.recordedAt)}</span>
                <span className={`status-pill status-${rec.status}`}>
                  {STATUS_LABEL[rec.status] || rec.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
