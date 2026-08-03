declare module 'firebase-admin' {
  export function initializeApp(options?: unknown): App
  export function auth(app?: App): auth.Auth
  export function database(app?: App): database.Database
  export function firestore(app?: App): firestore.Firestore

  export const credential: {
    cert: (serviceAccount: unknown) => unknown
  }

  export function messaging(app?: App): messaging.Messaging

  export interface App {
    name: string
    auth(): auth.Auth
    database(): database.Database
    firestore(): firestore.Firestore
  }

  export interface UserRecord {
    uid: string
    phoneNumber?: string
    displayName?: string
  }

  export interface DecodedIdToken {
    uid: string
    phone_number?: string
  }

  export namespace auth {
    interface Auth {
      createCustomToken(uid: string): Promise<string>
      verifyIdToken(idToken: string): Promise<DecodedIdToken>
      createUser(properties: { phoneNumber?: string; displayName?: string }): Promise<UserRecord>
      getUserByPhoneNumber(phoneNumber: string): Promise<UserRecord>
      deleteUser(uid: string): Promise<void>
      revokeRefreshTokens(uid: string): Promise<void>
    }
    interface UserRecord {
      uid: string
      phoneNumber?: string
      displayName?: string
    }
    interface DecodedIdToken {
      uid: string
      phone_number?: string
    }
  }

  export namespace database {
    interface DataSnapshot {
      exists(): boolean
      val(): any
    }
    interface Reference {
      child(path: string): Reference
      set(value: any): Promise<void>
      update(value: any): Promise<void>
      once(eventType: string): Promise<DataSnapshot>
    }
    interface Database {
      ref(path?: string): Reference
    }
  }

  export namespace firestore {
    interface Firestore {}
  }

  export namespace messaging {
    interface Messaging {
      sendMulticast(...args: unknown[]): Promise<{ successCount: number; responses: Array<{ success: boolean }> }>
    }
  }
}
