declare module 'firebase-admin' {
  const admin: {
    initializeApp: (...args: unknown[]) => unknown
    credential: {
      cert: (...args: unknown[]) => unknown
    }
    messaging: () => {
      sendMulticast: (...args: unknown[]) => Promise<{
        successCount: number
        responses: Array<{ success: boolean }>
      }>
    }
  }

  export default admin
}
