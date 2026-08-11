import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { toast } from 'sonner'

export default function OTPModal({ open, onClose, onVerify, purpose = 'transaction' }: { open: boolean; onClose: () => void; onVerify: () => void; purpose?: string }) {
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (!open) setCode('')
  }, [open])

  const resend = async () => {
    try {
      setSending(true)
      const res = await fetch('/api/otp/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose, method: 'email' }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to send code')
      toast.success('Verification code sent to your email')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setSending(false)
    }
  }

  const verify = async () => {
    try {
      setVerifying(true)
      const res = await fetch('/api/otp/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, purpose }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Invalid code')
      toast.success('Code verified')
      onVerify()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enter Verification Code">
      <div className="space-y-3">
        <div>
          <Label className="text-sm text-[#E5E5E5]">A 6-digit code was sent to your email.</Label>
        </div>
        <div>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
        </div>
        <div className="flex gap-2">
          <Button onClick={verify} disabled={verifying || code.length < 6} className="flex-1">Verify</Button>
          <Button variant="ghost" onClick={resend} disabled={sending} className="flex-1">Resend</Button>
        </div>
      </div>
    </Modal>
  )
}
