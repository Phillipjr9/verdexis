import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { ArrowRight, BarChart3, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'

const products = [
  {
    name: 'Liquid ETH staking',
    asset: 'ETH',
    provider: 'Lido / Rocket Pool',
    detail: 'Stake ETH while retaining a liquid position for portfolio management.',
    risk: 'Low',
  },
  {
    name: 'SOL staking',
    asset: 'SOL',
    provider: 'Marinade',
    detail: 'Access delegated Solana staking with epoch-based reward distribution.',
    risk: 'Low',
  },
  {
    name: 'Stablecoin lending',
    asset: 'USDC / USDT',
    provider: 'Aave v3 / Compound v3',
    detail: 'Supply supported stablecoins to lending markets with variable rates.',
    risk: 'Medium',
  },
]

export default function Products() {
  return (
    <div className="min-h-screen bg-[#070C0E] text-[#E5E5E5]">
      <Navigation />
      <main className="px-6 pb-20 pt-28">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-14 max-w-2xl">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-[#0C8B44]">Products</p>
            <h1 className="mb-5 text-4xl font-light leading-tight tracking-[-0.03em] md:text-6xl">
              Put your assets to work, with the risks in view.
            </h1>
            <p className="leading-relaxed text-[#A0A0A0]">
              Verdexis currently offers staking and lending products through the authenticated app.
              Rates, availability, lockups, and network conditions can change; review the live terms
              before opening a position.
            </p>
          </div>

          <div className="mb-14 grid gap-4 md:grid-cols-3">
            {products.map((product) => (
              <article key={product.name} className="glass-card flex flex-col p-6">
                <div className="mb-6 flex items-center justify-between">
                  <span className="rounded-full border border-[#0C8B44]/30 px-3 py-1 text-xs text-[#69D391]">
                    {product.asset}
                  </span>
                  <span className="text-xs text-[#737373]">{product.risk} risk profile</span>
                </div>
                <h2 className="mb-2 text-xl font-medium">{product.name}</h2>
                <p className="mb-4 text-sm leading-relaxed text-[#A0A0A0]">{product.detail}</p>
                <p className="mt-auto border-t border-[#ffffff10] pt-4 text-xs text-[#737373]">
                  Available through {product.provider}
                </p>
              </article>
            ))}
          </div>

          <section className="liquid-card grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10" style={{ '--fill-color': 'rgba(12,139,68,0.1)' } as React.CSSProperties}>
            <div>
              <div className="mb-5 flex flex-wrap gap-5 text-sm text-[#A0A0A0]">
                <span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#0C8B44]" />Live rate and position view</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#0C8B44]" />Risk disclosures included</span>
                <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#0C8B44]" />Ledger-backed balances</span>
              </div>
              <h2 className="mb-2 text-2xl font-light">Explore live availability</h2>
              <p className="max-w-xl text-sm leading-relaxed text-[#A0A0A0]">
                Open the staking workspace to review available products, current rates, balances,
                and position controls. No product is opened from this public page.
              </p>
            </div>
            <Link to="/staking" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#0C8B44] px-5 py-3 text-sm text-white transition-colors hover:bg-[#00A854]">
              View in app <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <div className="mt-10 flex items-center gap-2 text-sm text-[#737373]">
            <Sparkles className="h-4 w-4 text-[#0C8B44]" />
            See <Link to="/disclosures" className="text-[#69D391] hover:underline">risk disclosures</Link> before making an investment decision.
          </div>
        </div>
      </main>
    </div>
  )
}
