import { Link, useParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import WithdrawalOverridePanel from '../components/admin/WithdrawalOverridePanel'

export default function AdminUserOverrides() {
  const { id = '' } = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6 max-w-3xl mx-auto">
        <Link to={`/admin/users/${id}`} className="text-xs text-[#737373] hover:text-[#E5E5E5]">← Back to user</Link>
        <h1 className="mt-4 text-2xl font-light text-[#E5E5E5]">Admin override</h1>
        <p className="text-xs text-[#737373] mt-1 mb-6">Per-user processing fee and withdrawal release rules.</p>
        {id ? <WithdrawalOverridePanel userId={id} /> : null}
      </div>
    </div>
  )
}
