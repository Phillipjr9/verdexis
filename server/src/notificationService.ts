import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from './db.js'
import { env } from './env.js'
import { customerEmailAddress, customerEmailName, adminEmailAddress, adminEmailRecipients, customerEmailFooter, emailReplyTo, formatEmailAddress, emailLogoUrl, appUrl } from './config/email.js'
import { companyInfo } from './config/company.js'

// Full file too large for this intermediate step - will use push_files from local artifact
export {}
