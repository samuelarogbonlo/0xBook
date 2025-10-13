import type { Position, RiskTolerance, RiskAssessment, Chain } from '../../types/index.js'

const RISK_THRESHOLDS = {
  conservative: { critical: 1.5, warning: 2.0, target: 2.5 },
  moderate: { critical: 1.3, warning: 1.6, target: 2.0 },
  aggressive: { critical: 1.15, warning: 1.4, target: 1.8 },
} as const

export class RiskCalculator {
  assessRisk(position: Position, riskTolerance: RiskTolerance): RiskAssessment {
    const thresholds = RISK_THRESHOLDS[riskTolerance]

    if (position.healthFactor < thresholds.critical) {
      return {
        action: 'URGENT_REBALANCE',
        healthFactor: position.healthFactor,
        targetHealthFactor: thresholds.target,
      }
    }

    if (position.healthFactor < thresholds.warning) {
      return {
        action: 'PREVENTIVE_REBALANCE',
        healthFactor: position.healthFactor,
        targetHealthFactor: thresholds.target,
      }
    }

    return {
      action: 'MONITOR',
      healthFactor: position.healthFactor,
      targetHealthFactor: thresholds.target,
    }
  }

  calculateRequiredCollateral(
    _currentHealth: number,
    targetHealth: number,
    collateralValue: number,
    debtValue: number,
    liquidationThreshold: number
  ): bigint {
    // HF = (collateral * LT) / debt
    // target_HF = (collateral + x) * LT / debt
    // x = (target_HF * debt / LT) - collateral

    const requiredTotal = (targetHealth * debtValue) / liquidationThreshold
    const delta = requiredTotal - collateralValue

    // Convert to smallest unit (assuming 18 decimals)
    return BigInt(Math.ceil(delta * 1e18))
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
