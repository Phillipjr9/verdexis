// PDF Export utility using simple HTML canvas rendering
// For production, consider using jsPDF or pdfmake for richer formatting

interface TransactionData {
  date: string
  type: string
  amount: number
  currency: string
  description: string
  status: string
}

interface TaxReportData {
  year: number
  totalGains: number
  totalLosses: number
  netGains: number
  trades: Array<{
    date: string
    symbol: string
    side: string
    quantity: number
    price: number
    costBasis: number
    proceeds: number
    gainLoss: number
  }>
}

export function generateTransactionsPDF(transactions: TransactionData[], filename: string) {
  const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VERDEXIS Transactions Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; color: #1a1a1a; }
    .header { border-bottom: 3px solid #0C8B44; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #0C8B44; margin: 0; font-size: 32px; }
    .header p { color: #737373; margin: 5px 0 0 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    tr:hover { background: #fafafa; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #737373; }
  </style>
</head>
<body>
  <div class="header">
    <h1>VERDEXIS</h1>
    <p>Transaction Report · Generated ${new Date().toLocaleDateString()}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Amount</th>
        <th>Currency</th>
        <th>Description</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${transactions.map(t => `
        <tr>
          <td>${new Date(t.date).toLocaleDateString()}</td>
          <td>${t.type}</td>
          <td>$${t.amount.toFixed(2)}</td>
          <td>${t.currency}</td>
          <td>${t.description}</td>
          <td>${t.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="footer">
    <p>This report is for informational purposes only. Consult with a tax professional for tax advice.</p>
    <p>VERDEXIS · Premium Fintech Platform</p>
  </div>
</body>
</html>
  `

  printPDF(content, filename)
}

export function generateTaxReportPDF(data: TaxReportData, filename: string) {
  const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VERDEXIS Tax Report ${data.year}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; color: #1a1a1a; }
    .header { border-bottom: 3px solid #0C8B44; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #0C8B44; margin: 0; font-size: 32px; }
    .header p { color: #737373; margin: 5px 0 0 0; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary-item { display: flex; justify-content: space-between; padding: 8px 0; }
    .summary-item strong { font-weight: 600; }
    .net-gains { font-size: 24px; color: ${data.netGains >= 0 ? '#0C8B44' : '#dc2626'}; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { background: #f5f5f5; padding: 10px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
    td { padding: 8px; border-bottom: 1px solid #eee; }
    tr:hover { background: #fafafa; }
    .gain { color: #0C8B44; }
    .loss { color: #dc2626; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #737373; }
  </style>
</head>
<body>
  <div class="header">
    <h1>VERDEXIS</h1>
    <p>Tax Report ${data.year} · Generated ${new Date().toLocaleDateString()}</p>
  </div>
  
  <div class="summary">
    <h2 style="margin: 0 0 15px 0; font-size: 18px;">Capital Gains Summary</h2>
    <div class="summary-item">
      <span>Total Gains:</span>
      <strong class="gain">$${data.totalGains.toFixed(2)}</strong>
    </div>
    <div class="summary-item">
      <span>Total Losses:</span>
      <strong class="loss">$${Math.abs(data.totalLosses).toFixed(2)}</strong>
    </div>
    <div class="summary-item" style="border-top: 2px solid #ddd; padding-top: 12px; margin-top: 8px;">
      <span><strong>Net Capital Gain/Loss:</strong></span>
      <strong class="net-gains">$${data.netGains.toFixed(2)}</strong>
    </div>
  </div>
  
  <h3>Trade Details</h3>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Symbol</th>
        <th>Side</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Cost Basis</th>
        <th>Proceeds</th>
        <th>Gain/Loss</th>
      </tr>
    </thead>
    <tbody>
      ${data.trades.map(t => `
        <tr>
          <td>${new Date(t.date).toLocaleDateString()}</td>
          <td>${t.symbol}</td>
          <td>${t.side}</td>
          <td>${t.quantity}</td>
          <td>$${t.price.toFixed(2)}</td>
          <td>$${t.costBasis.toFixed(2)}</td>
          <td>$${t.proceeds.toFixed(2)}</td>
          <td class="${t.gainLoss >= 0 ? 'gain' : 'loss'}">$${t.gainLoss.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="footer">
    <p><strong>Disclaimer:</strong> This report is for informational purposes only and should not be considered tax advice. 
    Consult with a qualified tax professional or CPA before filing. VERDEXIS does not provide tax, legal, or accounting advice.</p>
    <p>VERDEXIS · Premium Fintech Platform · https://verdexis.com</p>
  </div>
</body>
</html>
  `

  printPDF(content, filename)
}

function printPDF(htmlContent: string, filename: string) {
  // Create iframe for printing
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  
  document.body.appendChild(iframe)
  
  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Failed to create print document')
  }
  
  doc.open()
  doc.write(htmlContent)
  doc.close()
  
  // Wait for content to load, then print
  iframe.contentWindow?.addEventListener('load', () => {
    setTimeout(() => {
      iframe.contentWindow?.print()
      // Clean up after a delay
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }, 250)
  })
}
