import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { Link, useLocation } from 'react-router-dom'

type PageKey = 'privacy' | 'terms' | 'cookies' | 'risk' | 'security' | 'accessibility' | 'regulatory' | 'fees' | 'bonus' | 'wallet-guide' | 'contact' | 'support' | 'fraud' | 'careers' | 'faq'
type Section = { title: string; paragraphs: string[] }

const pages: Record<PageKey, { eyebrow: string; title: string; intro: string; sections: Section[] }> = {
  privacy: {
    eyebrow: 'Privacy', title: 'Privacy Policy', intro: 'Our Privacy Policy explains what information we collect, how it is used, and how you can exercise your rights. For privacy requests, please visit Support.',
    sections: [
      { title: 'Information we may collect', paragraphs: ['Account and contact information, device and IP information, usage information, authentication records, and information needed to provide requested features.'] },
      { title: 'How information may be used', paragraphs: ['To provide and secure the platform, process requests, communicate service information, prevent abuse, maintain records, and improve reliability where permitted.'] },
    ],
  },
  terms: {
    eyebrow: 'Legal', title: 'Terms of Service', intro: 'These Terms of Service describe the rules for using the platform. Creating an account requires that you read and accept these terms, the Privacy Policy, and the Risk Disclosure.',
    sections: [
      { title: 'Use of the platform', paragraphs: ['Users are responsible for accurate account information, protecting credentials, and using the platform lawfully.'] },
      { title: 'Acceptance', paragraphs: ['By checking the agreement box at signup, you confirm that you have read these Terms, the Privacy Policy, the Risk Disclosure, and the Disclosures page.'] },
    ],
  },
  cookies: {
    eyebrow: 'Privacy', title: 'Cookie Policy', intro: 'Verdexis uses essential browser storage for session, preferences, and consent behavior.',
    sections: [{ title: 'Cookie categories', paragraphs: ['Necessary storage supports authentication, security, consent, and basic preferences.'] }],
  },
  risk: {
    eyebrow: 'Risk', title: 'Risk Disclosure', intro: 'Using Verdexis involves financial, technology, and operational risk. You can lose some or all of the value of assets you track or transfer.',
    sections: [
      { title: 'You can lose money', paragraphs: ['Digital assets and market prices are volatile. Values can fall quickly or go to zero. Bonus credit is not profit.'] },
      { title: 'Transfers may be irreversible', paragraphs: ['Cryptocurrency sent to the wrong address or network may be permanently lost.'] },
    ],
  },
  security: {
    eyebrow: 'Trust', title: 'Security at Verdexis', intro: 'The platform uses layered controls to protect accounts and operations.',
    sections: [{ title: 'Report a concern', paragraphs: ['Do not send passwords, private keys, seed phrases, or authentication codes. Use Support.'] }],
  },
  accessibility: {
    eyebrow: 'Access', title: 'Accessibility', intro: 'Verdexis is working toward an accessible experience across supported browsers and devices.',
    sections: [{ title: 'Feedback', paragraphs: ['Report an accessibility barrier through the Contact page.'] }],
  },
  regulatory: {
    eyebrow: 'Transparency', title: 'Regulatory Information', intro: 'Verified regulatory information will be published here when available.',
    sections: [{ title: 'Verified information pending', paragraphs: ['No regulator logos or coverage claims are made on this page.'] }],
  },
  fees: {
    eyebrow: 'Pricing', title: 'Fees', intro: 'Fees are shown before you confirm a deposit, withdrawal, transfer, or trade. Amounts can change. Always review the quote on screen. This page is a summary, not a guarantee of a specific rate.',
    sections: [
      { title: 'What you may pay', paragraphs: ['Processing or network fees can apply when you withdraw or move funds. Crypto network fees depend on the chain and congestion. Bank, wire, and check withdrawals can include a processing fee and, for mailed checks, a delivery surcharge.', 'Trading and conversion fees, if any, are displayed in the order ticket before you submit.'] },
      { title: 'Welcome bonus and unlock fees', paragraphs: ['Signup or welcome bonuses can include eligibility rules, holding periods, or a verification step. If an unlock or processing fee is required, it is shown in the wallet flow before you pay.', 'Bonus value is not profit. Investing can lose value. Read bonus terms in the app before you claim or fund.'] },
      { title: 'How to confirm a fee', paragraphs: ['Open Wallet or the withdrawal form, enter the amount, and read the fee line before you submit. If the number does not match what you expected, do not continue — use Support.'] },
    ],
  },
  bonus: {
    eyebrow: 'Offer', title: 'New-investor welcome bonus', intro: 'New Verdexis accounts may qualify for a welcome bonus. Eligibility, amount, and any lock or fee are shown in your account after signup. Terms apply. This is not a guaranteed return.',
    sections: [
      { title: 'How to see if you qualify', paragraphs: ['Create an account at Sign up, verify your email, then open Wallet or the bonus prompt in the app. If a bonus is available for your account, the amount and conditions appear there.', 'Bonuses can require identity verification or a processing-fee check before funds are fully usable. Do not pay anyone who contacts you off-platform.'] },
      { title: 'Important limits', paragraphs: ['Offers can end, change, or be declined if the account is duplicated, restricted, or incomplete. Read Fees, Terms, and Risk disclosure before you fund an account.'] },
    ],
  },
  'wallet-guide': {
    eyebrow: 'Product', title: 'Wallet and transfers', intro: 'The Verdexis wallet holds balances, deposits, withdrawals, and activity after you sign in. You must create an account to use the live wallet.',
    sections: [
      { title: 'What the wallet shows', paragraphs: ['After login you can view balances, recent transactions, deposit instructions, and withdrawal options. Available and pending amounts can differ while a transfer is reviewed.'] },
      { title: 'Deposits and withdrawals', paragraphs: ['Withdrawals can require a destination address or linked bank, a fee quote, and in some cases admin review. Transfers sent to the wrong address usually cannot be reversed.'] },
    ],
  },
  contact: {
    eyebrow: 'Contact', title: 'Contact Verdexis', intro: 'Use Support for questions. Do not include passwords, private keys, seed phrases, or authentication codes.',
    sections: [{ title: 'Contact options', paragraphs: ['Account, KYC, transaction, and accessibility questions can be sent through Support and Help.'] }],
  },
  support: {
    eyebrow: 'Support', title: 'Verdexis Support', intro: 'Get help with signup, bonus terms, fees, deposits, and withdrawals. Support will never ask for your password, private key, seed phrase, or one-time code.',
    sections: [
      { title: 'Fast answers', paragraphs: ['New account: use Sign up, then verify the email we send.', 'Bonus: open /bonus or the prompt in your account after login.', 'Fees: see /fees, then confirm the live quote in Wallet before you submit.', 'Wallet: after you sign in, open Wallet for deposits, withdrawals, and history.'] },
      { title: 'Contact', paragraphs: ['Use /contact for account, KYC, or transaction questions. Include the transaction reference only.', 'Help Center articles also live at /help.'] },
    ],
  },
  fraud: {
    eyebrow: 'Security', title: 'Fraud Prevention', intro: 'Protect your account by verifying the website and treating unexpected requests with caution.',
    sections: [{ title: 'Verdexis will not ask for secrets', paragraphs: ['Verdexis will not request your password, private key, seed phrase, or authentication code by email.'] }],
  },
  careers: {
    eyebrow: 'Company', title: 'Careers', intro: 'Check back for open positions.',
    sections: [{ title: 'Future opportunities', paragraphs: ['When roles are approved, this page will describe the position and how to apply.'] }],
  },
  faq: {
    eyebrow: 'Resources', title: 'Frequently Asked Questions', intro: 'Answers below describe the current platform at a high level and should not be treated as financial or legal advice.',
    sections: [
      { title: 'Account and security', paragraphs: ['Use Sign up to create an account, verify email, and configure available security controls.'] },
      { title: 'Markets and transactions', paragraphs: ['Market data can be delayed. Fees and limits should be reviewed before submitting a transaction.'] },
    ],
  },
}

export default function PublicInformation() {
  const pathname = useLocation().pathname
  const key = (
    pathname === '/risk-disclosure' ? 'risk'
      : pathname === '/security/fraud-prevention' ? 'fraud'
        : pathname === '/cookie-preferences' ? 'cookies'
          : pathname === '/wallet-guide' ? 'wallet-guide'
          : pathname.replace(/^\//, '')
  ) as PageKey
  const page = pages[key] ?? pages.faq
  return <div className="min-h-screen bg-[#070C0E]"><Navigation /><main className="pt-24 pb-16 px-6"><article className="max-w-[920px] mx-auto"><p className="text-xs tracking-[0.3em] uppercase text-[#0C8B44] mb-3">{page.eyebrow}</p><h1 className="text-4xl md:text-5xl font-light text-[#E5E5E5] mb-4">{page.title}</h1><p className="text-sm text-[#A0A0A0] leading-relaxed max-w-3xl mb-10">{page.intro}</p><div className="space-y-8">{page.sections.map((section, sIdx) => <section key={`section-${sIdx}`}><h2 className="text-2xl font-light text-[#E5E5E5] mb-3">{section.title}</h2>{section.paragraphs.map((paragraph, pIdx) => <p key={`section-${sIdx}-p-${pIdx}`} className="text-sm text-[#A0A0A0] leading-relaxed mb-3">{paragraph}</p>)}</section>)}</div><div className="mt-12 pt-6 border-t border-[#ffffff08] text-sm text-[#737373] space-y-3"><p>Related: <Link to="/terms" className="text-[#0C8B44]">Terms</Link> · <Link to="/privacy" className="text-[#0C8B44]">Privacy</Link> · <Link to="/risk-disclosure" className="text-[#0C8B44]">Risk disclosure</Link> · <Link to="/fees" className="text-[#0C8B44]">Fees</Link> · <Link to="/bonus" className="text-[#0C8B44]">Bonus</Link></p><p>Need help? <Link to="/support" className="text-[#0C8B44]">Visit Support</Link>.</p></div></article></main><Footer /></div>
}
