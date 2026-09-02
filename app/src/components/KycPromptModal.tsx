import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, X } from 'lucide-react'
import { api, getToken } from '../lib/api'

export default function KycPromptModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!getToken()) return
    let alive = true
    api.me()
      .then((res) => {
        if (!alive) return
        const u = res.user as {
          kycStatus?: string
          prefs?: { kycRequested?: boolean }
        }
        const requested = !!(u?.prefs && (u.prefs as { kycRequested?: boolean }).kycRequested)
        const needs = requested && u?.kycStatus !== 'approved' && u?.kycStatus !== 'pending'
        setOpen(needs)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#ffffff12] bg-[#0f1619] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#0C8B44]" />
            <h2 className="text-lg font-medium text-[#E5E5E5]">Verification required</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-[#737373] hover:text-[#E5E5E5]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm text-[#A0A0A0]">
          An administrator asked you to complete identity verification before some account features stay available.
        </p>
        <div className="mt-5 flex gap-2">
          <Link to="/kyc" className="flex-1 rounded-xl bg-[#0C8B44] px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-[#0a7539]">
            Start verification
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-[#ffffff12] px-4 py-2.5 text-sm text-[#A0A0A0]">
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
