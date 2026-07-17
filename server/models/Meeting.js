const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  rawTranscript: { type: String, default: '' },
  cleanedTranscript: { type: String, default: '' },
  summary: [{ type: String }],
  actionItems: [{ type: String }],
  rollingSnapshot: { type: String, default: '' },
  lastSummaryAt: { type: Date },
  emailSentTo: { type: String, default: '' },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);
