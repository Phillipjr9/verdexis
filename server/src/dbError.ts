export function isDbUnavailableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false

  const code = (err as { code?: string }).code
  if (typeof code === 'string' && /^(P1000|P1001|P1008|P1010|P1011|P1024|P1012)$/i.test(code)) {
    return true
  }

  const msg = err.message
  return /(?:error validating datasource|connection.*refused|connection.*reset|timeout|timed out|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|EPIPE|could not connect|database.*unavailable|database server|access denied|authentication failed|invalid datasource|must start with the protocol)/i.test(msg)
}
