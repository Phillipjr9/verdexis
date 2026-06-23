import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  meta?: boolean // Cmd on Mac
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
}

export function useKeyboardShortcuts(enabled = true) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled) return

    const shortcuts: ShortcutConfig[] = [
      // Navigation
      { key: 'd', meta: true, ctrl: true, description: 'Dashboard', action: () => navigate('/dashboard') },
      { key: 't', meta: true, ctrl: true, description: 'Trading', action: () => navigate('/trading') },
      { key: 'm', meta: true, ctrl: true, description: 'Markets', action: () => navigate('/markets') },
      { key: 'w', meta: true, ctrl: true, description: 'Wallet', action: () => navigate('/wallet') },
      { key: 'a', meta: true, ctrl: true, description: 'AI Assistant', action: () => navigate('/ai') },
      { key: 'n', meta: true, ctrl: true, description: 'News', action: () => navigate('/news') },
      
      // Command Palette (Cmd+K)
      { key: 'k', meta: true, ctrl: true, description: 'Command Palette', action: () => {
        // Trigger command palette - it listens for Cmd+K
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          ctrlKey: true,
          bubbles: true,
        })
        document.dispatchEvent(event)
      }},

      // Quick Actions
      { key: '/', description: 'Search', action: () => {
        // Focus search input if exists
        const searchInput = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="Search"]')
        searchInput?.focus()
      }},

      { key: '?', shift: true, description: 'Help / Shortcuts', action: () => {
        toast.info('Keyboard Shortcuts', {
          description: (
            <div className="text-xs space-y-1 mt-2">
              <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">⌘/Ctrl+D</kbd> Dashboard</p>
              <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">⌘/Ctrl+T</kbd> Trading</p>
              <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">⌘/Ctrl+M</kbd> Markets</p>
              <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">⌘/Ctrl+W</kbd> Wallet</p>
              <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">⌘/Ctrl+K</kbd> Command Palette</p>
              <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">/</kbd> Search</p>
              <p><kbd className="px-1.5 py-0.5 bg-white/10 rounded">?</kbd> Show this help</p>
            </div>
          ),
          duration: 8000,
        })
      }},

      // Escape to close modals/dialogs
      { key: 'Escape', description: 'Close modals', action: () => {
        const closeButton = document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label*="Close"], [data-dismiss="modal"]')
        closeButton?.click()
      }},
    ]

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Except for Escape key
        if (e.key !== 'Escape' && e.key !== '?') return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdKey = isMac ? e.metaKey : e.ctrlKey

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : true
        const metaMatch = shortcut.meta ? cmdKey : true
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          e.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, navigate])
}

// Component to show keyboard shortcuts help panel
export function KeyboardShortcutsHelp() {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[#1a1a1a] border border-[#ffffff10] rounded-xl p-4 shadow-2xl max-w-xs">
      <h3 className="text-sm font-medium text-[#E5E5E5] mb-3">Keyboard Shortcuts</h3>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-[#A0A0A0]">Dashboard</span>
          <kbd className="px-2 py-1 bg-[#0d0d0d] border border-[#ffffff08] rounded text-[#E5E5E5]">⌘D</kbd>
        </div>
        <div className="flex justify-between">
          <span className="text-[#A0A0A0]">Trading</span>
          <kbd className="px-2 py-1 bg-[#0d0d0d] border border-[#ffffff08] rounded text-[#E5E5E5]">⌘T</kbd>
        </div>
        <div className="flex justify-between">
          <span className="text-[#A0A0A0]">Markets</span>
          <kbd className="px-2 py-1 bg-[#0d0d0d] border border-[#ffffff08] rounded text-[#E5E5E5]">⌘M</kbd>
        </div>
        <div className="flex justify-between">
          <span className="text-[#A0A0A0]">Wallet</span>
          <kbd className="px-2 py-1 bg-[#0d0d0d] border border-[#ffffff08] rounded text-[#E5E5E5]">⌘W</kbd>
        </div>
        <div className="flex justify-between">
          <span className="text-[#A0A0A0]">Search</span>
          <kbd className="px-2 py-1 bg-[#0d0d0d] border border-[#ffffff08] rounded text-[#E5E5E5]">⌘K</kbd>
        </div>
        <div className="flex justify-between">
          <span className="text-[#A0A0A0]">Help</span>
          <kbd className="px-2 py-1 bg-[#0d0d0d] border border-[#ffffff08] rounded text-[#E5E5E5]">?</kbd>
        </div>
      </div>
    </div>
  )
}
