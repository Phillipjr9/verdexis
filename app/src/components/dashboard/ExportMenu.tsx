// Export menu — dropdown that downloads CSVs for trades / holdings /
// transactions. Uses csvExport util.

import { useEffect, useRef, useState } from 'react'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { portfolioStore } from '../../lib/portfolioStore'
import { toCsv, downloadFile } from '../../lib/csvExport'
import { generateTransactionsPDF, generateTaxReportPDF } from '../../lib/pdfExport'

export default function ExportMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const stamp = () => new Date().toISOString().slice(0, 10)

  const exportTrades = () => {
    const rows = portfolioStore.getTrades().map((t) => ({
      date: new Date(t.timestamp).toISOString(),
      symbol: t.symbol,
      name: t.name,
      side: t.side,
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      total: t.total,
    }))
    if (rows.length === 0) { toast.error('No trades to export'); return }
    downloadFile(`verdexis-trades-${stamp()}.csv`, toCsv(rows))
    toast.success(`Exported ${rows.length} trades`)
    setOpen(false)
  }

  const exportHoldings = () => {
    const rows = portfolioStore.getHoldings().map((h) => ({
      symbol: h.symbol,
      name: h.name,
      quantity: h.quantity,
      avgBuyPrice: h.avgBuyPrice,
      currentPrice: h.currentPrice,
      value: h.value,
      pnl: h.pnl,
      pnlPercent: h.pnlPercent,
      allocationPct: h.allocation,
    }))
    if (rows.length === 0) { toast.error('No holdings to export'); return }
    downloadFile(`verdexis-holdings-${stamp()}.csv`, toCsv(rows))
    toast.success(`Exported ${rows.length} holdings`)
    setOpen(false)
  }

  const exportTransactionsPDF = () => {
    const txns = portfolioStore.getTransactions().map((t) => ({
      date: new Date(t.timestamp).toISOString(),
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      status: t.status,
    }))
    if (txns.length === 0) { toast.error('No transactions to export'); return }
    generateTransactionsPDF(txns, `verdexis-transactions-${stamp()}.pdf`)
    toast.success('Opening PDF print dialog...')
    setOpen(false)
  }

  const exportTaxReportPDF = () => {
    const trades = portfolioStore.getTrades()
    const year = new Date().getFullYear()
    
    // Calculate gains/losses (simplified - real tax calc is more complex)
    const tradeData = trades.map(t => {
      const costBasis = t.side === 'buy' ? t.total : 0
      const proceeds = t.side === 'sell' ? t.total : 0
      const gainLoss = proceeds - costBasis
      return {
        date: new Date(t.timestamp).toISOString(),
        symbol: t.symbol,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        costBasis,
        proceeds,
        gainLoss,
      }
    })
    
    const totalGains = tradeData.filter(t => t.gainLoss > 0).reduce((sum, t) => sum + t.gainLoss, 0)
    const totalLosses = tradeData.filter(t => t.gainLoss < 0).reduce((sum, t) => sum + t.gainLoss, 0)
    
    generateTaxReportPDF({
      year,
      totalGains,
      totalLosses,
      netGains: totalGains + totalLosses,
      trades: tradeData,
    }, `verdexis-tax-report-${year}.pdf`)
    
    toast.success('Opening tax report...')
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1a1a]/80 border border-[#ffffff10] text-xs text-[#E5E5E5] hover:border-[#0C8B44]/30 transition-colors"
      >
        <Download className="w-3 h-3" />
        Export
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0f1619] border border-[#ffffff10] shadow-2xl py-1 z-30">
          <div className="px-2 py-1.5 text-[10px] text-[#737373] uppercase tracking-wider">CSV Export</div>
          <button onClick={exportHoldings} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#E5E5E5] hover:bg-[#ffffff05] text-left">
            <FileSpreadsheet className="w-3 h-3 text-[#737373]" />Holdings
          </button>
          <button onClick={exportTrades} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#E5E5E5] hover:bg-[#ffffff05] text-left">
            <FileSpreadsheet className="w-3 h-3 text-[#737373]" />Trades
          </button>
          <button onClick={exportTransactions} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#E5E5E5] hover:bg-[#ffffff05] text-left">
            <FileSpreadsheet className="w-3 h-3 text-[#737373]" />Transactions
          </button>
          <div className="border-t border-[#ffffff08] my-1"></div>
          <div className="px-2 py-1.5 text-[10px] text-[#737373] uppercase tracking-wider">PDF Export</div>
          <button onClick={exportTransactionsPDF} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#E5E5E5] hover:bg-[#ffffff05] text-left">
            <FileText className="w-3 h-3 text-[#737373]" />Transactions Report
          </button>
          <button onClick={exportTaxReportPDF} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#E5E5E5] hover:bg-[#ffffff05] text-left">
            <FileText className="w-3 h-3 text-[#737373]" />Tax Report
          </button>
        </div>
      )}
    </div>
  )
}
