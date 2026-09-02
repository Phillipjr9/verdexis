import { portfolioStore } from './lib/portfolioStore'

const origFetch = window.fetch.bind(window)

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const method = String(init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET') || 'GET').toUpperCase()
  const res = await origFetch(input, init)
  if (res.ok && method === 'POST' && (/\/api\/withdrawals(?:\?|$)/.test(url) || /\/api\/wallet\/transactions(?:\?|$)/.test(url))) {
    void portfolioStore.hydrate(true)
  }
  return res
}
