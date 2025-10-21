import { aaveAdapter } from './data/aave-adapter.js'
import { riskCalculator } from './risk/calculator.js'
import { rebalancer } from './execution/rebalancer.js'
import { db } from '../utils/db.js'
import { createComponentLogger } from '../utils/logger.js'
import { getEnv } from '../utils/env.js'
import type { Position, RiskTolerance, RiskAssessment } from '../types/index.js'

const logger = createComponentLogger('monitor')

export class PositionMonitor {
  private intervalMs: number
  private intervalId?: NodeJS.Timeout
  private errorCounts: Map<string, number> = new Map()
  private backoffTimers: Map<string, number> = new Map()

  constructor(intervalMs = 30_000) {
    this.intervalMs = intervalMs
  }

  start() {
    if (this.intervalId) {
      logger.warn('Monitor already running')
      return
    }

    logger.info(`Starting position monitor (interval: ${this.intervalMs}ms)`)
    this.intervalId = setInterval(() => this.monitorAllUsers(), this.intervalMs)

    // Run immediately on start
    void this.monitorAllUsers()
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      logger.info('Position monitor stopped')
    }
  }

  private async monitorAllUsers() {
    try {
      const users = await db.user.findMany({
        where: { enabled: true },
      })

      logger.debug(`Monitoring ${users.length} active users`)

      for (const user of users) {
        await this.monitorUser(user.address, user.riskTolerance as RiskTolerance)
      }
    } catch (error) {
      logger.error('Error in monitor loop', error)
    }
  }

  private async monitorUser(userAddress: string, riskTolerance: RiskTolerance) {
    // Check if user is in backoff period
    const backoffUntil = this.backoffTimers.get(userAddress)
    if (backoffUntil && Date.now() < backoffUntil) {
      logger.debug(`User ${userAddress} in backoff period, skipping`)
      return
    }

    try {
      // Fetch positions from Aave
      const positions = await aaveAdapter.getAllUserPositions(userAddress)

      if (positions.length === 0) {
        logger.debug(`No positions found for ${userAddress}`)
        return
      }

      // Update positions in database
      await this.updatePositions(positions)

      // Assess risk for each position
      for (const position of positions) {
        let assessment = riskCalculator.assessRisk(position, riskTolerance, positions)

        // Calculate GBM probability for enhanced risk assessment
        const gbmAssessment = riskCalculator.assessRiskWithGBM(position, 0.5) // 50% volatility assumption
        logger.debug(
          `GBM Risk for ${userAddress} on ${position.chain}: ` +
          `24h prob=${(gbmAssessment.liquidationProbability24h * 100).toFixed(2)}%, ` +
          `7d prob=${(gbmAssessment.liquidationProbability7d * 100).toFixed(2)}%, ` +
          `level=${gbmAssessment.riskLevel.level}`
        )

        // Use GBM to enhance decision-making: trigger if high liquidation probability
        if (gbmAssessment.liquidationProbability7d > 0.3 && assessment.action === 'MONITOR') {
          logger.warn(
            `GBM override: High liquidation probability (${(gbmAssessment.liquidationProbability7d * 100).toFixed(1)}%) ` +
            `for ${userAddress} on ${position.chain}, escalating to PREVENTIVE_REBALANCE`
          )
          const sourceChain = riskCalculator.selectSourceChain(positions, position.chain)
          if (sourceChain) {
            assessment = {
              action: 'PREVENTIVE_REBALANCE',
              healthFactor: position.healthFactor,
              targetHealthFactor: 2.0,
              sourceChain,
              requiredCollateralUSD: riskCalculator.calculateRequiredCollateralUSD(
                position.healthFactor,
                2.0,
                position.collateral.valueUSD,
                position.debt.valueUSD,
                position.liquidationThreshold
              ),
            }
          }
        }

        // Demo mode override: inject fake low health factor for demonstration
        const env = getEnv()
        if (env.DEMO_MODE === 'true' && env.DEMO_WALLET && userAddress.toLowerCase() === env.DEMO_WALLET.toLowerCase()) {
          const demoHF = parseFloat(env.DEMO_HEALTH_FACTOR)
          const demoTargetHF = parseFloat(env.DEMO_TARGET_HF)
          const demoAmountUSD = parseFloat(env.DEMO_AMOUNT_USD)

          logger.info(`[DEMO MODE] Injecting fake HF=${demoHF} for ${userAddress} on ${position.chain}`)

          // Find source chain with collateral (must be different from current position)
          const sourcePosition = positions.find(p => p.chain !== position.chain && p.collateral.valueUSD > demoAmountUSD)

          if (sourcePosition) {
            assessment = {
              action: 'URGENT_REBALANCE',
              healthFactor: demoHF,
              targetHealthFactor: demoTargetHF,
              sourceChain: sourcePosition.chain,
              requiredCollateralUSD: demoAmountUSD,
            }
          }
        }

        if (assessment.action === 'URGENT_REBALANCE') {
          logger.warn(
            `URGENT: ${userAddress} on ${position.chain} - HF: ${position.healthFactor.toFixed(2)}`
          )
          await this.handleUrgentRebalance(userAddress, position, assessment)
        } else if (assessment.action === 'PREVENTIVE_REBALANCE') {
          logger.info(
            `Warning: ${userAddress} on ${position.chain} - HF: ${position.healthFactor.toFixed(2)}`
          )
          await this.handlePreventiveRebalance(userAddress, position, assessment)
        }
      }

      // Success - reset error count and backoff
      this.errorCounts.set(userAddress, 0)
      this.backoffTimers.delete(userAddress)
    } catch (error) {
      logger.error(`Failed to monitor user ${userAddress}`, error)

      // Increment error count
      const errorCount = (this.errorCounts.get(userAddress) || 0) + 1
      this.errorCounts.set(userAddress, errorCount)

      // Calculate exponential backoff: 30s, 60s, 120s, 240s (max 4 minutes)
      const backoffMs = Math.min(this.intervalMs * Math.pow(2, errorCount - 1), 240_000)
      const backoffUntil = Date.now() + backoffMs

      this.backoffTimers.set(userAddress, backoffUntil)

      logger.warn(
        `User ${userAddress} monitoring failed (${errorCount} consecutive errors), ` +
        `backing off for ${backoffMs / 1000}s`
      )
    }
  }

  private async handleUrgentRebalance(
    userAddress: string,
    position: Position,
    assessment: RiskAssessment
  ) {
    try {
      if (!assessment.sourceChain || !assessment.requiredCollateralUSD || assessment.requiredCollateralUSD <= 0) {
        logger.error(
          `Cannot execute urgent rebalance: missing source chain or collateral amount (USD=${assessment.requiredCollateralUSD})`
        )
        return
      }

      // Check for recent duplicate actions to prevent spam
      const recentAction = await db.action.findFirst({
        where: {
          userAddress,
          type: 'rebalance',
          destChain: position.chain,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes
          },
        },
      })

      if (recentAction) {
        logger.debug(`Skipping duplicate urgent rebalance for ${userAddress}`)
        return
      }

      logger.info(`Executing urgent rebalance for ${userAddress}`)

      await rebalancer.executeAutoRebalance({
        userId: userAddress,
        targetPosition: position,
        sourceChain: assessment.sourceChain,
        requiredCollateralUSD: assessment.requiredCollateralUSD,
      })
    } catch (error) {
      logger.error(`Urgent rebalance failed for ${userAddress}`, error)
    }
  }

  private async handlePreventiveRebalance(
    userAddress: string,
    position: Position,
    assessment: RiskAssessment
  ) {
    try {
      if (!assessment.sourceChain || !assessment.requiredCollateralUSD || assessment.requiredCollateralUSD <= 0) {
        logger.debug(`Preventive rebalance not needed: no source chain available`)
        return
      }

      // Check for recent duplicate actions
      const recentAction = await db.action.findFirst({
        where: {
          userAddress,
          type: 'rebalance',
          destChain: position.chain,
          createdAt: {
            gte: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes
          },
        },
      })

      if (recentAction) {
        logger.debug(`Skipping duplicate preventive rebalance for ${userAddress}`)
        return
      }

      logger.info(`Executing preventive rebalance for ${userAddress}`)

      await rebalancer.executeAutoRebalance({
        userId: userAddress,
        targetPosition: position,
        sourceChain: assessment.sourceChain,
        requiredCollateralUSD: assessment.requiredCollateralUSD,
      })
    } catch (error) {
      logger.error(`Preventive rebalance failed for ${userAddress}`, error)
    }
  }

  private async updatePositions(positions: Position[]) {
    for (const position of positions) {
      await db.position.upsert({
        where: { id: position.id },
        create: {
          id: position.id,
          userAddress: position.userId,
          chain: position.chain,
          protocol: position.protocol,
          collateralToken: position.collateral.token,
          collateralAmount: position.collateral.amount.toString(),
          collateralValueUSD: position.collateral.valueUSD,
          debtToken: position.debt.token,
          debtAmount: position.debt.amount.toString(),
          debtValueUSD: position.debt.valueUSD,
          healthFactor: position.healthFactor,
          liquidationThreshold: position.liquidationThreshold,
          lastUpdated: position.lastUpdated,
        },
        update: {
          collateralAmount: position.collateral.amount.toString(),
          collateralValueUSD: position.collateral.valueUSD,
          debtAmount: position.debt.amount.toString(),
          debtValueUSD: position.debt.valueUSD,
          healthFactor: position.healthFactor,
          liquidationThreshold: position.liquidationThreshold,
          lastUpdated: position.lastUpdated,
        },
      })
    }
  }
}

export const positionMonitor = new PositionMonitor()
