import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
};

// Dynamic import fixes ESM/CommonJS incompatibility.
const appPromise = import('../server/dist/index.js');

export default async (req: VercelRequest, res: VercelResponse) => {
  const app = await appPromise;
  return app.default(req, res);
};
