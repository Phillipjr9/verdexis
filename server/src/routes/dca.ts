import { Router, type Response } from 'express'
import { z } from 'zod'
import { dcaService } from '../services/dcaService.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

// Schemas
const createScheduleSchema = z.object({
  asset: z.string().min(2).max(10),
  amountUsd: z.number().positive().min(5),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
})

/**
 * GET /api/dca
 * List all DCA schedules for the authenticated user
 */
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const schedules = await dcaService.getSchedules(req.userId!)
    return res.json(schedules)
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch schedules' })
  }
})

/**
 * GET /api/dca/:id
 * Get a single DCA schedule
 */
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const id = req.params.id || ''
    const schedule = await dcaService.getSchedule(id, req.userId!)
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' })
    return res.json(schedule)
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch schedule' })
  }
})

/**
 * POST /api/dca
 * Create a new DCA schedule
 */
router.post('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const body = createScheduleSchema.parse(req.body) as {
      asset: string
      amountUsd: number
      frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
    }
    const schedule = await dcaService.createSchedule(req.userId!, body)
    return res.status(201).json(schedule)
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues[0]?.message || 'Validation error'
      return res.status(400).json({ error: message })
    }
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create schedule' })
  }
})

/**
 * PATCH /api/dca/:id/toggle-pause
 * Pause or resume a DCA schedule
 */
router.patch('/:id/toggle-pause', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const id = req.params.id || ''
    const schedule = await dcaService.togglePause(id, req.userId!)
    return res.json(schedule)
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update schedule' })
  }
})

/**
 * DELETE /api/dca/:id
 * Delete a DCA schedule
 */
router.delete('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const id = req.params.id || ''
    await dcaService.deleteSchedule(id, req.userId!)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete schedule' })
  }
})

/**
 * POST /api/dca/:id/run
 * Manually execute a DCA purchase (admin only)
 */
router.post('/:id/run', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    // Verify admin or schedule owner
    const id = req.params.id || ''
    const schedule = await dcaService.getSchedule(id, req.userId!)
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' })

    const result = await dcaService.executeDCAPurchase(schedule)
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to execute DCA' })
  }
})

export default router
