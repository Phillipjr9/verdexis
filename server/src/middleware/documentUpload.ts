import multer from 'multer'
import type { NextFunction, Request, Response } from 'express'
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_FILE_SIZE } from '../documentService.js'

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOCUMENT_FILE_SIZE,
    files: 1,
    fields: 10,
    parts: 12,
  },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype))
  },
})

/** Parse one bounded document upload and turn parser failures into 400s. */
export function documentUpload(req: Request, res: Response, next: NextFunction): void {
  parser.single('document')(req, res, (error: unknown) => {
    if (error) {
      const multerCode = error instanceof multer.MulterError
        ? (error as multer.MulterError).code
        : undefined
      const message = multerCode === 'LIMIT_FILE_SIZE'
        ? 'File too large'
        : 'Invalid document upload'
      res.status(400).json({ error: message })
      return
    }
    next()
  })
}
