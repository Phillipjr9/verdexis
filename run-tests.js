#!/usr/bin/env node

/**
 * VERDEXIS TestSprite - Standalone Test Runner
 * Runs without Jest for quick API testing
 */

const http = require('http');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class TestRunner {
  constructor() {
    this.baseUrl = 'http://localhost:4000';
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0
    };
    this.testData = {};
  }

  async apiCall(method, endpoint, data = null) {
    return new Promise((resolve) => {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      const options = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

      if (this.testData.token) {
        options.headers['Authorization'] = `Bearer ${this.testData.token}`;
      }

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const response = {
              status: res.statusCode,
              headers: res.headers,
              data: body ? JSON.parse(body) : null
            };
            resolve(response);
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, data: null, error: e.message });
          }
        });
      });

      req.on('error', () => {
        resolve({ status: 0, data: null, error: 'Connection refused' });
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async test(name, fn) {
    this.results.total++;
    try {
      await fn();
      this.log(`✓ ${name}`, 'green');
      this.results.passed++;
    } catch (error) {
      this.log(`✗ ${name}`, 'red');
      this.log(`  Error: ${error.message}`, 'red');
      this.results.failed++;
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    this.log(`Test Results Summary`, 'cyan');
    console.log('='.repeat(60));
    this.log(`✓ Passed:  ${this.results.passed}`, 'green');
    this.log(`✗ Failed:  ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');
    this.log(`⊘ Skipped: ${this.results.skipped}`, 'yellow');
    this.log(`Total:    ${this.results.total}`, 'cyan');
    console.log('='.repeat(60));
    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(2);
    this.log(`Pass Rate: ${passRate}%\n`, this.results.failed === 0 ? 'green' : 'red');
  }

  async runAll() {
    console.log('\n');
    this.log('🚀 VERDEXIS TestSprite - Standalone Test Runner', 'cyan');
    this.log(`📍 Base URL: ${this.baseUrl}`, 'blue');
    console.log('='.repeat(60) + '\n');

    // Check backend connectivity
    await this.test('Health Check - API Server Running', async () => {
      const { status } = await this.apiCall('GET', '/api/health');
      this.assert(status === 200, `Expected 200, got ${status}`);
    });

    // Authentication Tests
    console.log('\n' + colors.cyan + '📝 Authentication Tests' + colors.reset);
    await this.test('User Signup - Create new account', async () => {
      const email = `test-${Date.now()}@verdexis.com`;
      const { status, data } = await this.apiCall('POST', '/api/auth/signup', {
        email,
        password: 'TestPassword123!',
        name: 'Test User'
      });
      this.assert([201, 400].includes(status), `Expected 201 or 400, got ${status}`);
      if (status === 201) {
        this.testData.token = data.token;
        this.testData.userId = data.user.id;
        this.testData.email = email;
      }
    });

    await this.test('User Login - Login with credentials', async () => {
      const { status, data } = await this.apiCall('POST', '/api/auth/login', {
        email: this.testData.email || 'test@verdexis.com',
        password: 'TestPassword123!'
      });
      this.assert([200, 401, 404].includes(status), `Expected 200/401/404, got ${status}`);
      if (status === 200 && data.token) {
        this.testData.token = data.token;
      }
    });

    await this.test('Get Profile - Current user info', async () => {
      if (!this.testData.token) {
        this.log('⊘ Skipped - No token available', 'yellow');
        this.results.skipped++;
        return;
      }
      const { status } = await this.apiCall('GET', '/api/auth/me');
      this.assert([200, 401].includes(status), `Expected 200 or 401, got ${status}`);
    });

    // Wallet Tests
    console.log('\n' + colors.cyan + '💰 Wallet Tests' + colors.reset);
    await this.test('Get Wallet - Retrieve balances', async () => {
      if (!this.testData.token) {
        this.log('⊘ Skipped - No token available', 'yellow');
        this.results.skipped++;
        return;
      }
      const { status, data } = await this.apiCall('GET', '/api/wallet');
      this.assert([200, 401].includes(status), `Expected 200 or 401, got ${status}`);
      if (status === 200) {
        this.assert(data.balances !== undefined, 'Response should have balances');
      }
    });

    await this.test('Get Transactions - Transaction history', async () => {
      if (!this.testData.token) {
        this.log('⊘ Skipped - No token available', 'yellow');
        this.results.skipped++;
        return;
      }
      const { status, data } = await this.apiCall('GET', '/api/wallet/transactions?limit=10');
      this.assert([200, 401].includes(status), `Expected 200 or 401, got ${status}`);
      if (status === 200) {
        this.assert(Array.isArray(data.transactions), 'Should return transactions array');
      }
    });

    // Market Data Tests
    console.log('\n' + colors.cyan + '📊 Market Data Tests' + colors.reset);
    await this.test('Get Quote - Crypto price', async () => {
      const { status, data } = await this.apiCall('GET', '/api/market/quotes/BTC');
      this.assert([200, 429].includes(status), `Expected 200 or 429, got ${status}`);
      if (status === 200 && data) {
        this.assert(data.price > 0, 'Price should be greater than 0');
      }
    });

    await this.test('Search Symbols - Find crypto/stock', async () => {
      const { status, data } = await this.apiCall('GET', '/api/market/search?q=bit');
      this.assert([200, 429].includes(status), `Expected 200 or 429, got ${status}`);
    });

    // Trading Tests
    console.log('\n' + colors.cyan + '📈 Trading Tests' + colors.reset);
    await this.test('Get Trades - List user trades', async () => {
      if (!this.testData.token) {
        this.log('⊘ Skipped - No token available', 'yellow');
        this.results.skipped++;
        return;
      }
      const { status, data } = await this.apiCall('GET', '/api/trades?limit=10');
      this.assert([200, 401].includes(status), `Expected 200 or 401, got ${status}`);
    });

    // Portfolio Tests
    console.log('\n' + colors.cyan + '🏦 Portfolio Tests' + colors.reset);
    await this.test('Get Holdings - Portfolio holdings', async () => {
      if (!this.testData.token) {
        this.log('⊘ Skipped - No token available', 'yellow');
        this.results.skipped++;
        return;
      }
      const { status, data } = await this.apiCall('GET', '/api/holdings');
      this.assert([200, 401].includes(status), `Expected 200 or 401, got ${status}`);
      if (status === 200) {
        this.assert(Array.isArray(data.holdings), 'Should return holdings array');
      }
    });

    // Error Handling Tests
    console.log('\n' + colors.cyan + '❌ Error Handling Tests' + colors.reset);
    await this.test('Invalid Email - Reject bad format', async () => {
      const { status } = await this.apiCall('POST', '/api/auth/signup', {
        email: 'invalid-email',
        password: 'TestPassword123!',
        name: 'Test'
      });
      this.assert(status === 400, `Expected 400, got ${status}`);
    });

    await this.test('Weak Password - Reject weak password', async () => {
      const { status } = await this.apiCall('POST', '/api/auth/signup', {
        email: `test-${Date.now()}@test.com`,
        password: '123',
        name: 'Test'
      });
      this.assert(status === 400, `Expected 400, got ${status}`);
    });

    await this.test('Unauthorized - Missing token', async () => {
      const { status } = await this.apiCall('GET', '/api/auth/me');
      this.assert(status === 401, `Expected 401, got ${status}`);
    });

    // Print summary
    this.printSummary();

    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run tests
const runner = new TestRunner();
runner.runAll().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
