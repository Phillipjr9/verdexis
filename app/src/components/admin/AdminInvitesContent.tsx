import React, { useState } from 'react'
import { Mail, Send, CheckCircle } from 'lucide-react'

export function AdminInvitesContent() {
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('500')

  return (
    <div className="space-y-6">
      {/* Send Invite Form */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <h3 className="text-xl font-semibold text-white mb-6">Send New Invite</h3>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investor@example.com"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Invite Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Custom Message (Optional)</label>
            <textarea
              placeholder="Add a personal message..."
              rows={4}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="flex gap-4">
            <button className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition">
              <Send size={18} />
              Send Invite
            </button>
            <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg font-semibold transition">
              Preview Email
            </button>
          </div>
        </div>
      </div>

      {/* Recent Invites */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <h3 className="text-xl font-semibold text-white mb-6">Recent Invites</h3>
        
        <div className="space-y-4">
          {[
            { email: 'john@example.com', amount: 1000, status: 'accepted', date: '2 days ago' },
            { email: 'jane@example.com', amount: 500, status: 'pending', date: '5 days ago' },
            { email: 'bob@example.com', amount: 2000, status: 'accepted', date: '1 week ago' },
          ].map((invite, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-4">
                <Mail className="text-gray-400" size={24} />
                <div>
                  <p className="text-white font-medium">{invite.email}</p>
                  <p className="text-sm text-gray-400">${invite.amount}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                  invite.status === 'accepted'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {invite.status === 'accepted' && <CheckCircle size={14} />}
                  {invite.status === 'accepted' ? 'Accepted' : 'Pending'}
                </span>
                <span className="text-sm text-gray-500">{invite.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
