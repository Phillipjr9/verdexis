import { prisma } from './db.js'
import { PortfolioService } from './portfolioService.js'
import { sendEmailNotification } from './notificationService.js'
import { customerEmailFooter } from './config/email.js'

interface DigestConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'never'
  includeMetrics: boolean
  includeTrades: boolean
  includeAlerts: boolean
  includeNews: boolean
}

export class EmailDigestService {
  async sendDailyDigest(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!user) return

    const metrics = await PortfolioService.getPortfolioMetrics(userId)
    const holdings = await PortfolioService.getHoldingPerformance(userId)
    const trades = await prisma.trade.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    const alerts = await prisma.priceAlert.findMany({
      where: { userId, active: true },
      take: 5,
    })

    const html = this.generateDigestHTML(user.name, metrics, holdings, trades, alerts)

    await sendEmailNotification(
      user.email,
      `Your VERDEXIS Daily Summary - ${new Date().toLocaleDateString()}`,
      'Your Verdexis daily portfolio summary is ready.',
      html,
      { userId, kind: 'portfolio_digest', title: 'Daily portfolio summary', body: 'Your Verdexis daily portfolio summary is ready.' },
    )

    console.log(`[email-digest] sent to ${user.email}`)
  }

  private generateDigestHTML(
    name: string,
    metrics: Awaited<ReturnType<typeof PortfolioService.getPortfolioMetrics>>,
    holdings: Awaited<ReturnType<typeof PortfolioService.getHoldingPerformance>>,
    trades: Array<{ symbol: string; side: string; amount: number; price: number }>,
    alerts: Array<{ symbol: string; direction: string; target: number }>,
  ): string {
    const topGainers = holdings.filter((h) => h.gainLossPercent > 0).slice(0, 3)
    const topLosers = holdings.filter((h) => h.gainLossPercent < 0).slice(0, 3)

    return `
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
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0C8B44; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .metric { display: inline-block; width: 48%; padding: 10px; background: #f5f5f5; margin: 1%; border-radius: 4px; }
    .positive { color: #0C8B44; }
    .negative { color: #d32f2f; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Hi ${name}! 👋</h1>
      <p>Here's your VERDEXIS portfolio summary for ${new Date().toLocaleDateString()}</p>
    </div>

    <h2>📊 Performance</h2>
    <div>
      <div class="metric">
        <strong>Today</strong>
        <div class="${metrics.dayReturn >= 0 ? 'positive' : 'negative'}">
          ${metrics.dayReturn >= 0 ? '+' : ''}${metrics.dayReturn.toFixed(2)} USD
          (${metrics.dayReturnPercent.toFixed(2)}%)
        </div>
      </div>
      <div class="metric">
        <strong>Month</strong>
        <div class="${metrics.monthReturn >= 0 ? 'positive' : 'negative'}">
          ${metrics.monthReturn >= 0 ? '+' : ''}${metrics.monthReturn.toFixed(2)} USD
          (${metrics.monthReturnPercent.toFixed(2)}%)
        </div>
      </div>
      <div class="metric">
        <strong>Year</strong>
        <div class="${metrics.yearReturn >= 0 ? 'positive' : 'negative'}">
          ${metrics.yearReturn >= 0 ? '+' : ''}${metrics.yearReturn.toFixed(2)} USD
          (${metrics.yearReturnPercent.toFixed(2)}%)
        </div>
      </div>
      <div class="metric">
        <strong>Sharpe Ratio</strong>
        <div>${metrics.sharpeRatio.toFixed(2)}</div>
      </div>
    </div>

    ${topGainers.length > 0 ? `
    <h2>🚀 Top Gainers</h2>
    <table>
      <tr><th>Asset</th><th>Return</th><th>Value</th></tr>
      ${topGainers.map((h) => `
        <tr>
          <td>${h.symbol}</td>
          <td class="positive">+${h.gainLossPercent.toFixed(2)}%</td>
          <td>$${h.value.toFixed(2)}</td>
        </tr>
      `).join('')}
    </table>
    ` : ''}

    ${topLosers.length > 0 ? `
    <h2>📉 Top Losers</h2>
    <table>
      <tr><th>Asset</th><th>Return</th><th>Value</th></tr>
      ${topLosers.map((h) => `
        <tr>
          <td>${h.symbol}</td>
          <td class="negative">${h.gainLossPercent.toFixed(2)}%</td>
          <td>$${h.value.toFixed(2)}</td>
        </tr>
      `).join('')}
    </table>
    ` : ''}

    ${trades.length > 0 ? `
    <h2>💱 Recent Trades</h2>
    <table>
      <tr><th>Asset</th><th>Type</th><th>Amount</th><th>Price</th></tr>
      ${trades.slice(0, 5).map((t) => `
        <tr>
          <td>${t.symbol}</td>
          <td>${t.side === 'buy' ? '🔵 Buy' : '🔴 Sell'}</td>
          <td>${t.amount}</td>
          <td>$${t.price.toFixed(2)}</td>
        </tr>
      `).join('')}
    </table>
    ` : ''}

    ${alerts.length > 0 ? `
    <h2>🔔 Active Price Alerts</h2>
    <ul>
      ${alerts.map((a) => `<li>${a.symbol} - ${a.direction} $${a.target}</li>`).join('')}
    </ul>
    ` : ''}

    <div class="footer">
      <p>This is an automated email from VERDEXIS. You can adjust your email preferences in Settings.</p>
      <p>&copy; 2024 VERDEXIS. All rights reserved.</p>
      ${customerEmailFooter()}
    </div>
  </div>
</body>
</html>
    `
  }

  async scheduleDigests(): Promise<void> {
    // Get all users with email preferences
    const users = await prisma.user.findMany({
      select: { id: true },
    })

    for (const user of users) {
      // Parse preferences (stored as JSON in prefs field)
      const prefs = await prisma.user.findUnique({
        where: { id: user.id },
        select: { prefs: true },
      })

      if (!prefs?.prefs) continue

      try {
        const config: DigestConfig = JSON.parse(prefs.prefs)

        if (config.frequency === 'daily') {
          await this.sendDailyDigest(user.id)
        }
      } catch (err) {
        console.error(`[email-digest] parse error for user ${user.id}:`, err)
      }
    }
  }
}

export const emailDigest = new EmailDigestService()
