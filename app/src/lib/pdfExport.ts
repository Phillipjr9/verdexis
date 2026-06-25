// Professional PDF export utility with bank-statement styling
// Includes company branding, contact info, and professional formatting

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

function getCompanyHeader() {
  return `
    <div class="company-header">
      <div class="logo-section">
        <div class="logo-icon">V</div>
        <div class="company-name">VERDEXIS</div>
      </div>
      <div class="company-details">
        <div class="company-tagline">Premium Fintech Platform</div>
        <div class="contact-info">
          <div><strong>Web:</strong> https://verdexis.com</div>
          <div><strong>Email:</strong> support@verdexis.com</div>
          <div><strong>Phone:</strong> +1 (719) 679-8790</div>
        </div>
      </div>
    </div>
  `
}

function getFooter() {
  const year = new Date().getFullYear()
  return `
    <div class="footer">
      <div class="footer-content">
        <div class="footer-section">
          <p class="footer-heading">Disclaimer</p>
          <p class="footer-text">This report is for informational purposes only and does not constitute financial, investment, tax, or legal advice. 
          Please consult with qualified professionals before making financial decisions.</p>
        </div>
        <div class="footer-section">
          <p class="footer-heading">Company Information</p>
          <p class="footer-text">
            VERDEXIS Financial Platform<br>
            Document Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}<br>
            Document ID: ${generateDocumentId()}
          </p>
        </div>
      </div>
      <div class="footer-copyright">
        <p>© ${year} VERDEXIS. All rights reserved. | Confidential Account Statement</p>
      </div>
    </div>
  `
}

function generateDocumentId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `VRD-${timestamp}-${random}`
}

export function generateTransactionsPDF(transactions: TransactionData[], filename: string) {
  const totalDeposits = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  const totalWithdrawals = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const netActivity = totalDeposits - totalWithdrawals
  
  const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VERDEXIS Transaction Statement</title>
  <style>
    @page { margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
      color: #1a1a1a;
      background: white;
      line-height: 1.5;
    }
    .page {
      padding: 40px 50px;
      max-width: 210mm;
      margin: 0 auto;
      background: white;
    }
    
    /* Company Header */
    .company-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 0 30px 0;
      border-bottom: 3px solid #0C8B44;
      margin-bottom: 30px;
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #0C8B44 0%, #0a7539 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 700;
      border-radius: 8px;
    }
    .company-name {
      font-size: 32px;
      font-weight: 300;
      color: #0C8B44;
      letter-spacing: -0.02em;
    }
    .company-details {
      text-align: right;
    }
    .company-tagline {
      font-size: 11px;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 10px;
    }
    .contact-info {
      font-size: 10px;
      color: #555;
      line-height: 1.6;
    }
    .contact-info strong {
      color: #333;
    }
    
    /* Document Title */
    .document-title {
      text-align: center;
      margin: 30px 0;
    }
    .document-title h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    .document-title .subtitle {
      font-size: 12px;
      color: #737373;
    }
    
    /* Statement Period */
    .statement-period {
      background: #f8f9fa;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .period-info {
      font-size: 11px;
      color: #555;
    }
    .period-info strong {
      color: #1a1a1a;
      font-weight: 600;
    }
    
    /* Summary Box */
    .summary-box {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .summary-item {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    .summary-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #737373;
      margin-bottom: 5px;
    }
    .summary-value {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .summary-value.positive { color: #0C8B44; }
    .summary-value.negative { color: #dc2626; }
    
    /* Transaction Table */
    .table-container {
      margin: 30px 0;
    }
    .section-heading {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #0C8B44;
    }
    table { 
      width: 100%; 
      border-collapse: collapse;
      font-size: 10px;
    }
    thead {
      background: #070C0E;
      color: white;
    }
    th { 
      padding: 12px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    th:last-child { text-align: right; }
    tbody tr {
      border-bottom: 1px solid #e8e8e8;
    }
    tbody tr:nth-child(even) {
      background: #fafafa;
    }
    tbody tr:hover {
      background: #f5f5f5;
    }
    td { 
      padding: 12px 10px;
      color: #333;
      vertical-align: top;
    }
    td:last-child { 
      text-align: right;
      font-weight: 600;
    }
    .amount-positive { color: #0C8B44; }
    .amount-negative { color: #dc2626; }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .status-completed { background: #d1fae5; color: #065f46; }
    .status-pending { background: #fed7aa; color: #92400e; }
    .status-failed { background: #fee; color: #991b1b; }
    .description-cell {
      max-width: 250px;
      word-wrap: break-word;
      font-size: 10px;
      color: #555;
    }
    
    /* Footer */
    .footer {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid #e0e0e0;
      page-break-inside: avoid;
    }
    .footer-content {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 30px;
      margin-bottom: 20px;
    }
    .footer-section {
      font-size: 9px;
      color: #555;
    }
    .footer-heading {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 5px;
      font-size: 10px;
    }
    .footer-text {
      line-height: 1.6;
    }
    .footer-copyright {
      text-align: center;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
      font-size: 9px;
      color: #737373;
    }
    
    /* Print Styles */
    @media print {
      .page { padding: 30px; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${getCompanyHeader()}
    
    <div class="document-title">
      <h1>Account Transaction Statement</h1>
      <div class="subtitle">Detailed Activity Report</div>
    </div>
    
    <div class="statement-period">
      <div class="period-info">
        <strong>Statement Period:</strong> ${transactions.length > 0 ? new Date(transactions[0].date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'} - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
      <div class="period-info">
        <strong>Total Transactions:</strong> ${transactions.length}
      </div>
    </div>
    
    <div class="summary-box">
      <div class="summary-item">
        <div class="summary-label">Total Deposits</div>
        <div class="summary-value positive">$${totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Total Withdrawals</div>
        <div class="summary-value negative">$${totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Net Activity</div>
        <div class="summary-value ${netActivity >= 0 ? 'positive' : 'negative'}">$${netActivity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    </div>
    
    <div class="table-container">
      <h2 class="section-heading">Transaction Details</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Currency</th>
            <th>Status</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(t => {
            const amount = Math.abs(t.amount)
            const sign = t.amount >= 0 ? '+' : '-'
            const statusClass = t.status === 'completed' ? 'status-completed' : t.status === 'pending' ? 'status-pending' : 'status-failed'
            const amountClass = t.amount >= 0 ? 'amount-positive' : 'amount-negative'
            return `
              <tr>
                <td>${new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td style="text-transform: capitalize;">${t.type}</td>
                <td class="description-cell">${t.description}</td>
                <td>${t.currency}</td>
                <td><span class="status-badge ${statusClass}">${t.status}</span></td>
                <td class="${amountClass}">${sign}$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
    
    ${getFooter()}
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
    @page { margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
      color: #1a1a1a;
      background: white;
      line-height: 1.5;
    }
    .page {
      padding: 40px 50px;
      max-width: 210mm;
      margin: 0 auto;
      background: white;
    }
    
    /* Company Header */
    .company-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 0 30px 0;
      border-bottom: 3px solid #0C8B44;
      margin-bottom: 30px;
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #0C8B44 0%, #0a7539 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 700;
      border-radius: 8px;
    }
    .company-name {
      font-size: 32px;
      font-weight: 300;
      color: #0C8B44;
      letter-spacing: -0.02em;
    }
    .company-details {
      text-align: right;
    }
    .company-tagline {
      font-size: 11px;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 10px;
    }
    .contact-info {
      font-size: 10px;
      color: #555;
      line-height: 1.6;
    }
    .contact-info strong {
      color: #333;
    }
    
    /* Document Title */
    .document-title {
      text-align: center;
      margin: 30px 0;
    }
    .document-title h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    .document-title .subtitle {
      font-size: 12px;
      color: #737373;
    }
    .tax-year {
      display: inline-block;
      background: #0C8B44;
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-top: 10px;
    }
    
    /* Tax Summary */
    .tax-summary {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 2px solid #0C8B44;
      border-radius: 12px;
      padding: 25px;
      margin: 30px 0;
    }
    .summary-heading {
      font-size: 16px;
      font-weight: 600;
      color: #0C8B44;
      margin-bottom: 20px;
      text-align: center;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    .summary-item {
      text-align: center;
      padding: 15px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    .summary-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #737373;
      margin-bottom: 8px;
    }
    .summary-amount {
      font-size: 24px;
      font-weight: 700;
    }
    .gain { color: #0C8B44; }
    .loss { color: #dc2626; }
    .net-result {
      text-align: center;
      padding: 20px;
      background: white;
      border-radius: 8px;
      border: 2px solid #0C8B44;
    }
    .net-label {
      font-size: 12px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 10px;
    }
    .net-amount {
      font-size: 36px;
      font-weight: 700;
    }
    
    /* Trade Details Table */
    .table-container {
      margin: 40px 0;
    }
    .section-heading {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #0C8B44;
    }
    table { 
      width: 100%; 
      border-collapse: collapse;
      font-size: 9px;
    }
    thead {
      background: #070C0E;
      color: white;
    }
    th { 
      padding: 10px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    th:last-child { text-align: right; }
    tbody tr {
      border-bottom: 1px solid #e8e8e8;
    }
    tbody tr:nth-child(even) {
      background: #fafafa;
    }
    td { 
      padding: 10px 6px;
      color: #333;
    }
    td:last-child { 
      text-align: right;
      font-weight: 600;
    }
    
    /* Tax Notice */
    .tax-notice {
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
    }
    .notice-icon {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .notice-heading {
      font-size: 14px;
      font-weight: 600;
      color: #856404;
      margin-bottom: 10px;
    }
    .notice-text {
      font-size: 11px;
      color: #856404;
      line-height: 1.6;
    }
    
    /* Footer */
    .footer {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid #e0e0e0;
      page-break-inside: avoid;
    }
    .footer-content {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 30px;
      margin-bottom: 20px;
    }
    .footer-section {
      font-size: 9px;
      color: #555;
    }
    .footer-heading {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 5px;
      font-size: 10px;
    }
    .footer-text {
      line-height: 1.6;
    }
    .footer-copyright {
      text-align: center;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
      font-size: 9px;
      color: #737373;
    }
    
    @media print {
      .page { padding: 30px; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${getCompanyHeader()}
    
    <div class="document-title">
      <h1>Annual Capital Gains Tax Report</h1>
      <div class="subtitle">For Tax Year</div>
      <div class="tax-year">${data.year}</div>
    </div>
    
    <div class="tax-summary">
      <div class="summary-heading">Capital Gains Summary</div>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">Total Gains</div>
          <div class="summary-amount gain">$${data.totalGains.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Total Losses</div>
          <div class="summary-amount loss">$${Math.abs(data.totalLosses).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Number of Trades</div>
          <div class="summary-amount" style="color: #1a1a1a;">${data.trades.length}</div>
        </div>
      </div>
      <div class="net-result">
        <div class="net-label">Net Capital Gain/Loss</div>
        <div class="net-amount ${data.netGains >= 0 ? 'gain' : 'loss'}">
          ${data.netGains >= 0 ? '+' : ''}$${data.netGains.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
    
    <div class="tax-notice">
      <div class="notice-icon">⚠️</div>
      <div class="notice-heading">Important Tax Notice</div>
      <div class="notice-text">
        This report provides a summary of your trading activity for tax purposes. However, it should NOT be used as your sole 
        source for tax filing. Please consult with a qualified Certified Public Accountant (CPA) or tax professional to ensure 
        accurate reporting on your tax returns. Tax regulations vary by jurisdiction, and professional guidance is recommended.
      </div>
    </div>
    
    <div class="table-container">
      <h2 class="section-heading">Detailed Trade History</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Symbol</th>
            <th>Side</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Cost Basis</th>
            <th>Proceeds</th>
            <th>Gain/Loss</th>
          </tr>
        </thead>
        <tbody>
          ${data.trades.map(t => {
            const gainLossClass = t.gainLoss >= 0 ? 'gain' : 'loss'
            return `
              <tr>
                <td>${new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td><strong>${t.symbol}</strong></td>
                <td style="text-transform: uppercase;">${t.side}</td>
                <td>${t.quantity.toFixed(4)}</td>
                <td>$${t.price.toFixed(2)}</td>
                <td>$${t.costBasis.toFixed(2)}</td>
                <td>$${t.proceeds.toFixed(2)}</td>
                <td class="${gainLossClass}">${t.gainLoss >= 0 ? '+' : ''}$${t.gainLoss.toFixed(2)}</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>
    
    ${getFooter()}
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
