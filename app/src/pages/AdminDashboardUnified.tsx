import React, { useState } from 'react'
import { Users, BarChart3, DollarSign, Settings, Shield, MessageSquare, UserPlus, Zap, Lock, Eye, FileText } from 'lucide-react'

// Import admin components
import { AdminDashboardContent } from '../components/admin/AdminDashboardContent'
import { AdminUsersContent } from '../components/admin/AdminUsersContent'
import { AdminFinancialContent } from '../components/admin/AdminFinancialContent'
import { AdminInvitesContent } from '../components/admin/AdminInvitesContent'
import { AdminSecurityContent } from '../components/admin/AdminSecurityContent'
import { AdminSettingsContent } from '../components/admin/AdminSettingsContent'

type AdminSection = 'dashboard' | 'users' | 'financial' | 'invites' | 'security' | 'settings'

interface NavItem {
  id: AdminSection
  label: string
  icon: React.ReactNode
  description: string
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={20} />, description: 'Overview & stats' },
  { id: 'users', label: 'Users', icon: <Users size={20} />, description: 'Manage users & KYC' },
  { id: 'financial', label: 'Financial', icon: <DollarSign size={20} />, description: 'Deposits, withdrawals, transfers' },
  { id: 'invites', label: 'Invites', icon: <UserPlus size={20} />, description: 'Send & manage invites' },
  { id: 'security', label: 'Security', icon: <Shield size={20} />, description: 'Audits & security events' },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, description: 'Admin settings' },
]

export function AdminDashboardUnified() {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const currentNav = navItems.find(n => n.id === activeSection)

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 transition-all duration-300 flex flex-col`}>
        {/* Logo Section */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
              <Lock size={16} className="text-white" />
            </div>
            {sidebarOpen && <span className="font-bold text-sm">Admin Panel</span>}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeSection === item.id
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'text-gray-300 hover:bg-slate-800/50 hover:text-white'
              }`}
              title={!sidebarOpen ? item.label : ''}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <div className="text-left">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.description}</div>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Collapse Button */}
        <div className="border-t border-slate-800 p-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <Eye size={16} />
            {sidebarOpen && 'Collapse'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{currentNav?.label}</h1>
              <p className="text-gray-400 mt-1">{currentNav?.description}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Admin Console</div>
              <div className="text-sm text-gray-400 mt-1">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {activeSection === 'dashboard' && <AdminDashboardContent />}
            {activeSection === 'users' && <AdminUsersContent />}
            {activeSection === 'financial' && <AdminFinancialContent />}
            {activeSection === 'invites' && <AdminInvitesContent />}
            {activeSection === 'security' && <AdminSecurityContent />}
            {activeSection === 'settings' && <AdminSettingsContent />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboardUnified
