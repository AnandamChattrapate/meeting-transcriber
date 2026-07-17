const fs = require('fs');
const path = require('path');
const Recording = require('../models/Recording');
const { transcribeAudio } = require('../utils/transcribe');

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
    const transcript = await transcribeAudio(filePath, req.file.originalname);
    recording.transcript = transcript;
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
    .select('originalName status recordedAt createdAt')
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

module.exports = { uploadRecording, listRecordings, getRecording };
