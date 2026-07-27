import test from 'node:test'
import assert from 'node:assert/strict'

import { buildNotificationEmailHtml, resolveEmailTransportConfig } from '../src/notificationService.js'

test('resolveEmailTransportConfig prefers SMTP_PASS and keeps the fallback sender', () => {
  const config = resolveEmailTransportConfig({
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '2525',
    SMTP_SECURE: 'true',
    SMTP_USER: 'alerts@example.com',
    SMTP_PASS: 'super-secret',
    SMTP_FROM: 'noreply@example.com',
  })

  assert.equal(config.host, 'smtp.example.com')
  assert.equal(config.port, 2525)
  assert.equal(config.secure, true)
  assert.equal(config.auth.user, 'alerts@example.com')
  assert.equal(config.auth.pass, 'super-secret')
  assert.equal(config.from, 'Verdexis <noreply@example.com>')
})

test('resolveEmailTransportConfig builds a branded sender and support headers', () => {
  const config = resolveEmailTransportConfig({
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '2525',
    SMTP_SECURE: 'true',
    SMTP_USER: 'alerts@example.com',
    SMTP_PASS: 'super-secret',
    SMTP_FROM: 'noreply@example.com',
    SMTP_FROM_NAME: 'Verdexis Support',
    SMTP_REPLY_TO: 'support@example.com',
    SMTP_UNSUBSCRIBE_URL: 'https://example.com/unsubscribe',
  })

  assert.equal(config.from, 'Verdexis Support <noreply@example.com>')
  assert.equal(config.replyTo, 'support@example.com')
  assert.equal(config.unsubscribeUrl, 'https://example.com/unsubscribe')
})

test('buildNotificationEmailHtml renders a readable HTML email body', () => {
  const html = buildNotificationEmailHtml('Security Alert', 'Your account was updated.')

  assert.match(html, /Security Alert/)
  assert.match(html, /Your account was updated\./)
  assert.match(html, /<html/i)
})

test('buildNotificationEmailHtml includes a tracked view-in-app link', () => {
  const html = buildNotificationEmailHtml('Security Alert', 'Your account was updated.')

  assert.match(html, /View in Verdexis/i)
  assert.match(html, /channel=notification/i)
  assert.match(html, /source=email/i)
})

test('buildNotificationEmailHtml preserves full HTML templates and appends a tracked CTA', () => {
  const html = buildNotificationEmailHtml('Template Test', 'ignored body', '<!DOCTYPE html><html><body><p>Hello Template</p></body></html>')

  assert.match(html, /Hello Template/)
  assert.match(html, /View in Verdexis/i)
  assert.match(html, /channel=notification/i)
})
