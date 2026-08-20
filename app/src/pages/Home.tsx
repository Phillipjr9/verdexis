import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import AuthModal from '../components/AuthModal'
import { HAND_PHONE_IMAGE } from '../assets/handPhoneImage'

export default function Home() {
  const isAuthed = (() => {
    try {
      return !!localStorage.getItem('verdexis_token') || (!!localStorage.getItem('verdexis_auth') && !!localStorage.getItem('verdexis_holdings'))
    } catch {
      return false
    }
  })()
  const [authOpen, setAuthOpen] = useState(false)
  if (isAuthed) return <Navigate to="/dashboard" replace />
  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultMode="signup" />
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl md:text-6xl font-light tracking-[-0.04em] text-[#E5E5E5] mb-4">Multiply Your Wealth.</h1>
        <p className="text-lg text-[#A0A0A0] max-w-lg mx-auto mb-8">A simpler way to understand your money and move forward with confidence.</p>
        <button onClick={() => setAuthOpen(true)} className="px-8 py-3.5 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg hover:bg-[#0a7539] transition-colors">Start Free</button>
      </section>
      <section id="product" className="py-16 px-6 bg-[#0a0f11]">
        <div className="max-w-[480px] mx-auto">
          <img
            src={HAND_PHONE_IMAGE}
            alt="Verdexis mobile app in hand"
            width={360}
            height={366}
            loading="lazy"
            decoding="async"
            className="w-full h-auto object-contain drop-shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
          />
        </div>
      </section>
      <Footer />
    </div>
  )
}
