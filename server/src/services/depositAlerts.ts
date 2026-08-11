import { prisma } from '../db.js'
import { sendAdminEmailNotification } from '../notificationService.js'
import { appUrl } from '../config/email.js'
import { createDepositActionToken } from './adminEmailActions.js'

export async function alertAdminsOfDeposit(
  userId: string,
  amount: number,
  currency: string,
  depositId: string,
  reference: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, email: true } })

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      kind: 'deposit',
      title: `Deposit awaiting approval: ${amount} ${currency}`,
      body: `${user?.name || user?.email || 'A user'} submitted a deposit for admin review. ${reference}`,
    })),
  })

  await Promise.all(admins.filter((admin) => admin.email).map(async (admin) => {
    const approveToken = createDepositActionToken(depositId, 'approve', admin.email)
    const rejectToken = createDepositActionToken(depositId, 'reject', admin.email)
    const approveUrl = `${appUrl}/api/admin/email-actions/${approveToken}`
    const rejectUrl = `${appUrl}/api/admin/email-actions/${rejectToken}`
    const html = `<p>${user?.name || 'A user'} (${user?.email || 'email unavailable'}) submitted a deposit for admin review.</p><p>${reference}</p><p>Choose the correct response below to process this request immediately:</p><p><a href="${approveUrl}" style="display:inline-block;background:#087f45;color:white;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold">YES - APPROVE</a><span style="display:inline-block;width:12px"></span><a href="${rejectUrl}" style="display:inline-block;background:#b42318;color:white;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold">NO - REJECT</a></p>`
    return sendAdminEmailNotification(`Deposit awaiting approval: ${amount} ${currency}`, `${user?.name || 'A user'} (${user?.email || 'email unavailable'}) submitted a deposit for admin review.\n\n${reference}\n\nApprove: ${approveUrl}\nReject: ${rejectUrl}`, html, [admin.email])
  }))
}
