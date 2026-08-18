import './ProgressTrail.css'

export type TrailStep = { id: string; name: string }

export function ProgressTrail({
  title,
  phase,
  steps,
  current,
  done,
  reference,
}: {
  title: string
  phase: string
  steps: TrailStep[]
  current: number
  done?: boolean
  reference?: string
}) {
  const last = Math.max(0, steps.length - 1)
  const index = done ? last : Math.min(Math.max(current, 0), last)
  const progress = last === 0 ? 1 : index / last

  return (
    <div className="la-16" data-state={done ? 'done' : 'loading'} data-step={index + 1} style={{ ['--la-steps' as string]: steps.length, ['--la-progress' as string]: progress }}>
      <section className="la-16__card" role="status" aria-live="polite">
        <header className="la-16__head">
          <p className="la-16__title">{title}</p>
          <p className="la-16__phase">{phase}</p>
        </header>
        <div className="la-16__path">
          <span className="la-16__rail" aria-hidden="true"><span className="la-16__fill" /></span>
          <ol className="la-16__list">
            {steps.map((step, i) => {
              const state = i < index ? 'done' : i === index ? 'current' : 'todo'
              return (
                <li key={step.id} className="la-16__node" data-state={state}>
                  <span className="la-16__dot" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false"><path d="m5.5 12.6 4.3 4.3L18.5 7.6" /></svg>
                  </span>
                  <span className="la-16__name">{step.name}</span>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="la-16__meter" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-valuetext={`Step ${index + 1} of ${steps.length}, ${steps[index]?.name || ''}`}>
          <span className="la-16__ref">{reference || `Step ${index + 1} of ${steps.length}`}</span>
        </div>
      </section>
    </div>
  )
}

export const DEPOSIT_STEPS: TrailStep[] = [
  { id: 'sent', name: 'Sent' },
  { id: 'confirming', name: 'Confirming' },
  { id: 'review', name: 'Review' },
  { id: 'credited', name: 'Credited' },
]

export const WITHDRAW_STEPS: TrailStep[] = [
  { id: 'requested', name: 'Requested' },
  { id: 'review', name: 'Review' },
  { id: 'processing', name: 'Processing' },
  { id: 'sent', name: 'Sent' },
]

export const TRANSFER_STEPS: TrailStep[] = [
  { id: 'initiated', name: 'Initiated' },
  { id: 'review', name: 'Review' },
  { id: 'processing', name: 'Processing' },
  { id: 'complete', name: 'Complete' },
]

export function stepFromStatus(status: string, kind: 'deposit' | 'withdraw' | 'transfer'): { current: number; done: boolean; phase: string } {
  const s = (status || '').toLowerCase()
  if (kind === 'deposit') {
    if (['credited', 'confirmed', 'completed', 'approved'].includes(s)) return { current: 3, done: true, phase: 'Deposit credited to your wallet' }
    if (['review', 'pending_review'].includes(s)) return { current: 2, done: false, phase: 'Under review…' }
    if (['confirming', 'pending'].includes(s)) return { current: 1, done: false, phase: 'Waiting for network confirmations…' }
    return { current: 0, done: false, phase: 'Deposit submitted' }
  }
  if (kind === 'withdraw') {
    if (['rejected', 'failed', 'declined'].includes(s)) return { current: 1, done: false, phase: 'Withdrawal rejected' }
    if (['approved', 'completed', 'sent'].includes(s)) return { current: 3, done: true, phase: 'Funds sent' }
    if (['processing'].includes(s)) return { current: 2, done: false, phase: 'Processing payout…' }
    return { current: 1, done: false, phase: 'In review…' }
  }
  if (['completed', 'sent', 'success'].includes(s)) return { current: 3, done: true, phase: 'Transfer complete' }
  if (['processing'].includes(s)) return { current: 2, done: false, phase: 'Processing transfer…' }
  if (['pending', 'review'].includes(s)) return { current: 1, done: false, phase: 'In review…' }
  return { current: 0, done: false, phase: 'Transfer initiated' }
}
