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

export async function generateAuditTrailPDF(data: AuditTrailData) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>VERDEXIS Audit Trail</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
          margin: 20px; 
          color: #333;
          background: white;
        }
        h1 { 
          color: #0C8B44; 
          margin-bottom: 10px;
          font-size: 24px;
        }
        .header {
          border-bottom: 2px solid #0C8B44;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .meta {
          color: #666;
          font-size: 12px;
          margin-bottom: 30px;
        }
        h2 {
          color: #333;
          font-size: 18px;
          margin-top: 30px;
          margin-bottom: 15px;
          padding-bottom: 5px;
          border-bottom: 1px solid #ddd;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 30px;
          font-size: 11px;
        }
        th { 
          background: #070C0E; 
          color: white; 
          padding: 10px 8px; 
          text-align: left;
          font-weight: 600;
        }
        td { 
          padding: 8px; 
          border-bottom: 1px solid #e0e0e0;
        }
        tr:nth-child(even) { 
          background: #f9f9f9; 
        }
        tr:hover {
          background: #f5f5f5;
        }
        .buy { color: #4CAF50; font-weight: 600; }
        .sell { color: #f44336; font-weight: 600; }
        .hash { 
          font-family: 'Courier New', monospace; 
          font-size: 9px; 
          color: #666;
          word-break: break-all;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 11px;
        }
        .status {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
        }
        .status.completed { background: #e8f5e9; color: #2e7d32; }
        .status.pending { background: #fff3e0; color: #e65100; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📋 Account Audit Trail</h1>
        <div class="meta">
          <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
          <strong>Document Type:</strong> Compliance Audit Report<br>
          <strong>Platform:</strong> VERDEXIS Financial Platform
        </div>
      </div>

      <h2>Trade History</h2>
      <table>
        <tr>
          <th>Date</th>
          <th>Symbol</th>
          <th>Side</th>
          <th>Amount</th>
          <th>Price</th>
          <th>Total</th>
          <th>Reference</th>
        </tr>
        ${data.trades.map(t => `
          <tr>
            <td>${new Date(t.date).toLocaleString()}</td>
            <td><strong>${t.symbol}</strong></td>
            <td class="${t.side}">${t.side.toUpperCase()}</td>
            <td>${t.amount.toFixed(8)}</td>
            <td>$${t.price.toFixed(2)}</td>
            <td>$${t.total.toFixed(2)}</td>
            <td class="hash">${t.hash}</td>
          </tr>
        `).join('')}
      </table>

      <h2>Transaction History</h2>
      <table>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Currency</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Reference</th>
        </tr>
        ${data.transactions.map(tx => `
          <tr>
            <td>${new Date(tx.date).toLocaleString()}</td>
            <td>${tx.kind}</td>
            <td><strong>${tx.currency}</strong></td>
            <td>${tx.amount.toFixed(2)}</td>
            <td><span class="status ${tx.status}">${tx.status}</span></td>
            <td class="hash">${tx.reference}</td>
          </tr>
        `).join('')}
      </table>

      ${data.audits.length > 0 ? `
        <h2>Account Activity Log</h2>
        <table>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
          ${data.audits.map(a => `
            <tr>
              <td>${new Date(a.date).toLocaleString()}</td>
              <td><strong>${a.action}</strong></td>
              <td>${a.details || 'N/A'}</td>
            </tr>
          `).join('')}
        </table>
      ` : ''}

      <div class="footer">
        <p><strong>Disclaimer:</strong> This audit trail is provided for compliance and record-keeping purposes only. 
        All transactions are recorded with cryptographic references for verification. For regulatory inquiries or 
        additional documentation, please contact VERDEXIS Support at support@verdexis.com</p>
        <p><strong>Document ID:</strong> AUDIT-${Date.now()}</p>
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
