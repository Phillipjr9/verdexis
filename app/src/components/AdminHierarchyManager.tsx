import { useState, useEffect } from 'react'
import { Plus, Trash2, Users, Settings } from 'lucide-react'
import { api } from '../lib/api'

interface Admin {
  id: string
  email: string
  name: string
  canCreateAdmins: boolean
  canManageUsers: boolean
  canManageDeposits: boolean
  canManageTransactions: boolean
  createdAt: string
}

interface AssignedUser {
  id: string
  email: string
  name: string
  createdAt: string
  assignedAt?: string
}

export default function AdminHierarchyManager() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null)
  const [adminUsers, setAdminUsers] = useState<AssignedUser[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({ email: '', name: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadAdmins()
  }, [])

  useEffect(() => {
    if (selectedAdmin) {
      loadAdminUsers(selectedAdmin)
    } else {
      setAdminUsers([])
    }
  }, [selectedAdmin])

  async function loadAdmins() {
    try {
      setLoading(true)
      const response = await api.get('/admin/hierarchy/admins')
      setAdmins(response.admins || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admins')
    } finally {
      setLoading(false)
    }
  }

  async function loadAdminUsers(adminId: string) {
    try {
      const response = await api.get(`/admin/hierarchy/admins/${adminId}/users`)
      setAdminUsers(response.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.email || !formData.name || !formData.password) {
      setError('All fields required')
      return
    }

    try {
      setLoading(true)
      await api.post('/admin/hierarchy/admins', {
        email: formData.email,
        name: formData.name,
        password: formData.password,
      })
      setSuccess(`Admin ${formData.email} created`)
      setFormData({ email: '', name: '', password: '' })
      setShowCreateForm(false)
      await loadAdmins()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create admin')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveUser(userId: string) {
    if (!selectedAdmin) return
    if (!window.confirm('Remove this user assignment?')) return

    try {
      await api.post('/admin/hierarchy/remove-assignment', {
        userId,
        adminId: selectedAdmin,
      })
      setSuccess('User assignment removed')
      await loadAdminUsers(selectedAdmin)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user')
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Admin Hierarchy</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0C8B44] text-white rounded-lg hover:bg-[#0a7539] transition"
        >
          <Plus className="w-4 h-4" />
          Create Admin
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg text-green-400">
          {success}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateAdmin} className="p-6 bg-[#1a1a1a] rounded-lg border border-[#ffffff10] space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#0C8B44]"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#0C8B44]"
              placeholder="Admin Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded text-white placeholder-gray-500 focus:outline-none focus:border-[#0C8B44]"
              placeholder="Min 8 characters"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#0C8B44] text-white rounded hover:bg-[#0a7539] disabled:opacity-50 transition"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Sub-Admins ({admins.length})
          </h2>

          {loading && admins.length === 0 ? (
            <div className="p-4 text-center text-gray-400">Loading...</div>
          ) : admins.length === 0 ? (
            <div className="p-4 text-center text-gray-400">No sub-admins created yet</div>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  onClick={() => setSelectedAdmin(admin.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition ${
                    selectedAdmin === admin.id
                      ? 'bg-[#0C8B44]/10 border-[#0C8B44]'
                      : 'bg-[#1a1a1a] border-[#ffffff10] hover:border-[#0C8B44]/50'
                  }`}
                >
                  <p className="font-semibold text-white">{admin.name}</p>
                  <p className="text-sm text-gray-400">{admin.email}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    <p>Can manage users: {admin.canManageUsers ? '✓' : '✗'}</p>
                    <p>Can manage deposits: {admin.canManageDeposits ? '✓' : '✗'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Assigned Users {selectedAdmin && `(${adminUsers.length})`}
          </h2>

          {!selectedAdmin ? (
            <div className="p-4 text-center text-gray-400">Select an admin to view assigned users</div>
          ) : adminUsers.length === 0 ? (
            <div className="p-4 text-center text-gray-400">No users assigned</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {adminUsers.map((user) => (
                <div key={user.id} className="p-4 bg-[#1a1a1a] rounded-lg border border-[#ffffff10] flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{user.name}</p>
                    <p className="text-sm text-gray-400 truncate">{user.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Assigned: {new Date(user.assignedAt || user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    className="ml-2 p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
