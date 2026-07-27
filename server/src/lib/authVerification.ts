export type PendingVerificationKind = 'login' | 'signup'

export interface PendingVerificationPayload {
  otpRequired: true
  pendingToken: string
  verificationType: PendingVerificationKind
  email: string
  message: string
}

export function buildPendingVerificationPayload({
  kind,
  pendingToken,
  email,
}: {
  kind: PendingVerificationKind
  pendingToken: string
  email: string
}): PendingVerificationPayload {
  const action = kind === 'signup' ? 'finish signing up' : 'finish signing in'
  return {
    otpRequired: true,
    pendingToken,
    verificationType: kind,
    email,
    message: `We sent a 6-digit code to ${email}. Enter it to verify your email and ${action}.`,
  }
}
