import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

/** Google Maps Extended Component Library custom elements */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmpx-api-loader': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          key?: string
          'solution-channel'?: string
        },
        HTMLElement
      >
      'gmpx-place-picker': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          placeholder?: string
          disabled?: boolean
        },
        HTMLElement
      >
    }
  }

  interface Window {
    __verdexisGmpxLoaderPromise?: Promise<void>
  }
}

const ECL_SCRIPT_ID = 'verdexis-gmpx-ecl'
const ECL_SCRIPT_SRC =
  'https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.15/index.min.js'

function getApiKey(): string {
  // Vite inlines this at build time — must be set on the frontend host (e.g. Vercel)
  // as VITE_GOOGLE_MAPS_API_KEY and the app rebuilt for production.
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  return typeof key === 'string' ? key.trim() : ''
}

/** Load the Extended Component Library once (defines gmpx-* elements). */
function loadGmpxLibrary(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (customElements.get('gmpx-place-picker')) return Promise.resolve()

  if (window.__verdexisGmpxLoaderPromise) return window.__verdexisGmpxLoaderPromise

  window.__verdexisGmpxLoaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(ECL_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      if (customElements.get('gmpx-place-picker')) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('gmpx library failed to load')))
      return
    }

    const script = document.createElement('script')
    script.id = ECL_SCRIPT_ID
    script.type = 'module'
    script.src = ECL_SCRIPT_SRC
    script.onload = () => resolve()
    script.onerror = () => {
      window.__verdexisGmpxLoaderPromise = undefined
      reject(new Error('gmpx library failed to load'))
    }
    document.head.appendChild(script)
  })

  return window.__verdexisGmpxLoaderPromise
}

interface GmpxPlace {
  formattedAddress?: string
  displayName?: string
  addressComponents?: unknown
}

export interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  id?: string
  disabled?: boolean
}

/**
 * Street-address field using Google Place Picker
 * (Extended Component Library: gmpx-api-loader + gmpx-place-picker).
 * Falls back to a plain text input when VITE_GOOGLE_MAPS_API_KEY is missing
 * or the library fails to load.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Enter an address',
  required = false,
  className = '',
  id,
  disabled = false,
}: AddressAutocompleteProps) {
  const apiKey = getApiKey()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const pickerRef = useRef<HTMLElement | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!apiKey) return
    let cancelled = false
    void loadGmpxLibrary()
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        console.warn('[AddressAutocomplete] gmpx unavailable:', err)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [apiKey])

  useEffect(() => {
    if (!ready || !pickerRef.current) return
    const el = pickerRef.current

    const handlePlaceChange = () => {
      // gmpx-place-picker exposes `.place` after selection
      const place = (el as HTMLElement & { place?: GmpxPlace | null }).place
      if (!place) {
        // Cleared selection — allow empty
        onChangeRef.current('')
        return
      }
      const formatted =
        place.formattedAddress ||
        place.displayName ||
        ''
      if (formatted) onChangeRef.current(formatted)
    }

    el.addEventListener('gmpx-placechange', handlePlaceChange)
    return () => el.removeEventListener('gmpx-placechange', handlePlaceChange)
  }, [ready])

  const inputClass =
    className ||
    'w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors'

  // No key or library failed → plain controlled input (signup still works)
  if (!apiKey || failed) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373] pointer-events-none z-[1]" />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={placeholder}
          autoComplete="street-address"
          required={required}
          disabled={disabled}
        />
      </div>
    )
  }

  // Loading library
  if (!ready) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373] pointer-events-none z-[1]" />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={placeholder}
          autoComplete="street-address"
          required={required}
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <div className="verdexis-place-picker relative" id={id}>
      {/* Loads Maps JS + Places for this key (once per page is fine) */}
      <gmpx-api-loader key={apiKey} solution-channel="GMP_GE_placepicker_v2" />

      <div className="verdexis-place-picker-box">
        <div className="verdexis-place-picker-container">
          <gmpx-place-picker
            ref={pickerRef as React.RefObject<HTMLElement>}
            placeholder={placeholder}
            // @ts-expect-error web component boolean attr
            disabled={disabled || undefined}
          />
        </div>
      </div>

      {/* Hidden field so HTML5 required + form state stay in sync */}
      <input type="hidden" value={value} required={required} readOnly aria-hidden />

      <style>{`
        .verdexis-place-picker-box {
          width: 100%;
        }
        .verdexis-place-picker-container {
          width: 100%;
        }
        .verdexis-place-picker gmpx-place-picker {
          width: 100%;
          display: block;
          --gmpx-color-surface: #1a1a1a;
          --gmpx-color-on-surface: #e5e5e5;
          --gmpx-color-on-surface-variant: #737373;
          --gmpx-color-primary: #0c8b44;
          --gmpx-color-outline: rgba(255, 255, 255, 0.08);
          --gmpx-font-family: inherit;
          border-radius: 0.75rem;
        }
      `}</style>
    </div>
  )
}
