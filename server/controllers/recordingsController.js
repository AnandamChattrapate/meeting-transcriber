const fs = require('fs');
const path = require('path');
const Recording = require('../models/Recording');
const { transcribeAudio } = require('../utils/transcribe');
const { processTranscript } = require('../utils/processTranscript');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

async function uploadRecording(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const recording = await Recording.create({
    originalName: req.file.originalname,
    storedFilename: req.file.filename,
    status: 'processing',
  });

  res.status(201).json(recording);

  const filePath = path.join(UPLOADS_DIR, req.file.filename);
  try {
    const rawTranscript = await transcribeAudio(filePath, req.file.originalname);
    recording.transcript = rawTranscript;

    try {
      const processed = await processTranscript(rawTranscript);
      recording.cleanedTranscript = processed.cleanedTranscript || rawTranscript;
      recording.summary = Array.isArray(processed.summary) ? processed.summary : [];
      recording.actionItems = Array.isArray(processed.actionItems) ? processed.actionItems : [];
    } catch (llmErr) {
      console.error('AI processing failed:', llmErr.message);
      recording.cleanedTranscript = rawTranscript;
    }

    recording.status = 'done';
    await recording.save();
  } catch (err) {
    recording.status = 'failed';
    recording.errorMessage = err.message;
    await recording.save();
  }
}

async function listRecordings(req, res) {
  const recordings = await Recording.find()
    .sort({ recordedAt: -1 })
    .select('originalName title status recordedAt createdAt')
    .lean();
  res.json(recordings);
}

async function getRecording(req, res) {
  const recording = await Recording.findById(req.params.id).lean();
  if (!recording) {
    return res.status(404).json({ error: 'Recording not found' });
  }
  res.json(recording);
}

async function deleteRecording(req, res) {
  const recording = await Recording.findByIdAndDelete(req.params.id);
  if (!recording) return res.status(404).json({ error: 'Recording not found' });

  const filePath = path.join(UPLOADS_DIR, recording.storedFilename);
  try { fs.unlinkSync(filePath); } catch (_) {}

  res.json({ ok: true });
}

async function renameRecording(req, res) {
  const { title } = req.body;
  const recording = await Recording.findByIdAndUpdate(
    req.params.id,
    { title },
    { new: true, lean: true }
  );
  if (!recording) return res.status(404).json({ error: 'Recording not found' });
  res.json(recording);
}

module.exports = { uploadRecording, listRecordings, getRecording, deleteRecording, renameRecording };
