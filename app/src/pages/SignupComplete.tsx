import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { fireSignupConversion } from '../adsConversion'

export default function SignupComplete() {
  useEffect(() => {
    fireSignupConversion('thank-you-page')
  }, [])

  return (
    <div className="min-h-screen bg-[#070C0E] text-[#E5E5E5]">
      <Navigation />
      <main className="pt-28 pb-16 px-6">
        <article className="max-w-lg mx-auto rounded-2xl border border-[#ffffff12] bg-[#0f1619] p-8 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-[#0C8B44] mb-3">Account created</p>
          <h1 className="text-3xl font-light mb-3">Welcome to Verdexis</h1>
          <p className="text-sm text-[#A0A0A0] mb-8">
            Your account is ready. This page is the signup conversion page for ads measurement.
          </p>
          <Link to="/dashboard" className="inline-flex px-5 py-2.5 rounded-lg bg-[#0C8B44] text-white text-sm">
            Open dashboard
          </Link>
        </article>
      </main>
    </div>
  )
}
