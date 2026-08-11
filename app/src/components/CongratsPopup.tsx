import { useEffect } from 'react'

export default function CongratsPopup({ visible, onClose, address }: { visible: boolean; onClose: () => void; address?: string | null }) {
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => onClose(), 3200)
    return () => clearTimeout(t)
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .cp-scale { animation: none !important; }
          .cp-check { animation: none !important; }
        }
        @keyframes cp-scale { 0% { transform: scale(.92); opacity: 0 } 60% { transform: scale(1.02); opacity: 1 } 100% { transform: scale(1); opacity: 1 }}
        @keyframes cp-check { 0% { stroke-dashoffset: 24 } 60% { stroke-dashoffset: 6 } 100% { stroke-dashoffset: 0 }}
      `}</style>

      <div className="pointer-events-auto max-w-sm w-full mx-4">
        <div className="bg-[#081018] border border-[#ffffff0d] rounded-xl p-6 text-center shadow-md cp-scale" style={{ animation: 'cp-scale 320ms cubic-bezier(.2,.9,.2,1)' }}>
          <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-[#0C8B44]/10 mb-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="cp-check">
              <circle cx="12" cy="12" r="10" stroke="#10B981" strokeWidth="1" opacity="0.08" />
              <path d="M7 13l3 3 7-7" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: 'cp-check 420ms ease-out 160ms forwards' }} />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-[#E5E5E5]">Wallet Created</h3>
          <p className="text-sm text-[#A0A0A0] mt-2">Your new wallet has been generated.</p>
          {address && <p className="mt-3 font-mono text-sm text-[#E5E5E5] break-all">{address}</p>}
        </div>
      </div>
    </div>
  )
}
