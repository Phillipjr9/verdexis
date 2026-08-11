import { useEffect, useState } from 'react'
import DepositPending from './DepositPending'
import DepositResult from './DepositResult'
import WithdrawalPending from './WithdrawalPending'
import WithdrawalResult from './WithdrawalResult'
import type { DepositPayload, WithdrawalPayload } from '../lib/txNotifier'

type ModalRecord = {
  id: string
  type: 'deposit'
  payload?: DepositPayload | WithdrawalPayload
  status?: 'pending' | 'success' | 'failure'
  txHash?: string
  error?: string
}

export default function TxModalHost() {
  const [modals, setModals] = useState<Record<string, ModalRecord>>({})

  useEffect(() => {
    const onPending = (e: Event) => {
      // @ts-ignore
      const { id, payload } = e.detail
      setModals((s) => ({ ...s, [id]: { id, type: 'deposit', payload, status: 'pending' } }))
    }

    const onUpdate = (e: Event) => {
      // @ts-ignore
      const { id, status, txHash, error } = e.detail
      setModals((s) => ({ ...s, [id]: { ...(s[id] ?? { id, type: 'deposit' }), status: status === 'success' ? 'success' : 'failure', txHash, error } }))
    }

    const onResult = (e: Event) => {
      // @ts-ignore
      const { id, success, txHash, error } = e.detail
      setModals((s) => ({ ...s, [id]: { ...(s[id] ?? { id, type: 'deposit' }), status: success ? 'success' : 'failure', txHash, error } }))
    }

    const onWithdrawalPending = (e: Event) => {
      // @ts-ignore
      const { id, payload } = e.detail
      setModals((s) => ({ ...s, [id]: { id, type: 'deposit' as any, payload, status: 'pending' } }))
    }

    const onWithdrawalUpdate = (e: Event) => {
      // @ts-ignore
      const { id, status, txHash, error } = e.detail
      setModals((s) => ({ ...s, [id]: { ...(s[id] ?? { id, type: 'deposit' }), status: status === 'success' ? 'success' : 'failure', txHash, error } }))
    }

    const onWithdrawalResult = (e: Event) => {
      // @ts-ignore
      const { id, success, txHash, error } = e.detail
      setModals((s) => ({ ...s, [id]: { ...(s[id] ?? { id, type: 'deposit' }), status: success ? 'success' : 'failure', txHash, error } }))
    }

    window.addEventListener('tx:deposit:pending', onPending)
    window.addEventListener('tx:deposit:update', onUpdate)
    window.addEventListener('tx:deposit:result', onResult)
    window.addEventListener('tx:withdrawal:pending', onWithdrawalPending)
    window.addEventListener('tx:withdrawal:update', onWithdrawalUpdate)
    window.addEventListener('tx:withdrawal:result', onWithdrawalResult)

    return () => {
      window.removeEventListener('tx:deposit:pending', onPending)
      window.removeEventListener('tx:deposit:update', onUpdate)
      window.removeEventListener('tx:deposit:result', onResult)
    }
  }, [])

  const close = (id: string) => {
    setModals((s) => {
      const copy = { ...s }
      delete copy[id]
      return copy
    })
  }

  const viewOnExplorer = (tx: string) => {
    const url = `https://etherscan.io/tx/${tx}`
    window.open(url, '_blank')
  }

  return (
    <>
      {Object.values(modals).map((m) => {
        // basic type detection by id prefix
        if (m.id.startsWith('deposit-')) {
          if (m.status === 'pending') {
            return <DepositPending key={m.id} id={m.id} payload={m.payload as DepositPayload} onClose={close} />
          }
          return <DepositResult key={m.id} id={m.id} success={m.status === 'success'} txHash={m.txHash} error={m.error} onClose={close} onViewTx={viewOnExplorer} />
        }

        if (m.id.startsWith('withdrawal-')) {
          if (m.status === 'pending') {
            return <WithdrawalPending key={m.id} id={m.id} payload={m.payload as WithdrawalPayload} onClose={close} />
          }
          return <WithdrawalResult key={m.id} id={m.id} success={m.status === 'success'} txHash={m.txHash} error={m.error} onClose={close} onViewTx={viewOnExplorer} />
        }

        return null
      })}
    </>
  )
}
