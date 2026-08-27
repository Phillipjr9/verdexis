import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi, type AdminUserSummary } from '../lib/adminApi'
import { Search, Users, Shield, Ban, CheckCircle2, Pause, Trash2, RefreshCw, UserPlus, Lock } from 'lucide-react'

const PAGE_SIZE = 25

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [role, setRole] = useState<'all' | 'user' | 'admin'>((searchParams.get('role') as 'all' | 'user' | 'admin') || 'all')
  const [suspended, setSuspended] = useState<'all' | 'true' | 'false'>((searchParams.get('suspended') as 'all' | 'true' | 'false') || 'all')
  const [kycStatus, setKycStatus] = useState<string>(searchParams.get('kycStatus') || 'all')
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [bulkReason, setBulkReason] = useState('')
  const [bulkHoldType, setBulkHoldType] = useState<'all' | 'withdraw' | 'transfer'>('all')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set())
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set())

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const allChecked = useMemo(() => users.length > 0 && users.every((u) => selected.has(u.id)), [users, selected])

  function load() {
    setLoading(true)
    adminApi.listUsers({ q, page, limit: PAGE_SIZE, role, suspended, kycStatus: kycStatus !== 'all' ? kycStatus as 'none' | 'pending' | 'approved' | 'rejected' : undefined })
      .then((r) => {
        const list = (r.users || []).map((u) => ({
          ...u,
          _count: {
            holdings: u._count?.holdings ?? 0,
            trades: u._count?.trades ?? 0,
            transactions: u._count?.transactions ?? 0,
            alerts: u._count?.alerts ?? 0,
          },
        }))
        setUsers(list)
        setTotal(r.total ?? list.length)
      })
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, role, suspended, kycStatus])
  useEffect(() => {
    const sp = new URLSearchParams(searchParams)
    if (role !== 'all') sp.set('role', role); else sp.delete('role')
    if (suspended !== 'all') sp.set('suspended', suspended); else sp.delete('suspended')
    if (kycStatus !== 'all') sp.set('kycStatus', kycStatus); else sp.delete('kycStatus')
    setSearchParams(sp, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, suspended, kycStatus])

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function toggleAll() {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(users.map((u) => u.id)))
  }
  async function runBulk() {
    if (!bulkAction || !selected.size) return
    if (bulkAction === 'delete' && !window.confirm(`Permanently delete ${selected.size} user(s)? This cannot be undone.`)) return
    setBulkBusy(true)
    try {
      const r = await adminApi.bulkUsers({
        ids: Array.from(selected),
        action: bulkAction as 'suspend' | 'unsuspend' | 'hold' | 'unhold' | 'delete',
        reason: bulkReason || undefined,
        holdType: bulkAction === 'hold' ? bulkHoldType : undefined,
      })
      toast.success(`${r.count} user(s) updated`)
      setSelected(new Set()); setBulkAction(''); setBulkReason('')
      load()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Bulk action failed')
    } finally { setBulkBusy(false) }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    load()
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-light text-[#E5E5E5] flex items-center gap-3">
              <Users className="w-6 h-6 text-[#0C8B44]" />Users
            </h1>
            <p className="text-xs text-[#737373] mt-1">{total} accounts</p>
          </div>
          <Link to="/admin/users/new" className="inline-flex items-center gap-2 rounded-xl bg-[#0C8B44] px-4 py-2 text-sm text-white hover:bg-[#0a7539]">
            <UserPlus className="w-4 h-4" />Create user
          </Link>
        </div>

        <form onSubmit={onSearch} className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, name, id…"
              className="w-full pl-10 pr-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
          </div>
          <select value={role} onChange={(e) => { setRole(e.target.value as typeof role); setPage(1) }}
            className="px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5]">
            <option value="all">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
          <select value={suspended} onChange={(e) => { setSuspended(e.target.value as typeof suspended); setPage(1) }}
            className="px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5]">
            <option value="all">Any status</option>
            <option value="false">Active</option>
            <option value="true">Suspended</option>
          </select>
          <select value={kycStatus} onChange={(e) => { setKycStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5]">
            <option value="all">Any KYC</option>
            <option value="none">None</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button type="submit" className="px-4 py-2 rounded-lg bg-[#0C8B44] text-sm text-white">Search</button>
          <button type="button" onClick={() => load()} className="px-3 py-2 rounded-lg border border-[#ffffff15] text-sm text-[#A0A0A0] hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </form>

        {selected.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#ffffff10] bg-[#0a0f11] p-3">
            <span className="text-xs text-[#A0A0A0]">{selected.size} selected</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className="px-2 py-1.5 bg-[#070C0E] border border-[#ffffff10] rounded text-xs text-[#E5E5E5]">
              <option value="">Bulk action…</option>
              <option value="suspend">Suspend</option>
              <option value="unsuspend">Unsuspend</option>
              <option value="hold">Place hold</option>
              <option value="unhold">Clear hold</option>
              <option value="delete">Delete</option>
            </select>
            {bulkAction === 'hold' && (
              <select value={bulkHoldType} onChange={(e) => setBulkHoldType(e.target.value as typeof bulkHoldType)} className="px-2 py-1.5 bg-[#070C0E] border border-[#ffffff10] rounded text-xs text-[#E5E5E5]">
                <option value="all">All</option>
                <option value="withdraw">Withdraw</option>
                <option value="transfer">Transfer</option>
              </select>
            )}
            <input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder="Reason" className="px-2 py-1.5 bg-[#070C0E] border border-[#ffffff10] rounded text-xs text-[#E5E5E5] min-w-[140px]" />
            <button type="button" disabled={bulkBusy || !bulkAction} onClick={runBulk} className="px-3 py-1.5 rounded bg-[#0C8B44] text-xs text-white disabled:opacity-50">Apply</button>
          </div>
        )}

        <div className="rounded-2xl border border-[#ffffff08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0f11] text-[#737373] text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-[#0C8B44]" /></th>
                  <th className="text-left px-4 py-3 font-normal">User</th>
                  <th className="text-left px-4 py-3 font-normal">Role</th>
                  <th className="text-left px-4 py-3 font-normal">KYC</th>
                  <th className="text-left px-4 py-3 font-normal">Status</th>
                  <th className="text-right px-4 py-3 font-normal">Holdings</th>
                  <th className="text-right px-4 py-3 font-normal">Trades</th>
                  <th className="text-right px-4 py-3 font-normal">Txns</th>
                  <th className="text-left px-4 py-3 font-normal">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ffffff08]">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-[#737373]">Loading…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-[#737373]">No users found</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#0a0f11]/80">
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} className="accent-[#0C8B44]" /></td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${u.id}`} className="text-[#E5E5E5] hover:text-[#0C8B44]">
                        <div className="font-medium">{u.name || '—'}</div>
                        <div className="text-xs text-[#737373]">{u.email}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-[#0C8B44]/20 text-[#0C8B44]' : 'bg-[#ffffff10] text-[#A0A0A0]'}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-[#A0A0A0]">{u.kycStatus}</td>
                    <td className="px-4 py-3">
                      {u.suspended ? <span className="text-[#f44336] text-xs">Suspended</span> : u.holdActive ? <span className="text-[#f59e0b] text-xs">Hold</span> : <span className="text-[#0C8B44] text-xs">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-[#A0A0A0]">{u._count?.holdings ?? 0}</td>
                    <td className="px-4 py-3 text-right text-[#A0A0A0]">{u._count?.trades ?? 0}</td>
                    <td className="px-4 py-3 text-right text-[#A0A0A0]">{u._count?.transactions ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-[#737373]">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 text-sm text-[#737373]">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded border border-[#ffffff15] disabled:opacity-40">Prev</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded border border-[#ffffff15] disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
