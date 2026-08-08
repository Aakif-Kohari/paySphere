const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max — single source of truth

/**
 * The CSV importer's uploader.
 *
 * Default export, because it is what every existing caller means by "upload".
 * Memory storage: a CSV is parsed straight out of the buffer and never needs to
 * land on disk.
 */
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// --- Expense receipts (#719) ----------------------------------------------
//
// `routes/expense.routes.js` used the CSV uploader above for receipt uploads,
// which fails twice over (#794):
//
//   - the fileFilter accepts `text/csv` and nothing else, so every photographed
//     receipt and every PDF was rejected with "Only CSV files are allowed";
//   - memory storage leaves no `file.filename`, and the controller records
//     `` `/uploads/${file.filename}` `` — so even a CSV pretending to be a
//     receipt was stored as the literal path `/uploads/undefined`.
//
// Receipts are attachments rather than input to be parsed, so they go to disk
// under a name of our choosing.

const RECEIPTS_DIR = path.join(__dirname, '..', '..', 'uploads', 'receipts');

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5MB — a phone photo of a receipt

/** Real receipts are photos or scans. Nothing here is executable. */
const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Created lazily rather than at require time so importing this module in a
    // test does not write to the filesystem.
    fs.mkdir(RECEIPTS_DIR, { recursive: true }, (error) =>
      cb(error, RECEIPTS_DIR),
    );
  },
  filename: (req, file, cb) => {
    // Never the client's filename. It is attacker-controlled, can contain path
    // separators, and two people uploading "receipt.jpg" must not collide.
    // The extension is derived from the (already whitelisted) mime type rather
    // than taken from the name.
    const extension =
      file.mimetype === 'application/pdf'
        ? '.pdf'
        : `.${file.mimetype.split('/')[1]}`;

    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const receiptUpload = multer({
  storage: receiptStorage,
  limits: {
    fileSize: MAX_RECEIPT_SIZE,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (RECEIPT_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Receipts must be a JPEG, PNG, WebP, HEIC image or a PDF'));
    }
  },
});

upload.MAX_FILE_SIZE = MAX_FILE_SIZE;

// Named exports hang off the default one, because `module.exports = upload` is
// what the CSV callers already destructure `MAX_FILE_SIZE` from and changing
// that shape would break them.
upload.receiptUpload = receiptUpload;
upload.MAX_RECEIPT_SIZE = MAX_RECEIPT_SIZE;
upload.RECEIPT_MIME_TYPES = RECEIPT_MIME_TYPES;
upload.RECEIPTS_DIR = RECEIPTS_DIR;

module.exports = upload;
