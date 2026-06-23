// Technical indicator calculations for smart alerts

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Not enough data
  
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const recentChanges = changes.slice(-period);
  const gains = recentChanges.filter(c => c > 0);
  const losses = recentChanges.filter(c => c < 0).map(Math.abs);
  
  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calculateMovingAverage(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  
  const recentPrices = prices.slice(-period);
  return recentPrices.reduce((a, b) => a + b, 0) / period;
}
