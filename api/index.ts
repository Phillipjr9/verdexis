import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
};

// Production API on Render (update if the service URL changes)
const BACKEND_URL =
  process.env.VERDEXIS_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'https://verdexis-fjqz.onrender.com';

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
