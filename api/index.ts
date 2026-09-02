import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
};

// Production API on Render — keep in sync with live service URL
const BACKEND_URL =
  process.env.VERDEXIS_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'https://verdexis-fjqz.onrender.com';

function requestPath(req: VercelRequest): string {
  const raw = String(req.url || '/')
  return raw.split('?')[0]
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const pathWithQuery = req.url?.includes('?')
      ? req.url
      : `${req.url || '/'}${Object.keys(req.query || {}).length > 0 ? '?' + new URLSearchParams(req.query as Record<string, string>).toString() : ''}`;

    const targetUrl = `${BACKEND_URL}${pathWithQuery}`;
    console.log(`Proxying ${req.method} ${targetUrl}`);

    const headers: Record<string, string> = {};
    Object.entries(req.headers).forEach(([key, val]) => {
      if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
        headers[key] = String(val);
      }
    });

    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const data = await response.text();

    // The admin console calls /api/security/sessions. Older Render builds
    // do not mount that router, so the proxy used to forward a raw 404 and
    // the dashboard treated the whole page as failed.
    if (response.status === 404 && req.method === 'GET' && requestPath(req).startsWith('/api/security/sessions')) {
      const hasUser = /[?&]userId=/.test(String(req.url || ''))
      res.status(200).setHeader('content-type', 'application/json')
      res.end(hasUser
        ? JSON.stringify({ sessions: [] })
        : JSON.stringify({ stats: { totalActiveSessions: 0, otpVerifiedSessions: 0, expiredSessions: 0, averageSessionDuration: 0 } }))
      return
    }

    res.status(response.status);

    for (const [key, value] of response.headers.entries()) {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    }

    res.end(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Bad Gateway', details: String(error) });
  }
};
