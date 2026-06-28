const rateLimit = require('express-rate-limit');

// Strict login limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Strict registration limiter
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many accounts created from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

// OTP verification limiter
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: 'Too many OTP attempts, request a new code',
  standardHeaders: true,
  legacyHeaders: false
});

// Password reset limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many password reset attempts',
  standardHeaders: true,
  legacyHeaders: false
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

// Withdrawal limiter (strict)
const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many withdrawal requests, try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Transfer limiter
const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many transfer requests',
  standardHeaders: true,
  legacyHeaders: false
});

// Email send limiter
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many email requests',
  standardHeaders: true,
  legacyHeaders: false
});

// In-memory rate limit store
class RateLimitStore {
  constructor() {
    this.store = new Map();
    this.setInterval(() => this.cleanup(), 60 * 1000); // Cleanup every minute
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

  getCount(key) {
    const entry = this.store.get(key);
    if (!entry) return 0;

    if (Date.now() > entry.resetTime) {
      return 0;
    }

    return entry.count;
  }

  reset(key) {
    this.store.delete(key);
  }

  cleanup() {
    for (const [key, entry] of this.store.entries()) {
      if (Date.now() > entry.resetTime + 5 * 60 * 1000) {
        this.store.delete(key);
      }
    }
  }
}

// Brute force protection
class BruteForceProtection {
  constructor() {
    this.attempts = new Map();
    this.blockedIPs = new Map();
    this.suspiciousPatterns = [];
    this.setInterval(() => this.cleanup(), 60 * 1000);
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
    while (attempts.length > 0 && attempts[0] < cutoff) {
      attempts.shift();
    }

    // Check if threshold exceeded
    if (attempts.length > 5) {
      const blockUntil = Date.now() + (30 * 60 * 1000);
      this.blockedIPs.set(ip, blockUntil);
      return { blocked: true, blockUntil, attempts: attempts.length };
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

  reset(ip, action = 'login') {
    this.attempts.delete(`${ip}:${action}`);
  }

  addSuspiciousPattern(pattern) {
    this.suspiciousPatterns.push({
      pattern,
      timestamp: Date.now()
    });
  }

  getSuspiciousPatterns(limit = 100) {
    return this.suspiciousPatterns.slice(-limit);
  }

  cleanup() {
    const cutoff = Date.now() - (60 * 60 * 1000);

    // Clean attempts
    for (const [key, attempts] of this.attempts.entries()) {
      if (attempts.length === 0 || attempts[attempts.length - 1] < cutoff) {
        this.attempts.delete(key);
      }
    }

    // Clean blocked IPs
    for (const [ip, blockTime] of this.blockedIPs.entries()) {
      if (Date.now() > blockTime) {
        this.blockedIPs.delete(ip);
      }
    }

    // Clean old patterns
    this.suspiciousPatterns = this.suspiciousPatterns.filter(p => 
      Date.now() - p.timestamp < (24 * 60 * 60 * 1000)
    );
  }
}

// Middleware factories
const bruteForceMiddleware = (bruteForce, action = 'login') => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;

    if (bruteForce.isBlocked(ip)) {
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Try again in 30 minutes.'
      });
    }

    next();
  };
};

const recordFailureMiddleware = (bruteForce, action = 'login') => {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function(data) {
      if (data && !data.success) {
        const ip = req.ip || req.connection.remoteAddress;
        bruteForce.recordAttempt(ip, action);
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

const recordSuccessMiddleware = (bruteForce, action = 'login') => {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function(data) {
      if (data && data.success) {
        const ip = req.ip || req.connection.remoteAddress;
        bruteForce.reset(ip, action);
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

// Advanced rate limit monitor
class RateLimitMonitor {
  constructor() {
    this.metrics = {
      blockedRequests: 0,
      suspiciousIPs: new Set(),
      eventLog: []
    };
  }

  recordBlockedRequest(ip, endpoint, reason) {
    this.metrics.blockedRequests++;
    this.metrics.suspiciousIPs.add(ip);
    this.metrics.eventLog.push({
      timestamp: new Date().toISOString(),
      ip,
      endpoint,
      reason
    });
  }

  getMetrics() {
    return {
      blockedRequests: this.metrics.blockedRequests,
      suspiciousIPCount: this.metrics.suspiciousIPs.size,
      recentEvents: this.metrics.eventLog.slice(-100)
    };
  }

  getSuspiciousIPs() {
    return Array.from(this.metrics.suspiciousIPs);
  }

  clearMetrics() {
    this.metrics.blockedRequests = 0;
    this.metrics.suspiciousIPs.clear();
    this.metrics.eventLog = [];
  }
}

// Adaptive rate limiting based on threat level
class AdaptiveRateLimiter {
  constructor() {
    this.threatLevel = 'normal'; // normal, elevated, critical
    this.thresholds = {
      normal: { login: 5, register: 3, api: 100 },
      elevated: { login: 3, register: 2, api: 50 },
      critical: { login: 1, register: 1, api: 25 }
    };
    this.lastUpdate = Date.now();
  }

  setThreatLevel(level) {
    if (['normal', 'elevated', 'critical'].includes(level)) {
      this.threatLevel = level;
      this.lastUpdate = Date.now();
    }
  }

  getCurrentLimits() {
    return this.thresholds[this.threatLevel];
  }

  shouldAllowRequest(action, currentCount) {
    const limit = this.thresholds[this.threatLevel][action];
    return currentCount <= limit;
  }
}

module.exports = {
  loginLimiter,
  registerLimiter,
  otpLimiter,
  passwordResetLimiter,
  apiLimiter,
  withdrawalLimiter,
  transferLimiter,
  emailLimiter,
  RateLimitStore,
  BruteForceProtection,
  bruteForceMiddleware,
  recordFailureMiddleware,
  recordSuccessMiddleware,
  RateLimitMonitor,
  AdaptiveRateLimiter
};
