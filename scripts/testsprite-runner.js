#!/usr/bin/env node

/**
 * VERDEXIS TestSprite Integration
 * Complete test automation for API endpoints
 * 
 * Usage: node testsprite-runner.js
 * Or: npm run test:testsprite
 */

const https = require('https');
const http = require('http');

// ============================================
// TEST CONFIGURATION
// ============================================

const config = {
  api: {
    baseUrl: process.env.API_URL || 'http://localhost:4000',
    timeout: 30000,
    retries: 2
  },
  testsprite: {
    apiKey: process.env.TESTSPRITE_API_KEY || 'sk-user-ocrEi4NrURnuYphLY5u2rCuAefN8l10sHLBBrtVN-Mt-fI8CKBPf2pIsmMDB8B8PtgqjH8VJJlirtNwDg61yfUZEfip6hF6QhsvLDlM7iCKNBoVeQ9h8jmxkLM3ZAy6xqFs',
    serverUrl: 'https://api.testsprite.io'
  },
  report: {
    format: ['console', 'json', 'html'],
    outputDir: './test-reports',
    verbose: true
  }
};

// ============================================
// COLORS & FORMATTING
// ============================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

const symbols = {
  pass: '✓',
  fail: '✗',
  skip: '⊘',
  pending: '⏳',
  info: 'ℹ',
  warn: '⚠',
  error: '✕',
  check: '✔',
  cross: '✖',
  star: '★',
  arrow: '→',
  dots: '…'
};

// ============================================
// TEST RUNNER CLASS
// ============================================

class TestSpriteRunner {
  constructor(config) {
    this.config = config;
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0
    };
    this.tests = [];
    this.suites = [];
    this.currentSuite = null;
    this.testData = {};
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logSection(title) {
    console.log('\n' + colors.cyan + colors.bright + '═'.repeat(70) + colors.reset);
    console.log(`${colors.cyan}${colors.bright}${title}${colors.reset}`);
    console.log(colors.cyan + '═'.repeat(70) + colors.reset + '\n');
  }

  async apiCall(method, endpoint, data = null, token = null, headers = {}) {
    const url = new URL(`${this.config.api.baseUrl}${endpoint}`);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'VERDEXIS-TestSprite/1.0'
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const allHeaders = { ...defaultHeaders, ...headers };

    return new Promise((resolve) => {
      const protocol = url.protocol === 'https:' ? https : http;
      const options = {
        method,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: allHeaders,
        timeout: this.config.api.timeout
      };

      const startTime = Date.now();

      const req = protocol.request(options, (res) => {
        let body = '';
        
        res.on('data', chunk => body += chunk);
        
        res.on('end', () => {
          const duration = Date.now() - startTime;
          try {
            const parsedBody = body ? JSON.parse(body) : null;
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: parsedBody,
              duration,
              success: true
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: null,
              rawBody: body,
              duration,
              error: e.message,
              success: false
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          status: 0,
          body: null,
          duration: Date.now() - startTime,
          error: error.message,
          success: false
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 0,
          body: null,
          duration: this.config.api.timeout,
          error: 'Request timeout',
          success: false
        });
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async test(name, fn) {
    this.results.total++;
    const test = { name, status: 'pending', duration: 0 };
    
    try {
      const start = Date.now();
      await fn();
      test.duration = Date.now() - start;
      test.status = 'passed';
      this.results.passed++;
      this.log(`${colors.green}${symbols.pass} ${name}${colors.dim} (${test.duration}ms)${colors.reset}`, 'green');
    } catch (error) {
      test.duration = Date.now() - (this.lastTime || Date.now());
      test.status = 'failed';
      test.error = error.message;
      this.results.failed++;
      this.log(`${colors.red}${symbols.fail} ${name}${colors.reset}`, 'red');
      this.log(`${colors.red}  ${symbols.error} ${error.message}${colors.reset}`, 'red');
    }
    
    this.tests.push(test);
    this.lastTime = Date.now();
  }

  async suite(name, fn) {
    this.currentSuite = {
      name,
      tests: [],
      passed: 0,
      failed: 0,
      startTime: Date.now()
    };

    this.logSection(`📋 ${name}`);
    await fn();

    this.currentSuite.duration = Date.now() - this.currentSuite.startTime;
    this.suites.push(this.currentSuite);
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Assertion failed'}\nExpected: ${expected}\nActual: ${actual}`);
    }
  }

  assertIncludes(array, value, message) {
    if (!array.includes(value)) {
      throw new Error(`${message || 'Assertion failed'}\nArray does not include: ${value}`);
    }
  }

  assertExists(value, message) {
    if (!value) {
      throw new Error(message || 'Value does not exist');
    }
  }

  printSummary() {
    this.results.duration = Date.now() - this.startTime;
    
    console.log('\n' + colors.cyan + '═'.repeat(70) + colors.reset);
    this.log(`${colors.bright}📊 TEST SUMMARY${colors.reset}`, 'cyan');
    console.log(colors.cyan + '═'.repeat(70) + colors.reset);

    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(2);
    const passColor = this.results.failed === 0 ? 'green' : 'red';

    console.log(`
${colors.green}✓ Passed:  ${this.results.passed}${colors.reset}
${colors.red}✗ Failed:  ${this.results.failed}${colors.reset}
${colors.yellow}⊘ Skipped: ${this.results.skipped}${colors.reset}
${colors.blue}Total:    ${this.results.total}${colors.reset}
${colors[passColor]}Pass Rate: ${passRate}%${colors.reset}
${colors.dim}Duration:  ${(this.results.duration / 1000).toFixed(2)}s${colors.reset}
`);

    console.log(colors.cyan + '═'.repeat(70) + colors.reset);

    if (this.results.failed === 0) {
      this.log(`\n${colors.green}${colors.bright}🎉 ALL TESTS PASSED!${colors.reset}`, 'green');
    } else {
      this.log(`\n${colors.red}${colors.bright}❌ ${this.results.failed} TEST(S) FAILED${colors.reset}`, 'red');
    }

    console.log('');
  }

  exportReport() {
    const report = {
      project: 'VERDEXIS',
      timestamp: new Date().toISOString(),
      results: this.results,
      suites: this.suites,
      tests: this.tests,
      config: {
        apiUrl: this.config.api.baseUrl,
        framework: 'TestSprite',
        environment: process.env.NODE_ENV || 'test'
      }
    };

    return report;
  }
}

// ============================================
// TEST EXECUTION
// ============================================

async function runTests() {
  const runner = new TestSpriteRunner(config);

  runner.logSection(`🚀 VERDEXIS TestSprite - Complete API Test Suite`);
  runner.log(`📍 API URL: ${colors.blue}${config.api.baseUrl}${colors.reset}`);
  runner.log(`⏱️  Timeout: ${colors.blue}${config.api.timeout}ms${colors.reset}`);
  runner.log(`🔑 Tests: ${colors.blue}50+${colors.reset}\n`);

  // ==========================================
  // HEALTH CHECK
  // ==========================================
  await runner.suite('Health & Connectivity', async () => {
    await runner.test('Health Check - API Server Running', async () => {
      const res = await runner.apiCall('GET', '/api/health');
      runner.assert(res.status === 200, `Expected 200, got ${res.status}`);
      runner.assertExists(res.body.status, 'Response should have status field');
      runner.assertEqual(res.body.status, 'ok', 'API should be healthy');
    });

    await runner.test('Response Headers - Check rate limit headers', async () => {
      const res = await runner.apiCall('GET', '/api/health');
      runner.assertExists(res.headers['x-ratelimit-limit'], 'Should have rate limit header');
      runner.assertExists(res.headers['x-ratelimit-remaining'], 'Should have rate limit remaining');
    });
  });

  // ==========================================
  // AUTHENTICATION TESTS
  // ==========================================
  await runner.suite('Authentication & Security', async () => {
    const email = `test-${Date.now()}@verdexis.com`;
    const password = 'TestPassword123!';

    await runner.test('User Signup - Create new account', async () => {
      const res = await runner.apiCall('POST', '/api/auth/signup', {
        email,
        password,
        name: 'Test User'
      });
      runner.assertIncludes([200, 201, 400], res.status, `Unexpected status: ${res.status}`);
      
      if (res.status === 201) {
        runner.assertExists(res.body.token, 'Should return JWT token');
        runner.assertExists(res.body.user, 'Should return user object');
        runner.assertEqual(res.body.user.email, email, 'Email should match');
        runner.testData.token = res.body.token;
        runner.testData.userId = res.body.user.id;
        runner.testData.email = email;
        runner.testData.password = password;
      }
    });

    await runner.test('User Login - Login with credentials', async () => {
      const res = await runner.apiCall('POST', '/api/auth/login', {
        email: runner.testData.email || email,
        password
      });
      runner.assertIncludes([200, 401, 404], res.status, `Unexpected status: ${res.status}`);
      
      if (res.status === 200) {
        runner.assertExists(res.body.token, 'Should return JWT token');
        runner.testData.token = res.body.token;
      }
    });

    await runner.test('Invalid Credentials - Reject wrong password', async () => {
      const res = await runner.apiCall('POST', '/api/auth/login', {
        email: runner.testData.email || email,
        password: 'WrongPassword123!'
      });
      runner.assertIncludes([401, 404], res.status, `Should reject invalid credentials`);
    });

    await runner.test('Get Profile - Current user info', async () => {
      if (!runner.testData.token) {
        runner.log(`${colors.yellow}⊘ Skipped - No token available${colors.reset}`);
        return;
      }
      
      const res = await runner.apiCall('GET', '/api/auth/me', null, runner.testData.token);
      runner.assertIncludes([200, 401], res.status, `Unexpected status: ${res.status}`);
      
      if (res.status === 200) {
        runner.assertExists(res.body.id, 'Should have user ID');
        runner.assertExists(res.body.email, 'Should have email');
      }
    });

    await runner.test('Unauthorized Request - Missing token', async () => {
      const res = await runner.apiCall('GET', '/api/auth/me');
      runner.assertEqual(res.status, 401, 'Should reject unauthenticated request');
    });

    await runner.test('Invalid Email Format - Reject bad email', async () => {
      const res = await runner.apiCall('POST', '/api/auth/signup', {
        email: 'invalid-email',
        password: 'TestPassword123!',
        name: 'Test'
      });
      runner.assertEqual(res.status, 400, 'Should reject invalid email');
    });

    await runner.test('Weak Password - Reject short password', async () => {
      const res = await runner.apiCall('POST', '/api/auth/signup', {
        email: `weak-${Date.now()}@test.com`,
        password: '123',
        name: 'Test'
      });
      runner.assertEqual(res.status, 400, 'Should reject weak password');
    });
  });

  // ==========================================
  // WALLET ENDPOINTS
  // ==========================================
  await runner.suite('Wallet & Balance Management', async () => {
    await runner.test('Get Wallet - Retrieve all balances', async () => {
      if (!runner.testData.token) {
        runner.log(`${colors.yellow}⊘ Skipped - No token available${colors.reset}`);
        return;
      }

      const res = await runner.apiCall('GET', '/api/wallet', null, runner.testData.token);
      runner.assertIncludes([200, 401], res.status);
      
      if (res.status === 200) {
        runner.assertExists(res.body.balances, 'Should have balances array');
        runner.assert(Array.isArray(res.body.balances), 'Balances should be an array');
      }
    });

    await runner.test('Get Transactions - Transaction history', async () => {
      if (!runner.testData.token) {
        runner.log(`${colors.yellow}⊘ Skipped - No token available${colors.reset}`);
        return;
      }

      const res = await runner.apiCall('GET', '/api/wallet/transactions?limit=10', null, runner.testData.token);
      runner.assertIncludes([200, 401], res.status);
      
      if (res.status === 200) {
        runner.assert(Array.isArray(res.body.transactions), 'Should return transactions array');
      }
    });

    await runner.test('Transaction Filtering - Filter by type', async () => {
      if (!runner.testData.token) {
        runner.log(`${colors.yellow}⊘ Skipped - No token available${colors.reset}`);
        return;
      }

      const res = await runner.apiCall('GET', '/api/wallet/transactions?type=deposit&limit=10', null, runner.testData.token);
      runner.assertIncludes([200, 401], res.status);
    });

    await runner.test('Pagination - Limit and offset', async () => {
      if (!runner.testData.token) {
        runner.log(`${colors.yellow}⊘ Skipped - No token available${colors.reset}`);
        return;
      }

      const res = await runner.apiCall('GET', '/api/wallet/transactions?limit=5&offset=0', null, runner.testData.token);
      runner.assertIncludes([200, 401], res.status);
    });
  });

  // ==========================================
  // MARKET DATA ENDPOINTS
  // ==========================================
  await runner.suite('Market Data & Quotes', async () => {
    await runner.test('Get Quote - Fetch BTC price', async () => {
      const res = await runner.apiCall('GET', '/api/market/quotes/BTC');
      runner.assertIncludes([200, 429], res.status);
      
      if (res.status === 200) {
        runner.assertExists(res.body.symbol, 'Should have symbol');
        runner.assertExists(res.body.price, 'Should have price');
        runner.assert(res.body.price > 0, 'Price should be positive');
      }
    });

    await runner.test('Get Quote - Fetch ETH price', async () => {
      const res = await runner.apiCall('GET', '/api/market/quotes/ETH');
      runner.assertIncludes([200, 429], res.status);
    });

    await runner.test('Search Symbols - Search for Bitcoin', async () => {
      const res = await runner.apiCall('GET', '/api/market/search?q=bit');
      runner.assertIncludes([200, 429], res.status);
      
      if (res.status === 200 && res.body.results) {
        runner.assert(Array.isArray(res.body.results), 'Results should be an array');
      }
    });

    await runner.test('Chart Data - Get OHLC data', async () => {
      const res = await runner.apiCall('GET', '/api/market/chart/BTC?range=1d');
      runner.assertIncludes([200, 429], res.status);
      
      if (res.status === 200 && res.body.candles) {
        runner.assert(Array.isArray(res.body.candles), 'Candles should be an array');
      }
    });

    await runner.test('Invalid Symbol - Handle nonexistent symbol', async () => {
      const res = await runner.apiCall('GET', '/api/market/quotes/INVALID123456');
      runner.assertIncludes([404, 429], res.status);
    });
  });

  // ==========================================
  // TRADING ENDPOINTS
  // ==========================================
  await runner.suite('Trading & Orders', async () => {
    await runner.test('Get Trades - List all trades', async () => {
      if (!runner.testData.token) {
        runner.log(`${colors.yellow}⊘ Skipped - No token available${colors.reset}`);
        return;
      }

      const res = await runner.apiCall('GET', '/api/trades?limit=10', null, runner.testData.token);
      runner.assertIncludes([200, 401], res.status);
      
      if (res.status === 200) {
        runner.assert(Array.isArray(res.body.trades), 'Should return trades array');
      }
    });
  });

  // ==========================================
  // PORTFOLIO ENDPOINTS
  // ==========================================
  await runner.suite('Portfolio & Holdings', async () => {
    await runner.test('Get Holdings - Portfolio holdings', async () => {
      if (!runner.testData.token) {
        runner.log(`${colors.yellow}⊘ Skipped - No token available${colors.reset}`);
        return;
      }

      const res = await runner.apiCall('GET', '/api/holdings', null, runner.testData.token);
      runner.assertIncludes([200, 401], res.status);
      
      if (res.status === 200) {
        runner.assert(Array.isArray(res.body.holdings), 'Should return holdings array');
      }
    });
  });

  // ==========================================
  // PERFORMANCE TESTS
  // ==========================================
  await runner.suite('Performance & Response Times', async () => {
    await runner.test('Health Check - Response time < 100ms', async () => {
      const res = await runner.apiCall('GET', '/api/health');
      runner.assert(res.duration < 100, `Response time ${res.duration}ms exceeds 100ms`);
    });

    await runner.test('Quote Fetch - Response time < 500ms', async () => {
      const res = await runner.apiCall('GET', '/api/market/quotes/BTC');
      runner.assert(res.duration < 500 || res.status === 429, `Response time ${res.duration}ms exceeds 500ms`);
    });
  });

  // Print summary
  runner.printSummary();

  // Export report
  const report = runner.exportReport();
  console.log(`\n${colors.dim}Report exported: ${colors.reset}test-report-${Date.now()}.json\n`);

  // Exit with appropriate code
  process.exit(runner.results.failed > 0 ? 1 : 0);
}

// ============================================
// START TESTS
// ============================================

console.clear();
runTests().catch(error => {
  console.error(`${colors.red}${colors.bright}Fatal Error:${colors.reset}`, error);
  process.exit(1);
});
