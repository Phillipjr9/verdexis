import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getFriendlyApiErrorMessage } from '../../lib/api'
import { userFromMe } from '../../lib/authMe'
import { LayoutDashboard } from 'lucide-react'

/**
 * Lightweight entry point on the user dashboard for admins.
 * Full admin work happens at /admin (AdminLayout shell).
 */
export default function AdminConsoleEmbed() {
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    let cancelled = false
    api.me()
      .then((r) => {
        if (!cancelled) setIsAdmin(userFromMe(r)?.role === 'admin')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const status =
          typeof err === 'object' && err !== null && 'status' in err
            ? Number((err as { status?: number }).status)
            : undefined
        if (status !== 401) {
          console.warn('AdminConsoleEmbed: api.me failed', getFriendlyApiErrorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])
  if (!isAdmin) return null
  return (
    <div className="mb-6 rounded-2xl border border-[#0C8B44]/25 bg-[#0C8B44]/08 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-[#E5E5E5]">Admin console</p>
        <p className="text-xs text-[#A0A0A0] mt-0.5">
          Approvals, deposits, users, and platform tools live in the dedicated admin area.
        </p>
      </div>
      <Link
        to="/admin"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0C8B44] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0a7a3a] transition-colors shrink-0"
      >
        <LayoutDashboard className="w-4 h-4" />
        Open admin dashboard
      </Link>
    </div>
  )
}
