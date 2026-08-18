import './sp-01.css'
import { cn } from '@/lib/utils'

export function Spinner({
  className,
  size = 36,
  ...props
}: React.ComponentProps<'div'> & { size?: number }) {
  return (
    <div
      className={cn('sp-01', className)}
      role="status"
      aria-label="Loading"
      style={{ ['--sp-size' as string]: `${size}px` }}
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

export { Spinner as AppSpinner }
