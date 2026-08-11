import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
};

const BACKEND_URL = 'https://verdexis-ckgz.onrender.com';

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Build target URL with query string
    const pathWithQuery = req.url?.includes('?') 
      ? req.url 
      : `${req.url || '/'}${Object.keys(req.query || {}).length > 0 ? '?' + new URLSearchParams(req.query as Record<string, string>).toString() : ''}`;
    
    const targetUrl = `${BACKEND_URL}${pathWithQuery}`;
    console.log(`Proxying ${req.method} ${targetUrl}`);
    
    // Prepare headers
    const headers: Record<string, string> = {};
    Object.entries(req.headers).forEach(([key, val]) => {
      if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
        headers[key] = String(val);
      }
    });
    
    // Prepare body
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
    
    // Copy response headers
    Object.entries(response.headers.raw?.() || {}).forEach(([key, values]) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, Array.isArray(values) ? values[0] : values);
      }
    });
    
    res.end(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ error: 'Bad Gateway', details: String(error) });
  }
};
