import { Router } from 'express'
import { db } from '../utils/db.js'
import { aaveAdapter } from '../services/data/aave-adapter.js'
import { createComponentLogger } from '../utils/logger.js'

const logger = createComponentLogger('api:positions')
const router = Router()

// GET /positions?user=0x...
router.get('/', async (req, res) => {
  try {
    const userAddress = req.query.user as string

    if (!userAddress) {
      return res.status(400).json({ error: 'user parameter required' })
    }

    // Fetch from database (cached positions)
    const positions = await db.position.findMany({
      where: { userAddress },
      orderBy: { lastUpdated: 'desc' },
    })

    // Convert bigint strings back to strings for JSON response
    const formatted = positions.map((p) => ({
      id: p.id,
      chain: p.chain,
      protocol: p.protocol,
      collateral: {
        token: p.collateralToken,
        amount: p.collateralAmount,
        valueUSD: p.collateralValueUSD,
      },
      debt: {
        token: p.debtToken,
        amount: p.debtAmount,
        valueUSD: p.debtValueUSD,
      },
      healthFactor: p.healthFactor,
      liquidationThreshold: p.liquidationThreshold,
      lastUpdated: p.lastUpdated.toISOString(),
    }))

    res.json({ positions: formatted })
  } catch (error) {
    logger.error('Failed to fetch positions', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /positions/refresh - Force refresh from chain
router.post('/refresh', async (req, res) => {
  try {
    const { userAddress } = req.body

    if (!userAddress) {
      return res.status(400).json({ error: 'userAddress required' })
    }

    // Fetch fresh data from Aave
    const positions = await aaveAdapter.getAllUserPositions(userAddress)

    res.json({
      message: 'Positions refreshed',
      count: positions.length,
      positions: positions.map((p) => ({
        chain: p.chain,
        healthFactor: p.healthFactor,
      })),
    })
  } catch (error) {
    logger.error('Failed to refresh positions', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
