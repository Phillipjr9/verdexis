import { useEffect, useRef, useCallback } from 'react'
import { MapPin } from 'lucide-react'

/** Minimal Google Maps Places types so we avoid a hard dependency on @types/google.maps */
declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: {
              types?: string[]
              fields?: string[]
              componentRestrictions?: { country?: string | string[] }
            }
          ) => {
            addListener: (event: string, handler: () => void) => void
            getPlace: () => {
              formatted_address?: string
              address_components?: Array<{
                long_name: string
                short_name: string
                types: string[]
              }>
              name?: string
            }
          }
        }
        event: {
          clearInstanceListeners: (instance: unknown) => void
        }
      }
    }
    __verdexisGoogleMapsPromise?: Promise<void>
  }
}

const SCRIPT_ID = 'verdexis-google-maps-places'

function getApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || ''
}

/** Load the Google Maps JS API (Places library) once per page. */
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.google?.maps?.places) return Promise.resolve()

  if (window.__verdexisGoogleMapsPromise) return window.__verdexisGoogleMapsPromise

  window.__verdexisGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')))
      // Already loaded
      if (window.google?.maps?.places) resolve()
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`
    script.onload = () => resolve()
    script.onerror = () => {
      window.__verdexisGoogleMapsPromise = undefined
      reject(new Error('Google Maps script failed to load'))
    }
    document.head.appendChild(script)
  })

  return window.__verdexisGoogleMapsPromise
}

export interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  id?: string
  /** ISO country codes to bias results, e.g. ['us'] or ['us','ca'] */
  countries?: string[]
  disabled?: boolean
}

/**
 * Street-address input with Google Places Autocomplete.
 * Falls back to a normal text input when VITE_GOOGLE_MAPS_API_KEY is missing
 * or the Places script fails to load.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing your address…',
  required = false,
  className = '',
  id,
  countries,
  disabled = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<ReturnType<NonNullable<typeof window.google>['maps']['places']['Autocomplete']> | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const attachAutocomplete = useCallback(async () => {
    const apiKey = getApiKey()
    if (!apiKey || !inputRef.current) return

    try {
      await loadGoogleMapsScript(apiKey)
      if (!window.google?.maps?.places || !inputRef.current) return

      // Tear down previous instance if any
      if (autocompleteRef.current) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
        } catch {
          /* ignore */
        }
        autocompleteRef.current = null
      }

      const opts: {
        types: string[]
        fields: string[]
        componentRestrictions?: { country: string | string[] }
      } = {
        types: ['address'],
        fields: ['formatted_address', 'address_components', 'name'],
      }
      if (countries && countries.length > 0) {
        opts.componentRestrictions = {
          country: countries.length === 1 ? countries[0] : countries,
        }
      }

      const ac = new window.google.maps.places.Autocomplete(inputRef.current, opts)
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        const formatted =
          place.formatted_address ||
          place.name ||
          inputRef.current?.value ||
          ''
        if (formatted) {
          onChangeRef.current(formatted)
        }
      })
      autocompleteRef.current = ac
    } catch (err) {
      console.warn('[AddressAutocomplete] Google Places unavailable:', err)
    }
  }, [countries])

  useEffect(() => {
    void attachAutocomplete()
    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
        } catch {
          /* ignore */
        }
        autocompleteRef.current = null
      }
    }
  }, [attachAutocomplete])

  // Keep the controlled value in sync with the DOM input (Places can write
  // directly to the input element).
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }
  }, [value])

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373] pointer-events-none z-[1]" />
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          className ||
          'w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors'
        }
        placeholder={placeholder}
        autoComplete="street-address"
        required={required}
        disabled={disabled}
        // Prevent the browser from fighting Google's dropdown on some browsers
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="false"
      />
    </div>
  )
}
