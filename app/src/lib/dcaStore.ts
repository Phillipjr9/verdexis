// Recurring DCA schedules. Database (/api/dca) is the source of truth.

import { api } from './api'

const EVENT = 'verdexis:dca'

export interface DcaSchedule {
  id: string
  asset: string
  assetId: string
  name: string
  amountUsd: number
  intervalDays: number
  active: boolean
  createdAt: string
  lastRun?: string
  frequency?: string
  paused?: boolean
  nextRunAt?: string
}

let memory: DcaSchedule[] = []

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function freqToDays(frequency?: string): number {
  switch ((frequency || '').toLowerCase()) {
    case 'daily': return 1
    case 'biweekly': return 14
    case 'monthly': return 30
    default: return 7
  }
}

function mapRemote(s: any): DcaSchedule {
  return {
    id: String(s.id),
    asset: String(s.asset || ''),
    assetId: String(s.assetId || (s.asset || '').toLowerCase()),
    name: String(s.name || `${s.asset} DCA`),
    amountUsd: Number(s.amountUsd || 0),
    intervalDays: Number(s.intervalDays || freqToDays(s.frequency)),
    active: s.active !== false && s.paused !== true,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
    lastRun: s.lastRunAt ? new Date(s.lastRunAt).toISOString() : undefined,
    frequency: s.frequency,
    paused: Boolean(s.paused),
    nextRunAt: s.nextRunAt ? new Date(s.nextRunAt).toISOString() : undefined,
  }
}

export const dcaStore = {
  list(): DcaSchedule[] {
    return memory.slice()
  },
  async hydrate(): Promise<DcaSchedule[]> {
    try {
      const rows = await api.get<any[]>('/api/dca')
      memory = Array.isArray(rows) ? rows.map(mapRemote) : []
      emit()
    } catch (e) {
      console.warn('[dca] hydrate failed', e)
    }
    return memory.slice()
  },
  add(input: Omit<DcaSchedule, 'id' | 'createdAt'>): DcaSchedule {
    const local: DcaSchedule = { ...input, id: `dca_tmp_${Date.now()}`, createdAt: new Date().toISOString() }
    memory = [...memory, local]
    emit()
    const frequency = input.intervalDays >= 28 ? 'monthly' : input.intervalDays >= 14 ? 'biweekly' : input.intervalDays <= 1 ? 'daily' : 'weekly'
    void api.post('/api/dca', { asset: input.asset, amountUsd: input.amountUsd, frequency }).then(() => this.hydrate())
    return local
  },
  toggle(id: string) {
    memory = memory.map((s) => s.id === id ? { ...s, active: !s.active, paused: s.active } : s)
    emit()
    void api.patch(`/api/dca/${encodeURIComponent(id)}/toggle-pause`, {}).then(() => this.hydrate())
  },
  markRun(id: string) {
    memory = memory.map((s) => s.id === id ? { ...s, lastRun: new Date().toISOString() } : s)
    emit()
  },
  remove(id: string) {
    memory = memory.filter((s) => s.id !== id)
    emit()
    void api.delete(`/api/dca/${encodeURIComponent(id)}`).then(() => this.hydrate())
  },
}

export function nextRunMs(s: DcaSchedule): number {
  if (s.nextRunAt) return new Date(s.nextRunAt).getTime()
  const last = s.lastRun ? new Date(s.lastRun).getTime() : new Date(s.createdAt).getTime()
  return last + s.intervalDays * 86400_000
}

export const DCA_EVENT = EVENT
