export function normalizeTextInput(value: unknown, fallback = '', maxLength = 255): string {
  const raw = typeof value === 'string' ? value : String(value ?? fallback)
  const normalized = raw
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u001F\u007F-\u009F]/g, '')
    .replace(/[<>"'`&]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)

  return normalized || fallback
}

export function normalizeQueryText(value: unknown, maxLength = 128): string {
  return normalizeTextInput(value, '', maxLength).toLowerCase()
}

export function normalizeIdentifier(value: unknown, maxLength = 128): string {
  return normalizeTextInput(value, '', maxLength).toLowerCase()
}
