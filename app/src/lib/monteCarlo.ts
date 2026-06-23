// Monte Carlo simulation engine for portfolio stress testing

interface SimulationResult {
  worstCase: number;
  bestCase: number;
  mostLikely: number;
  distribution: number[];
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
}

interface Holding {
  symbol: string;
  quantity: number;
  currentPrice: number;
  value: number;
}

interface CorrelationMatrix {
  [symbol: string]: {
    [symbol: string]: number;
  };
}

// Calculate Pearson correlation coefficient between two price series
function calculateCorrelation(prices1: number[], prices2: number[]): number {
  const n = Math.min(prices1.length, prices2.length);
  if (n < 2) return 0;

  let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
  
  for (let i = 0; i < n; i++) {
    sum1 += prices1[i];
    sum2 += prices2[i];
    sum1Sq += prices1[i] ** 2;
    sum2Sq += prices2[i] ** 2;
    pSum += prices1[i] * prices2[i];
  }

  const num = pSum - (sum1 * sum2 / n);
  const den = Math.sqrt((sum1Sq - sum1 ** 2 / n) * (sum2Sq - sum2 ** 2 / n));
  
  return den === 0 ? 0 : num / den;
}

// Build correlation matrix from historical prices
export function buildCorrelationMatrix(
  priceHistory: Record<string, number[]>
): CorrelationMatrix {
  const symbols = Object.keys(priceHistory);
  const matrix: CorrelationMatrix = {};

  for (const sym1 of symbols) {
    matrix[sym1] = {};
    for (const sym2 of symbols) {
      if (sym1 === sym2) {
        matrix[sym1][sym2] = 1.0;
      } else {
        matrix[sym1][sym2] = calculateCorrelation(
          priceHistory[sym1],
          priceHistory[sym2]
        );
      }
    }
  }

  return matrix;
}

// Calculate historical volatility (annualized)
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0.3; // Default 30% if insufficient data

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  
  // Annualize: daily vol * sqrt(365)
  return Math.sqrt(variance) * Math.sqrt(365);
}

// Generate correlated random returns using Cholesky decomposition
function generateCorrelatedReturns(
  correlationMatrix: CorrelationMatrix,
  volatilities: Record<string, number>,
  symbols: string[]
): Record<string, number> {
  const n = symbols.length;
  const independentReturns: number[] = [];
  
  // Generate independent normal random variables (Box-Muller)
  for (let i = 0; i < n; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    independentReturns.push(z);
  }

  // Simple correlation implementation (not full Cholesky for speed)
  const correlatedReturns: Record<string, number> = {};
  
  for (let i = 0; i < n; i++) {
    const sym = symbols[i];
    let correlatedReturn = independentReturns[i];
    
    // Add correlation effects from other assets
    for (let j = 0; j < i; j++) {
      const otherSym = symbols[j];
      const corr = correlationMatrix[sym]?.[otherSym] || 0;
      correlatedReturn += corr * independentReturns[j] * 0.3; // Dampen correlation effect
    }
    
    // Scale by volatility and convert to daily return
    correlatedReturns[sym] = correlatedReturn * volatilities[sym] / Math.sqrt(365);
  }

  return correlatedReturns;
}

// Run Monte Carlo simulation
export function runMonteCarloSimulation(
  holdings: Holding[],
  priceHistory: Record<string, number[]>,
  daysAhead: number = 30,
  numSimulations: number = 10000
): SimulationResult {
  const symbols = holdings.map(h => h.symbol);
  const currentPortfolioValue = holdings.reduce((sum, h) => sum + h.value, 0);

  // Build correlation matrix and calculate volatilities
  const correlationMatrix = buildCorrelationMatrix(priceHistory);
  const volatilities: Record<string, number> = {};
  
  for (const symbol of symbols) {
    volatilities[symbol] = calculateVolatility(priceHistory[symbol] || []);
  }

  const finalValues: number[] = [];

  // Run simulations
  for (let sim = 0; sim < numSimulations; sim++) {
    let portfolioValue = currentPortfolioValue;

    // Simulate each day
    for (let day = 0; day < daysAhead; day++) {
      const returns = generateCorrelatedReturns(correlationMatrix, volatilities, symbols);
      
      // Apply returns to each holding
      portfolioValue = holdings.reduce((sum, holding) => {
        const dailyReturn = returns[holding.symbol] || 0;
        const newValue = holding.value * (1 + dailyReturn);
        return sum + newValue;
      }, 0);
    }

    finalValues.push(portfolioValue);
  }

  // Sort results for percentile calculation
  finalValues.sort((a, b) => a - b);

  const getPercentile = (p: number) => {
    const index = Math.floor(finalValues.length * p);
    return finalValues[index];
  };

  return {
    worstCase: finalValues[0],
    bestCase: finalValues[finalValues.length - 1],
    mostLikely: getPercentile(0.5), // Median
    distribution: finalValues,
    percentiles: {
      p5: getPercentile(0.05),
      p25: getPercentile(0.25),
      p50: getPercentile(0.50),
      p75: getPercentile(0.75),
      p95: getPercentile(0.95),
    },
  };
}

// Scenario analysis with custom price shocks
export function runScenarioAnalysis(
  holdings: Holding[],
  scenarios: Record<string, number> // symbol -> % change (e.g., { BTC: -0.30, ETH: -0.20 })
): number {
  return holdings.reduce((sum, holding) => {
    const priceShock = scenarios[holding.symbol] || 0;
    const newValue = holding.value * (1 + priceShock);
    return sum + newValue;
  }, 0);
}

// Generate distribution histogram buckets
export function generateHistogramBuckets(
  distribution: number[],
  numBuckets: number = 50
): Array<{ min: number; max: number; count: number }> {
  const min = Math.min(...distribution);
  const max = Math.max(...distribution);
  const bucketSize = (max - min) / numBuckets;

  const buckets: Array<{ min: number; max: number; count: number }> = [];
  
  for (let i = 0; i < numBuckets; i++) {
    const bucketMin = min + i * bucketSize;
    const bucketMax = bucketMin + bucketSize;
    const count = distribution.filter(v => v >= bucketMin && v < bucketMax).length;
    
    buckets.push({ min: bucketMin, max: bucketMax, count });
  }

  return buckets;
}
