import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getDatabase, type Database } from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
}

const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)

export const firebaseApp: FirebaseApp | null = hasConfig
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
export const db: Database | null = firebaseApp ? getDatabase(firebaseApp) : null
export const isFirebaseConfigured = Boolean(firebaseApp && auth && db)

export function getFirebaseError(error: unknown) {
  if (error instanceof Error) return error
  return new Error(typeof error === 'string' ? error : 'Firebase request failed')
}
