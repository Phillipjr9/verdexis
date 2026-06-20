import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/kyc')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf']

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

export interface DocumentUpload {
  id: string
  userId: string
  documentType: 'identity' | 'address' | 'selfie'
  fileName: string
  mimeType: string
  fileSize: number
  storagePath: string
  uploadedAt: Date
  hash: string // SHA-256 hash for integrity
}

/**
 * Validate file before upload
 */
export function validateFile(buffer: Buffer, mimeType: string, fileName: string): { valid: boolean; error?: string } {
  // Check size
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Max: ${MAX_FILE_SIZE / 1024 / 1024} MB` }
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: `Invalid file type. Allowed: JPG, PNG, PDF` }
  }

  // Check extension
  const ext = path.extname(fileName).slice(1).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` }
  }

  // Check if file is empty
  if (buffer.length === 0) {
    return { valid: false, error: 'File is empty' }
  }

  // Validate PDF header
  if (mimeType === 'application/pdf' && !isPdfValid(buffer)) {
    return { valid: false, error: 'Invalid PDF file' }
  }

  // Validate image magic bytes
  if ((mimeType === 'image/jpeg' || mimeType === 'image/png') && !isImageValid(buffer, mimeType)) {
    return { valid: false, error: 'Invalid image file' }
  }

  return { valid: true }
}

/**
 * Check if PDF file has valid magic bytes
 */
function isPdfValid(buffer: Buffer): boolean {
  // PDF magic bytes: %PDF
  return buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
}

/**
 * Check if image has valid magic bytes
 */
function isImageValid(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    // JPEG magic bytes: FF D8 FF
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (mimeType === 'image/png') {
    // PNG magic bytes: 89 50 4E 47
    return buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  }
  return false
}

/**
 * Calculate SHA-256 hash of file for integrity verification
 */
export function hashFile(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Store uploaded file securely
 */
export async function storeDocument(
  userId: string,
  documentType: 'identity' | 'address' | 'selfie',
  buffer: Buffer,
  originalFileName: string,
  mimeType: string,
): Promise<DocumentUpload> {
  // Validate file
  const validation = validateFile(buffer, mimeType, originalFileName)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file')
  }

  // Generate unique filename: userid_timestamp_doctype_randomstring
  const timestamp = Date.now()
  const randomStr = crypto.randomBytes(4).toString('hex')
  const ext = path.extname(originalFileName).slice(1).toLowerCase()
  const safeFileName = `${userId}_${timestamp}_${documentType}_${randomStr}.${ext}`

  // Create user-specific directory
  const userDir = path.join(UPLOADS_DIR, userId)
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true })
  }

  // Save file
  const filePath = path.join(userDir, safeFileName)
  await fs.promises.writeFile(filePath, buffer)

  // Calculate hash for integrity
  const hash = hashFile(buffer)

  return {
    id: crypto.randomUUID(),
    userId,
    documentType,
    fileName: originalFileName,
    mimeType,
    fileSize: buffer.length,
    storagePath: filePath,
    uploadedAt: new Date(),
    hash,
  }
}

/**
 * Retrieve stored document
 */
export async function retrieveDocument(userId: string, storagePath: string): Promise<Buffer> {
  // Security: Ensure path is within user's directory
  const userDir = path.join(UPLOADS_DIR, userId)
  const resolvedPath = path.resolve(storagePath)

  if (!resolvedPath.startsWith(userDir)) {
    throw new Error('Unauthorized access to document')
  }

  if (!fs.existsSync(storagePath)) {
    throw new Error('Document not found')
  }

  return fs.promises.readFile(storagePath)
}

/**
 * Delete stored document
 */
export async function deleteDocument(userId: string, storagePath: string): Promise<void> {
  // Security: Ensure path is within user's directory
  const userDir = path.join(UPLOADS_DIR, userId)
  const resolvedPath = path.resolve(storagePath)

  if (!resolvedPath.startsWith(userDir)) {
    throw new Error('Unauthorized access to document')
  }

  if (fs.existsSync(storagePath)) {
    await fs.promises.unlink(storagePath)
  }
}

/**
 * Verify file integrity using stored hash
 */
export async function verifyDocumentIntegrity(storagePath: string, expectedHash: string): Promise<boolean> {
  const buffer = await fs.promises.readFile(storagePath)
  const actualHash = hashFile(buffer)
  return actualHash === expectedHash
}

/**
 * Delete all user's KYC documents
 */
export async function deleteUserDocuments(userId: string): Promise<void> {
  const userDir = path.join(UPLOADS_DIR, userId)
  if (fs.existsSync(userDir)) {
    await fs.promises.rm(userDir, { recursive: true, force: true })
  }
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
  }
  return mimeMap[mimeType] || 'bin'
}
