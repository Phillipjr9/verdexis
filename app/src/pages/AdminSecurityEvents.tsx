import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import RequireAdmin from '../components/RequireAdmin'
import { adminApi } from '../lib/adminApi'
import { ArrowLeft, Shield, Activity } from 'lucide-react'

export default function AdminSecurityEvents() {
  return <RequireAdmin><AdminSecurityEventsInner /></RequireAdmin>
}

function AdminSecurityEventsInner() {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const result = await adminApi.get('/security/events')
        setEvents(result.events || [])
      } catch (error) {
        toast.error('Failed to load security events')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to admin
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-light text-[#E5E5E5] flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-[#0C8B44]" />Security Events
          </h1>
          <p className="text-sm text-[#737373]">Monitor security incidents, risk events, and audit activity in one place.</p>
        </div>

        <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-[#737373]">Loading security events...</div>
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
                    <tr key={event.id} className="border-b border-[#ffffff08] hover:bg-[#0a0e10]/30 transition-colors">
                      <td className="px-6 py-4 text-[#E5E5E5]">{event.eventType}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{event.userEmail || event.userId || 'System'}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{event.severity}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{event.resolved ? 'Yes' : 'No'}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
