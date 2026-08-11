export type DepositPayload = {
  amount: string
  address: string
  network?: string
  memo?: string
}

export function showDepositPending(payload: DepositPayload) {
  const id = `deposit-${Date.now()}`
  window.dispatchEvent(new CustomEvent('tx:deposit:pending', { detail: { id, payload } }))
  return id
}

export function updateDepositStatus(id: string, status: 'success' | 'failure', txHash?: string, error?: string) {
  window.dispatchEvent(new CustomEvent('tx:deposit:update', { detail: { id, status, txHash, error } }))
}

export function showDepositResult(id: string, success: boolean, txHash?: string, error?: string) {
  window.dispatchEvent(new CustomEvent('tx:deposit:result', { detail: { id, success, txHash, error } }))
}

export type WithdrawalPayload = {
  amount: string
  address: string
  network?: string
  note?: string
}

export function showWithdrawalPending(payload: WithdrawalPayload) {
  const id = `withdrawal-${Date.now()}`
  window.dispatchEvent(new CustomEvent('tx:withdrawal:pending', { detail: { id, payload } }))
  return id
}

export function updateWithdrawalStatus(id: string, status: 'success' | 'failure', txHash?: string, error?: string) {
  window.dispatchEvent(new CustomEvent('tx:withdrawal:update', { detail: { id, status, txHash, error } }))
}

export function showWithdrawalResult(id: string, success: boolean, txHash?: string, error?: string) {
  window.dispatchEvent(new CustomEvent('tx:withdrawal:result', { detail: { id, success, txHash, error } }))
}
