import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireFullAdmin, type AuthedRequest } from '../auth.js'
import { sendEmailNotification } from '../notificationService.js'

const router = Router()

router.post('/users/:id/role', requireAuth, requireFullAdmin, async (req: AuthedRequest, res) => {
  const role = String((req.body as { role?: string })?.role || '').toLowerCase()
  if (role !== 'subadmin' && role !== 'user') {
    res.status(400).json({ error: 'Role must be subadmin or user' })
    return
  }
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, email: true, name: true, role: true, deletedAt: true },
  })
  if (!target || target.deletedAt) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (target.id === req.userId) {
    res.status(400).json({ error: 'Cannot change your own role here' })
    return
  }
  if (target.role === 'admin') {
    res.status(403).json({ error: 'Cannot change a full admin from this action' })
    return
  }
  const user = await prisma.user.update({
    where: { id: target.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  })

  const promoted = role === 'subadmin'
  const subject = promoted
    ? 'You have been promoted to Verdexis sub-admin'
    : 'Your Verdexis sub-admin access was removed'
  const greeting = user.name ? `Hi ${user.name},` : 'Hello,'
  const body = promoted
    ? `${greeting}\n\nYour Verdexis account (${user.email}) is now a sub-admin.\n\nYou can sign in and open the admin console to create users and transfer funds to other accounts. You cannot credit or transfer funds to your own account.\n\nLog out and sign back in so the new role takes effect.\n\nVerdexis`
    : `${greeting}\n\nSub-admin access has been removed from ${user.email}. Your account is a standard user again.\n\nVerdexis`

  if (user.email) {
    void sendEmailNotification(user.email, subject, body, undefined, {
      userId: user.id,
      kind: 'system',
      title: subject,
      body,
    }).catch((e) => console.warn('[admin] subadmin email failed', e))
  }
  await prisma.notification.create({
    data: {
      userId: user.id,
      kind: 'system',
      title: subject,
      body: promoted
        ? 'You are now a sub-admin. Log out and sign back in, then open the admin console.'
        : 'Your sub-admin access was removed.',
    },
  }).catch(() => {})

  res.json({ user })
})

export default router
