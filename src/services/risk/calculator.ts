import type { Position, RiskTolerance, RiskAssessment, Chain } from '../../types/index.js'
import { assessRiskWithGBM, type GBMRiskAssessment } from './gbm-model.js'

const RISK_THRESHOLDS = {
  conservative: { critical: 1.5, warning: 2.0, target: 2.5 },
  moderate: { critical: 1.3, warning: 1.6, target: 2.0 },
  aggressive: { critical: 1.15, warning: 1.4, target: 1.8 },
} as const

export class RiskCalculator {
  /**
   * Assess risk with GBM liquidation probability model
   * Returns enhanced assessment with probabilistic risk metrics
   */
  assessRiskWithGBM(position: Position, volatility: number = 0.5): GBMRiskAssessment {
    return assessRiskWithGBM(position.healthFactor, volatility)
  }

  assessRisk(position: Position, riskTolerance: RiskTolerance, allPositions: Position[]): RiskAssessment {
    const thresholds = RISK_THRESHOLDS[riskTolerance]

    if (position.healthFactor < thresholds.critical) {
      const sourceChain = this.selectSourceChain(allPositions, position.chain)
      const requiredCollateralUSD = this.calculateRequiredCollateralUSD(
        position.healthFactor,
        thresholds.target,
        position.collateral.valueUSD,
        position.debt.valueUSD,
        position.liquidationThreshold
      )

      return {
        action: 'URGENT_REBALANCE',
        healthFactor: position.healthFactor,
        targetHealthFactor: thresholds.target,
        requiredCollateralUSD: sourceChain ? requiredCollateralUSD : undefined,
        sourceChain: sourceChain || undefined,
        destChain: position.chain,
      }
    }

    if (position.healthFactor < thresholds.warning) {
      const sourceChain = this.selectSourceChain(allPositions, position.chain)
      const requiredCollateralUSD = this.calculateRequiredCollateralUSD(
        position.healthFactor,
        thresholds.target,
        position.collateral.valueUSD,
        position.debt.valueUSD,
        position.liquidationThreshold
      )

      return {
        action: 'PREVENTIVE_REBALANCE',
        healthFactor: position.healthFactor,
        targetHealthFactor: thresholds.target,
        requiredCollateralUSD: sourceChain ? requiredCollateralUSD : undefined,
        sourceChain: sourceChain || undefined,
        destChain: position.chain,
      }
    }

    return {
      action: 'MONITOR',
      healthFactor: position.healthFactor,
      targetHealthFactor: thresholds.target,
    }
  }

  calculateRequiredCollateralUSD(
    _currentHealth: number,
    targetHealth: number,
    collateralValue: number,
    debtValue: number,
    liquidationThreshold: number
  ): number {
    // HF = (collateral * LT) / debt
    // target_HF = (collateral + x) * LT / debt
    // x = (target_HF * debt / LT) - collateral

    const requiredTotal = (targetHealth * debtValue) / liquidationThreshold
    const delta = requiredTotal - collateralValue

    return Math.max(delta, 0)
  }

  selectSourceChain(positions: Position[], targetChain: Chain): Chain | null {
    const otherChainPositions = positions.filter((p) => p.chain !== targetChain)

    if (otherChainPositions.length === 0) {
      return null
    }

    // Find position with highest health factor (safest to withdraw from)
    const safest = otherChainPositions.reduce((max, pos) =>
      pos.healthFactor > max.healthFactor ? pos : max
    )

    return safest.healthFactor > 2.0 ? safest.chain : null
  }
}

export const riskCalculator = new RiskCalculator()
