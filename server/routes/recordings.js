const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { uploadRecording, listRecordings, getRecording } = require('../controllers/recordingsController');

const router = express.Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg)$/i;
    if (!allowed.test(file.originalname)) {
      return cb(new Error('Unsupported audio format'));
    }
    cb(null, true);
  },
});

router.post('/', upload.single('audio'), uploadRecording);
router.get('/', listRecordings);
router.get('/:id', getRecording);

module.exports = router;
