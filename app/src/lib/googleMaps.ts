// Lazily injects the Google Maps JS API (Places library) once, and reuses the
// same loading promise across callers so multiple components don't double-load it.
let mapsPromise: Promise<void> | null = null

export function loadGoogleMapsPlaces(): Promise<void> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  if (!apiKey) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not configured'))

  if (mapsPromise) return mapsPromise

  if ((window as any).google?.maps?.places) {
    mapsPromise = Promise.resolve()
    return mapsPromise
  }

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')))
      return
    }
    const script = document.createElement('script')
    script.id = 'google-maps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })

  return mapsPromise
}
