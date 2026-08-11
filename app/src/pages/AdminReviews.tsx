import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
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
    void loadReviews()
  }, [])

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const approve = async (id: string) => {
    setBusy(id, true)
    try {
      await adminApi.approveReview(id)
      toast.success('Review approved')
      await loadReviews()
    } catch (error) {
      toast.error((error as { error?: string }).error || 'Failed to approve review')
    } finally {
      setBusy(id, false)
    }
  }

  const reject = async (id: string) => {
    if (!window.confirm('Reject this review? It will remain hidden from the homepage.')) return
    setBusy(id, true)
    try {
      await adminApi.rejectReview(id)
      toast.success('Review rejected')
      await loadReviews()
    } catch (error) {
      toast.error((error as { error?: string }).error || 'Failed to reject review')
    } finally {
      setBusy(id, false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-light text-[#E5E5E5] mb-2">Admin Reviews</h1>
            <p className="text-sm text-[#737373] max-w-2xl">Approve or reject user-submitted homepage testimonials before they appear publicly.</p>
          </div>
          <button
            type="button"
            onClick={loadReviews}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ffffff10] bg-[#0C8B44]/10 px-4 py-2 text-sm text-[#E5E5E5] hover:border-[#0C8B44]/40 hover:bg-[#0C8B44]/15 transition-colors"
          >
            <Hourglass className="w-4 h-4" /> Refresh pending reviews
          </button>
        </div>

        <div className="rounded-3xl border border-[#ffffff08] bg-[#0f1619]/70 p-6">
          {loading ? (
            <div className="text-sm text-[#A0A0A0]">Loading pending reviews…</div>
          ) : reviews.length === 0 ? (
            <div className="text-sm text-[#A0A0A0]">No reviews are pending approval.</div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-3xl border border-[#ffffff10] bg-[#131a1f] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      {review.authorAvatar ? (
                        <img src={review.authorAvatar} alt="Author avatar" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0C8B44]/20 text-sm font-semibold text-[#E5E5E5]">
                          {review.authorName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-[#E5E5E5]">{review.authorName}</p>
                        <p className="text-xs text-[#737373]">{review.user.email} · {new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#ffffff05] px-3 py-2 text-xs uppercase tracking-[0.15em] text-[#A0E6FF]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pending approval
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center gap-1 text-sm text-[#F57C00] mb-2">
                      {Array.from({ length: 5 }, (_, idx) => (
                        <span key={idx}>{idx < review.rating ? '★' : '☆'}</span>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-[#D4D4D4] whitespace-pre-wrap">{review.text}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-3 border-t border-[#ffffff08]">
                    <button
                      type="button"
                      onClick={() => approve(review.id)}
                      disabled={busyIds.has(review.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0C8B44] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a7539] disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(review.id)}
                      disabled={busyIds.has(review.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#f44336]/30 bg-[#f44336]/10 px-4 py-2 text-sm font-medium text-[#f44336] hover:bg-[#f44336]/15 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
