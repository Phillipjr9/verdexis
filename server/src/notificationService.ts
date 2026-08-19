import { createRequire } from 'node:module'
// Temporary bootstrap: re-fetch is not available at runtime.
// Full service restored in following commit.
export * from './notificationService.impl.js'
