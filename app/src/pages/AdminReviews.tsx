import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import AdminLayout from '../components/AdminLayout'
import { adminApi } from '../lib/adminApi'
import { CheckCircle2, XCircle, Hourglass, User, MessageSquare } from 'lucide-react'

type PendingReview = {
  id: string
  rating: number
  text: string
  authorName: string
  authorAvatar: string | null
  approved: boolean
  createdAt: string
  updatedAt: string
  user: { id: string; email: string; name: string }
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState<PendingReview[]>([])
  const [loading, setLoading] = useState(true)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  const loadReviews = async () => {
    setLoading(true)
    try {
      const result = await adminApi.listPendingReviews()
      setReviews(result.reviews)
    } catch (error) {
      toast.error((error as { error?: string }).error || 'Failed to load pending reviews')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviews()
  }, [])

  async function decide(id: string, approve: boolean) {
    setBusyIds((prev) => new Set(prev).add(id))
    try {
      if (approve) await (adminApi as any).approveReview?.(id)
      else await (adminApi as any).rejectReview?.(id)
      toast.success(approve ? 'Review approved' : 'Review rejected')
      loadReviews()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Action failed')
    } finally {
      setBusyIds((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    }
  }

  return (
    <AdminLayout title="Reviews" subtitle="Pending testimonial moderation">
      {loading ? (
        <p className="text-sm text-[#737373]">Loading…</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/50 p-8 text-center text-sm text-[#737373]">
          <Hourglass className="w-8 h-8 mx-auto mb-2 text-[#737373]" />
          No pending reviews.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-[#ffffff08] bg-[#0f1619]/50 p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#0C8B44]" />
                  <div>
                    <p className="text-sm text-[#E5E5E5]">{r.authorName || r.user.name}</p>
                    <p className="text-xs text-[#737373]">{r.user.email}</p>
                  </div>
                </div>
                <span className="text-xs text-[#FF9800]">{r.rating}/5</span>
              </div>
              <p className="text-sm text-[#A0A0A0] flex gap-2 mb-3">
                <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                {r.text}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyIds.has(r.id)}
                  onClick={() => decide(r.id, true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
                <button
                  type="button"
                  disabled={busyIds.has(r.id)}
                  onClick={() => decide(r.id, false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#f44336]/40 text-[#f44336] disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
