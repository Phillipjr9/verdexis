import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth'
import { get, ref, set, serverTimestamp } from 'firebase/database'
import { auth, db, getFirebaseError, isFirebaseConfigured } from './firebase'

export interface FirebaseUserProfile {
  uid: string
  email: string | null
  name: string | null
  phone: string | null
  role: 'user' | 'admin'
  createdAt?: unknown
  updatedAt?: unknown
}

function assertFirebaseReady() {
  if (!isFirebaseConfigured || !auth || !db) {
    throw new Error('Firebase is not configured for this app.')
  }
}

export async function signUpWithFirebase(email: string, password: string, name: string, phone: string) {
  assertFirebaseReady()
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  if (!credential.user) {
    throw new Error('Failed to create Firebase user')
  }

  await updateProfile(credential.user, { displayName: name })

  const profile: FirebaseUserProfile = {
    uid: credential.user.uid,
    email: credential.user.email,
    name,
    phone,
    role: 'user',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await set(ref(db, `users/${credential.user.uid}`), profile)

  return { user: credential.user, profile }
}

export async function signInWithFirebase(email: string, password: string) {
  assertFirebaseReady()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  if (!credential.user) {
    throw new Error('Failed to sign in Firebase user')
  }

  const profileRef = ref(db, `users/${credential.user.uid}`)
  const existing = await get(profileRef)
  let profile: FirebaseUserProfile | null = null

  if (existing.exists()) {
    profile = existing.val() as FirebaseUserProfile
  } else {
    profile = {
      uid: credential.user.uid,
      email: credential.user.email,
      name: credential.user.displayName || 'User',
      phone: null,
      role: 'user',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await set(profileRef, profile)
  }

  return { user: credential.user, profile }
}

export async function signOutFirebase() {
  assertFirebaseReady()
  await firebaseSignOut(auth)
}

export async function resetPasswordFirebase(email: string) {
  assertFirebaseReady()
  await sendPasswordResetEmail(auth, email)
}

export async function getCurrentFirebaseUserProfile(uid: string): Promise<FirebaseUserProfile | null> {
  assertFirebaseReady()
  const snap = await get(ref(db, `users/${uid}`))
  return snap.exists() ? (snap.val() as FirebaseUserProfile) : null
}

export function getFirebaseUserDisplayName(user: User | null | undefined) {
  return user?.displayName || user?.email || 'User'
}

export function toFirebaseUserShape(user: User, profile?: FirebaseUserProfile | null) {
  return {
    id: user.uid,
    email: user.email || '',
    username: null,
    name: profile?.name || user.displayName || 'User',
    avatar: null,
    twoFactor: false,
    prefs: {},
    role: profile?.role || 'user',
    suspended: false,
    investmentId: null,
    kycStatus: 'none' as const,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerified ? new Date().toISOString() : null,
  }
}

export { getFirebaseError }
