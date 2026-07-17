const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// Groq rejects requests above ~25MB; stay comfortably under that.
const MAX_CHUNK_BYTES = Number(process.env.GROQ_MAX_FILE_BYTES) || 20 * 1024 * 1024;
// Chunks are transcoded to 64kbps mono mp3 (8000 bytes/sec), with a 10% safety margin.
const CHUNK_SECONDS = Math.floor((MAX_CHUNK_BYTES * 0.9) / 8000);

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('error', (err) => reject(new Error(`ffmpeg not available: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function callGroqTranscription(fileBuffer, filename) {
  const form = new FormData();
  form.append('file', new Blob([fileBuffer]), filename);
  form.append('model', process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo');
  form.append('response_format', 'text');

  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq transcription failed (${response.status}): ${errText}`);
  }

  return (await response.text()).trim();
}

async function transcribeLargeFile(filePath) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-chunks-'));
  try {
    const segmentPattern = path.join(workDir, 'chunk-%04d.mp3');
    await runFfmpeg([
      '-y', '-i', filePath,
      '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k',
      '-f', 'segment', '-segment_time', String(CHUNK_SECONDS),
      '-reset_timestamps', '1',
      segmentPattern,
    ]);

    const chunkFiles = fs.readdirSync(workDir)
      .filter((f) => f.startsWith('chunk-'))
      .sort();

    if (chunkFiles.length === 0) {
      throw new Error('Audio splitting produced no chunks');
    }

    const transcripts = [];
    for (const chunkFile of chunkFiles) {
      const chunkPath = path.join(workDir, chunkFile);
      const text = await callGroqTranscription(fs.readFileSync(chunkPath), chunkFile);
      transcripts.push(text);
    }
    return transcripts.join(' ').replace(/\s+/g, ' ').trim();
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function transcribeAudio(filePath, originalName) {
  const { size } = fs.statSync(filePath);
  if (size <= MAX_CHUNK_BYTES) {
    return callGroqTranscription(fs.readFileSync(filePath), originalName);
  }
  return transcribeLargeFile(filePath);
}

module.exports = { transcribeAudio };
