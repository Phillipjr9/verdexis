import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import RequireAdmin from '../components/RequireAdmin'
import { adminApi } from '../lib/adminApi'
import { ArrowLeft, FileText, Download } from 'lucide-react'

export default function AdminExports() {
  return <RequireAdmin><AdminExportsInner /></RequireAdmin>
}

function AdminExportsInner() {
  const [loading, setLoading] = useState(true)
  const [exportsData, setExportsData] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const result = await adminApi.get('/transaction-export')
        setExportsData(result.exports || [])
      } catch (error) {
        toast.error('Failed to load export history')
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
            <FileText className="w-8 h-8 text-[#0C8B44]" />Export History
          </h1>
          <p className="text-sm text-[#737373]">Review generated transaction exports and download audit reports.</p>
        </div>

        <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-[#737373]">Loading export history...</div>
          ) : exportsData.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-[#737373]">No export records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0e10] border-b border-[#ffffff08]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">User</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Type</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Status</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Expires</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {exportsData.map((item) => (
                    <tr key={item.id} className="border-b border-[#ffffff08] hover:bg-[#0a0e10]/30 transition-colors">
                      <td className="px-6 py-4 text-[#E5E5E5]">{item.userEmail || item.userId}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{item.kind || 'transaction'}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{item.status}</td>
                      <td className="px-6 py-4 text-[#A0A0A0]">{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : '—'}</td>
                      <td className="px-6 py-4">
                        <button className="inline-flex items-center gap-2 px-3 py-1 text-xs rounded-lg bg-[#0C8B44]/20 text-[#0C8B44] hover:bg-[#0C8B44]/30 transition-colors">
                          <Download className="w-3 h-3" />Download
                        </button>
                      </td>
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
