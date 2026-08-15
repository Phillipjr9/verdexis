import { Link } from 'react-router-dom'
import { Shield, Lock, ChevronDown } from 'lucide-react'

import { clearConsentValue } from '../lib/cookieConsent'

const openCookiePrefs = () => {
  try { clearConsentValue() } catch { /* ignore */ }
  window.dispatchEvent(new Event('verdexis:open-cookie-prefs'))
}

const groups = [
  { title: 'Company', links: [['About Verdexis', '/about'], ['Our Approach', '/about#mission'], ['Careers', '/careers'], ['Contact', '/contact']] },
  { title: 'Platform', links: [['Dashboard', '/dashboard'], ['Markets', '/markets'], ['Portfolio', '/dashboard'], ['Pricing & Fees', '/fees'], ['Security', '/security'], ['Help Center', '/help'], ['Status', '/status']] },
  { title: 'Resources', links: [['FAQs', '/faq'], ['Investment Education', '/learn'], ['Market Insights', '/news'], ['Contact Support', '/support']] },
  { title: 'Legal', links: [['Privacy Policy', '/privacy'], ['Terms of Use', '/terms'], ['Cookie Policy', '/cookies'], ['Risk Disclosure', '/risk-disclosure'], ['Disclosures', '/disclosures'], ['Regulatory Information', '/regulatory'], ['Accessibility', '/accessibility']] },
  { title: 'Account', links: [['Log In', '/login'], ['Create Account', '/signup'], ['Forgot Password', '/reset'], ['Account Security', '/security'], ['Manage Notifications', '/settings/notifications']] },
] as const

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-12 border-t border-[#ffffff08] bg-[#070C0E]">
      <div className="max-w-[1280px] mx-auto px-6 py-12">

        {/* Brand row */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-10 pb-10 border-b border-[#ffffff05]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <img src="/assets/logo-icon-transparent.png" alt="Verdexis" className="w-7 h-7 object-contain" onError={(e) => { const t = e.currentTarget as HTMLImageElement; t.style.display = 'none' }} />
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0C8B44] to-[#00E676] items-center justify-center hidden">
                <span className="text-white text-xs font-bold">V</span>
              </div>
              <span className="text-sm font-medium text-[#E5E5E5] tracking-wide">VERDEXIS</span>
            </div>
            <p className="text-xs text-[#737373] leading-relaxed">
              Verdexis provides digital financial and investment services through a secure online platform.
            </p>
            <Link to="/contact" className="inline-flex mt-4 text-xs text-[#0C8B44] hover:text-[#00E676]">Contact Verdexis</Link>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-[#A0A0A0]">
            <span className="flex items-center gap-1.5" title="All traffic encrypted with TLS 1.3"><Lock className="w-3 h-3 text-[#0C8B44]" /> TLS 1.3 Encrypted</span>
            <span className="flex items-center gap-1.5" title="Data at rest encrypted with AES-256"><Shield className="w-3 h-3 text-[#0C8B44]" /> AES-256 at Rest</span>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-8 mb-10">
          {groups.map((group) => (
            <div key={group.title} className="border-b border-[#ffffff08] md:border-0 pb-3 md:pb-0">
              <p className="text-xs font-medium text-[#E5E5E5] uppercase tracking-[0.05em] mb-3">
                {group.title}
              </p>
              <ul className="space-y-2 text-xs text-[#A0A0A0]">
                {group.links.map(([label, path]) => (
                  <li key={`${group.title}-${label}-${path}`}>
                    <Link to={path} className="hover:text-[#0C8B44] transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mb-8 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-relaxed text-amber-100/80">
          Investment values can rise or fall and you may lose money. Past performance does not necessarily predict future results. Verdexis information is general and is not individualized financial, legal, tax, or accounting advice.
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-6 border-t border-[#ffffff05]">
          <p className="text-[11px] text-[#737373]">© {year} Verdexis. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px] text-[#737373] flex-wrap justify-center">
            <Link to="/privacy" className="hover:text-[#A0A0A0] transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-[#A0A0A0] transition-colors">Terms</Link>
            <Link to="/cookies" className="hover:text-[#A0A0A0] transition-colors">Cookie policy</Link>
            <button type="button" onClick={openCookiePrefs} className="hover:text-[#A0A0A0] transition-colors">Cookie preferences</button>
            <Link to="/risk-disclosure" className="hover:text-[#A0A0A0] transition-colors">Risk disclosure</Link>
            <Link to="/security" className="hover:text-[#A0A0A0] transition-colors">Security</Link>
            <Link to="/contact" className="hover:text-[#A0A0A0] transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
