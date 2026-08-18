import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { Link, useLocation } from 'react-router-dom'

type PageKey = 'privacy' | 'terms' | 'cookies' | 'risk' | 'security' | 'accessibility' | 'regulatory' | 'fees' | 'contact' | 'support' | 'fraud' | 'careers' | 'faq'
type Section = { title: string; paragraphs: string[] }

const pages: Record<PageKey, { eyebrow: string; title: string; intro: string; sections: Section[] }> = {
  privacy: {
    eyebrow: 'Privacy', title: 'Privacy Policy', intro: 'Our Privacy Policy explains what information we collect, how it is used, and how you can exercise your rights. For privacy requests, please visit Support.',
    sections: [
      { title: 'Information we may collect', paragraphs: ['Account and contact information, device and IP information, usage information, authentication records, and information needed to provide requested features.', 'The exact categories and sources depend on which platform features you use.'] },
      { title: 'How information may be used', paragraphs: ['To provide and secure the platform, process requests, communicate service information, prevent abuse, maintain records, and improve reliability where permitted.'] },
      { title: 'Service providers and disclosures', paragraphs: ['The platform may use hosting, authentication, communications, analytics, market-data, payment, and security providers. The applicable provider list and legal disclosure process require verified business input.'] },
      { title: 'Retention and rights', paragraphs: ['Retention periods, deletion workflows, access requests, international transfers, children\'s privacy, and jurisdiction-specific rights require confirmation from Verdexis legal counsel. Use the support page for privacy requests.'] },
    ],
  },
  terms: {
    eyebrow: 'Legal', title: 'Terms of Service', intro: 'These Terms of Service describe the rules for using the platform. Creating an account requires that you read and accept these terms, the Privacy Policy, and the Risk Disclosure.',
    sections: [
      { title: 'Use of the platform', paragraphs: ['Users are responsible for accurate account information, protecting credentials, and using the platform lawfully. Do not share passwords, private keys, seed phrases, or authentication codes.'] },
      { title: 'Information and transactions', paragraphs: ['Market information and platform content may be incomplete, delayed, or unavailable. Transaction availability, fees, limits, reversals, and third-party dependencies depend on the applicable feature and current disclosures.'] },
      { title: 'Restrictions and service availability', paragraphs: ['Abuse, unauthorized access, fraud, unlawful activity, and attempts to disrupt the service are prohibited. Features may be suspended for security, maintenance, legal, or provider reasons.'] },
      { title: 'Acceptance', paragraphs: ['By checking the agreement box at signup, you confirm that you have read these Terms, the Privacy Policy, the Risk Disclosure, and the Disclosures page.'] },
      { title: 'Legal review required', paragraphs: ['Governing law, dispute resolution, liability limits, indemnification, eligibility, and entity-specific terms must be supplied and approved by Verdexis legal counsel before final publication.'] },
    ],
  },
  cookies: {
    eyebrow: 'Privacy', title: 'Cookie Policy', intro: 'Verdexis currently uses essential browser storage for session, preferences, and consent behavior. Non-essential analytics should remain disabled unless consent is recorded.',
    sections: [
      { title: 'Cookie categories', paragraphs: ['Necessary storage supports authentication, security, consent, and basic preferences. Functional or analytics storage should only be enabled when the user chooses it. Marketing cookies are not assumed by this policy.'] },
      { title: 'Managing preferences', paragraphs: ['Use Cookie preferences in the footer to revisit the consent choice. Browser settings can also clear cookies and local storage, although clearing essential storage may sign you out.'] },
      { title: 'Third parties and duration', paragraphs: ['Any third-party cookie, analytics tool, provider, purpose, and retention period must be added from the actual production configuration before publication.'] },
    ],
  },
  risk: {
    eyebrow: 'Risk', title: 'Risk Disclosure', intro: 'Using Verdexis involves financial, technology, and operational risk. You can lose some or all of the value of assets you track or transfer. Read this page together with the Terms of Use, Privacy Policy, and Disclosures before you create an account or send funds.',
    sections: [
      { title: 'Not a bank, broker, or adviser', paragraphs: ['Verdexis is software. It is not a bank, broker-dealer, exchange, money transmitter, custodian, or registered investment adviser unless separately documented on the Regulatory Information page.', 'Nothing on the site is an offer to sell securities, an invitation to invest, or personalized financial, legal, or tax advice.'] },
      { title: 'You can lose money', paragraphs: ['Digital assets and market prices are volatile. Values can fall quickly, stay depressed for long periods, or go to zero.', 'You are solely responsible for deciding whether to deposit, transfer, withdraw, or hold any asset.'] },
      { title: 'Transfers may be irreversible', paragraphs: ['Cryptocurrency sent to the wrong address, on the wrong network, or without a required memo or tag may be permanently lost. Verdexis cannot reverse most blockchain transactions.', 'Deposits and withdrawals can be delayed, queued for review, rejected, or fail because of network congestion, compliance review, or provider outages.'] },
      { title: 'No custody or insurance promise', paragraphs: ['Do not assume balances shown in the app are FDIC-insured, SIPC-protected, or held in a segregated custodial account unless that is expressly stated for a specific product.', 'Displayed balances, fees, and market prices are estimates and can differ from on-chain or bank records.'] },
      { title: 'Technology and third-party risk', paragraphs: ['Outages, bugs, cyber incidents, blockchain reorganizations, oracle or market-data errors, and failures by hosting or wallet providers can affect access, records, or settlement.'] },
      { title: 'Eligibility and local law', paragraphs: ['You must be legally allowed to use the service where you live. You are responsible for taxes, reporting, and any license or restriction that applies to you.', 'The platform may restrict features or close accounts for security, legal, or abuse reasons.'] },
      { title: 'Limitation of claims', paragraphs: ['To the fullest extent allowed by law, Verdexis and its operators are not liable for investment losses, irreversible transfers, delayed credits, or decisions you make using information on the site. See the Terms of Use and Disclosures for the full allocation of risk.'] },
    ],
  },
  security: {
    eyebrow: 'Trust', title: 'Security at Verdexis', intro: 'The platform uses layered controls to protect accounts and operations. Specific controls can change as the service evolves.',
    sections: [
      { title: 'Account protection', paragraphs: ['Authentication, session controls, rate limits, email verification, optional MFA, device and security-event monitoring, and audit logging are part of the current application surface.'] },
      { title: 'Data and infrastructure', paragraphs: ['The application uses HTTPS/TLS in production, security headers, input validation, access controls, and environment-based secret configuration. No online service can guarantee perfect security.'] },
      { title: 'Report a concern', paragraphs: ['Do not send passwords, private keys, seed phrases, API keys, or authentication codes. Use the support page to report a suspected issue and include only non-sensitive details.'] },
    ],
  },
  accessibility: {
    eyebrow: 'Access', title: 'Accessibility', intro: 'Verdexis is working toward an accessible experience across supported browsers and devices. This page is a commitment and feedback channel, not a certification claim.',
    sections: [
      { title: 'Design priorities', paragraphs: ['The interface is designed with keyboard navigation, semantic headings, readable contrast, responsive layouts, text alternatives, and screen-reader-friendly labels in mind.'] },
      { title: 'Feedback', paragraphs: ['Report an accessibility barrier through the Contact page with the page, device, browser, and a description of what prevented access. Do not include account secrets.'] },
    ],
  },
  regulatory: {
    eyebrow: 'Transparency', title: 'Regulatory Information', intro: 'Verified regulatory information will be published here when available. Contact Support for questions about compliance or registrations.',
    sections: [{ title: 'Verified information pending', paragraphs: ['This page will be updated only with documentation reviewed and approved by Verdexis. No regulator logos, registration numbers, or coverage claims are made on this page.'] }],
  },
  fees: {
    eyebrow: 'Pricing', title: 'Fees', intro: 'Fees depend on the service and are confirmed at the time of a transaction. Official fee schedules are provided by the platform.',
    sections: [{ title: 'Fee schedule', paragraphs: ['Official production fees are provided by the platform at the point of transaction. If you have questions, contact Support.'] }],
  },
  contact: {
    eyebrow: 'Contact', title: 'Contact Verdexis', intro: 'Use the support workflow for questions about the platform. Do not include passwords, private keys, seed phrases, API secrets, or authentication codes in a message.',
    sections: [{ title: 'Contact options', paragraphs: ['General inquiries, business inquiries, accessibility feedback, security reports, transaction questions, and KYC support can be routed through the Help Center and Support pages. Verified company contact details will be published here when configured.'] }],
  },
  support: {
    eyebrow: 'Support', title: 'Verdexis Support', intro: 'Find help without sharing sensitive credentials. Support will never need your password, private key, seed phrase, or one-time authentication code.',
    sections: [{ title: 'Support topics', paragraphs: ['Account access, security, KYC, deposits, withdrawals, transactions, trading, and notifications are covered in the Help Center. Authenticated ticket functionality can be added when the support backend is enabled.'] }],
  },
  fraud: {
    eyebrow: 'Security', title: 'Fraud Prevention', intro: 'Protect your account by verifying the website and treating unexpected requests with caution.',
    sections: [{ title: 'Verdexis will not ask for secrets', paragraphs: ['Verdexis will not request your password, private key, seed phrase, API secret, or authentication code by email. Legitimate automated customer email comes from no-reply@verdexisgroup.com. Internal administrative email uses admin@verdexisgroup.com.'] }, { title: 'Report suspicious activity', paragraphs: ['Do not click suspicious links. Visit https://www.verdexisgroup.com directly and use the Support page to report the message without forwarding sensitive information.'] }],
  },
  careers: {
    eyebrow: 'Company', title: 'Careers', intro: 'Check back for open positions. You can also contact Support to inquire about opportunities.',
    sections: [{ title: 'Future opportunities', paragraphs: ['When roles are approved, this page will describe the position, location, application process, and any applicable equal-opportunity statement.'] }],
  },
  faq: {
    eyebrow: 'Resources', title: 'Frequently Asked Questions', intro: 'Answers below describe the current platform at a high level and should not be treated as financial or legal advice.',
    sections: [{ title: 'Account and security', paragraphs: ['Use the authentication flow to create an account, verify email, reset a password, and configure available security controls. Never share authentication codes.'] }, { title: 'Markets and transactions', paragraphs: ['Market data can be delayed or unavailable. Fees, limits, confirmations, and provider dependencies should be reviewed before submitting a transaction.'] }, { title: 'KYC and support', paragraphs: ['KYC requirements and review timing can vary. Upload documents only through the authenticated platform and contact Support without sending secrets.'] }],
  },
}

export default function PublicInformation() {
  const pathname = useLocation().pathname
  const key = (
    pathname === '/risk-disclosure' ? 'risk'
      : pathname === '/security/fraud-prevention' ? 'fraud'
        : pathname === '/cookie-preferences' ? 'cookies'
          : pathname.replace(/^\//, '')
  ) as PageKey
  const page = pages[key] ?? pages.faq
  return <div className="min-h-screen bg-[#070C0E]"><Navigation /><main className="pt-24 pb-16 px-6"><article className="max-w-[920px] mx-auto"><p className="text-xs tracking-[0.3em] uppercase text-[#0C8B44] mb-3">{page.eyebrow}</p><h1 className="text-4xl md:text-5xl font-light text-[#E5E5E5] mb-4">{page.title}</h1><p className="text-sm text-[#A0A0A0] leading-relaxed max-w-3xl mb-10">{page.intro}</p><div className="space-y-8">{page.sections.map((section, sIdx) => <section key={`section-${sIdx}`}><h2 className="text-2xl font-light text-[#E5E5E5] mb-3">{section.title}</h2>{section.paragraphs.map((paragraph, pIdx) => <p key={`section-${sIdx}-p-${pIdx}`} className="text-sm text-[#A0A0A0] leading-relaxed mb-3">{paragraph}</p>)}</section>)}</div><div className="mt-12 pt-6 border-t border-[#ffffff08] text-sm text-[#737373] space-y-3"><p>Related: <Link to="/terms" className="text-[#0C8B44]">Terms</Link> · <Link to="/privacy" className="text-[#0C8B44]">Privacy</Link> · <Link to="/risk-disclosure" className="text-[#0C8B44]">Risk disclosure</Link> · <Link to="/disclosures" className="text-[#0C8B44]">Disclosures</Link> · <Link to="/regulatory" className="text-[#0C8B44]">Regulatory</Link></p><p>Need help? <Link to="/support" className="text-[#0C8B44]">Visit Support</Link>.</p></div></article></main><Footer /></div>
}
