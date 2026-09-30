import React, { useState } from 'react'
import { Search, UserCheck, UserX, Edit, Eye, Trash2 } from 'lucide-react'

export function AdminUsersContent() {
  const [searchTerm, setSearchTerm] = useState('')

  const users = [
    { id: 1, email: 'john@example.com', name: 'John Doe', kyc: 'verified', status: 'active' },
    { id: 2, email: 'jane@example.com', name: 'Jane Smith', kyc: 'pending', status: 'active' },
    { id: 3, email: 'bob@example.com', name: 'Bob Wilson', kyc: 'verified', status: 'suspended' },
  ]

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition">
          Create User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">User</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">KYC Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Account Status</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-800/30 transition">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-white">{user.name}</p>
                    <p className="text-sm text-gray-400">{user.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                    user.kyc === 'verified' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {user.kyc === 'verified' ? <UserCheck size={14} /> : <UserX size={14} />}
                    {user.kyc === 'verified' ? 'Verified' : 'Pending'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                    user.status === 'active'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {user.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-2 hover:bg-slate-800 rounded-lg transition text-gray-400 hover:text-white">
                      <Eye size={18} />
                    </button>
                    <button className="p-2 hover:bg-slate-800 rounded-lg transition text-gray-400 hover:text-white">
                      <Edit size={18} />
                    </button>
                    <button className="p-2 hover:bg-red-900/30 rounded-lg transition text-gray-400 hover:text-red-400">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
