const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedFilename: { type: String, required: true },
  title: { type: String, default: '' },
  transcript: { type: String, default: '' },
  cleanedTranscript: { type: String, default: '' },
  summary: [{ type: String }],
  actionItems: [{ type: String }],
  status: { type: String, enum: ['processing', 'done', 'failed'], default: 'processing' },
  errorMessage: { type: String, default: '' },
  recordedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Recording', recordingSchema);
