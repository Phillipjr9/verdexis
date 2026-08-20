import { useParams, Link } from 'react-router-dom'

/**
 * Temporary stub after PLACEHOLDER overwrite.
 * Full AdminUserDetail.tsx must be restored from local artifact AdminUserDetail_to_push.tsx
 * (includes FeeProofsPanel wired to server feeProofs.verify/reject, bonus unlock, wallet admin edit, etc.)
 */
export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>()
  return (
    <div className="min-h-screen bg-[#0a0f11] text-[#E5E5E5] p-8">
      <h1 className="text-xl font-semibold mb-4">Admin User Detail</h1>
      <p className="text-sm text-[#A0A0A0] mb-2">User ID: {userId ?? '—'}</p>
      <p className="text-amber-400 text-sm mb-4">
        Full page temporarily stubbed after accidental PLACEHOLDER overwrite. Restore from artifact.
      </p>
      <Link to="/admin/users" className="text-[#0C8B44] underline text-sm">
        ← Back to users
      </Link>
    </div>
  )
}
