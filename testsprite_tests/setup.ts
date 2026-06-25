// Test Setup for VERDEXIS TestSprite Suite

// Global test timeout
jest.setTimeout(30000);

// Mock console in tests to reduce noise
const originalLog = console.log;
const originalError = console.error;

beforeAll(() => {
  console.log('🚀 Starting VERDEXIS TestSprite Suite');
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'test'}`);
  console.log(`🔗 API Base URL: http://localhost:4000`);
  console.log('─'.repeat(60));
});

afterAll(() => {
  console.log('─'.repeat(60));
  console.log('✅ Test Suite Complete');
});

// Suppress verbose logging
process.env.DEBUG = '';

// Global error handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Add custom matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
    };
  },

  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;
    const pass = jwtRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid JWT`
          : `expected ${received} to be a valid JWT`,
    };
  },

  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid email`
          : `expected ${received} to be a valid email`,
    };
  },

  toBeValidEthereumAddress(received) {
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    const pass = ethRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid Ethereum address`
          : `expected ${received} to be a valid Ethereum address`,
    };
  },

  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});

// Declare custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidJWT(): R;
      toBeValidEmail(): R;
      toBeValidEthereumAddress(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}
