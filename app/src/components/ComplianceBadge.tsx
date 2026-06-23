import { Shield, Lock, CheckCircle } from 'lucide-react';

export default function ComplianceBadge() {
  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-emerald-900/50 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="text-2xl">
          <Shield className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            Your Account is Protected
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-slate-300">
                <strong>FDIC Insurance</strong> up to $250,000 (USD deposits)
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-slate-300">
                <strong>Crypto Insurance</strong> via Fireblocks & BitGo
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-slate-300">
                <strong>SOC 2 Type II Compliant</strong> - Enterprise security standard
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span className="text-slate-300">
                <strong>Bank-level encryption</strong> for all transactions
              </span>
            </div>
          </div>
          
          <a
            href="/legal/insurance"
            className="text-emerald-400 hover:text-emerald-300 text-sm mt-3 inline-block transition-colors"
          >
            View Insurance Policy Details →
          </a>
        </div>
      </div>
    </div>
  );
}
