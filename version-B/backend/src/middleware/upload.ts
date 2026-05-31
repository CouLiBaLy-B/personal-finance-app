// ===========================================
// FinTrack Backend - File Upload Middleware
// Handles CSV file uploads for transaction imports
// ===========================================

import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { ensureDir, getUploadsDir, generateFilename } from "../utils/index";
import logger from "../utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = getUploadsDir();
await ensureDir(uploadDir);

// File filter to only allow CSV files
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = ["text/csv", "application/vnd.ms-excel"];
  const allowedExts = [".csv"];

  const mimeOk = allowedMimes.includes(file.mimetype);
  const extOk = allowedExts.includes(path.extname(file.originalname).toLowerCase());

  if (mimeOk && extOk) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed"), false);
  }
};

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const filename = generateFilename(file.originalname);
    logger.info(`Uploading file: ${filename}`);
    cb(null, filename);
  },
});

// Maximum file size (from env or 5MB default)
const maxSize = parseInt(process.env.MAX_FILE_SIZE || "5242880"); // 5MB

// Multer upload middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxSize,
    files: 1, // Only allow one file at a time
  },
});

// Middleware to handle upload errors
export function handleUploadError(err: any, req: any, res: any, next: any) {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        error: "Too many files. Only one file is allowed at a time.",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        error: "Unexpected file. Please provide a CSV file.",
      });
    }
  }

  if (err) {
    // Other errors (like file type not allowed)
    return res.status(400).json({
      success: false,
      error: err.message || "File upload failed",
    });
  }

  next();
}

// Cleanup uploaded file after processing
export async function cleanupUpload(filename: string): Promise<void> {
  const fs = await import("fs");
  const filePath = path.join(uploadDir, filename);

  try {
    await fs.promises.unlink(filePath);
    logger.info(`Cleaned up uploaded file: ${filename}`);
  } catch (error) {
    logger.warn(`Failed to cleanup file ${filename}: ${error}`);
  }
}

// Get the full path to an uploaded file
export function getUploadPath(filename: string): string {
  return path.join(uploadDir, filename);
}

// Check if upload directory is writable
export async function checkUploadDir(): Promise<boolean> {
  const fs = await import("fs");
  try {
    await fs.promises.access(uploadDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
