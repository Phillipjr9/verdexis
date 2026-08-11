import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
};

const BACKEND_URL = 'https://verdexis-ckgz.onrender.com';

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Proxy the request to the Render backend
    const path = req.url || '/';
    const query = new URLSearchParams(typeof req.query === 'object' ? Object.entries(req.query).flat() : []).toString();
    const targetUrl = `${BACKEND_URL}${path}${query ? '?' + query : ''}`;
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...Object.entries(req.headers)
          .filter(([key]) => !['host', 'connection'].includes(key.toLowerCase()))
          .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {}),
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });
    
    const data = await response.text();
    res.status(response.status);
    Object.entries(response.headers).forEach(([key, val]) => {
      if (key.toLowerCase() !== 'content-encoding') res.setHeader(key, val);
    });
    res.end(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Bad Gateway', details: String(error) });
  }
};
