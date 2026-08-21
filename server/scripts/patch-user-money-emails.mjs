/**
 * Ensures deposit/withdrawal user notifications always send email + in-app for money events.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '../src/notificationService.ts')
if (!fs.existsSync(file)) {
  console.warn('[patch-user-money-emails] notificationService.ts missing')
  process.exit(0)
}
let t = fs.readFileSync(file, 'utf8')
let changed = false

const oldDep = `export async function sendDepositNotification(userId: string, amount: number, asset: string, status: 'pending' | 'confirmed' | 'credited'): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }); if (!user) return
  const prefs = await getUserNotificationPreferences(userId)
  const messages: Record<string, { subject: string; body: string }> = {
    pending: { subject: 'Deposit Received', body: \`We received your deposit of \${amount} \${asset}. It's pending confirmation.\` },
    confirmed: { subject: 'Deposit Confirmed', body: \`Your deposit of \${amount} \${asset} has been confirmed on the blockchain.\` },
    credited: { subject: 'Deposit Credited', body: \`Your deposit of \${amount} \${asset} has been credited to your account.\` },
  }
  const message = messages[status]; if (!message) return
  if (prefs.emailNotifications && prefs.transactionAlerts) await sendEmailNotification(user.email, message.subject, message.body, undefined, { userId, kind: 'transaction', title: message.subject, body: message.body })
}`

const newDep = `export async function sendDepositNotification(userId: string, amount: number, asset: string, status: 'pending' | 'confirmed' | 'credited' | 'rejected'): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }); if (!user) return
  const messages: Record<string, { subject: string; body: string }> = {
    pending: { subject: 'Deposit Received — Pending Review', body: \`We received your deposit of \${amount} \${asset}. It is pending admin review and will be credited once approved.\` },
    confirmed: { subject: 'Deposit Confirmed', body: \`Your deposit of \${amount} \${asset} has been confirmed on the blockchain.\` },
    credited: { subject: 'Deposit Credited', body: \`Your deposit of \${amount} \${asset} has been approved and credited to your Verdexis balance. You can use these funds immediately.\` },
    rejected: { subject: 'Deposit Rejected', body: \`Your deposit of \${amount} \${asset} was reviewed and could not be credited. If you believe this is an error, contact support.\` },
  }
  const message = messages[status]; if (!message) return
  await sendEmailNotification(user.email, message.subject, message.body, undefined, {
    userId,
    kind: 'deposit',
    title: message.subject,
    body: message.body,
    createWebNotification: true,
  })
}`

const oldWd = `export async function sendWithdrawalNotification(userId: string, amount: number, asset: string, status: 'pending' | 'approved' | 'rejected' | 'completed'): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }); if (!user) return
  const prefs = await getUserNotificationPreferences(userId)
  const messages: Record<string, { subject: string; body: string }> = {
    pending: { subject: 'Withdrawal Request Submitted', body: \`Your withdrawal request for \${amount} \${asset} has been submitted and is pending admin approval.\` },
    approved: { subject: 'Withdrawal Approved', body: \`Your withdrawal of \${amount} \${asset} has been approved and is being processed.\` },
    rejected: { subject: 'Withdrawal Rejected', body: \`Your withdrawal request for \${amount} \${asset} has been rejected. Please contact support for details.\` },
    completed: { subject: 'Withdrawal Completed', body: \`Your withdrawal of \${amount} \${asset} has been completed successfully.\` },
  }
  const message = messages[status]; if (!message) return
  if (prefs.emailNotifications && prefs.transactionAlerts) await sendEmailNotification(user.email, message.subject, message.body, undefined, { userId, kind: 'transaction', title: message.subject, body: message.body })
}`

const newWd = `export async function sendWithdrawalNotification(userId: string, amount: number, asset: string, status: 'pending' | 'approved' | 'rejected' | 'completed'): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }); if (!user) return
  const messages: Record<string, { subject: string; body: string }> = {
    pending: { subject: 'Withdrawal Request Submitted', body: \`Your withdrawal request for \${amount} \${asset} has been submitted and is pending admin approval.\` },
    approved: { subject: 'Withdrawal Approved', body: \`Your withdrawal of \${amount} \${asset} has been approved and is being processed.\` },
    rejected: { subject: 'Withdrawal Rejected', body: \`Your withdrawal request for \${amount} \${asset} has been rejected. Please contact support for details.\` },
    completed: { subject: 'Withdrawal Completed', body: \`Your withdrawal of \${amount} \${asset} has been completed successfully.\` },
  }
  const message = messages[status]; if (!message) return
  await sendEmailNotification(user.email, message.subject, message.body, undefined, {
    userId,
    kind: 'transaction',
    title: message.subject,
    body: message.body,
    createWebNotification: true,
  })
}`

if (t.includes(oldDep)) { t = t.replace(oldDep, newDep); changed = true }
else if (!t.includes("'rejected'") || !t.includes('Deposit Received — Pending Review')) {
  console.warn('[patch-user-money-emails] deposit function pattern not matched; may already be patched')
}
if (t.includes(oldWd)) { t = t.replace(oldWd, newWd); changed = true }

if (changed) {
  fs.writeFileSync(file, t)
  console.log('[patch-user-money-emails] patched', file)
} else {
  console.log('[patch-user-money-emails] already applied or patterns not found')
}
