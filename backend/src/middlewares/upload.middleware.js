const multer = require("multer");

const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max — single source of truth

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

upload.MAX_FILE_SIZE = MAX_FILE_SIZE;
module.exports = upload;