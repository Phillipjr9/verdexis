/**
 * Compatibility entry: production boots from index.ts.
 * Keep this module exporting the same Express app so any importer of ./app works.
 */
export { default } from './index.js'
