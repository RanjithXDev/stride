import multer from "multer";
import path from "path";
import fs from "fs";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "./api-error";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extensions: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" };
    cb(null, `${unique}${extensions[file.mimetype] ?? ""}`);
  },
});

export function validateUploadedFile(req: Request, _res: Response, next: NextFunction) {
  const file = req.file;
  if (!file) return next();
  try {
    const header = Buffer.alloc(12);
    const fd = fs.openSync(file.path, "r");
    const read = fs.readSync(fd, header, 0, header.length, 0);
    fs.closeSync(fd);
    const bytes = header.subarray(0, read);
    const valid = file.mimetype === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-"
      : file.mimetype === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
      : file.mimetype === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : file.mimetype === "image/webp" ? bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP"
      : false;
    if (!valid) {
      fs.unlinkSync(file.path);
      throw new ApiError(400, "Uploaded file content does not match its declared type", "INVALID_UPLOAD");
    }
    next();
  } catch (error) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    next(error);
  }
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, and PDF files are allowed"));
  },
});
