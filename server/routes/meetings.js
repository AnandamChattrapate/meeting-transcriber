const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { startMeeting, addChunk, getMeeting, listMeetings, endMeeting } = require('../controllers/meetingsController');

const router = express.Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/', startMeeting);
router.get('/', listMeetings);
router.get('/:id', getMeeting);
router.post('/:id/chunk', upload.single('audio'), addChunk);
router.post('/:id/end', endMeeting);

module.exports = router;
