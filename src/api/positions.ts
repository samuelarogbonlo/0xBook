import { Router } from 'express'
import { db } from '../utils/db.js'
import { aaveAdapter } from '../services/data/aave-adapter.js'
import { riskCalculator } from '../services/risk/calculator.js'
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

// GET /positions/risk/:positionId - Get GBM risk assessment for a position
router.get('/risk/:positionId', async (req, res) => {
  try {
    const { positionId } = req.params
    const volatility = req.query.volatility ? parseFloat(req.query.volatility as string) : 0.5

    if (isNaN(volatility) || volatility <= 0 || volatility > 2.0) {
      return res.status(400).json({ error: 'volatility must be between 0 and 2.0' })
    }

    // Get position from database
    const position = await db.position.findUnique({
      where: { id: positionId },
    })

    if (!position) {
      return res.status(404).json({ error: 'Position not found' })
    }

    // Calculate GBM risk assessment
    const gbmAssessment = riskCalculator.assessRiskWithGBM(
      {
        id: position.id,
        userId: position.userAddress,
        chain: position.chain as any,
        protocol: position.protocol as any,
        collateral: {
          token: position.collateralToken,
          amount: BigInt(position.collateralAmount),
          valueUSD: position.collateralValueUSD,
        },
        debt: {
          token: position.debtToken,
          amount: BigInt(position.debtAmount),
          valueUSD: position.debtValueUSD,
        },
        healthFactor: position.healthFactor,
        liquidationThreshold: position.liquidationThreshold,
        lastUpdated: position.lastUpdated,
      },
      volatility
    )

    res.json({
      positionId: position.id,
      chain: position.chain,
      currentHealthFactor: position.healthFactor,
      gbmAssessment: {
        liquidationProbability24h: gbmAssessment.liquidationProbability24h,
        liquidationProbability7d: gbmAssessment.liquidationProbability7d,
        riskLevel: gbmAssessment.riskLevel,
        recommendedAction: gbmAssessment.recommendedAction,
      },
      volatilityUsed: volatility,
    })
  } catch (error) {
    logger.error('Failed to calculate GBM risk', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
