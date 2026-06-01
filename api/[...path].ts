import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/src/index';

export default (req: VercelRequest, res: VercelResponse) => {
  // Properly invoke the Express app as middleware
  // The app object acts as a middleware function and will handle the request
  return app(req, res);
};

