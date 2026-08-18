import type { ComponentProps } from 'react'
import './sp-01.css'
import { cn } from '../../lib/utils'

export function Spinner({
  className,
  size = 36,
  ...props
}: ComponentProps<'div'> & { size?: number }) {
  const px = Number.isFinite(size) && size > 0 ? size : 36
  return (
    <div
      className={cn('sp-01', className)}
      role="status"
      aria-label="Loading"
      style={{ ['--sp-size' as string]: `${px}px` }}
      {...props}
    >
      <div className="sp-01__ring">
        <div className="sp-01__track" />
        <div className="sp-01__spinner">
          <div className="sp-01__arc" />
          <div className="sp-01__dot" />
        </div>
      </div>
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
      <Spinner size={36} />
    </div>
  )
}

export { Spinner as AppSpinner }
