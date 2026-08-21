import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import AdminLayout from '../components/AdminLayout'
import { adminSecurityApi } from '../lib/adminSecurityApi'
import { Shield } from 'lucide-react'

export default function AdminSecurityEvents() {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const result = await adminSecurityApi.listEvents({ days: 30 })
        setEvents(result?.events || [])
      } catch {
        toast.error('Failed to load security events')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AdminLayout title="Security events" subtitle="Auth and risk signals">
      <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
        <div className="bg-[#0a0e10] border-b border-[#ffffff08] px-6 py-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#0C8B44]" />
          <p className="text-sm font-medium text-[#E5E5E5]">Security events</p>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-[#737373]">Loading…</div>
        ) : events.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-[#737373]">No security events available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0e10] border-b border-[#ffffff08]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Event</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">User</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Severity</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Resolved</th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Created</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-[#ffffff08]">
                    <td className="px-6 py-4 text-[#E5E5E5]">{event.type || event.name || '—'}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">{event.user?.email || event.userEmail || event.userId || '—'}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">{event.severity || '—'}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">{event.resolved ? 'Yes' : 'No'}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">
                      {event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
