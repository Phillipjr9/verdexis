import RedirectAdminFromDashboard from '../components/RedirectAdminFromDashboard'
import Dashboard from './Dashboard'

/** /dashboard entry: admins go to /admin, users see the normal dashboard. */
export default function DashboardEntry() {
  return (
    <RedirectAdminFromDashboard>
      <Dashboard />
    </RedirectAdminFromDashboard>
  )
}
