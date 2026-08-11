import { useEffect } from 'react'

type ModalProps = {
  open: boolean
  title?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  onClose: () => void
}

export default function Modal({ open, title, children, footer, onClose }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-w-lg w-full mx-4 bg-[#0b1116] border border-[#ffffff0d] rounded-xl shadow-2xl p-6"
      >
        {title && <h3 className="text-lg font-semibold text-[#E5E5E5] mb-3">{title}</h3>}
        <div className="mb-4">{children}</div>
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  )
}
