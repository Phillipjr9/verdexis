import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getToken } from '../../lib/api';

interface PerformanceBreakdown {
  symbol: string;
  name: string;
  value: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
}

interface DailyPerformance {
  breakdown: PerformanceBreakdown[];
  total: {
    pnl: number;
    pnlPercent: number;
  };
}

export default function TradingAttribution() {
  const [data, setData] = useState<DailyPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getToken();
        if (!token) { setLoading(false); return; }
        const res = await fetch('/api/holdings/performance/daily', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch daily performance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-emerald-900/30 rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-slate-800 rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-800 rounded"></div>
          <div className="h-4 bg-slate-800 rounded"></div>
          <div className="h-4 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data || data.breakdown.length === 0) {
    return (
      <div className="bg-slate-900 border border-emerald-900/30 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">Today's Performance</h3>
        <p className="text-slate-400 text-sm">No holdings to display</p>
      </div>
    );
  }

  const { total, breakdown } = data;
  const isPositive = total.pnl >= 0;

  return (
    <div className="bg-slate-900 border border-emerald-900/30 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Today's Performance</h3>
        {isPositive ? (
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-400" />
        )}
      </div>

      <div>
        <div className="text-2xl font-bold">
          <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
            {isPositive ? '+' : ''}${total.pnl.toFixed(2)}
          </span>
        </div>
        <div className={`text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{total.pnlPercent.toFixed(2)}%
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-800">
        <p className="text-xs font-semibold text-slate-400 uppercase">Breakdown by Asset</p>
        {breakdown.slice(0, 5).map((asset, i) => (
          <div key={`${asset.symbol}-${i}`} className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">{asset.symbol}</span>
              <span className="text-slate-500 text-xs">{asset.allocation.toFixed(1)}%</span>
            </div>
            <div className={`font-semibold ${asset.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {asset.pnl >= 0 ? '+' : ''}${asset.pnl.toFixed(2)}
              <span className="text-xs ml-1">
                ({asset.pnl >= 0 ? '+' : ''}{asset.pnlPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
        {breakdown.length > 5 && (
          <p className="text-xs text-slate-500 text-center pt-2">
            +{breakdown.length - 5} more assets
          </p>
        )}
      </div>
    </div>
  );
}
