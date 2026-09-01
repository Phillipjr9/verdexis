import { api } from './api'

export interface Goal {
  id: string
  title: string
  target: number
  currency: 'USD'
  deadline: string
  category: 'wealth' | 'crypto' | 'retirement' | 'home' | 'other'
  startedAt: string
}

const EVENT = 'verdexis:goals'
let memory: Goal[] = []
let hydrated = false

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

async function persist(next: Goal[]) {
  memory = next
  emit()
  try {
    await api.patchProfile({ prefs: { goals: next } })
  } catch (err) {
    console.warn('[goalsStore] persist failed', err)
  }
}

export const goalsStore = {
  list(): Goal[] {
    return memory
  },
  async hydrate(): Promise<Goal[]> {
    if (hydrated) return memory
    try {
      const me = await api.me()
      const user = (me as { user?: { prefs?: { goals?: Goal[] } } }).user
      const goals = user?.prefs?.goals
      if (Array.isArray(goals)) memory = goals
    } catch {
      /* keep memory */
    }
    hydrated = true
    emit()
    return memory
  },
  add(input: Omit<Goal, 'id' | 'startedAt'>): Goal {
    const goal: Goal = { ...input, id: `g_${Date.now()}`, startedAt: new Date().toISOString() }
    void persist([...memory, goal])
    return goal
  },
  remove(id: string) {
    void persist(memory.filter((g) => g.id !== id))
  },
  reset() {
    void persist([])
  },
}

export function progressFor(goal: Goal, currentValue: number) {
  const pct = Math.max(0, Math.min(100, (currentValue / goal.target) * 100))
  const start = new Date(goal.startedAt).getTime()
  const end = new Date(goal.deadline).getTime()
  const now = Date.now()
  const timeElapsedPct = end > start ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 0
  const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
  const onTrack = pct >= timeElapsedPct
  return { pct, timeElapsedPct, daysLeft, onTrack, remaining: Math.max(0, goal.target - currentValue) }
}

export const GOALS_EVENT = EVENT
