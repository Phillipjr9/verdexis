const rateLimit = require('express-rate-limit');

// Login rate limiter - strict
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Skip rate limiting for admin IPs (if configured)
    return false;
  }
});

// Registration rate limiter
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour
  message: 'Too many accounts created from this IP, please try later',
  standardHeaders: true,
  legacyHeaders: false
});

// OTP verification limiter - very strict
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // 3 OTP attempts
  message: 'Too many OTP attempts, please request a new code',
  standardHeaders: true,
  legacyHeaders: false
});

// Password reset limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 reset attempts
  message: 'Too many password reset attempts, please try later',
  standardHeaders: true,
  legacyHeaders: false
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Create custom store for advanced rate limiting
class InMemoryStore {
  constructor() {
    this.store = new Map();
  }

  increment(key) {
    if (!this.store.has(key)) {
      this.store.set(key, { count: 0, resetTime: Date.now() + 15 * 60 * 1000 });
    }
    
    const entry = this.store.get(key);
    
    if (Date.now() > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = Date.now() + 15 * 60 * 1000;
    }
    
    entry.count++;
    return entry.count;
  }

  isBlocked(key, maxAttempts) {
    const entry = this.store.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.resetTime) {
      return false;
    }
    
    return entry.count >= maxAttempts;
  }

  reset(key) {
    this.store.delete(key);
  }
}

// Custom brute force protection
class BruteForceProtection {
  constructor() {
    this.attempts = new Map();
    this.blockedIPs = new Map();
  }

  recordAttempt(ip, action = 'login') {
    const key = `${ip}:${action}`;
    
    if (!this.attempts.has(key)) {
      this.attempts.set(key, []);
    }
    
    const attempts = this.attempts.get(key);
    attempts.push(Date.now());
    
    // Remove attempts older than 15 minutes
    const cutoff = Date.now() - (15 * 60 * 1000);
    while (attempts[0] < cutoff) {
      attempts.shift();
    }
    
    // Check if blocked
    if (attempts.length > 5) {
      const blockUntil = Date.now() + (30 * 60 * 1000); // Block for 30 minutes
      this.blockedIPs.set(ip, blockUntil);
      return { blocked: true, blockUntil };
    }
    
    return { blocked: false, attempts: attempts.length };
  }

  isBlocked(ip) {
    const blockTime = this.blockedIPs.get(ip);
    
    if (!blockTime) return false;
    
    if (Date.now() > blockTime) {
      this.blockedIPs.delete(ip);
      return false;
    }
    
    return true;
  }

  reset(ip) {
    this.attempts.delete(`${ip}:login`);
    this.blockedIPs.delete(ip);
  }
}

// Middleware to check brute force
const bruteForceMiddleware = (bruteForce) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (bruteForce.isBlocked(ip)) {
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please try again in 30 minutes.'
      });
    }
    
    next();
  };
};

module.exports = {
  loginLimiter,
  registerLimiter,
  otpLimiter,
  passwordResetLimiter,
  apiLimiter,
  InMemoryStore,
  BruteForceProtection,
  bruteForceMiddleware
};