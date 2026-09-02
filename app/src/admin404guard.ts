// Older Render builds do not mount /api/security/*. A single 404 from
// those calls used to fail the whole admin console (Promise.all).
const origFetch = window.fetch.bind(window)

function emptySessionsBody(url: string): string {
  return /[?&]userId=/.test(url)
    ? JSON.stringify({ sessions: [] })
    : JSON.stringify({
        stats: {
          totalActiveSessions: 0,
          otpVerifiedSessions: 0,
          expiredSessions: 0,
          averageSessionDuration: 0,
        },
      })
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const res = await origFetch(input, init)
  if (res.status !== 404) return res
  if (/\/api\/security\/sessions(?:\?|$)/.test(url)) {
    return new Response(emptySessionsBody(url), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (/\/api\/admin\/reviews(?:\?|$)/.test(url)) {
    return new Response(JSON.stringify({ reviews: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return res
}
