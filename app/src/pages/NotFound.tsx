import { Link, Navigate, useLocation } from 'react-router-dom'
import Navigation from '../components/Navigation'
import PublicInformation from './PublicInformation'
import SignupComplete from './SignupComplete'
import { ArrowLeft, Home, Compass } from 'lucide-react'

const SIGNUP_ALIASES = new Set(['/register', '/auth/signup'])
const PUBLIC_ALIASES = new Set(['/bonus', '/wallet-guide'])

export default function NotFound() {
  const { pathname } = useLocation()
  if (SIGNUP_ALIASES.has(pathname)) {
    return <Navigate to="/signup" replace />
  }
  if (pathname === '/signup/complete') {
    return <SignupComplete />
  }
  if (PUBLIC_ALIASES.has(pathname)) {
    return <PublicInformation />
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-32 pb-16 px-6">
        <div className="max-w-[680px] mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#0C8B44]/10 border border-[#0C8B44]/20 mb-8">
            <Compass className="w-10 h-10 text-[#0C8B44]" />
          </div>
          <p className="text-xs tracking-[0.3em] uppercase text-[#0C8B44] mb-4">404 — Not Found</p>
          <h1 className="text-5xl md:text-6xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">Off the chart.</h1>
          <p className="text-[#A0A0A0] max-w-md mx-auto mb-10 leading-relaxed">The page you are looking for does not exist or was moved.</p>
          <Link to="/signup" className="inline-flex px-6 py-3 bg-[#0C8B44] text-white text-sm rounded-lg">Open Account</Link>
        </div>
      </div>
    </div>
  )
}
