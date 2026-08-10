import fetch from 'node-fetch'
import { chromium } from 'playwright'

const ORIGIN = process.env.PASSKEY_TARGET || 'https://verdexis-ckgz.onrender.com'
const ADMIN = {
  email: process.env.PASSKEY_ADMIN_EMAIL || 'admin@verdexisgroup.com',
  password: process.env.PASSKEY_ADMIN_PASSWORD || 'Admin@Verdexis2024',
}

async function login() {
  const resp = await fetch(`${ORIGIN}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ADMIN),
  })
  const j = await resp.json()
  if (!j || (!j.token && !j.user?.token)) throw new Error('login failed: ' + JSON.stringify(j))
  return j.token || j.user.token || j.token
}

async function run() {
  const token = await login()
  console.log('Got token')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(ORIGIN)

  // Enable WebAuthn virtual authenticator via CDP
  const client = await context.newCDPSession(page)
  await client.send('WebAuthn.enable')
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'usb',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  })
  console.log('Added virtual authenticator', authenticatorId)

  // Fetch registration options via Playwright request (avoids CORS)
  const regResp = await page.request.post(ORIGIN + '/api/passkeys/register/options', {
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
    data: {},
  })
  const regOptionsResp = await regResp.json()
  if (!regOptionsResp || !regOptionsResp.options) {
    console.error('Registration options response:', regOptionsResp)
    await browser.close()
    process.exit(1)
  }
  const { options, challengeKey } = regOptionsResp
  console.log('Received registration options, challengeKey=', challengeKey)

  // Use page.evaluate to call navigator.credentials.create with proper ArrayBuffers
  const credential = await page.evaluate(async (options) => {
    function base64urlToBuffer(base64url) {
      base64url = base64url.replace(/-/g, '+').replace(/_/g, '/')
      while (base64url.length % 4) base64url += '='
      return Uint8Array.from(atob(base64url), c => c.charCodeAt(0)).buffer
    }
    // Convert challenge and user.id
    options.challenge = base64urlToBuffer(options.challenge)
    options.user.id = base64urlToBuffer(options.user.id)
    if (options.excludeCredentials) {
      options.excludeCredentials = options.excludeCredentials.map(c => ({ ...c, id: base64urlToBuffer(c.id) }))
    }
    const cred = await navigator.credentials.create({ publicKey: options })
    if (!cred) return null
    const response = cred.response
    const toBase64Url = (buf) => {
      const b = btoa(String.fromCharCode(...new Uint8Array(buf)))
      return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    return {
      id: cred.id,
      rawId: toBase64Url(cred.rawId),
      response: {
        attestationObject: toBase64Url(response.attestationObject),
        clientDataJSON: toBase64Url(response.clientDataJSON),
      },
      type: cred.type,
    }
  }, options)

  if (!credential) {
    console.error('navigator.credentials.create returned null')
    await browser.close()
    process.exit(1)
  }

  // Send verification to server via Playwright request
  const verifyRegResp = await page.request.post(ORIGIN + '/api/passkeys/register/verify', {
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
    data: { response: credential, deviceName: 'Playwright Virtual Authenticator', challengeKey },
  })
  const verifyReg = await verifyRegResp.json()
  console.log('Registration verify response:', verifyReg)

  // Now authenticate
  // Request auth options via Playwright request
  const authResp = await page.request.post(ORIGIN + '/api/passkeys/auth/options', {
    headers: { 'content-type': 'application/json' },
    data: { email: ADMIN.email },
  })
  const authOptionsResp = await authResp.json()
  if (!authOptionsResp || !authOptionsResp.options) {
    console.error('Auth options response:', authOptionsResp)
    await browser.close()
    process.exit(1)
  }
  const { options: authOptions, challengeKey: authChallengeKey } = authOptionsResp
  console.log('Received auth options')

  const assertion = await page.evaluate(async (options) => {
    function base64urlToBuffer(base64url) {
      base64url = base64url.replace(/-/g, '+').replace(/_/g, '/')
      while (base64url.length % 4) base64url += '='
      return Uint8Array.from(atob(base64url), c => c.charCodeAt(0)).buffer
    }
    options.challenge = base64urlToBuffer(options.challenge)
    if (options.allowCredentials) {
      options.allowCredentials = options.allowCredentials.map(c => ({ ...c, id: base64urlToBuffer(c.id) }))
    }
    const cred = await navigator.credentials.get({ publicKey: options })
    const resp = cred.response
    const toBase64Url = (buf) => {
      const b = btoa(String.fromCharCode(...new Uint8Array(buf)))
      return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    return {
      id: cred.id,
      rawId: toBase64Url(cred.rawId),
      response: {
        authenticatorData: toBase64Url(resp.authenticatorData),
        clientDataJSON: toBase64Url(resp.clientDataJSON),
        signature: toBase64Url(resp.signature),
        userHandle: resp.userHandle ? toBase64Url(resp.userHandle) : null,
      },
      type: cred.type,
    }
  }, authOptions)

  // Send auth verify via Playwright request
  const verifyAuthResp = await page.request.post(ORIGIN + '/api/passkeys/auth/verify', {
    headers: { 'content-type': 'application/json' },
    data: { response: assertion, challengeKey: authChallengeKey },
  })
  const verifyAuth = await verifyAuthResp.json()
  console.log('Auth verify response:', verifyAuth)

  await client.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId })
  await browser.close()
}

run().catch(err => { console.error(err); process.exit(1) })
