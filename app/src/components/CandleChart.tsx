import { useEffect, useMemo, useRef, useState } from 'react'
import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official'
import { marketData, type Candle, type OhlcRange } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  coinId: string
  symbol: string
  livePrice?: number
  range: OhlcRange
}

const RANGE_REFRESH_MS: Record<OhlcRange, number> = {
  '1H': 30_000,
  '1D': 60_000,
  '1W': 5 * 60_000,
  '1M': 15 * 60_000,
  '1Y': 60 * 60_000,
}

/**
 * Professional Highcharts candlestick chart
 * - Volume indicator
 * - Real-time price updates
 * - Live ticker integration
 */
export default function CandleChart({ coinId, symbol, livePrice, range }: Props) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tickerPrice, setTickerPrice] = useState<number | null>(() => liveTicker.getPrice(coinId))
  const chartRef = useRef<HighchartsReact.RefObject | null>(null)

  // Indicator visibility toggles
  const [showVolume, setShowVolume] = useState(true)

  // Sub-second live price.
  useEffect(() => {
    setTickerPrice(liveTicker.getPrice(coinId))
    const unsub = liveTicker.subscribe(coinId, (p) => setTickerPrice(p))
    return unsub
  }, [coinId])

  // Fetch + auto-refresh per range.
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const data = await marketData.getOhlc(coinId, range)
        if (!cancelled) {
          setCandles(data)
          setError(data.length === 0 ? 'No candles returned for this market' : null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load chart')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, RANGE_REFRESH_MS[range])
    return () => { cancelled = true; clearInterval(interval) }
  }, [coinId, range, reloadKey])

  const effectiveLivePrice = tickerPrice ?? livePrice
  const ohlcData = useMemo(
    () => candles.map((c) => [c.time, c.open, c.high, c.low, c.close]),
    [candles],
  )
  const volumeData = useMemo(
    () => candles.map((c) => [c.time, c.volume]),
    [candles],
  )

  // Live-price update
  useEffect(() => {
    const chart = chartRef.current?.chart
    if (!chart || candles.length === 0 || effectiveLivePrice == null || !isFinite(effectiveLivePrice)) return
    const series = chart.get('price') as Highcharts.Series | undefined
    const yAxis = chart.yAxis?.[0]
    if (series && series.points && series.points.length > 0) {
      const last = series.points[series.points.length - 1]
      const lastCandle = candles[candles.length - 1]
      const newHigh = Math.max(lastCandle.high, effectiveLivePrice)
      const newLow = Math.min(lastCandle.low, effectiveLivePrice)
      try {
        last.update(
          [lastCandle.time, lastCandle.open, newHigh, newLow, effectiveLivePrice],
          false,
          false,
        )
      } catch { /* point may have been disposed mid-update */ }
    }
    if (yAxis) {
      try {
        yAxis.removePlotLine('live-price')
        yAxis.addPlotLine({
          id: 'live-price',
          value: effectiveLivePrice,
          color: '#0C8B44',
          width: 1,
          dashStyle: 'ShortDash',
          zIndex: 5,
          label: {
            text: `$${effectiveLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            align: 'right',
            x: -8,
            y: -4,
            style: { color: '#0C8B44', fontSize: '10px', fontWeight: 'bold' },
          },
        })
      } catch { /* axis disposed */ }
    }
    chart.redraw(false)
  }, [effectiveLivePrice, candles])

  const options = useMemo<Highcharts.Options>(() => (
    {
      chart: {
        backgroundColor: 'rgba(10, 15, 17, 0.6)',
        borderRadius: 16,
        height: 520,
        styledMode: false,
        zooming: { type: 'x' },
        panning: { enabled: true, type: 'x' },
        panKey: 'shift',
        style: {
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        animation: { duration: 600 },
      },
      title: { text: undefined },
      credits: { enabled: false },
      rangeSelector: {
        enabled: false,
        selected: undefined,
      },
      plotOptions: {
        series: {
          marker: { enabled: false },
          animation: { duration: 600 },
        },
        candlestick: {
          lineColor: '#f44336',
          color: 'rgba(244, 67, 54, 0.9)',
          upColor: 'rgba(12, 139, 68, 0.9)',
          upLineColor: '#0C8B44',
          lineWidth: 1.5,
          states: {
            hover: {
              lineWidth: 2,
              lineWidthPlus: 0.5,
            },
          },
        },
      },
      xAxis: {
        lineWidth: 0,
        tickColor: 'rgba(255, 255, 255, 0.05)',
        crosshair: {
          color: 'rgba(12, 139, 68, 0.3)',
          dashStyle: 'Dot',
          width: 1.5,
        },
        labels: {
          style: { color: '#737373', fontSize: '10px', fontWeight: '500' },
        },
        minRange: 3600 * 1000,
        ordinal: false,
        type: 'datetime',
      },
      yAxis: [
        {
          labels: {
            align: 'right',
            x: -8,
            style: { color: '#737373', fontSize: '10px', fontWeight: '500' },
          },
          height: showVolume ? '75%' : '100%',
          crosshair: {
            dashStyle: 'Dot',
            snap: false,
            color: 'rgba(12, 139, 68, 0.2)',
            width: 1.5,
          },
          resize: { enabled: true, lineWidth: 2, lineColor: 'rgba(255, 255, 255, 0.08)' },
          gridLineColor: 'rgba(255, 255, 255, 0.04)',
          gridLineDashStyle: 'Dot',
          lineWidth: 0,
          visible: true,
          startOnTick: false,
          endOnTick: false,
          minPadding: 0.08,
          maxPadding: 0.08,
        },
        {
          top: '77%',
          height: '23%',
          visible: showVolume,
          gridLineColor: 'rgba(255, 255, 255, 0.02)',
          labels: { style: { color: '#737373', fontSize: '8px' } },
          title: { text: 'Volume', style: { color: '#737373', fontSize: '9px' } },
          startOnTick: false,
          endOnTick: false,
        },
      ],
      tooltip: {
        split: true,
        shape: 'rect',
        shadow: {
          color: 'rgba(12, 139, 68, 0.3)',
          width: 10,
          offsetY: 4,
        },
        backgroundColor: 'rgba(10, 15, 17, 0.95)',
        borderColor: 'rgba(12, 139, 68, 0.4)',
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        valueDecimals: 2,
        style: {
          color: '#E5E5E5',
          fontSize: '11px',
          fontWeight: '500',
        },
      },
      stockTools: { gui: { enabled: false } },
      navigator: {
        enabled: true,
        height: 50,
        margin: 12,
        outlineColor: 'rgba(255, 255, 255, 0.08)',
        outlineWidth: 1,
        maskFill: 'rgba(12, 139, 68, 0.15)',
        adaptToUpdatedData: true,
        handles: {
          backgroundColor: 'rgba(12, 139, 68, 0.4)',
          borderColor: '#0C8B44',
          lineWidth: 1.5,
          width: 10,
          height: 18,
        },
        xAxis: {
          gridLineColor: 'rgba(255, 255, 255, 0.04)',
          labels: { style: { color: '#737373', fontSize: '9px' } },
        },
        series: {
          color: '#0C8B44',
          lineWidth: 1.5,
          fillOpacity: 0.2,
        },
      },
      scrollbar: {
        barBackgroundColor: 'rgba(12, 139, 68, 0.2)',
        barBorderColor: 'transparent',
        barBorderRadius: 10,
        buttonArrowColor: '#0C8B44',
        buttonBackgroundColor: 'rgba(10, 15, 17, 0.8)',
        buttonBorderColor: 'rgba(255, 255, 255, 0.1)',
        buttonBorderRadius: 8,
        rifleColor: '#0C8B44',
        trackBackgroundColor: 'rgba(255, 255, 255, 0.03)',
        trackBorderColor: 'transparent',
        trackBorderRadius: 10,
        height: 10,
      },
      series: [
        {
          type: 'candlestick',
          name: symbol.toUpperCase(),
          id: 'price',
          data: ohlcData,
        },
        ...(showVolume ? [{
          type: 'column',
          name: 'Volume',
          id: 'volume',
          data: volumeData,
          yAxis: 1,
          color: 'rgba(12, 139, 68, 0.3)',
          negativeColor: 'rgba(244, 67, 54, 0.3)',
          tooltip: { valueDecimals: 0 },
        }] : []),
      ] as Highcharts.SeriesOptionsType[],
    }
  ), [ohlcData, volumeData, symbol, range, showVolume])

  if (loading && candles.length === 0) {
    return (
      <div className="h-[500px] w-full flex items-center justify-center">
        <div className="text-xs text-[#737373] animate-pulse">Loading {symbol.toUpperCase()} market data…</div>
      </div>
    )
  }

  if (error || candles.length === 0) {
    return (
      <div className="h-[500px] w-full flex flex-col items-center justify-center gap-3">
        <div className="text-xs text-[#737373] text-center max-w-sm">
          Couldn't load {symbol.toUpperCase()} candles{error ? ` — ${error}` : ''}.
          <br />The market data provider may be rate-limiting. We'll keep trying in the background.
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-3 py-1.5 text-[11px] rounded-md bg-[#0C8B44]/15 text-[#0C8B44] hover:bg-[#0C8B44]/25 transition-colors"
        >
          Retry now
        </button>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3">
      {/* Volume Toggle */}
      <div className="flex flex-wrap gap-2 px-2">
        <div className="text-[9px] text-[#737373] uppercase font-semibold tracking-wider">Chart:</div>
        <button
          onClick={() => setShowVolume(!showVolume)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-md transition-all ${
            showVolume
              ? 'bg-[#0C8B44]/20 text-[#0C8B44] border border-[#0C8B44]/30'
              : 'bg-white/5 text-[#737373] border border-white/10 hover:bg-white/10'
          }`}
        >
          {showVolume ? <Eye size={12} /> : <EyeOff size={12} />}
          Volume
        </button>
      </div>

      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        constructorType="stockChart"
        options={options}
      />
    </div>
  )
}
