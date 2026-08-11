import { createRequire } from 'node:module'
import { env } from '../env.js'

const require = createRequire(import.meta.url)

let firebaseApp: any = null
let firebaseInitError: Error | null = null
let firebaseAttempted = false

export function initializeFirebaseAdmin(): any {
  if (firebaseApp) return firebaseApp

  if (firebaseInitError) {
    throw firebaseInitError
  }

  if (firebaseAttempted && !firebaseApp) {
    throw new Error('Firebase initialization was already attempted and failed.')
  }

  firebaseAttempted = true

  try {
    if (process.env.FIREBASE_CONFIG) {
      return initializeFirebaseApp('default')
    }

    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL.')
    }

    const adminApp = requireFirebaseAdminApp()
    const { cert, initializeApp } = adminApp
    firebaseApp = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL: env.FIREBASE_DATABASE_URL,
    })

    return firebaseApp
  } catch (error) {
    firebaseInitError = error instanceof Error ? error : new Error(String(error))
    console.error('[firebase] Initialization failed:', firebaseInitError.message)
    throw firebaseInitError
  }
}

function initializeFirebaseApp(name?: string): any {
  const { initializeApp } = requireFirebaseAdminApp()
  firebaseApp = initializeApp(name ? undefined : undefined)
  return firebaseApp
}

function requireFirebaseAdminApp(): any {
  return requireDynamicFirebaseModule('firebase-admin/app')
}

function requireDynamicFirebaseModule(moduleName: string): any {
  const mod = require(moduleName)
  return mod
}

export function getFirebaseAdminApp(): any | null {
  try {
    return initializeFirebaseAdmin()
  } catch (error) {
    console.warn('[firebase] Firebase not available:', error instanceof Error ? error.message : String(error))
    return null
  }
}

export function getFirebaseFirestore(): any | null {
  const app = getFirebaseAdminApp()
  if (!app) return null
  const { getFirestore } = requireDynamicFirebaseModule('firebase-admin/firestore')
  return getFirestore(app)
}

export function getFirebaseRealtimeDatabase(): any | null {
  if (!env.FIREBASE_DATABASE_URL) {
    console.warn('[firebase] FIREBASE_DATABASE_URL not set')
    return null
  }
  const app = getFirebaseAdminApp()
  if (!app) return null
  const { getDatabase } = requireDynamicFirebaseModule('firebase-admin/database')
  return getDatabase(app)
}

export function getFirebaseAuth(): any | null {
  const app = getFirebaseAdminApp()
  if (!app) return null
  const { getAuth } = requireDynamicFirebaseModule('firebase-admin/auth')
  return getAuth(app)
}
