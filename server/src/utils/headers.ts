import type { Request } from 'express'

// Safe header accessor: Express lower-cases incoming header names but code
// often calls `req.header(name)` which isn't available on our `AuthedRequest`
// typedef. This small helper normalizes lookup and returns the first value
// when multiple values are present.
export function header(req: Request, name: string): string | undefined {
  const raw = (req.headers as any)[name.toLowerCase()] ?? (req.headers as any)[name]
  if (!raw) return undefined
  return Array.isArray(raw) ? String(raw[0]) : String(raw)
}

export function getIdempotencyKeyFromReq(req: Request): string | undefined {
  return header(req, 'idempotency-key') ?? header(req, 'Idempotency-Key')
}
