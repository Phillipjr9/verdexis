import type { VercelRequest, VercelResponse } from '@vercel/node';

// Dynamic import fixes ESM/CommonJS incompatibility:
// The server is an ES Module (type: "module"), but Vercel's build output 
// uses CommonJS. Using dynamic import() allows loading ESM from CJS.
const appPromise = import('../server/src/index.js');

export default async (req: VercelRequest, res: VercelResponse) => {
  const app = await appPromise;
  // Properly invoke the Express app as middleware
  // The app object acts as a middleware function and will handle the request
  return app.default(req, res);
};

