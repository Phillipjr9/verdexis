import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { api } from '../lib/api'
import { toast } from 'sonner'

interface Notification {
  id: string
  kind: string
  title: string
  body: string | null
  read: boolean
  createdAt: string
}

function NotificationsContent() {
  const [searchParams] = useSearchParams()
  const notificationId = searchParams.get('id')
  const [items, setItems] = useState<Notification[]>([])
  const [selected, setSelected] = useState<Notification | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadNotifications = async () => {
    setError(null)
    try {
      const result = await api.listNotifications()
      setItems(result.notifications)
    } catch (err) {
      setError((err as Error).message || 'Failed to load notifications')
    }
  }

  const loadNotification = async (id: string) => {
    try {
      const result = await api.getNotification(id)
      setSelected(result.notification)
    } catch (err) {
      setError((err as Error).message || 'Failed to load notification')
    }
  }

  useEffect(() => {
    void loadNotifications()
  }, [])

  useEffect(() => {
    if (notificationId) {
      void loadNotification(notificationId)
    } else {
      setSelected(null)
    }
  }, [notificationId])

  return (
    <div className="min-h-screen bg-[#070C0E] text-[#E5E5E5]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-3xl border border-[#ffffff10] bg-[#0f1619] p-4">
            <h1 className="text-xl font-semibold text-[#E5E5E5] mb-4">Notifications</h1>
            {loading ? (
              <div className="rounded-2xl border border-[#ffffff08] bg-[#070C0E]/70 p-6 text-center text-[#737373]">Loading…</div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-[#ffffff08] bg-[#070C0E]/70 p-6 text-center text-[#737373]">No notifications yet.</div>
            ) : (
              <div className="space-y-2">
                {items.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => {
                      setSelected(notification)
                      if (!notification.read) {
                        void api.markNotificationRead(notification.id)
                      }
                    }}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${notification.read ? 'border-[#ffffff10] bg-[#0f1619]' : 'border-[#0C8B44]/40 bg-[#0C8B44]/5 hover:bg-[#0C8B44]/10'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#E5E5E5] truncate">{notification.title}</p>
                        {notification.body && <p className="text-xs text-[#A0A0A0] line-clamp-2 mt-1">{notification.body}</p>}
                      </div>
                      {!notification.read && <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0C8B44]">New</span>}
                    </div>
                    <p className="text-[10px] text-[#555] mt-2">{new Date(notification.createdAt).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[#ffffff10] bg-[#0f1619] p-6 min-h-[320px]">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-[#E5E5E5]">Message details</h2>
                <p className="text-sm text-[#737373]">Select a notification to read the full message.</p>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
            ) : selected ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#737373]">{selected.kind}</p>
                  <h3 className="text-2xl font-semibold text-[#E5E5E5] mt-2">{selected.title}</h3>
                </div>
                {selected.body ? (
                  <p className="text-sm leading-7 text-[#d1d1d1] whitespace-pre-line">{selected.body}</p>
                ) : (
                  <p className="text-sm text-[#737373]">No additional details are available.</p>
                )}
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#555]">{new Date(selected.createdAt).toLocaleString()}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#ffffff08] bg-[#070C0E]/70 p-6 text-[#737373]">
                Select a notification from the list to view the full details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Notifications() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  )
}
