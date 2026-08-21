import { Link, useLocation } from 'react-router-dom'
import Navigation from './Navigation'
import {
  LayoutDashboard,
  Users,
  Inbox,
  Settings,
  BarChart3,
  ShieldCheck,
  Banknote,
  ArrowLeftRight,
  Activity,
  Megaphone,
  Gift,
  MapPin,
  FileCheck2,
  type LucideIcon,
} from 'lucide-react'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/queues', label: 'Queues', icon: Inbox },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/deposits', label: 'Deposits', icon: Banknote },
  { to: '/admin/transfer', label: 'Transfer', icon: ArrowLeftRight },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/audit', label: 'Audit', icon: Activity },
  { to: '/admin/security-events', label: 'Security', icon: ShieldCheck },
  { to: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
  { to: '/admin/deposit-addresses', label: 'Addresses', icon: MapPin },
  { to: '/admin/referrals', label: 'Referrals', icon: Gift },
  { to: '/admin/signup-bonus', label: 'Bonus', icon: Gift },
  { to: '/admin/reviews', label: 'Reviews', icon: FileCheck2 },
]

function isActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to || pathname === `${to}/`
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function AdminLayout({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] p-3">
            <p className="px-2 mb-2 text-[10px] uppercase tracking-[0.2em] text-[#737373]">Admin</p>
            <nav className="space-y-0.5">
              {NAV.map(({ to, label, icon: Icon, end }) => {
                const active = isActive(pathname, to, end)
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-[#0C8B44]/15 text-[#0C8B44] border border-[#0C8B44]/25'
                        : 'text-[#A0A0A0] hover:text-[#E5E5E5] hover:bg-[#ffffff06] border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile / tablet chips */}
        <div className="lg:hidden -mx-1 overflow-x-auto pb-1">
          <div className="flex gap-2 px-1 min-w-max">
            {NAV.slice(0, 8).map(({ to, label, icon: Icon, end }) => {
              const active = isActive(pathname, to, end)
              return (
                <Link
                  key={to}
                  to={to}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${
                    active
                      ? 'bg-[#0C8B44]/15 text-[#0C8B44] border-[#0C8B44]/30'
                      : 'bg-[#0f1619]/50 text-[#A0A0A0] border-[#ffffff08]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>

        <main className="flex-1 min-w-0">
          {(title || actions) && (
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
              <div>
                {title && <h1 className="text-2xl sm:text-3xl font-light text-[#E5E5E5]">{title}</h1>}
                {subtitle && <p className="text-sm text-[#737373] mt-1">{subtitle}</p>}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
