const request = require("supertest");
const express = require("express");
const multer = require("multer");
const upload = require("../upload.middleware");

describe("Upload Middleware — MAX_FILE_SIZE consistency (#252)", () => {
  test("should export MAX_FILE_SIZE constant as 2MB", () => {
    expect(upload.MAX_FILE_SIZE).toBe(2 * 1024 * 1024);
  });

  test("MAX_FILE_SIZE should be greater than 0", () => {
    expect(upload.MAX_FILE_SIZE).toBeGreaterThan(0);
  });
});

describe("Upload Middleware — Multer error handler message (#252)", () => {
  let app;

  beforeEach(() => {
    app = express();
    // Mount a test route that uses the actual upload middleware
    app.post("/test-upload", upload.single("file"), (req, res) => {
      res.status(200).json({ message: "Upload OK" });
    });

    // Copy the exact multer error handler from app.js
    app.use((err, req, res, next) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const maxMB = upload.MAX_FILE_SIZE / (1024 * 1024);
          return res.status(400).json({
            message: `File too large. Maximum size is ${maxMB}MB.`,
          });
        }
        return res.status(400).json({ message: "File upload error" });
      }
      next(err);
    });
  });

  test("should reject file larger than MAX_FILE_SIZE with correct error message", async () => {
    // Create a buffer larger than MAX_FILE_SIZE (2MB + 1 byte)
    const oversizedBuffer = Buffer.alloc(upload.MAX_FILE_SIZE + 1, "x");

    const res = await request(app)
      .post("/test-upload")
      .attach("file", oversizedBuffer, "test.csv");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("File too large. Maximum size is 2MB.");
  });

  test("should accept file smaller than MAX_FILE_SIZE", async () => {
    const smallBuffer = Buffer.alloc(1024, "x"); // 1KB

    const res = await request(app)
      .post("/test-upload")
      .attach("file", smallBuffer, "test.csv");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Upload OK");
  });
});
