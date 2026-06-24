// Add these methods to app/src/lib/api.ts

// Multi-Admin Hierarchy API Methods

export const adminHierarchy = {
  // Create sub-admin
  createSubAdmin: (payload: {
    email: string
    name: string
    canCreateAdmins?: boolean
    canManageUsers?: boolean
    canManageDeposits?: boolean
    canManageTransactions?: boolean
  }) =>
    request<{ admin: { id: string; email: string; name: string; tempPassword: string } }>(
      '/api/admin/admins/create',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  // Get admin hierarchy
  getHierarchy: () =>
    request<{
      adminInfo: any
      subAdmins: Array<{ admin: { id: string; email: string; name: string } }>
      managedUsers: Array<{
        id: string
        email: string
        name: string
        suspended: boolean
        createdAt: string
        assignedAt: string
      }>
    }>('/api/admin/admins/hierarchy'),

  // Assign user to admin
  assignUserToAdmin: (userId: string, adminId: string) =>
    request('/api/admin/users/' + encodeURIComponent(userId) + '/assign-admin', {
      method: 'POST',
      body: JSON.stringify({ adminId }),
    }),

  // Get users for admin
  getUsersForAdmin: (adminId: string) =>
    request<{
      users: Array<{
        id: string
        email: string
        name: string
        kycStatus: string
        suspended: boolean
        createdAt: string
        assignedAt: string
      }>
    }>('/api/admin/admins/' + encodeURIComponent(adminId) + '/users'),

  // Bank Accounts
  addBankAccount: (userId: string, account: {
    bankName: string
    accountNumber: string
    routingNumber?: string
    accountHolder: string
    accountType?: 'checking' | 'savings'
    country?: string
  }) =>
    request('/api/admin/users/' + encodeURIComponent(userId) + '/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    }),

  getUserBankAccounts: (userId: string) =>
    request<{
      accounts: Array<{
        id: string
        bankName: string
        accountNumber: string
        accountHolder: string
        accountType: string
        country?: string
        verifiedAt?: string
        createdAt: string
      }>
    }>('/api/admin/users/' + encodeURIComponent(userId) + '/bank-accounts'),

  updateBankAccount: (accountId: string, update: {
    bankName?: string
    accountHolder?: string
    country?: string
  }) =>
    request('/api/admin/bank-accounts/' + encodeURIComponent(accountId), {
      method: 'PATCH',
      body: JSON.stringify(update),
    }),

  deleteBankAccount: (accountId: string) =>
    request('/api/admin/bank-accounts/' + encodeURIComponent(accountId), { method: 'DELETE' }),

  // Wallet Details
  addWalletDetail: (userId: string, wallet: {
    walletAddress: string
    chainId?: string
    walletType?: string
    label?: string
    notes?: string
  }) =>
    request('/api/admin/users/' + encodeURIComponent(userId) + '/wallet-details', {
      method: 'POST',
      body: JSON.stringify(wallet),
    }),

  getUserWalletDetails: (userId: string) =>
    request<{
      details: Array<{
        id: string
        walletAddress: string
        chainId?: string
        walletType: string
        label?: string
        notes?: string
        verifiedAt?: string
        createdAt: string
      }>
    }>('/api/admin/users/' + encodeURIComponent(userId) + '/wallet-details'),

  updateWalletDetail: (detailId: string, update: {
    label?: string
    notes?: string
  }) =>
    request('/api/admin/wallet-details/' + encodeURIComponent(detailId), {
      method: 'PATCH',
      body: JSON.stringify(update),
    }),

  deleteWalletDetail: (detailId: string) =>
    request('/api/admin/wallet-details/' + encodeURIComponent(detailId), { method: 'DELETE' }),
}

// Update the main api export to include these
// api.adminHierarchy = adminHierarchy
