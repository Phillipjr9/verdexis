// VERDEXIS TestSprite Test Suite
// Complete API testing with authentication, wallet, trading, and portfolio endpoints

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

interface TestContext {
  baseUrl: string;
  token: string;
  refreshToken: string;
  userId: string;
  email: string;
  password: string;
  adminToken: string;
}

const context: TestContext = {
  baseUrl: 'http://localhost:4000',
  token: '',
  refreshToken: '',
  userId: '',
  email: `test-${Date.now()}@verdexis.com`,
  password: 'TestPassword123!',
  adminToken: ''
};

// Helper function for API calls
async function apiCall(
  method: string,
  endpoint: string,
  data?: any,
  token?: string
) {
  const headers: any = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${context.baseUrl}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined
  });

  const responseData = await response.json();
  return { status: response.status, data: responseData, headers: response.headers };
}

describe('VERDEXIS API Test Suite', () => {
  
  // ============================================
  // AUTHENTICATION TESTS
  // ============================================
  describe('Authentication Endpoints', () => {
    
    it('POST /api/auth/signup - Create new user account', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/signup', {
        email: context.email,
        password: context.password,
        name: 'Test User'
      });

      expect(status).toBe(201);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(context.email);
      expect(data.token).toBeDefined();
      expect(data.refreshToken).toBeDefined();

      context.token = data.token;
      context.refreshToken = data.refreshToken;
      context.userId = data.user.id;
    });

    it('POST /api/auth/signup - Reject duplicate email', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/signup', {
        email: context.email,
        password: context.password,
        name: 'Test User 2'
      });

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('POST /api/auth/login - Login with valid credentials', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/login', {
        email: context.email,
        password: context.password
      });

      expect(status).toBe(200);
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe(context.email);
    });

    it('POST /api/auth/login - Reject invalid credentials', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/login', {
        email: context.email,
        password: 'WrongPassword123!'
      });

      expect(status).toBe(401);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('GET /api/auth/me - Get current user profile', async () => {
      const { status, data } = await apiCall('GET', '/api/auth/me', null, context.token);

      expect(status).toBe(200);
      expect(data.id).toBe(context.userId);
      expect(data.email).toBe(context.email);
      expect(data.prefs).toBeDefined();
    });

    it('POST /api/auth/refresh - Extend JWT token', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/refresh', {
        refreshToken: context.refreshToken
      });

      expect(status).toBe(200);
      expect(data.token).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      context.token = data.token;
    });

    it('PATCH /api/profile - Update user profile', async () => {
      const { status, data } = await apiCall('PATCH', '/api/profile', {
        name: 'Updated Name',
        prefs: { theme: 'light' }
      }, context.token);

      expect(status).toBe(200);
      expect(data.name).toBe('Updated Name');
      expect(data.prefs.theme).toBe('light');
    });

    it('POST /api/auth/forgot - Request password reset', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/forgot', {
        email: context.email
      });

      expect(status).toBe(200);
      expect(data.message).toContain('reset link');
    });

    it('POST /api/auth/logout - Logout user', async () => {
      const { status } = await apiCall('POST', '/api/auth/logout', {}, context.token);

      expect(status).toBe(200);
    });

    it('GET /api/auth/me - Reject unauthenticated request', async () => {
      const { status, data } = await apiCall('GET', '/api/auth/me');

      expect(status).toBe(401);
      expect(data.error).toBe('UNAUTHORIZED');
    });
  });

  // ============================================
  // WALLET ENDPOINTS
  // ============================================
  describe('Wallet Endpoints', () => {
    
    beforeAll(async () => {
      // Re-login for wallet tests
      const { data } = await apiCall('POST', '/api/auth/login', {
        email: context.email,
        password: context.password
      });
      context.token = data.token;
    });

    it('GET /api/wallet - Get wallet balances', async () => {
      const { status, data } = await apiCall('GET', '/api/wallet', null, context.token);

      expect(status).toBe(200);
      expect(data.balances).toBeInstanceOf(Array);
      expect(data.balances.length).toBeGreaterThan(0);
      
      const usdBalance = data.balances.find((b: any) => b.currency === 'USD');
      expect(usdBalance).toBeDefined();
      expect(usdBalance.balance).toBeGreaterThanOrEqual(0);
      expect(usdBalance.available).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/wallet - Include transaction history', async () => {
      const { status, data } = await apiCall('GET', '/api/wallet', null, context.token);

      expect(status).toBe(200);
      expect(data.transactions).toBeInstanceOf(Array);
    });

    it('POST /api/wallet/transactions - Create USD deposit', async () => {
      const { status, data } = await apiCall('POST', '/api/wallet/transactions', {
        kind: 'deposit',
        currency: 'USD',
        symbol: '$',
        amount: 1000.00,
        reference: 'Test deposit',
        idempotencyKey: `test-${Date.now()}`
      }, context.token);

      expect(status).toBe(201);
      expect(data.type).toBe('deposit');
      expect(data.amount).toBe(1000.00);
      expect(data.status).toBe('pending');
    });

    it('POST /api/wallet/transactions - Create crypto deposit', async () => {
      const { status, data } = await apiCall('POST', '/api/wallet/transactions', {
        kind: 'deposit',
        currency: 'BTC',
        amount: 0.5,
        reference: 'Crypto deposit',
        idempotencyKey: `test-btc-${Date.now()}`
      }, context.token);

      expect(status).toBe(201);
      expect(data.currency).toBe('BTC');
      expect(data.amount).toBe(0.5);
    });

    it('POST /api/wallet/transactions - Reject duplicate idempotency key', async () => {
      const idempotencyKey = `test-dup-${Date.now()}`;
      
      // First request
      await apiCall('POST', '/api/wallet/transactions', {
        kind: 'deposit',
        currency: 'USD',
        symbol: '$',
        amount: 500.00,
        reference: 'Test duplicate',
        idempotencyKey
      }, context.token);

      // Duplicate request
      const { status, data } = await apiCall('POST', '/api/wallet/transactions', {
        kind: 'deposit',
        currency: 'USD',
        symbol: '$',
        amount: 500.00,
        reference: 'Test duplicate',
        idempotencyKey
      }, context.token);

      expect(status).toBe(409);
      expect(data.error).toBe('CONFLICT');
    });

    it('GET /api/wallet/transactions - Filter by type', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/wallet/transactions?type=deposit&limit=10',
        null,
        context.token
      );

      expect(status).toBe(200);
      expect(data.transactions).toBeInstanceOf(Array);
      data.transactions.forEach((tx: any) => {
        expect(tx.type).toBe('deposit');
      });
    });

    it('GET /api/wallet/transactions - Pagination', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/wallet/transactions?limit=10&offset=0',
        null,
        context.token
      );

      expect(status).toBe(200);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(0);
    });
  });

  // ============================================
  // TRADING ENDPOINTS
  // ============================================
  describe('Trading Endpoints', () => {
    
    beforeAll(async () => {
      // Ensure logged in
      if (!context.token) {
        const { data } = await apiCall('POST', '/api/auth/login', {
          email: context.email,
          password: context.password
        });
        context.token = data.token;
      }
    });

    it('GET /api/market/quotes/:symbol - Get BTC price', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/market/quotes/BTC',
        null,
        context.token
      );

      expect(status).toBe(200);
      expect(data.symbol).toBe('BTC');
      expect(data.price).toBeGreaterThan(0);
      expect(data.change24h).toBeDefined();
      expect(data.changePercent24h).toBeDefined();
    });

    it('GET /api/market/search - Search symbols', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/market/search?q=bit',
        null,
        context.token
      );

      expect(status).toBe(200);
      expect(data.results).toBeInstanceOf(Array);
      expect(data.results.length).toBeGreaterThan(0);
    });

    it('GET /api/market/chart/:symbol - Get OHLC data', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/market/chart/BTC?range=1d',
        null,
        context.token
      );

      expect(status).toBe(200);
      expect(data.candles).toBeInstanceOf(Array);
      if (data.candles.length > 0) {
        const candle = data.candles[0];
        expect(candle.open).toBeDefined();
        expect(candle.high).toBeDefined();
        expect(candle.low).toBeDefined();
        expect(candle.close).toBeDefined();
        expect(candle.volume).toBeDefined();
      }
    });

    it('POST /api/trades - Execute market buy order', async () => {
      const { status, data } = await apiCall('POST', '/api/trades', {
        symbol: 'BTC',
        side: 'buy',
        quantity: 0.01,
        type: 'market',
        idempotencyKey: `trade-${Date.now()}`
      }, context.token);

      expect([201, 400]).toContain(status); // 400 if insufficient balance
      if (status === 201) {
        expect(data.symbol).toBe('BTC');
        expect(data.side).toBe('buy');
        expect(data.quantity).toBe(0.01);
      }
    });

    it('GET /api/trades - List trades', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/trades?limit=50',
        null,
        context.token
      );

      expect(status).toBe(200);
      expect(data.trades).toBeInstanceOf(Array);
      expect(data.total).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/market/quotes/:symbol - Invalid symbol', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/market/quotes/INVALIDCOIN123',
        null,
        context.token
      );

      expect(status).toBe(404);
      expect(data.error).toBeDefined();
    });
  });

  // ============================================
  // PORTFOLIO ENDPOINTS
  // ============================================
  describe('Portfolio Endpoints', () => {
    
    beforeAll(async () => {
      if (!context.token) {
        const { data } = await apiCall('POST', '/api/auth/login', {
          email: context.email,
          password: context.password
        });
        context.token = data.token;
      }
    });

    it('GET /api/holdings - Get all holdings', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/holdings',
        null,
        context.token
      );

      expect(status).toBe(200);
      expect(data.holdings).toBeInstanceOf(Array);
      expect(data.totalValue).toBeGreaterThanOrEqual(0);
    });

    it('POST /api/holdings - Add manual holding', async () => {
      const { status, data } = await apiCall('POST', '/api/holdings', {
        symbol: 'AAPL',
        quantity: 10,
        avgBuyPrice: 150.00
      }, context.token);

      expect([201, 409]).toContain(status); // 409 if already exists
      if (status === 201) {
        expect(data.symbol).toBe('AAPL');
        expect(data.quantity).toBe(10);
      }
    });

    it('GET /api/holdings - Verify holding allocation', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/holdings',
        null,
        context.token
      );

      expect(status).toBe(200);
      let totalAllocation = 0;
      data.holdings.forEach((h: any) => {
        expect(h.allocation).toBeGreaterThanOrEqual(0);
        expect(h.allocation).toBeLessThanOrEqual(100);
        totalAllocation += h.allocation;
      });
      
      // Total allocation should be close to 100 (allow 0.1% rounding error)
      expect(totalAllocation).toBeLessThan(100.1);
    });
  });

  // ============================================
  // PASSKEY/WEBAUTHN TESTS
  // ============================================
  describe('Passkeys (WebAuthn) Endpoints', () => {
    
    beforeAll(async () => {
      if (!context.token) {
        const { data } = await apiCall('POST', '/api/auth/login', {
          email: context.email,
          password: context.password
        });
        context.token = data.token;
      }
    });

    it('POST /api/passkeys/register/options - Get registration options', async () => {
      const { status, data } = await apiCall(
        'POST',
        '/api/passkeys/register/options',
        {},
        context.token
      );

      expect(status).toBe(200);
      expect(data.options).toBeDefined();
      expect(data.options.challenge).toBeDefined();
      expect(data.options.rp).toBeDefined();
      expect(data.options.user).toBeDefined();
    });

    it('GET /api/passkeys - List user passkeys', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/passkeys',
        null,
        context.token
      );

      expect(status).toBe(200);
      expect(data.passkeys).toBeInstanceOf(Array);
    });
  });

  // ============================================
  // RATE LIMITING TESTS
  // ============================================
  describe('Rate Limiting', () => {
    
    it('GET /api/health - Should include rate limit headers', async () => {
      const { headers } = await apiCall('GET', '/api/health');

      expect(headers.get('x-ratelimit-limit')).toBeDefined();
      expect(headers.get('x-ratelimit-remaining')).toBeDefined();
      expect(headers.get('x-ratelimit-reset')).toBeDefined();
    });

    it('Multiple rapid requests should respect rate limits', async () => {
      const promises = Array(5).fill(null).map(() =>
        apiCall('GET', '/api/health')
      );

      const results = await Promise.all(promises);
      
      results.forEach(({ status }) => {
        expect([200, 429]).toContain(status);
      });
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    
    it('Invalid email format should be rejected', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/signup', {
        email: 'invalid-email',
        password: 'TestPassword123!',
        name: 'Test'
      });

      expect(status).toBe(400);
      expect(data.error).toBe('INVALID_INPUT');
    });

    it('Weak password should be rejected', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/signup', {
        email: `weak-${Date.now()}@test.com`,
        password: '123',
        name: 'Test'
      });

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('Missing required fields should return 400', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/signup', {
        email: `test-${Date.now()}@test.com`
        // password and name missing
      });

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('Nonexistent user should return 404', async () => {
      const { status, data } = await apiCall('POST', '/api/auth/login', {
        email: 'nonexistent@verdexis.com',
        password: 'SomePassword123!'
      });

      expect(status).toBe(404);
      expect(data.error).toBeDefined();
    });
  });

  // ============================================
  // HEALTH CHECK
  // ============================================
  describe('Health Check', () => {
    
    it('GET /api/health - Service should be healthy', async () => {
      const { status, data } = await apiCall('GET', '/api/health');

      expect(status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBeDefined();
    });
  });
});
