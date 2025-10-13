import { Router } from 'express'
import { db } from '../utils/db.js'
import { rebalancer } from '../services/execution/rebalancer.js'
import { createComponentLogger } from '../utils/logger.js'
import { z } from 'zod'

const logger = createComponentLogger('api:actions')
const router = Router()

const rebalanceSchema = z.object({
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  sourceChain: z.enum(['base', 'arbitrum']),
  destChain: z.enum(['base', 'arbitrum']),
  token: z.string(),
  amount: z.string().regex(/^\d+$/), // bigint as string
})

// POST /actions/rebalance - Manually trigger rebalance
router.post('/rebalance', async (req, res) => {
  try {
    const parsed = rebalanceSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.errors })
    }

    const { userAddress, sourceChain, destChain, token, amount } = parsed.data

    if (sourceChain === destChain) {
      return res.status(400).json({ error: 'Source and destination chains must differ' })
    }

    const actionId = await rebalancer.executeRebalance({
      userId: userAddress,
      sourceChain,
      destChain,
      token,
      amount: BigInt(amount),
    })

    logger.info(`Rebalance triggered for ${userAddress}: action ${actionId}`)

    res.json({
      success: true,
      actionId,
      message: 'Rebalance initiated',
    })
  } catch (error) {
    logger.error('Failed to trigger rebalance', error)
    res.status(500).json({ error: (error as Error).message })
  }
})

// GET /actions?user=0x...
router.get('/', async (req, res) => {
  try {
    const userAddress = req.query.user as string
    const limit = parseInt(req.query.limit as string) || 50

    if (!userAddress) {
      return res.status(400).json({ error: 'user parameter required' })
    }

    const actions = await db.action.findMany({
      where: { userId: userAddress },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const formatted = actions.map((a) => ({
      id: a.id,
      type: a.type,
      sourceChain: a.sourceChain,
      destChain: a.destChain,
      amount: a.amount,
      costPYUSD: a.costPYUSD,
      status: a.status,
      txHash: a.txHash,
      transferId: a.transferId,
      errorMessage: a.errorMessage,
      createdAt: a.createdAt.toISOString(),
      completedAt: a.completedAt?.toISOString(),
    }))

    res.json({ actions: formatted })
  } catch (error) {
    logger.error('Failed to fetch actions', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /actions/:id - Get action status
router.get('/:id', async (req, res) => {
  try {
    const actionId = req.params.id

    const action = await rebalancer.getActionStatus(actionId)

    res.json({
      id: action.id,
      type: action.type,
      sourceChain: action.sourceChain,
      destChain: action.destChain,
      amount: action.amount,
      costPYUSD: action.costPYUSD,
      status: action.status,
      txHash: action.txHash,
      transferId: action.transferId,
      errorMessage: action.errorMessage,
      createdAt: action.createdAt.toISOString(),
      completedAt: action.completedAt?.toISOString(),
    })
  } catch (error) {
    logger.error('Failed to fetch action status', error)
    res.status(404).json({ error: 'Action not found' })
  }
})

export default router
