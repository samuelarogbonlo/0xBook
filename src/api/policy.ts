import { Router } from 'express'
import { db } from '../utils/db.js'
import { createComponentLogger } from '../utils/logger.js'
import { z } from 'zod'

const logger = createComponentLogger('api:policy')
const router = Router()

const policySchema = z.object({
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']),
  maxSpendDaily: z.string().regex(/^\d+$/), // bigint as string
  enabled: z.boolean(),
})

// POST /policy - Create or update user policy
router.post('/', async (req, res) => {
  try {
    const parsed = policySchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors })
    }

    const { userAddress, riskTolerance, maxSpendDaily, enabled } = parsed.data

    const policy = await db.user.upsert({
      where: { address: userAddress },
      create: {
        address: userAddress,
        riskTolerance,
        maxSpendDaily,
        enabled,
      },
      update: {
        riskTolerance,
        maxSpendDaily,
        enabled,
      },
    })

    logger.info(`Policy updated for ${userAddress}`)

    res.json({
      success: true,
      policy: {
        address: policy.address,
        riskTolerance: policy.riskTolerance,
        maxSpendDaily: policy.maxSpendDaily,
        enabled: policy.enabled,
        pyusdBalance: policy.pyusdBalance,
      },
    })
  } catch (error) {
    logger.error('Failed to update policy', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /policy?user=0x...
router.get('/', async (req, res) => {
  try {
    const userAddress = req.query.user as string

    if (!userAddress) {
      return res.status(400).json({ error: 'user parameter required' })
    }

    const policy = await db.user.findUnique({
      where: { address: userAddress },
    })

    if (!policy) {
      return res.status(404).json({ error: 'User policy not found' })
    }

    res.json({
      policy: {
        address: policy.address,
        riskTolerance: policy.riskTolerance,
        maxSpendDaily: policy.maxSpendDaily,
        enabled: policy.enabled,
        pyusdBalance: policy.pyusdBalance,
        createdAt: policy.createdAt.toISOString(),
        updatedAt: policy.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    logger.error('Failed to fetch policy', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
