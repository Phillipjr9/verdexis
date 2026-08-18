import { useEffect, useState } from 'react'
import { api, getFriendlyApiErrorMessage } from '../../lib/api'
import { userFromMe } from '../../lib/authMe'
import { toast } from 'sonner'
import { AdminConsoleContent } from '../../pages/AdminDashboard'

export default function AdminConsoleEmbed() {
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    let cancelled = false
    api.me()
      .then((r) => {
        if (!cancelled) setIsAdmin(userFromMe(r)?.role === 'admin')
      })
      .catch((err: any) => {
        if (cancelled) return
        const friendly = getFriendlyApiErrorMessage(err)
        console.warn('AdminConsoleEmbed: api.me failed', err)
        if (!(err && typeof err.status === 'number' && err.status === 401)) {
          toast.error(friendly)
        }
      })
    return () => { cancelled = true }
  }, [])
  if (!isAdmin) return null
  return (
    <div className="mb-6 rounded-3xl border border-[#0C8B44]/20 bg-[#070C0E]/60 p-1">
      <div className="rounded-[22px] bg-[#070C0E]/80 px-4 py-6">
        <AdminConsoleContent />
      </div>
    </div>
  )
}
