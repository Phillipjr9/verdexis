import React, { useState } from 'react'
import { DollarSign, Download, Filter, ArrowUp, ArrowDown } from 'lucide-react'

export function AdminFinancialContent() {
  const [filter, setFilter] = useState('all')

  const transactions = [
    { id: 1, type: 'deposit', user: 'john@example.com', amount: 5000, status: 'completed', date: '2024-09-30' },
    { id: 2, type: 'withdrawal', user: 'jane@example.com', amount: 2500, status: 'pending', date: '2024-09-30' },
    { id: 3, type: 'transfer', user: 'bob@example.com', amount: 1000, status: 'completed', date: '2024-09-29' },
  ]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Deposits</p>
              <p className="text-3xl font-bold mt-2">$125,430</p>
            </div>
            <ArrowUp size={32} className="opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Pending Withdrawals</p>
              <p className="text-3xl font-bold mt-2">$34,200</p>
            </div>
            <ArrowDown size={32} className="opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">24h Volume</p>
              <p className="text-3xl font-bold mt-2">$12,580</p>
            </div>
            <DollarSign size={32} className="opacity-50" />
          </div>
        </div>
      </div>

      {/* Filters & Export */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            <option value="all">All Transactions</option>
            <option value="deposits">Deposits Only</option>
            <option value="withdrawals">Withdrawals Only</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-gray-300 hover:text-white hover:bg-slate-800 transition">
          <Download size={18} />
          Export
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Type</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">User</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Amount</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                    tx.type === 'deposit' ? 'bg-green-500/20 text-green-400' :
                    tx.type === 'withdrawal' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {tx.type === 'deposit' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-white">{tx.user}</td>
                <td className="px-6 py-4 text-white font-semibold">${tx.amount.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                    tx.status === 'completed'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-400 text-sm">{tx.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminFinancialContent
