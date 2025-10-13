import { aaveAdapter } from './data/aave-adapter.js'
import { riskCalculator } from './risk/calculator.js'
import { db } from '../utils/db.js'
import { createComponentLogger } from '../utils/logger.js'
import type { Position, RiskTolerance } from '../types/index.js'

const logger = createComponentLogger('monitor')

export class PositionMonitor {
  private intervalMs: number
  private intervalId?: NodeJS.Timeout

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
        const assessment = riskCalculator.assessRisk(position, riskTolerance)

        if (assessment.action === 'URGENT_REBALANCE') {
          logger.warn(
            `URGENT: ${userAddress} on ${position.chain} - HF: ${position.healthFactor.toFixed(2)}`
          )
          // TODO: Trigger rebalance execution
        } else if (assessment.action === 'PREVENTIVE_REBALANCE') {
          logger.info(
            `Warning: ${userAddress} on ${position.chain} - HF: ${position.healthFactor.toFixed(2)}`
          )
          // TODO: Consider preventive action
        }
      }
    } catch (error) {
      logger.error(`Failed to monitor user ${userAddress}`, error)
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
