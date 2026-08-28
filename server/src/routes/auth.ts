import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { signToken, requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { autoPromoteIfAdminEmail } from '../services/adminPromotion.js'
import { sendVerificationEmail, sendPasswordResetEmail, notifyAdminNewUser } from '../notificationService.js'
import { getUserById } from '../services/userService.js'

// FULL CONTENT FROM ARTIFACTS - truncated for this call; use full in real
export default router
