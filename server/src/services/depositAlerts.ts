import { prisma } from '../db.js'
import { sendAdminEmailNotification } from '../notificationService.js'
import { adminEmailRecipients } from '../config/email.js'
import { appUrl } from '../config/email.js'
import { createDepositActionToken } from './adminEmailActions.js'

/**
 * Notify every allowlisted admin (ADMIN_EMAIL / ADMIN_EMAILS) by email,
 * and every user with role=admin via in-app notification.
 *
 * Email recipients are restricted by notificationService to the env allowlist
 * so SMTP never sends to arbitrary addresses. Action tokens are issued for
 * each allowlisted mailbox.
 */
export async function alertAdminsOfDeposit(
  userId: string,
  amount: number,
  currency: string,
  depositId: string,
  reference: string,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, email: true },
    })

    if (admins.length) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          kind: 'deposit',
          title: `Deposit awaiting approval: ${amount} ${currency}`,
          body: `${user?.name || user?.email || 'A user'} submitted a deposit for admin review. ${reference}`,
        })),
      })
    }

    const recipients = Array.from(
      new Set(
        adminEmailRecipients
          .map((a) => a.trim().toLowerCase())
          .filter((a) => a.includes('@')),
      ),
    )

    if (!recipients.length) {
      console.warn(
        '[depositAlerts] No ADMIN_EMAIL / ADMIN_EMAILS configured — deposit email skipped. In-app admin notifications may still have been created.',
      )
      return
    }

    const who = user?.name || 'A user'
    const email = user?.email || 'email unavailable'
    const subject = `[IMPORTANT] Deposit awaiting approval: ${amount} ${currency}`

    // One token pair per allowlisted recipient so approve/reject links authorize the right mailbox
    await Promise.all(
      recipients.map(async (adminEmail) => {
        const approveToken = createDepositActionToken(depositId, 'approve', adminEmail)
        const rejectToken = createDepositActionToken(depositId, 'reject', adminEmail)
        const approveUrl = `${appUrl}/api/admin/email-actions/${approveToken}`
        const rejectUrl = `${appUrl}/api/admin/email-actions/${rejectToken}`
        const text = [
          `${who} (${email}) submitted a deposit for admin review.`,
          '',
          reference,
          '',
          `Approve: ${approveUrl}`,
          `Reject: ${rejectUrl}`,
        ].join('\n')
        const html = `
          <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
            <p style="margin:0 0 12px;padding:10px 14px;background:#fef3c7;border-left:4px solid #d97706;border-radius:4px">
              <strong>IMPORTANT</strong> — Deposit awaiting approval
            </p>
            <p><strong>${who}</strong> (${email}) submitted a deposit for admin review.</p>
            <p>${reference}</p>
            <p>Amount: <strong>${amount} ${currency}</strong></p>
            <p style="margin-top:20px">
              <a href="${approveUrl}" style="display:inline-block;background:#087f45;color:white;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold">YES — APPROVE</a>
              <span style="display:inline-block;width:12px"></span>
              <a href="${rejectUrl}" style="display:inline-block;background:#b42318;color:white;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold">NO — REJECT</a>
            </p>
          </div>`

        const ok = await sendAdminEmailNotification(subject, text, html, {
          important: true,
          recipients: [adminEmail],
        })
        if (!ok) {
          console.warn(`[depositAlerts] Admin deposit email failed for ${adminEmail}`)
        }
      }),
    )
  } catch (err) {
    console.error('[depositAlerts] alertAdminsOfDeposit failed:', err)
  }
}

/** Alert allowlisted admins that a withdrawal is queued for review. */
export async function alertAdminsOfWithdrawal(
  userId: string,
  amount: number,
  asset: string,
  withdrawalId: string,
  destination?: string | null,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true },
    })

    if (admins.length) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          kind: 'withdrawal',
          title: `Withdrawal queued: ${amount} ${asset}`,
          body: `${user?.name || user?.email || 'A user'} requested a withdrawal (${withdrawalId}).`,
        })),
      })
    }

    const who = user?.name || 'A user'
    const email = user?.email || 'email unavailable'
    const adminUsersUrl = `${(appUrl || 'https://www.verdexisgroup.com').replace(/\/$/, '')}/admin`
    const subject = `[IMPORTANT] Withdrawal queued: ${amount} ${asset}`
    const text = [
      `${who} (${email}) requested a withdrawal.`,
      `Amount: ${amount} ${asset}`,
      `Withdrawal ID: ${withdrawalId}`,
      destination ? `Destination: ${destination}` : '',
      '',
      `Admin: ${adminUsersUrl}`,
    ]
      .filter(Boolean)
      .join('\n')
    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
        <p style="margin:0 0 12px;padding:10px 14px;background:#fef3c7;border-left:4px solid #d97706;border-radius:4px">
          <strong>IMPORTANT</strong> — Withdrawal queued
        </p>
        <p><strong>${who}</strong> (${email}) requested a withdrawal.</p>
        <p>Amount: <strong>${amount} ${asset}</strong></p>
        <p>Withdrawal ID: <code>${withdrawalId}</code></p>
        ${destination ? `<p>Destination: <code>${destination}</code></p>` : ''}
        <p style="margin-top:20px">
          <a href="${adminUsersUrl}" style="display:inline-block;background:#0C8B44;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Open admin</a>
        </p>
      </div>`

    const ok = await sendAdminEmailNotification(subject, text, html, { important: true })
    if (!ok) {
      console.warn('[depositAlerts] Admin withdrawal email failed (check SMTP + ADMIN_EMAIL allowlist)')
    }
  } catch (err) {
    console.error('[depositAlerts] alertAdminsOfWithdrawal failed:', err)
  }
}
