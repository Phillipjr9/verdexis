import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { webhookService, type WebhookEvent } from '../services/webhook.js'

const router = Router()

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  active: z.boolean().default(true),
})

/**
 * Create webhook
 */
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createWebhookSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const { id, secret } = await WebhookService.createWebhook(
      req.userId!,
      parsed.data.url,
      parsed.data.events as WebhookEvent[],
      parsed.data.active,
    )

    res.status(201).json({
      id,
      secret,
      message: 'Webhook created. Save the secret - you will need it to verify webhook signatures.',
    })
  } catch (error) {
    console.error('[webhook] Failed to create:', error)
    res.status(500).json({ error: 'Failed to create webhook' })
  }
})

/**
 * Get webhooks
 */
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const webhooks = await WebhookService.getWebhooks(req.userId!)
    res.json({ webhooks })
  } catch (error) {
    console.error('[webhook] Failed to get:', error)
    res.status(500).json({ error: 'Failed to get webhooks' })
  }
})

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
})

/**
 * Update webhook
 */
router.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateWebhookSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const data: Record<string, unknown> = {}
    if (parsed.data.url) data.url = parsed.data.url
    if (parsed.data.events) data.events = parsed.data.events
    if (parsed.data.active !== undefined) data.active = parsed.data.active

    await WebhookService.updateWebhook(req.userId!, req.params.id, data as any)

    res.json({ updated: true })
  } catch (error) {
    console.error('[webhook] Failed to update:', error)
    res.status(500).json({ error: 'Failed to update webhook' })
  }
})

/**
 * Delete webhook
 */
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const deleted = await WebhookService.deleteWebhook(req.userId!, req.params.id)

    if (!deleted) {
      res.status(404).json({ error: 'Webhook not found' })
      return
    }

    res.json({ deleted: true })
  } catch (error) {
    console.error('[webhook] Failed to delete:', error)
    res.status(500).json({ error: 'Failed to delete webhook' })
  }
})

export default router
