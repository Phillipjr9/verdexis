import { useMemo } from 'react'
import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official'
import type { ChartRange } from './dashboard/TimeRangePicker'

interface Props {
  series: number[]
  benchmark?: number[] | null // optional BTC overlay (same length, same scale baseline)
  range: ChartRange
  isUp: boolean
  height?: number
  // Explicit start of the time window in ms — overrides the default span
  // for `range`. Useful for ALL where the span depends on user inception.
  startMs?: number
}

// Returns the millisecond spacing between consecutive points for a range,
// so the x-axis shows real dates instead of bucket indexes.
function bucketMs(range: ChartRange, points: number, startOverride?: number): { start: number; step: number } {
  const now = Date.now()
  if (typeof startOverride === 'number' && startOverride < now) {
    const span = now - startOverride
    return { start: startOverride, step: span / Math.max(1, points - 1) }
  }
  switch (range) {
    case '1D':  return { start: now - 24 * 3_600_000, step: 3_600_000 }
    case '1W':  return { start: now - 7 * 24 * 3_600_000, step: (7 * 24 * 3_600_000) / Math.max(1, points - 1) }
    case '1M':  return { start: now - 30 * 24 * 3_600_000, step: (30 * 24 * 3_600_000) / Math.max(1, points - 1) }
    case '1Y':  return { start: now - 365 * 24 * 3_600_000, step: (365 * 24 * 3_600_000) / Math.max(1, points - 1) }
    case 'ALL': return { start: now - 365 * 24 * 3_600_000, step: (365 * 24 * 3_600_000) / Math.max(1, points - 1) }
  }
}

export default function NetWorthChart({ series, benchmark, range, isUp, height = 192, startMs }: Props) {
  const accent = isUp ? '#0C8B44' : '#f44336'
  const accentGlow = isUp ? 'rgba(12, 139, 68, 0.4)' : 'rgba(244, 67, 54, 0.4)'
  
  const options = useMemo<Highcharts.Options>(() => {
    const { start, step } = bucketMs(range, series.length, startMs)
    const data: [number, number][] = series.map((v, i) => [start + i * step, v])
    const benchData: [number, number][] | undefined = benchmark
      ? benchmark.map((v, i) => [start + i * step, v])
      : undefined

    return {
      chart: {
        backgroundColor: 'transparent',
        height,
        spacing: [4, 0, 4, 0],
        animation: { duration: 800, easing: 'easeOutCubic' },
        zooming: { mouseWheel: { enabled: false }, type: undefined },
        panning: { enabled: false, type: 'x' },
        pinchType: undefined,
        style: {
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 17, 0.95)',
        borderColor: accent,
        borderWidth: 1,
        borderRadius: 12,
        style: { color: '#E5E5E5', fontSize: '11px', fontWeight: '400' },
        shadow: {
          color: accentGlow,
          offsetX: 0,
          offsetY: 4,
          opacity: 0.6,
          width: 12,
        },
        xDateFormat: range === '1D' ? '%b %e, %H:%M' : '%b %e, %Y',
        valuePrefix: '$',
        valueDecimals: 2,
        split: false,
        shared: true,
        useHTML: true,
        padding: 12,
        formatter() {
          const points = this.points || []
          if (!points.length) return ''
          let html = `<div style="padding: 2px;">`
          html += `<div style="color: #737373; font-size: 9px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">${Highcharts.dateFormat(range === '1D' ? '%b %e, %H:%M' : '%b %e, %Y', this.x || 0)}</div>`
          points.forEach((p) => {
            const color = p.series.name === 'BTC' ? '#FF9800' : accent
            const val = p.y || 0
            html += `<div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">`
            html += `<span style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; display: inline-block; box-shadow: 0 0 8px ${color}60;"></span>`
            html += `<span style="color: #A0A0A0; font-weight: 500; font-size: 10px;">${p.series.name}:</span>`
            html += `<span style="color: ${color}; font-weight: 700; margin-left: auto; font-size: 12px;">$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`
            html += `</div>`
          })
          html += `</div>`
          return html
        },
      },
      xAxis: {
        type: 'datetime',
        lineColor: '#ffffff15',
        tickColor: '#ffffff15',
        labels: { 
          style: { color: '#737373', fontSize: '10px', fontWeight: '500' },
          y: 20,
        },
        crosshair: {
          color: accent,
          width: 1.5,
          dashStyle: 'Dot',
          zIndex: 5,
          snap: true,
        },
        gridLineWidth: 0,
      },
      yAxis: {
        opposite: false,
        gridLineColor: '#ffffff08',
        gridLineDashStyle: 'Dot',
        startOnTick: false,
        endOnTick: false,
        minPadding: 0.12,
        maxPadding: 0.12,
        labels: {
          align: 'left',
          x: -5,
          y: 4,
          style: { color: '#737373', fontSize: '10px', fontWeight: '500' },
          formatter() {
            const n = this.value as number
            if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
            if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
            return `$${n.toFixed(0)}`
          },
        },
        title: { text: undefined },
      },
      plotOptions: {
        series: { 
          marker: { enabled: false }, 
          animation: { duration: 800 },
          states: {
            hover: {
              halo: {
                size: 8,
                opacity: 0.4,
                attributes: { fill: accentGlow },
              },
            },
          },
        },
        area: {
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
              [0, accent + '50'],
              [0.5, accent + '20'],
              [1, accent + '00'],
            ],
          },
          lineWidth: 2,
          lineColor: accent,
          states: { 
            hover: { 
              lineWidth: 2.5,
              halo: { size: 0 },
            },
          },
          threshold: null,
          shadow: {
            color: accentGlow,
            width: 8,
            offsetY: 0,
          },
        },
      },
      series: [
        {
          type: 'area',
          name: 'Net Worth',
          data,
          color: accent,
        },
        ...(benchData
          ? [{
              type: 'line' as const,
              name: 'BTC',
              data: benchData,
              color: '#FF9800',
              dashStyle: 'Dash' as const,
              lineWidth: 1,
              opacity: 0.85,
            }]
          : []),
      ],
    }
  }, [series, benchmark, range, accent, height, startMs])

  return (
    <HighchartsReact
      highcharts={Highcharts}
      constructorType="stockChart"
      options={options}
    />
  )
}
