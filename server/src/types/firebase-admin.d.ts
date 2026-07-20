declare module 'firebase-admin' {
  export function initializeApp(options?: unknown): App
  export function auth(app?: App): Auth

  export const credential: {
    cert: (serviceAccount: unknown) => unknown
  }

  export function messaging(): {
    sendMulticast: (...args: unknown[]) => Promise<{
      successCount: number
      responses: Array<{ success: boolean }>
    }>
  }

  export interface App {
    name: string
  }

  export interface Auth {
    createCustomToken(uid: string): Promise<string>
    verifyIdToken(idToken: string): Promise<DecodedIdToken>
    createUser(properties: { phoneNumber?: string; displayName?: string }): Promise<UserRecord>
    getUserByPhoneNumber(phoneNumber: string): Promise<UserRecord>
    deleteUser(uid: string): Promise<void>
    revokeRefreshTokens(uid: string): Promise<void>
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

  export namespace app {
    interface App {
      name: string
    }
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
}
