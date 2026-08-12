interface AuditTrailData {
  trades: Array<{
    type: string;
    date: string;
    symbol: string;
    side: string;
    amount: number;
    price: number;
    total: number;
    hash: string;
  }>;
  transactions: Array<{
    type: string;
    date: string;
    kind: string;
    currency: string;
    amount: number;
    status: string;
    reference: string;
  }>;
  audits: Array<{
    type: string;
    date: string;
    action: string;
    details?: string;
  }>;
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
  const docId = `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  return `
    <div class="footer">
      <div class="footer-content">
        <div class="footer-section">
          <p class="footer-heading">Confidentiality Notice</p>
          <p class="footer-text">
            This audit trail is provided for compliance and record-keeping purposes only. All transactions are recorded with 
            cryptographic references for verification. This document contains confidential account information and should be 
            stored securely. For regulatory inquiries or additional documentation, please contact VERDEXIS Support.
          </p>
        </div>
        <div class="footer-section">
          <p class="footer-heading">Document Information</p>
          <p class="footer-text">
            <strong>Document ID:</strong> ${docId}<br>
            <strong>Generated:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}<br>
            <strong>Type:</strong> Compliance Audit Report
          </p>
        </div>
      </div>
      <div class="footer-copyright">
        <p>© ${year} VERDEXIS. All rights reserved. | Confidential Account Statement</p>
      </div>
    </div>
  `
}

export async function generateAuditTrailPDF(data: AuditTrailData) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <!-- Google tag (gtag.js) -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18384264054"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);} 
        gtag('js', new Date());

        gtag('config', 'AW-18384264054');
      </script>
      <meta charset="UTF-8">
      <title>VERDEXIS Audit Trail</title>
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
        
        /* Section */
        .section {
          margin: 40px 0;
        }
        .section-heading {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #0C8B44;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .section-icon {
          font-size: 18px;
        }
        
        /* Tables */
        table { 
          width: 100%; 
          border-collapse: collapse;
          font-size: 10px;
          margin-top: 15px;
        }
        thead {
          background: #070C0E;
          color: white;
        }
        th { 
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
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
          padding: 10px 8px;
          color: #333;
          vertical-align: top;
        }
        .buy { 
          color: #0C8B44; 
          font-weight: 600;
          text-transform: uppercase;
        }
        .sell { 
          color: #f44336; 
          font-weight: 600;
          text-transform: uppercase;
        }
        .hash { 
          font-family: 'Courier New', monospace; 
          font-size: 8px; 
          color: #666;
          word-break: break-all;
          max-width: 150px;
        }
        .status {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          display: inline-block;
        }
        .status.completed { background: #d1fae5; color: #065f46; }
        .status.pending { background: #fed7aa; color: #92400e; }
        .status.failed { background: #fee2e2; color: #991b1b; }
        
        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin: 20px 0 30px 0;
        }
        .stat-card {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        }
        .stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #737373;
          margin-bottom: 5px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #0C8B44;
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
          body { margin: 0; }
          .page { padding: 30px; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        ${getCompanyHeader()}
        
        <div class="document-title">
          <h1>Complete Account Audit Trail</h1>
          <div class="subtitle">Comprehensive Activity & Compliance Report</div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Trades</div>
            <div class="stat-value">${data.trades.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Transactions</div>
            <div class="stat-value">${data.transactions.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Audit Events</div>
            <div class="stat-value">${data.audits.length}</div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-heading">
            <span class="section-icon">📊</span>
            Trade History
          </h2>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Amount</th>
                <th>Price</th>
                <th>Total Value</th>
                <th>Reference Hash</th>
              </tr>
            </thead>
            <tbody>
              ${data.trades.map(t => `
                <tr>
                  <td>${new Date(t.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${t.symbol}</strong></td>
                  <td class="${t.side}">${t.side}</td>
                  <td>${t.amount.toFixed(8)}</td>
                  <td>$${t.price.toFixed(2)}</td>
                  <td>$${t.total.toFixed(2)}</td>
                  <td class="hash">${t.hash}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2 class="section-heading">
            <span class="section-icon">💳</span>
            Transaction History
          </h2>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Currency</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              ${data.transactions.map(tx => `
                <tr>
                  <td>${new Date(tx.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style="text-transform: capitalize;">${tx.kind}</td>
                  <td><strong>${tx.currency}</strong></td>
                  <td>${tx.amount.toFixed(2)}</td>
                  <td><span class="status ${tx.status}">${tx.status}</span></td>
                  <td class="hash">${tx.reference}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${data.audits.length > 0 ? `
          <div class="section">
            <h2 class="section-heading">
              <span class="section-icon">🔒</span>
              Account Activity Log
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${data.audits.map(a => `
                  <tr>
                    <td>${new Date(a.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>${a.action}</strong></td>
                    <td>${a.details || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${getFooter()}
      </div>
    </body>
    </html>
  `;

  // Open print dialog with generated HTML
  const printWindow = window.open('', '', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
