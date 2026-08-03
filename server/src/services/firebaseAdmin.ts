import { cert, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getDatabase, type Database } from 'firebase-admin/database'
import { env } from '../env.js'

let firebaseApp: App | null = null
let firebaseInitError: Error | null = null
let firebaseAttempted = false

export function initializeFirebaseAdmin(): App {
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
      firebaseApp = initializeApp()
      return firebaseApp
    }

    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL.')
    }

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

export function getFirebaseAdminApp(): App | null {
  try {
    return initializeFirebaseAdmin()
  } catch (error) {
    console.warn('[firebase] Firebase not available:', error instanceof Error ? error.message : String(error))
    return null
  }
}

export function getFirebaseFirestore(): Firestore | null {
  const app = getFirebaseAdminApp()
  return app ? getFirestore(app) : null
}

export function getFirebaseRealtimeDatabase(): Database | null {
  if (!env.FIREBASE_DATABASE_URL) {
    console.warn('[firebase] FIREBASE_DATABASE_URL not set')
    return null
  }
  const app = getFirebaseAdminApp()
  return app ? getDatabase(app) : null
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseAdminApp()
  return app ? getAuth(app) : null
}
