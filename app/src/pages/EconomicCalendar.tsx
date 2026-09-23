import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import Navigation from '../components/Navigation'

interface CalEvent {
  date: string // YYYY-MM-DD
  time: string
  title: string
  importance: 'high' | 'medium' | 'low'
  forecast?: string
  previous?: string
  category: 'crypto' | 'macro' | 'earnings' | 'fed'
}

/** Illustrative placeholders only — not a live economic-data feed. */
const EVENT_TEMPLATES: Omit<CalEvent, 'date'>[] = [
  { time: '08:30', title: 'US CPI', importance: 'high', forecast: '—', previous: '—', category: 'macro' },
  { time: '10:00', title: 'Crypto options expiry window', importance: 'medium', category: 'crypto' },
  { time: '14:00', title: 'FOMC minutes / policy remarks', importance: 'high', forecast: 'N/A', previous: 'N/A', category: 'fed' },
  { time: '08:30', title: 'US PPI', importance: 'medium', forecast: '—', previous: '—', category: 'macro' },
  { time: '09:00', title: 'ETF / staking regulatory deadline', importance: 'high', category: 'crypto' },
  { time: '08:30', title: 'US Retail Sales', importance: 'high', forecast: '—', previous: '—', category: 'macro' },
  { time: 'All Day', title: 'Major exchange earnings window', importance: 'high', category: 'earnings' },
  { time: '11:00', title: 'Large options expiry', importance: 'high', category: 'crypto' },
  { time: '08:30', title: 'US Housing Starts', importance: 'low', forecast: '—', previous: '—', category: 'macro' },
  { time: '14:00', title: 'Fed Chair speech window', importance: 'high', category: 'fed' },
  { time: 'All Day', title: 'Industry conference window', importance: 'medium', category: 'crypto' },
  { time: '08:30', title: 'US Jobless Claims', importance: 'medium', forecast: '—', previous: '—', category: 'macro' },
  { time: 'All Day', title: 'Treasury-heavy public company earnings', importance: 'medium', category: 'earnings' },
  { time: '09:00', title: 'SEC crypto hearing window', importance: 'high', category: 'crypto' },
  { time: '08:30', title: 'US GDP print', importance: 'high', forecast: '—', previous: '—', category: 'macro' },
  { time: '20:00', title: 'Network upgrade / vote window', importance: 'medium', category: 'crypto' },
]

const TEMPLATE_DAYS = [12, 12, 13, 14, 14, 15, 15, 16, 19, 20, 20, 21, 22, 27, 28, 30]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function eventsForMonth(year: number, month: number): CalEvent[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return EVENT_TEMPLATES.map((tpl, i) => {
    const day = Math.min(TEMPLATE_DAYS[i] ?? 1, daysInMonth)
    return { ...tpl, date: `${year}-${pad(month + 1)}-${pad(day)}` }
  })
}

const IMPORTANCE_COLOR: Record<string, string> = {
  high: 'text-red-400 bg-red-400/10',
  medium: 'text-yellow-400 bg-yellow-400/10',
  low: 'text-[#0C8B44] bg-[#0C8B44]/10',
}

const CATEGORY_COLOR: Record<string, string> = {
  crypto: 'text-purple-400',
  macro: 'text-blue-400',
  earnings: 'text-yellow-400',
  fed: 'text-red-400',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function EconomicCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [filter, setFilter] = useState<'all' | 'crypto' | 'macro' | 'earnings' | 'fed'>('all')
  const [importanceFilter, setImportanceFilter] = useState<'all' | 'high'>('all')

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthEvents = useMemo(() => eventsForMonth(year, month), [year, month])

  const visibleEvents = monthEvents.filter(e => {
    if (filter !== 'all' && e.category !== filter) return false
    if (importanceFilter === 'high' && e.importance !== 'high') return false
    return true
  })

  const eventsByDay: Record<number, CalEvent[]> = {}
  visibleEvents.forEach(e => {
    const day = parseInt(e.date.split('-')[2], 10)
    if (!eventsByDay[day]) eventsByDay[day] = []
    eventsByDay[day].push(e)
  })

  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : []

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Economic Calendar</h1>
              <p className="text-xs text-[#737373]">Key macro windows, crypto catalysts & earnings.</p>
            </div>
          </div>

          <p className="text-[11px] text-[#737373] mb-6 rounded-lg border border-[#ffffff10] bg-[#0f1619] px-3 py-2">
            Illustrative schedule for the month you are viewing — not a live data vendor feed.
          </p>

          <div className="flex flex-wrap gap-2 mb-6">
            {(['all', 'crypto', 'macro', 'earnings', 'fed'] as const).map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-full text-xs transition-colors ${filter === cat ? 'bg-[#0C8B44] text-white' : 'bg-[#0f1619] border border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'}`}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
            <button onClick={() => setImportanceFilter(i => i === 'all' ? 'high' : 'all')} className={`ml-auto px-3 py-1.5 rounded-full text-xs transition-colors ${importanceFilter === 'high' ? 'bg-red-600 text-white' : 'bg-[#0f1619] border border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'}`}>
              High Impact Only
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[#ffffff08] transition-colors"><ChevronLeft className="w-4 h-4 text-[#737373]" /></button>
                <h2 className="text-sm font-medium text-[#E5E5E5]">{MONTHS[month]} {year}</h2>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[#ffffff08] transition-colors"><ChevronRight className="w-4 h-4 text-[#737373]" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(d => <div key={d} className="text-center text-[10px] text-[#737373] py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const hasEvents = !!eventsByDay[day]
                  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                  const isSelected = day === selectedDay
                  const hasHigh = eventsByDay[day]?.some(e => e.importance === 'high')
                  return (
                    <button key={day} onClick={() => setSelectedDay(day)} className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center relative transition-colors ${isSelected ? 'bg-[#0C8B44] text-white' : isToday ? 'border border-[#0C8B44] text-[#0C8B44]' : 'hover:bg-[#ffffff08] text-[#737373]'}`}>
                      {day}
                      {hasEvents && !isSelected && (
                        <div className={`w-1 h-1 rounded-full mt-0.5 ${hasHigh ? 'bg-red-400' : 'bg-[#0C8B44]'}`} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">
                {selectedDay ? `${MONTHS[month]} ${selectedDay}` : 'Select a day'}
              </h2>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-[#737373] text-center py-8">No events on this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev, i) => (
                    <div key={`econ-${i}`} className="rounded-xl bg-[#0a0f11] border border-[#ffffff08] p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs text-[#E5E5E5] font-medium leading-tight">{ev.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${IMPORTANCE_COLOR[ev.importance]}`}>{ev.importance}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-[#737373]">
                        <span className={CATEGORY_COLOR[ev.category]}>{ev.category}</span>
                        <span>{ev.time}</span>
                      </div>
                      {(ev.forecast || ev.previous) && (
                        <div className="flex gap-4 mt-2 text-[10px]">
                          {ev.forecast && <span className="text-[#737373]">Forecast: <span className="text-[#E5E5E5]">{ev.forecast}</span></span>}
                          {ev.previous && <span className="text-[#737373]">Prior: <span className="text-[#E5E5E5]">{ev.previous}</span></span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">All Events This Month</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#737373] text-left border-b border-[#ffffff08]">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Time</th>
                    <th className="pb-3 pr-4 font-medium">Event</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Impact</th>
                    <th className="pb-3 pr-4 font-medium">Forecast</th>
                    <th className="pb-3 font-medium">Previous</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ffffff05]">
                  {visibleEvents.map((ev, i) => (
                    <tr key={`econ-row-${i}`} className="hover:bg-[#ffffff04] transition-colors">
                      <td className="py-2.5 pr-4 text-[#E5E5E5]">{ev.date.slice(5)}</td>
                      <td className="py-2.5 pr-4 text-[#737373]">{ev.time}</td>
                      <td className="py-2.5 pr-4 text-[#E5E5E5]">{ev.title}</td>
                      <td className={`py-2.5 pr-4 ${CATEGORY_COLOR[ev.category]}`}>{ev.category}</td>
                      <td className="py-2.5 pr-4"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${IMPORTANCE_COLOR[ev.importance]}`}>{ev.importance}</span></td>
                      <td className="py-2.5 pr-4 text-[#737373]">{ev.forecast ?? '—'}</td>
                      <td className="py-2.5 text-[#737373]">{ev.previous ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
