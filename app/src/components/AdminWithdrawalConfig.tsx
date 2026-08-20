/**
 * Admin: Configure withdrawal methods for a user.
 * ACH, Wire, Cashier's check, Wire check.
 */
import { useState, FormEvent } from 'react'
import { Save, Building2, Banknote, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '../lib/adminApi'

interface AdminWithdrawalConfigProps {
  userId: string
  userEmail: string
  onChange: () => void
}

export function AdminWithdrawalConfig({ userId, userEmail, onChange }: AdminWithdrawalConfigProps) {
  const [achBankName, setAchBankName] = useState('')
  const [achInstitution, setAchInstitution] = useState('')
  const [achAccountNumber, setAchAccountNumber] = useState('')
  const [achRoutingNumber, setAchRoutingNumber] = useState('')
  const [achVerified, setAchVerified] = useState(false)

  const [wireBeneficiary, setWireBeneficiary] = useState('')
  const [wireBankName, setWireBankName] = useState('')
  const [wireAccountNumber, setWireAccountNumber] = useState('')
  const [wireRoutingNumber, setWireRoutingNumber] = useState('')
  const [wireSwiftCode, setWireSwiftCode] = useState('')
  const [wireIban, setWireIban] = useState('')
  const [wireReference, setWireReference] = useState('')

  const [checkPayee, setCheckPayee] = useState('')
  const [checkLine1, setCheckLine1] = useState('')
  const [checkLine2, setCheckLine2] = useState('')
  const [checkCity, setCheckCity] = useState('')
  const [checkState, setCheckState] = useState('')
  const [checkPostal, setCheckPostal] = useState('')
  const [checkCountry, setCheckCountry] = useState('US')
  const [checkNotes, setCheckNotes] = useState('')
  const [enableCashier, setEnableCashier] = useState(true)
  const [enableWireCheck, setEnableWireCheck] = useState(false)

  const [busy, setBusy] = useState(false)

  function isValidRoutingNumber(rn: string): boolean {
    if (!/^\d{9}$/.test(rn)) return false
    const d = rn.split('').map(Number)
    const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + 1 * (d[2] + d[5] + d[8])
    return sum % 10 === 0
  }

  async function saveAch(e: FormEvent) {
    e.preventDefault()
    if (!achBankName.trim() || !achInstitution.trim()) {
      toast.error('Bank name and institution are required')
      return
    }
    if (!achAccountNumber.trim() || achAccountNumber.length < 4) {
      toast.error('Valid account number required (min 4 digits)')
      return
    }
    if (!isValidRoutingNumber(achRoutingNumber)) {
      toast.error('Invalid routing number (ABA checksum failed)')
      return
    }
    setBusy(true)
    try {
      await adminApi.setUserWithdrawalAch(userId, {
        bankName: achBankName.trim(),
        institution: achInstitution.trim(),
        accountNumber: achAccountNumber.trim(),
        routingNumber: achRoutingNumber.trim(),
        accountMask: achAccountNumber.slice(-4),
        verified: achVerified,
      })
      toast.success(`ACH configured for ${userEmail}`)
      setAchBankName('')
      setAchInstitution('')
      setAchAccountNumber('')
      setAchRoutingNumber('')
      setAchVerified(false)
      onChange()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to save ACH config')
    } finally {
      setBusy(false)
    }
  }

  async function saveWire(e: FormEvent) {
    e.preventDefault()
    if (!wireBeneficiary.trim() || !wireBankName.trim()) {
      toast.error('Beneficiary name and bank name are required')
      return
    }
    if (!wireAccountNumber.trim() || wireAccountNumber.length < 4) {
      toast.error('Valid account number required')
      return
    }
    if (!isValidRoutingNumber(wireRoutingNumber)) {
      toast.error('Invalid routing number (ABA checksum failed)')
      return
    }
    setBusy(true)
    try {
      await adminApi.setUserWithdrawalWire(userId, {
        beneficiaryName: wireBeneficiary.trim(),
        bankName: wireBankName.trim(),
        accountNumber: wireAccountNumber.trim(),
        routingNumber: wireRoutingNumber.trim(),
        swiftCode: wireSwiftCode.trim() || undefined,
        iban: wireIban.trim() || undefined,
        reference: wireReference.trim() || undefined,
      })
      toast.success(`Wire configured for ${userEmail}`)
      onChange()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to save wire config')
    } finally {
      setBusy(false)
    }
  }

  async function saveCheck(e: FormEvent) {
    e.preventDefault()
    const types: Array<'cashier_check' | 'wire_check'> = []
    if (enableCashier) types.push('cashier_check')
    if (enableWireCheck) types.push('wire_check')
    if (types.length === 0) {
      toast.error('Select at least one check type')
      return
    }
    if (!checkPayee.trim()) {
      toast.error('Payee name is required')
      return
    }
    if (!checkLine1.trim() || !checkCity.trim() || !checkState.trim() || !checkPostal.trim()) {
      toast.error('Mailing address (line1, city, state, postal code) is required')
      return
    }
    setBusy(true)
    try {
      await adminApi.setUserWithdrawalCheck(userId, {
        types,
        payeeName: checkPayee.trim(),
        mailingAddress: {
          line1: checkLine1.trim(),
          line2: checkLine2.trim() || undefined,
          city: checkCity.trim(),
          state: checkState.trim(),
          postalCode: checkPostal.trim(),
          country: checkCountry.trim() || 'US',
        },
        notes: checkNotes.trim() || undefined,
      })
      toast.success(`Check withdrawal configured for ${userEmail}`)
      onChange()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to save check config')
    } finally {
      setBusy(false)
    }
  }

  async function removeAch() {
    if (!confirm(`Remove ACH withdrawal for ${userEmail}?`)) return
    setBusy(true)
    try {
      await adminApi.removeUserWithdrawalAch(userId)
      toast.success('ACH withdrawal removed')
      onChange()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to remove ACH')
    } finally {
      setBusy(false)
    }
  }

  async function removeWire() {
    if (!confirm(`Remove wire transfer for ${userEmail}?`)) return
    setBusy(true)
    try {
      await adminApi.removeUserWithdrawalWire(userId)
      toast.success('Wire transfer removed')
      onChange()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to remove wire')
    } finally {
      setBusy(false)
    }
  }

  async function removeCheck() {
    if (!confirm(`Remove check withdrawal for ${userEmail}?`)) return
    setBusy(true)
    try {
      await adminApi.removeUserWithdrawalCheck(userId)
      toast.success('Check withdrawal removed')
      onChange()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to remove check')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]'
  const btnPrimary =
    'inline-flex items-center gap-2 px-4 py-2 bg-[#0C8B44] hover:bg-[#0a7a3a] text-white text-sm rounded-lg disabled:opacity-50'
  const btnGhost =
    'px-3 py-1.5 text-xs text-[#A0A0A0] hover:text-[#E5E5E5] border border-[#ffffff12] rounded-lg'

  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-6">
      <div>
        <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#0C8B44]" />
          Withdrawal methods (ACH / Wire / Check)
        </h2>
        <p className="text-xs text-[#737373] mt-1">
          Configure where this user can send withdrawals. Users only see methods you set here.
        </p>
      </div>

      <form onSubmit={saveAch} className="space-y-3 border-t border-[#ffffff08] pt-4">
        <h3 className="text-xs uppercase tracking-wider text-[#A0A0A0]">ACH</h3>
        <div className="grid md:grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Bank name" value={achBankName} onChange={(e) => setAchBankName(e.target.value)} />
          <input className={inputCls} placeholder="Institution" value={achInstitution} onChange={(e) => setAchInstitution(e.target.value)} />
          <input className={inputCls} placeholder="Account number" value={achAccountNumber} onChange={(e) => setAchAccountNumber(e.target.value)} />
          <input className={inputCls} placeholder="Routing number (9 digits)" value={achRoutingNumber} onChange={(e) => setAchRoutingNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))} />
        </div>
        <label className="flex items-center gap-2 text-xs text-[#A0A0A0]">
          <input type="checkbox" checked={achVerified} onChange={(e) => setAchVerified(e.target.checked)} />
          Mark as verified
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={btnPrimary}>
            <Save className="w-3.5 h-3.5" /> Save ACH
          </button>
          <button type="button" disabled={busy} onClick={removeAch} className={btnGhost}>
            Remove ACH
          </button>
        </div>
      </form>

      <form onSubmit={saveWire} className="space-y-3 border-t border-[#ffffff08] pt-4">
        <h3 className="text-xs uppercase tracking-wider text-[#A0A0A0] flex items-center gap-1">
          <Banknote className="w-3.5 h-3.5" /> Wire
        </h3>
        <div className="grid md:grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Beneficiary name" value={wireBeneficiary} onChange={(e) => setWireBeneficiary(e.target.value)} />
          <input className={inputCls} placeholder="Bank name" value={wireBankName} onChange={(e) => setWireBankName(e.target.value)} />
          <input className={inputCls} placeholder="Account number" value={wireAccountNumber} onChange={(e) => setWireAccountNumber(e.target.value)} />
          <input className={inputCls} placeholder="Routing number" value={wireRoutingNumber} onChange={(e) => setWireRoutingNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 9))} />
          <input className={inputCls} placeholder="SWIFT (optional)" value={wireSwiftCode} onChange={(e) => setWireSwiftCode(e.target.value.toUpperCase())} />
          <input className={inputCls} placeholder="IBAN (optional)" value={wireIban} onChange={(e) => setWireIban(e.target.value)} />
          <input className={`${inputCls} md:col-span-2`} placeholder="Reference (optional)" value={wireReference} onChange={(e) => setWireReference(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={btnPrimary}>
            <Save className="w-3.5 h-3.5" /> Save wire
          </button>
          <button type="button" disabled={busy} onClick={removeWire} className={btnGhost}>
            Remove wire
          </button>
        </div>
      </form>

      <form onSubmit={saveCheck} className="space-y-3 border-t border-[#ffffff08] pt-4">
        <h3 className="text-xs uppercase tracking-wider text-[#A0A0A0] flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> Check (mailed)
        </h3>
        <div className="flex gap-4 text-xs text-[#A0A0A0]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={enableCashier} onChange={(e) => setEnableCashier(e.target.checked)} />
            Cashier&apos;s check
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={enableWireCheck} onChange={(e) => setEnableWireCheck(e.target.checked)} />
            Wire check
          </label>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Payee name" value={checkPayee} onChange={(e) => setCheckPayee(e.target.value)} />
          <input className={inputCls} placeholder="Address line 1" value={checkLine1} onChange={(e) => setCheckLine1(e.target.value)} />
          <input className={inputCls} placeholder="Address line 2" value={checkLine2} onChange={(e) => setCheckLine2(e.target.value)} />
          <input className={inputCls} placeholder="City" value={checkCity} onChange={(e) => setCheckCity(e.target.value)} />
          <input className={inputCls} placeholder="State" value={checkState} onChange={(e) => setCheckState(e.target.value)} />
          <input className={inputCls} placeholder="Postal code" value={checkPostal} onChange={(e) => setCheckPostal(e.target.value)} />
          <input className={inputCls} placeholder="Country" value={checkCountry} onChange={(e) => setCheckCountry(e.target.value)} />
          <input className={inputCls} placeholder="Notes (optional)" value={checkNotes} onChange={(e) => setCheckNotes(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={btnPrimary}>
            <Save className="w-3.5 h-3.5" /> Save check
          </button>
          <button type="button" disabled={busy} onClick={removeCheck} className={btnGhost}>
            Remove check
          </button>
        </div>
      </form>
    </section>
  )
}
