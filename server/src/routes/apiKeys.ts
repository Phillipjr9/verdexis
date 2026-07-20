import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { APIKeyService } from '../services/apiKey.js'

const router = Router()

const createAPIKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).default(['read']),
  rateLimit: z.number().int().min(1).max(100000).default(1000),
  expiresAt: z.string().datetime().optional(),
})

/**
 * Create API key
 */
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createAPIKeySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined

    const { id, key, prefix } = await APIKeyService.createAPIKey(
      req.userId!,
      parsed.data.name,
      parsed.data.permissions,
      parsed.data.rateLimit,
      expiresAt,
    )

    res.status(201).json({
      id,
      key,
      prefix,
      message: 'API key created. Save the key - you will not be able to see it again.',
    })
  } catch (error) {
    console.error('[api-key] Failed to create:', error)
    res.status(500).json({ error: 'Failed to create API key' })
  }
})

/**
 * Get API keys
 */
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const keys = await APIKeyService.getAPIKeys(req.userId!)
    res.json({ keys })
  } catch (error) {
    console.error('[api-key] Failed to get:', error)
    res.status(500).json({ error: 'Failed to get API keys' })
  }
})

/**
 * Revoke API key
 */
router.post('/:id/revoke', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const revoked = await APIKeyService.revokeAPIKey(req.userId!, req.params.id)

    if (!revoked) {
      res.status(404).json({ error: 'API key not found' })
      return
    }

    res.json({ revoked: true })
  } catch (error) {
    console.error('[api-key] Failed to revoke:', error)
    res.status(500).json({ error: 'Failed to revoke API key' })
  }
})

/**
 * Delete API key
 */
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const deleted = await APIKeyService.deleteAPIKey(req.userId!, req.params.id)

    if (!deleted) {
      res.status(404).json({ error: 'API key not found' })
      return
    }

    res.json({ deleted: true })
  } catch (error) {
    console.error('[api-key] Failed to delete:', error)
    res.status(500).json({ error: 'Failed to delete API key' })
  }
})

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()).min(1),
})

/**
 * Update API key permissions
 */
router.patch('/:id/permissions', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updatePermissionsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const updated = await APIKeyService.updateAPIKeyPermissions(req.userId!, req.params.id, parsed.data.permissions)

    if (!updated) {
      res.status(404).json({ error: 'API key not found' })
      return
    }

    res.json({ updated: true })
  } catch (error) {
    console.error('[api-key] Failed to update:', error)
    res.status(500).json({ error: 'Failed to update API key' })
  }
})

export default router
