import { useState, useEffect } from 'react'
import { Plus, Users, Trash2, Edit2, Check, X, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'

interface AdminInfo {
  id: string
  email: string
  name: string
}

interface ManagedUser {
  id: string
  email: string
  name: string
  suspended: boolean
  createdAt: string
  assignedAt: string
}

interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountHolder: string
  accountType: string
  country?: string
  verifiedAt?: string
  createdAt: string
}

interface WalletDetail {
  id: string
  walletAddress: string
  chainId?: string
  walletType: string
  label?: string
  notes?: string
  verifiedAt?: string
  createdAt: string
}

export function AdminHierarchyPanel() {
  const [admins, setAdmins] = useState<AdminInfo[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'sub-admins'>('overview')
  const [showCreateAdmin, setShowCreateAdmin] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminName, setNewAdminName] = useState('')

  useEffect(() => {
    loadHierarchy()
  }, [])

  async function loadHierarchy() {
    try {
      const response = await api.getAdminHierarchy()
      if (response.managedUsers) setUsers(response.managedUsers)
      if (response.subAdmins) setAdmins(response.subAdmins.map((sa) => sa.admin))
    } catch (err) {
      toast.error('Failed to load hierarchy')
    } finally {
      setLoading(false)
    }
  }

  async function createAdmin() {
    if (!newAdminEmail || !newAdminName) {
      toast.error('Enter email and name')
      return
    }

    try {
      const result = await api.createSubAdmin({
        email: newAdminEmail,
        name: newAdminName,
        canManageUsers: true,
      })
      toast.success(`Admin created. Temp password: ${result.admin.tempPassword}`)
      setNewAdminEmail('')
      setNewAdminName('')
      setShowCreateAdmin(false)
      await loadHierarchy()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#ffffff10]">
        {(['overview', 'users', 'sub-admins'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-[#0C8B44] text-[#0C8B44]'
                : 'border-transparent text-[#737373] hover:text-[#E5E5E5]'
            }`}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'users' && `Users (${users.length})`}
            {tab === 'sub-admins' && `Sub-Admins (${admins.length})`}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Managed Users</h3>
            <div className="text-3xl font-bold text-[#0C8B44]">{users.length}</div>
            <p className="text-xs text-[#737373] mt-2">Active users under management</p>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Sub-Admins</h3>
            <div className="text-3xl font-bold text-[#0C8B44]">{admins.length}</div>
            <p className="text-xs text-[#737373] mt-2">Admins you've created</p>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#E5E5E5]">Managed Users</h3>
            <button
              onClick={() => {}}
              className="px-3 py-1 rounded-lg bg-[#0C8B44] hover:bg-[#0a7035] text-white text-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>

          <div className="space-y-2">
            {users.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
        </div>
      )}

      {/* Sub-Admins Tab */}
      {activeTab === 'sub-admins' && (
        <div className="space-y-4">
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#E5E5E5]">Create Sub-Admin</h3>
              <button
                onClick={() => setShowCreateAdmin(!showCreateAdmin)}
                className="px-3 py-1 rounded-lg bg-[#0C8B44] hover:bg-[#0a7035] text-white text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create
              </button>
            </div>

            {showCreateAdmin && (
              <div className="space-y-3 p-4 rounded-lg bg-[#1a1a1a] border border-[#ffffff10]">
                <input
                  type="email"
                  placeholder="Admin email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0e10] border border-[#ffffff10] text-[#E5E5E5]"
                />
                <input
                  type="text"
                  placeholder="Admin name"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0e10] border border-[#ffffff10] text-[#E5E5E5]"
                />
                <button
                  onClick={createAdmin}
                  className="w-full px-3 py-2 rounded-lg bg-[#0C8B44] hover:bg-[#0a7035] text-white text-sm transition-colors"
                >
                  Create Admin
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {admins.map((admin) => (
              <div key={admin.id} className="glass-card p-4 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#E5E5E5]">{admin.name}</p>
                  <p className="text-xs text-[#737373]">{admin.email}</p>
                </div>
                <button
                  onClick={() => {}}
                  className="p-2 rounded-lg hover:bg-[#ffffff05] transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-[#737373]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UserCard({ user }: { user: ManagedUser }) {
  const [showDetails, setShowDetails] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [walletDetails, setWalletDetails] = useState<WalletDetail[]>([])
  const [loading, setLoading] = useState(false)

  async function loadUserDetails() {
    setLoading(true)
    try {
      const [bankResponse, walletResponse] = await Promise.all([
        api.getUserBankAccounts(user.id),
        api.getUserWalletDetails(user.id),
      ])
      setBankAccounts(bankResponse.accounts || [])
      setWalletDetails(walletResponse.details || [])
    } catch (err) {
      toast.error('Failed to load details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-[#ffffff10] rounded-xl overflow-hidden">
      <button
        onClick={() => {
          setShowDetails(!showDetails)
          if (!showDetails) loadUserDetails()
        }}
        className="w-full p-4 flex items-center justify-between hover:bg-[#ffffff02] transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <Users className="w-4 h-4 text-[#0C8B44]" />
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">{user.name}</p>
            <p className="text-xs text-[#737373]">{user.email}</p>
          </div>
        </div>
        <span className={`text-xs text-[#737373] transition-transform ${showDetails ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {showDetails && (
        <div className="border-t border-[#ffffff10] p-4 space-y-4 bg-[#0a0e10]/50">
          {/* Bank Accounts */}
          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-2">Bank Accounts ({bankAccounts.length})</h4>
            {bankAccounts.length === 0 ? (
              <p className="text-xs text-[#737373]">No bank accounts added</p>
            ) : (
              bankAccounts.map((account) => (
                <div key={account.id} className="text-xs text-[#737373] p-2 rounded bg-[#ffffff03]">
                  <p>{account.bankName} - {account.accountHolder}</p>
                  <p>****{account.accountNumber.slice(-4)}</p>
                </div>
              ))
            )}
            <button
              onClick={() => {}}
              className="mt-2 text-xs text-[#0C8B44] hover:text-[#0a7035]"
            >
              + Add Bank Account
            </button>
          </div>

          {/* Wallet Details */}
          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-2">Wallet Addresses ({walletDetails.length})</h4>
            {walletDetails.length === 0 ? (
              <p className="text-xs text-[#737373]">No wallets added</p>
            ) : (
              walletDetails.map((wallet) => (
                <div key={wallet.id} className="text-xs text-[#737373] p-2 rounded bg-[#ffffff03] flex items-center justify-between">
                  <div>
                    <p>{wallet.label || wallet.walletType}</p>
                    <p className="font-mono">{wallet.walletAddress.slice(0, 10)}…{wallet.walletAddress.slice(-4)}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(wallet.walletAddress)
                      toast.success('Address copied')
                    }}
                    className="p-1 hover:text-[#E5E5E5]"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
            <button
              onClick={() => {}}
              className="mt-2 text-xs text-[#0C8B44] hover:text-[#0a7035]"
            >
              + Add Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
