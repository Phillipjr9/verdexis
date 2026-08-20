import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import AuthModal from '../components/AuthModal'
import Testimonials from '../components/Testimonials'
import ScrambleText from '../components/ScrambleText'
import TetrahedronCanvas from '../components/Tetrahedron'
import { type CryptoQuote, marketData } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'
import { Shield, ChevronRight, CheckCircle, Play, Lock, Fingerprint, Eye, Server, Globe, Sparkles, Wallet } from 'lucide-react'

const platformStats = [
  { value: 'Unified', label: 'All your accounts', icon: Globe },
  { value: 'Secure', label: 'Encryption first', icon: Shield },
  { value: 'Clear', label: 'Performance signals', icon: Sparkles },
  { value: 'Accessible', label: 'Desktop & mobile', icon: Wallet },
]

const trustedPartners = [
  { name: 'CoinGecko', src: '/assets/logo-coingecko.png', white: false, className: 'max-w-[56px] md:max-w-[72px]' },
  { name: 'Binance', src: '/assets/logo-binance.png' },
  { name: 'Stripe', src: '/assets/logo-stripe.png' },
  { name: 'Plaid', src: '/assets/logo-plaid.png', white: true },
  { name: 'Finnhub', src: '/assets/logo-finnhub.png' },
  { name: 'Alpha Vantage', src: '/assets/logo-alphavantage.png' },
  { name: 'Chainlink', src: '/assets/logo-link.png' },
]

const featureItems = [
  { icon: Globe, title: 'Unified financial view', desc: 'Bring checking, savings, investments, and other assets into a single, secure overview.' },
  { icon: Sparkles, title: 'Clear progress signals', desc: 'Understand your money with easy-to-read summaries and simple performance indicators.' },
  { icon: Wallet, title: 'Cashflow tracking', desc: 'Monitor balances, transfers, spending, and savings all in one place.' },
  { icon: Shield, title: 'Security-first design', desc: 'Built with strong controls, encryption, and account protection from day one.' },
  { icon: Server, title: 'Reliable access', desc: 'Fast, dependable access so you can check your finances whenever you need.' },
  { icon: Lock, title: 'Privacy controls', desc: 'You decide what data is shared and how it is used.' },
]

const securityItems = [
  { icon: Lock, title: 'AES-256 encryption', desc: 'Your information is encrypted at rest and in transit.' },
  { icon: Fingerprint, title: 'Two-factor authentication', desc: 'Add extra protection to your account with TOTP security.' },
  { icon: Eye, title: 'Privacy by design', desc: 'Consent-based analytics and no data selling.' },
  { icon: Server, title: 'Audit logging', desc: 'Actions are logged so you always have a clear record of activity.' },
]

const audienceItems = [
  { title: 'For self-directed investors', desc: 'Track portfolios, compare market moves, and keep your decisions grounded in clean, readable data.' },
  { title: 'For people planning ahead', desc: 'Set goals, review your accounts, and keep the long view in focus without losing the short-term details.' },
  { title: 'For anyone who wants clarity', desc: 'Verdexis is designed to simplify complicated financial work into one view that is easier to understand.' },
]

const howItWorks = [
  { step: '01', title: 'Create your account', desc: 'Sign up in minutes. Add 2FA when you are ready. No credit card required.' },
  { step: '02', title: 'Get your wallets', desc: 'Generate a deposit address for each coin, or connect an external wallet. Admin can still update addresses if needed.' },
  { step: '03', title: 'Move and track money', desc: 'Deposit, transfer, and withdraw with a live status trail so you always know where a request stands.' },
]

const planItems = [
  {
    name: 'Free',
    price: '$0',
    detail: 'Forever',
    points: ['Account and portfolio overview', 'Per-coin deposit addresses', 'Transfers and withdrawal tracking', 'Live market data'],
    cta: 'Start free',
    featured: true,
  },
  {
    name: 'Premium',
    price: 'Coming soon',
    detail: 'Optional upgrades',
    points: ['Advanced planning tools', 'Deeper reports', 'Priority support'],
    cta: 'Join the waitlist',
    featured: false,
  },
]

const faqItems = [
  { q: 'Who is Verdexis for?', a: 'Verdexis is built for self-directed investors, long-term savers, and anyone who wants a clearer, more secure view of their finances.' },
  { q: 'Is Verdexis free?', a: 'Yes. Verdexis is free to sign up and use, with optional premium upgrades for advanced planning tools.' },
  { q: 'How is my data protected?', a: 'All information is encrypted with AES-256 at rest and TLS 1.3 in transit, and we support two-factor authentication for every account.' },
  { q: 'Can I use Verdexis on mobile?', a: 'Yes. Verdexis is designed to work across desktop and mobile so you can check your finances wherever you are.' },
  { q: 'What support is available?', a: 'Our support team is available through the in-app help center and live chat for account questions and setup assistance. We never ask for passwords, private keys, or one-time security codes.' },
  { q: 'Is Verdexis financial advice?', a: 'No. Verdexis provides insights and analysis to help you make decisions, but it is not a registered investment adviser.' },
]

function formatTickerPrice(value: number) {
  if (!Number.isFinite(value)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 3 : 4,
  }).format(value)
}

function TickerItem({ coin }: { coin: CryptoQuote }) {
  const [price, setPrice] = useState<number>(coin.current_price || 0)

  useEffect(() => {
    const current = liveTicker.getPrice(coin.id) ?? coin.current_price ?? 0
    setPrice(current)
    return liveTicker.subscribe(coin.id, (nextPrice) => setPrice(nextPrice))
  }, [coin.id, coin.current_price])

  const change = Number.isFinite(coin.price_change_percentage_24h) ? coin.price_change_percentage_24h : 0
  const up = change >= 0

  return (
    <div className="flex items-center gap-3 shrink-0 px-2 py-1 text-sm text-[#E5E5E5]">
      {coin.image ? (
        <img
          src={coin.image}
          alt={coin.name}
          className="h-4 w-4 object-contain shrink-0"
          onError={(event) => {
            const image = event.currentTarget as HTMLImageElement
            image.style.display = 'none'
          }}
        />
      ) : (
        <span className="flex h-4 w-4 items-center justify-center text-[8px] font-semibold text-[#0C8B44]">
          {coin.symbol.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="text-[#F3F4F6]">{formatTickerPrice(price)}</span>
      <span className={up ? 'font-medium text-[#4CAF50]' : 'font-medium text-[#f44336]'}>{up ? '+' : ''}{change.toFixed(2)}%</span>
    </div>
  )
}

export default function Home() {
  const isAuthed = (() => {
    try {
      return !!localStorage.getItem('verdexis_token') || (!!localStorage.getItem('verdexis_auth') && !!localStorage.getItem('verdexis_holdings'))
    } catch {
      return false
    }
  })()

  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup')
  const [tickerCoins, setTickerCoins] = useState<CryptoQuote[]>([])

  useEffect(() => {
    let active = true
    const loadTicker = async () => {
      try {
        const list = await marketData.getCryptoList()
        if (active) setTickerCoins(list.slice(0, 8))
      } catch {
        if (active) setTickerCoins([])
      }
    }
    void loadTicker()
    const id = window.setInterval(() => { void loadTicker() }, 3000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  const openSignup = () => { setAuthMode('signup'); setAuthOpen(true) }
  const openLogin = () => { setAuthMode('login'); setAuthOpen(true) }

  if (isAuthed) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultMode={authMode} />

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '4px 4px' }}>
        <TetrahedronCanvas />
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto" style={{ marginTop: '-5vh' }}>
          <h1 className="text-6xl md:text-7xl lg:text-[80px] font-light tracking-[-0.04em] text-[#E5E5E5] mb-4">
            <ScrambleText text="Multiply Your Wealth." />
          </h1>
          <p className="text-2xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">A simpler way to understand your money and move forward with confidence.</p>
          <p className="text-base md:text-lg text-[#A0A0A0] max-w-lg mx-auto mb-10 leading-relaxed">Securely connect your accounts, track progress, and keep your finances organized without the noise.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button onClick={openSignup} className="px-8 py-3.5 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg hover:bg-[#0a7539] transition-colors glow-accent">Start Free</button>
            <a href="#product" className="flex items-center gap-2 px-8 py-3.5 text-[#E5E5E5] text-sm font-medium tracking-[0.04em] uppercase border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 transition-colors"><Play className="w-4 h-4" />See the product</a>
          </div>
          <p className="text-xs text-[#737373] mt-4">No credit card required. Free forever plan available. Not a bank. Not investment advice. <button onClick={openLogin} className="text-[#0C8B44] hover:text-[#00E676] underline-offset-4 hover:underline transition-colors">Already have an account? Sign in</button></p>
        </div>
      </section>

      <section className="py-12 md:py-20 px-6 border-y border-[#ffffff08]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center">
            {platformStats.map((stat, i) => (
              <div key={`${stat.label}-${i}`} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center mx-auto mb-4"><stat.icon className="w-6 h-6 text-[#0C8B44]" /></div>
                <p className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">{stat.value}</p>
                <p className="text-sm text-[#737373] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {tickerCoins.length > 0 && (
        <section className="border-b border-[#ffffff08] bg-[#0a0f11] py-3 sm:py-4">
          <style>{`
            @keyframes marketMarquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .market-marquee-track {
              min-width: max-content;
              width: max-content;
              animation: marketMarquee 26s linear infinite;
              will-change: transform;
            }
            @media (max-width: 767px) {
              .market-marquee-track { animation-duration: 22s; }
            }
          `}</style>
          <div className="overflow-x-auto overflow-y-hidden" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="market-marquee-track flex items-center gap-4 px-4 py-3 sm:px-5">
              {[...tickerCoins, ...tickerCoins].map((coin, index) => (
                <TickerItem key={`${coin.id}-${index}`} coin={coin} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-b border-[#ffffff08] bg-[#091113] py-8 md:py-10">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="flex flex-col items-center justify-center gap-4 md:gap-6 text-center">
            <p className="text-[10px] md:text-xs font-medium uppercase tracking-[0.18em] text-[#8B9AA3]">Trusted partners</p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 md:gap-4">
              {trustedPartners.map((partner) => (
                <div key={partner.name} className="flex h-14 md:h-16 items-center justify-center px-0.5 md:px-1">
                  <img
                    src={partner.src}
                    alt={partner.name}
                    className={['partner-logo', partner.white ? 'partner-logo--white' : '', 'h-8 md:h-10 w-auto object-contain', partner.className ?? 'max-w-[140px]'].join(' ')}
                    onError={(event) => { const image = event.currentTarget as HTMLImageElement; image.style.display = 'none' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 md:py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Platform</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Built for modern investors who want control and clarity.</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">Everything you need to monitor progress, set goals, and keep your finances under one roof.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {audienceItems.map((item) => (
              <div key={item.title} className="p-6 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05]">
                <h3 className="text-lg font-medium text-[#E5E5E5] mb-2">{item.title}</h3>
                <p className="text-sm text-[#A0A0A0] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureItems.map((feature) => (
              <div key={feature.title} className="p-8 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 bg-[#0C8B44]/10"><feature.icon className="w-7 h-7 text-[#0C8B44]" /></div>
                <h3 className="text-xl font-medium text-[#E5E5E5] mb-3">{feature.title}</h3>
                <p className="text-sm text-[#A0A0A0] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-16 md:py-24 px-6 bg-[#070C0E]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">How it works</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">From signup to your first deposit.</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">Three steps. No bank paperwork on day one.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {howItWorks.map((item) => (
              <div key={item.step} className="p-8 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05]">
                <p className="text-xs tracking-[0.14em] uppercase text-[#0C8B44] mb-4">{item.step}</p>
                <h3 className="text-xl font-medium text-[#E5E5E5] mb-3">{item.title}</h3>
                <p className="text-sm text-[#A0A0A0] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="product" className="py-16 md:py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Product</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">See the workspace before you sign up.</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">Wallets and market context on the go.</p>
          </div>
          <div className="flex justify-center">
            <div
              className="relative w-full max-w-[280px] sm:max-w-[320px] rounded-[2rem] overflow-hidden border border-[#ffffff12] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 20%, rgba(12,139,68,0.18) 0%, rgba(15,22,25,0.95) 55%, rgba(10,15,17,1) 100%)',
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0C8B44]/10 via-transparent to-transparent" />
              <img
                src="https://litter.catbox.moe/02h5s4.webp"
                alt="Verdexis mobile app in hand"
                className="relative z-[1] w-full h-auto object-contain object-center bg-transparent"
              />
            </div>
          </div>
        </div>
      </section>

      <Testimonials onSignInRequired={openLogin} />

      <section className="py-16 md:py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-16 items-center">
            <div>
              <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Security</span>
              <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">Institutional-grade protection for your finances.</h2>
              <p className="text-[#A0A0A0] mb-8 leading-relaxed">Your accounts and data are protected with strong controls and standard practices designed for reliability.</p>
              <div className="space-y-4">
                {securityItems.map((item) => (
                  <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                    <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/10 flex items-center justify-center shrink-0"><item.icon className="w-5 h-5 text-[#0C8B44]" /></div>
                    <div><p className="text-sm font-medium text-[#E5E5E5]">{item.title}</p><p className="text-xs text-[#737373]">{item.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border border-[#ffffff08]">
              <img src="/assets/showcase-team.jpg" alt="Team collaborating on financial decisions" className="w-full h-[420px] object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 md:py-24 px-6 bg-[#070C0E]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Pricing</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Start free. Upgrade only if you need more.</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">The core wallet, deposits, transfers, and tracking stay on the free plan.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {planItems.map((plan) => (
              <div key={plan.name} className={`p-8 rounded-2xl border ${plan.featured ? 'border-[#0C8B44]/40 bg-[#0C8B44]/5' : 'border-[#ffffff08] bg-[#0f1619]/50'}`}>
                <p className="text-sm text-[#A0A0A0]">{plan.name}</p>
                <p className="text-3xl font-light text-[#E5E5E5] mt-2">{plan.price}</p>
                <p className="text-xs text-[#737373] mt-1">{plan.detail}</p>
                <ul className="mt-6 space-y-2">
                  {plan.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-[#A0A0A0]">
                      <CheckCircle className="w-4 h-4 text-[#0C8B44] shrink-0 mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={openSignup} className={`mt-8 w-full px-6 py-3 rounded-lg text-sm font-medium tracking-[0.04em] uppercase ${plan.featured ? 'bg-[#0C8B44] text-white hover:bg-[#0a7539]' : 'border border-[#ffffff15] text-[#E5E5E5] hover:border-[#0C8B44]/30'}`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#737373] max-w-2xl mx-auto text-center mt-8 leading-relaxed">
            Verdexis is not a bank and does not provide investment, tax, or legal advice. Balances, fees, and market prices are estimates for informational purposes. Crypto transfers can be irreversible. Review the{' '}
            <Link to="/risk-disclosure" className="text-[#0C8B44] hover:underline">risk disclosure</Link>
            {' '}and{' '}
            <Link to="/terms" className="text-[#0C8B44] hover:underline">terms</Link>
            {' '}before you move funds.
          </p>
        </div>
      </section>

      <section id="faq" className="py-16 md:py-24 px-6 bg-[#070C0E]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">FAQ</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Common questions answered.</h2>
            <p className="text-[#A0A0A0]">Everything you need to know before starting with Verdexis.</p>
          </div>
          <div className="space-y-3">
            {faqItems.map((item) => (
              <article key={item.q} className="p-5 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-medium text-[#E5E5E5]">{item.q}</h3>
                  <ChevronRight className="w-4 h-4 text-[#0C8B44] flex-shrink-0 mt-0.5" />
                </div>
                <p className="text-sm text-[#A0A0A0] mt-3 leading-relaxed">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="liquid-card p-8 md:p-12 lg:p-16 text-center relative overflow-hidden" style={{ '--fill-color': 'rgba(12,139,68,0.08)' } as React.CSSProperties}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(rgba(12,139,68,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Ready to simplify your finances?</h2>
              <p className="text-[#A0A0A0] max-w-xl mx-auto mb-8">Sign up to start tracking your accounts, securing your data, and staying organized with one clear financial workspace.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={openSignup} className="px-8 py-3.5 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg hover:bg-[#0a7539] transition-colors glow-accent">Get Started Free</button>
                <a href="#faq" className="flex items-center gap-2 px-8 py-3.5 text-[#E5E5E5] text-sm font-medium tracking-[0.04em] uppercase border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 hover:text-[#0C8B44] transition-colors">View FAQ</a>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8 text-xs text-[#737373]">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-[#0C8B44]" />No credit card required</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-[#0C8B44]" />Free forever plan available</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-[#0C8B44]" />Secure account protections</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
