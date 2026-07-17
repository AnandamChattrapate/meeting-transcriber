const path = require('path');
const Meeting = require('../models/Meeting');
const { transcribeAudio } = require('../utils/transcribe');
const { processTranscript } = require('../utils/processTranscript');
const { sendMeetingSummaryEmail } = require('../utils/sendEmail');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const SUMMARY_INTERVAL_MS = 5 * 60 * 1000;

async function startMeeting(req, res) {
  const { title = '' } = req.body;
  const meeting = await Meeting.create({ title });
  res.status(201).json(meeting);
}

async function addChunk(req, res) {
  const meeting = await Meeting.findById(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  if (!req.file) return res.status(400).json({ error: 'No audio provided' });

  // Respond immediately so iOS isn't blocked waiting
  res.json({ ok: true, rollingSnapshot: meeting.rollingSnapshot });

  const filePath = path.join(UPLOADS_DIR, req.file.filename);
  try {
    const chunkText = await transcribeAudio(filePath, req.file.originalname);
    meeting.rawTranscript = (meeting.rawTranscript + ' ' + chunkText).trim();

    const now = new Date();
    const needsSummary = !meeting.lastSummaryAt
      || (now - meeting.lastSummaryAt) >= SUMMARY_INTERVAL_MS;

    if (needsSummary && meeting.rawTranscript.length > 80) {
      try {
        const processed = await processTranscript(meeting.rawTranscript);
        const bullets = (processed.summary || []).map(s => `• ${s}`).join('\n');
        const actions = (processed.actionItems || []).map(a => `→ ${a}`).join('\n');
        meeting.rollingSnapshot = [bullets, actions].filter(Boolean).join('\n\n');
        meeting.lastSummaryAt = now;
      } catch (_) {}
    }
    await meeting.save();
  } catch (err) {
    console.error('Chunk error:', err.message);
  }
}

async function getMeeting(req, res) {
  const meeting = await Meeting.findById(req.params.id).lean();
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  res.json(meeting);
}

async function listMeetings(req, res) {
  const meetings = await Meeting.find()
    .sort({ startedAt: -1 })
    .select('title status startedAt endedAt')
    .lean();
  res.json(meetings);
}

async function endMeeting(req, res) {
  const { emailTo = '' } = req.body;
  const meeting = await Meeting.findById(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

  meeting.status = 'ended';
  meeting.endedAt = new Date();
  await meeting.save();
  res.json(meeting.toObject());

  if (meeting.rawTranscript) {
    try {
      const processed = await processTranscript(meeting.rawTranscript);
      meeting.cleanedTranscript = processed.cleanedTranscript || meeting.rawTranscript;
      meeting.summary = processed.summary || [];
      meeting.actionItems = processed.actionItems || [];
      await meeting.save();
    } catch (err) {
      console.error('End-of-meeting LLM error:', err.message);
    }
  }

  if (emailTo && process.env.RESEND_API_KEY) {
    try {
      await sendMeetingSummaryEmail({ to: emailTo, meeting: meeting.toObject() });
      meeting.emailSentTo = emailTo;
      await meeting.save();
    } catch (err) {
      console.error('Email error:', err.message);
    }
  }
}

module.exports = { startMeeting, addChunk, getMeeting, listMeetings, endMeeting };
