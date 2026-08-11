import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import AuthModal from '../components/AuthModal'
import Testimonials from '../components/Testimonials'
import ScrambleText from '../components/ScrambleText'
import TetrahedronCanvas from '../components/Tetrahedron'
import { ArrowRight, Shield, ChevronRight, CheckCircle, Play, Lock, Fingerprint, Eye, Server, Globe, Sparkles, Wallet } from 'lucide-react'

const platformStats = [
  { value: 'Unified', label: 'All your accounts', icon: Globe },
  { value: 'Secure', label: 'Encryption first', icon: Shield },
  { value: 'Clear', label: 'Performance signals', icon: Sparkles },
  { value: 'Accessible', label: 'Desktop & mobile', icon: Wallet },
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

const faqItems = [
  { q: 'Is Verdexis free?', a: 'Yes. Verdexis is free to sign up and use, with optional premium upgrades for advanced planning tools.' },
  { q: 'How is my data protected?', a: 'All information is encrypted with AES-256 at rest and TLS 1.3 in transit, and we support two-factor authentication for every account.' },
  { q: 'Can I use Verdexis on mobile?', a: 'Yes. Verdexis is designed to work across desktop and mobile so you can check your finances wherever you are.' },
  { q: 'What support is available?', a: 'Our support team is available through the in-app help center and live chat for account questions and setup assistance.' },
  { q: 'Is Verdexis financial advice?', a: 'No. Verdexis provides insights and analysis to help you make decisions, but it is not a registered investment adviser.' },
]

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
            <a href="#features" className="flex items-center gap-2 px-8 py-3.5 text-[#E5E5E5] text-sm font-medium tracking-[0.04em] uppercase border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 transition-colors"><Play className="w-4 h-4" />See the platform</a>
          </div>
          <p className="text-xs text-[#737373] mt-4">No credit card required. Free forever plan available. <button onClick={openLogin} className="text-[#0C8B44] hover:text-[#00E676] underline-offset-4 hover:underline transition-colors">Already have an account? Sign in</button></p>
        </div>
      </section>

      <section className="py-12 md:py-20 px-6 border-y border-[#ffffff08]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center">
            {platformStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center mx-auto mb-4"><stat.icon className="w-6 h-6 text-[#0C8B44]" /></div>
                <p className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">{stat.value}</p>
                <p className="text-sm text-[#737373] mt-1">{stat.label}</p>
              </div>
            ))}
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

      <section id="faq" className="py-16 md:py-24 px-6 bg-[#070C0E]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">FAQ</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Common questions answered.</h2>
            <p className="text-[#A0A0A0]">Everything you need to know before starting with Verdexis.</p>
          </div>
          <div className="space-y-3">
            {faqItems.map((item) => (
              <details key={item.q} className="group p-5 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-colors">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-[#E5E5E5] list-none">
                  <span>{item.q}</span>
                  <ChevronRight className="w-4 h-4 text-[#0C8B44] transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-sm text-[#A0A0A0] mt-3 leading-relaxed">{item.a}</p>
              </details>
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
