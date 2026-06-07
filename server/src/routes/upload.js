import { Router } from "express";
import multer from "multer";
import { extractText } from "../services/pdf.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      const err = new Error("Only PDF files are accepted.");
      err.code = "INVALID_MIME";
      cb(err, false);
    }
  },
});

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const maxChars = parseInt(process.env.MAX_DOC_CHARS || "200000", 10);

  try {
    let { text, pages } = await extractText(req.file.buffer);

    const truncated = text.length > maxChars;
    if (truncated) {
      text = text.slice(0, maxChars) + "\n\n[Document truncated for length]";
    }

    return res.json({
      filename: req.file.originalname,
      pages,
      charCount: text.length,
      text,
      truncated,
    });
  } catch (err) {
    if (err.code === "EMPTY_PDF") {
      return res.status(422).json({ error: err.message });
    }
    console.error("PDF extraction error:", err);
    return res.status(500).json({ error: "Failed to process PDF." });
  }
});

// Multer error handler — must have 4 args for Express to treat it as error middleware
router.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File exceeds the 25 MB limit." });
  }
  if (err.code === "INVALID_MIME") {
    return res.status(400).json({ error: err.message });
  }
  console.error("Upload error:", err);
  return res.status(500).json({ error: "Upload failed." });
});

export default router;
