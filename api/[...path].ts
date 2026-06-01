import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/src/index';

export default async (req: VercelRequest, res: VercelResponse) => {
  return new Promise<void>((resolve, reject) => {
    // Use the Express app to handle the request
    app(req as any, res as any);
    
    // Wait for the response to finish
    res.on('finish', () => resolve());
    res.on('error', reject);
    
    // Add a timeout to prevent hanging
    setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ error: 'Gateway timeout' });
      }
      resolve();
    }, 25000); // Vercel function timeout is 30s, so we timeout at 25s
  });
};

