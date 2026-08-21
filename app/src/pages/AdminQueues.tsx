import AdminLayout from '../components/AdminLayout'
import { AdminApprovalQueues } from '../components/admin/AdminApprovalQueues'

export default function AdminQueues() {
  return (
    <AdminLayout
      title="Approval queues"
      subtitle="Fiat deposits, on-chain deposits, and withdrawal payouts — refresh every 30s"
    >
      <AdminApprovalQueues />
    </AdminLayout>
  )
}
