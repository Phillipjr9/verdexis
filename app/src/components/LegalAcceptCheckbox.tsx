import { Link } from 'react-router-dom'

export const LEGAL_ACCEPT_VERSION = '2026-08-18'

export function persistLegalAccept() {
  try {
    localStorage.setItem('verdexis_legal_accept', JSON.stringify({
      accepted: true,
      at: new Date().toISOString(),
      version: LEGAL_ACCEPT_VERSION,
      documents: ['terms', 'privacy', 'risk-disclosure', 'disclosures'],
    }))
  } catch { /* ignore */ }
}

export function LegalAcceptCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2.5 text-[11px] text-[#A3A3A3] leading-relaxed cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#0C8B44]"
        required
      />
      <span>
        I have read and agree to the{' '}
        <Link to="/terms" target="_blank" className="text-[#0C8B44] hover:underline">Terms of Use</Link>,{' '}
        <Link to="/privacy" target="_blank" className="text-[#0C8B44] hover:underline">Privacy Policy</Link>,{' '}
        <Link to="/risk-disclosure" target="_blank" className="text-[#0C8B44] hover:underline">Risk Disclosure</Link>, and{' '}
        <Link to="/disclosures" target="_blank" className="text-[#0C8B44] hover:underline">Disclosures</Link>.
      </span>
    </label>
  )
}
