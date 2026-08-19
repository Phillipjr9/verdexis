import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from './db.js'
import { env } from './env.js'
import { customerEmailAddress, customerEmailName, adminEmailAddress, adminEmailRecipients, customerEmailFooter, emailReplyTo, formatEmailAddress, emailLogoUrl, appUrl } from './config/email.js'
import { companyInfo } from './config/company.js'

// SEE ARTIFACT - content too large, use create_or_update with chunked approach
export {}
