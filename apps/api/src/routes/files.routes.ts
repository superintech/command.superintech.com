import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { filesController, downloadSharedFile, getShareInfo } from '../controllers/files.controller.js';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create year/month subdirectories
    const date = new Date();
    const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const destDir = path.join(uploadsDir, yearMonth);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving extension
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter - allow common file types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow common document types
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'text/plain',
    'text/csv',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',
    'text/xml',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar',
    // Video
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/mp3',
    // Generic binary (allow for unknown types)
    'application/octet-stream',
  ];

  console.log('File upload attempt:', file.originalname, file.mimetype);

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log('File type rejected:', file.mimetype);
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 10, // Max 10 files at once
  },
});

// Wrapper for upload with error handling
const uploadWithErrorHandler = (req: Request, res: Response, next: NextFunction) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err instanceof MulterError) {
      // Multer-specific errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 50MB.',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: 'Too many files. Maximum is 10 files.',
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    } else if (err) {
      // Other errors (like file type not allowed)
      console.error('Upload error:', err.message);
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    next();
  });
};

// Routes
router.post('/upload', authenticate, uploadWithErrorHandler, filesController.upload);
router.get('/', authenticate, filesController.list);
router.get('/:id', authenticate, filesController.get);
router.get('/:id/download', authenticate, filesController.download);
router.delete('/:id', authenticate, filesController.delete);

// File sharing routes (authenticated)
router.post('/:id/share', authenticate, filesController.createShare);
router.get('/:id/shares', authenticate, filesController.getShares);
router.delete('/share/:shareId', authenticate, filesController.deleteShare);

export default router;

// Export public routes separately (to be mounted without /api/files prefix)
export { downloadSharedFile, getShareInfo };
