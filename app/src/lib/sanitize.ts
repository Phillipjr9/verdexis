export function sanitizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? fallback)
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text || fallback
}

export function sanitizeDisplayText(value: unknown, maxLength = 120): string {
  const text = sanitizeText(value, '')
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text
}

export function escapeHtml(value: unknown): string {
  return sanitizeText(value, '').replace(/[&<>"'`]/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '`': '&#96;',
    }
    return map[char] ?? char
  })
}

export function sanitizeEmail(value: unknown): string {
  return sanitizeText(value, '').toLowerCase().replace(/[^a-z0-9@._+-]/g, '')
}

export function sanitizeUsername(value: unknown): string {
  return sanitizeText(value, '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40)
}
