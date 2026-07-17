const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedFilename: { type: String, required: true },
  transcript: { type: String, default: '' },
  status: { type: String, enum: ['processing', 'done', 'failed'], default: 'processing' },
  errorMessage: { type: String, default: '' },
  recordedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Recording', recordingSchema);
