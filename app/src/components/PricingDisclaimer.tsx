import { Link } from 'react-router-dom'

export default function PricingDisclaimer() {
  return (
    <p className="text-xs text-[#737373] max-w-2xl mx-auto text-center mt-8 leading-relaxed">
      Verdexis is a software workspace, not a bank, broker, or investment adviser.
      Account balances, fees, and market prices are estimates and can change.
      Cryptocurrency deposits and withdrawals may be delayed, rejected, or irreversible.
      Confirm amounts and destinations before you send funds. See the{' '}
      <Link to="/risk-disclosure" className="text-[#0C8B44] hover:underline">risk disclosure</Link>
      {' '}and{' '}
      <Link to="/terms" className="text-[#0C8B44] hover:underline">terms of use</Link>.
    </p>
  )
}
