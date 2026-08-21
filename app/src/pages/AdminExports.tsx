import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import AdminLayout from '../components/AdminLayout'
import { adminApi } from '../lib/adminApi'
import { FileText, Download } from 'lucide-react'

export default function AdminExports() {
  const [loading, setLoading] = useState(true)
  const [exportsData, setExportsData] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const result = await (adminApi as any).get?.('/transaction-export')
        setExportsData(result?.exports || [])
      } catch {
        toast.error('Failed to load export history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <AdminLayout title="Exports" subtitle="Data export tools">
      <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
        <div className="bg-[#0a0e10] border-b border-[#ffffff08] px-6 py-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0C8B44]" />
          <p className="text-sm font-medium text-[#E5E5E5]">Export history</p>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-[#737373]">Loading…</div>
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
                  <tr key={item.id} className="border-b border-[#ffffff08]">
                    <td className="px-6 py-4 text-[#E5E5E5]">{item.userEmail || item.userId}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">{item.kind || 'transaction'}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">{item.status}</td>
                    <td className="px-6 py-4 text-[#A0A0A0]">
                      {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <button type="button" className="inline-flex items-center gap-2 px-3 py-1 text-xs rounded-lg bg-[#0C8B44]/20 text-[#0C8B44]">
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
    </AdminLayout>
  )
}
