/**
 * Admin: Configure withdrawal methods for a user.
 * ACH, Wire, Cashier's check, Wire check.
 * Users only see methods you configure here (read-only destinations).
 */

import { useState, FormEvent } from 'react'
import { Save, Building2, Banknote, FileText, AlertCircle, CheckCircle } from 'lucide-react'
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
      toast.success(`Wire transfer configured for ${userEmail}`)
      setWireBeneficiary('')
      setWireBankName('')
      setWireAccountNumber('')
      setWireRoutingNumber('')
      setWireSwiftCode('')
      setWireIban('')
      setWireReference('')
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
      toast.error('Enable at least one check type (cashier or wire check)')
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

  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-6">
      <div>
        <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#0C8B44]" />
          Withdrawal Methods Configuration
        </h2>
        <p className="text-[11px] text-[#737373] mt-1">
          Configure how {userEmail} can withdraw. Users only see methods you set up here.
        </p>
      </div>

      <div className="p-3 rounded-lg bg-[#F57C00]/10 border border-[#F57C00]/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#F57C00] shrink-0 mt-0.5" />
          <div className="text-xs text-[#F57C00]">
            <p className="font-medium">Admin-only configuration</p>
            <p className="text-[#E5E5E5]/80 mt-1">
              Users cannot link banks or change mailing addresses. You configure destinations; they request withdrawals to those destinations.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#0C8B44]" />
            <h3 className="text-sm font-medium text-[#E5E5E5]">ACH Bank Transfer</h3>
          </div>
          <button type="button" onClick={removeAch} disabled={busy} className="text-xs text-[#f44336] hover:underline disabled:opacity-50">
            Remove ACH
          </button>
        </div>
        <form onSubmit={saveAch} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Bank name" value={achBankName} onChange={setAchBankName} placeholder="Chase Bank" />
            <Input label="Institution" value={achInstitution} onChange={setAchInstitution} placeholder="JPMorgan Chase" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Account number" value={achAccountNumber} onChange={setAchAccountNumber} placeholder="1234567890" />
            <Input
              label="Routing number (9 digits)"
              value={achRoutingNumber}
              onChange={(v) => setAchRoutingNumber(v.replace(/\D/g, '').slice(0, 9))}
              placeholder="021000021"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#A0A0A0] cursor-pointer">
            <input type="checkbox" checked={achVerified} onChange={(e) => setAchVerified(e.target.checked)} className="accent-[#0C8B44]" />
            Mark as verified
          </label>
          <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">
            <Save className="w-4 h-4" />
            {busy ? 'Saving...' : 'Save ACH Configuration'}
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0C8B44]" />
            <h3 className="text-sm font-medium text-[#E5E5E5]">Wire Transfer</h3>
          </div>
          <button type="button" onClick={removeWire} disabled={busy} className="text-xs text-[#f44336] hover:underline disabled:opacity-50">
            Remove Wire
          </button>
        </div>
        <form onSubmit={saveWire} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Beneficiary name" value={wireBeneficiary} onChange={setWireBeneficiary} placeholder="John Doe" />
            <Input label="Bank name" value={wireBankName} onChange={setWireBankName} placeholder="Bank of America" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Account number" value={wireAccountNumber} onChange={setWireAccountNumber} placeholder="9876543210" />
            <Input
              label="Routing number"
              value={wireRoutingNumber}
              onChange={(v) => setWireRoutingNumber(v.replace(/\D/g, '').slice(0, 9))}
              placeholder="026009593"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="SWIFT code (optional)" value={wireSwiftCode} onChange={(v) => setWireSwiftCode(v.toUpperCase())} placeholder="BOFAUS3N" />
            <Input label="IBAN (optional)" value={wireIban} onChange={(v) => setWireIban(v.toUpperCase())} placeholder="GB29 NWBK..." />
          </div>
          <Input label="Reference/memo (optional)" value={wireReference} onChange={setWireReference} placeholder="Account #12345" />
          <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">
            <Save className="w-4 h-4" />
            {busy ? 'Saving...' : 'Save Wire Configuration'}
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0C8B44]" />
            <h3 className="text-sm font-medium text-[#E5E5E5]">Check withdrawal</h3>
          </div>
          <button type="button" onClick={removeCheck} disabled={busy} className="text-xs text-[#f44336] hover:underline disabled:opacity-50">
            Remove check
          </button>
        </div>
        <p className="text-[11px] text-[#737373]">
          Cashier's check or wire check mailed to the address below. Withdrawal only — no check deposits.
        </p>
        <form onSubmit={saveCheck} className="space-y-3">
          <div className="flex flex-wrap gap-4 text-xs text-[#A0A0A0]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={enableCashier} onChange={(e) => setEnableCashier(e.target.checked)} className="accent-[#0C8B44]" />
              Cashier's check
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={enableWireCheck} onChange={(e) => setEnableWireCheck(e.target.checked)} className="accent-[#0C8B44]" />
              Wire check
            </label>
          </div>
          <Input label="Payee name (on check)" value={checkPayee} onChange={setCheckPayee} placeholder="John Doe" />
          <Input label="Mailing address line 1" value={checkLine1} onChange={setCheckLine1} placeholder="123 Main St" />
          <Input label="Line 2 (optional)" value={checkLine2} onChange={setCheckLine2} placeholder="Apt 4B" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={checkCity} onChange={setCheckCity} placeholder="New York" />
            <Input label="State" value={checkState} onChange={setCheckState} placeholder="NY" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Postal code" value={checkPostal} onChange={setCheckPostal} placeholder="10001" />
            <Input label="Country" value={checkCountry} onChange={setCheckCountry} placeholder="US" />
          </div>
          <Input label="Notes (optional)" value={checkNotes} onChange={setCheckNotes} placeholder="Certified mail required" />
          <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">
            <Save className="w-4 h-4" />
            {busy ? 'Saving...' : 'Save check configuration'}
          </button>
        </form>
      </div>

      <div className="p-3 rounded-lg bg-[#0C8B44]/10 border border-[#0C8B44]/30">
        <div className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-[#0C8B44] shrink-0 mt-0.5" />
          <div className="text-xs text-[#0C8B44]">
            <p className="font-medium">How it works</p>
            <ul className="text-[#E5E5E5]/80 mt-1 space-y-1 list-disc list-inside">
              <li>User goes to Wallet → Withdraw</li>
              <li>User sees only methods you configure here</li>
              <li>Check withdrawals are mailed after you approve in the pending queue</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]"
      />
    </label>
  )
}
