import { describe, it, expect } from 'vitest'
import { RiskCalculator } from '../calculator.js'
import type { Position } from '../../../types/index.js'

const createMockPosition = (
  chain: 'base' | 'arbitrum',
  healthFactor: number,
  collateralValueUSD: number = 1000,
  debtValueUSD: number = 500
): Position => ({
  id: `${chain}-aave-test`,
  userId: '0xTest',
  chain,
  protocol: 'aave',
  collateral: {
    token: 'ETH',
    amount: BigInt(1e18),
    valueUSD: collateralValueUSD,
  },
  debt: {
    token: 'USDC',
    amount: BigInt(500e6),
    valueUSD: debtValueUSD,
  },
  healthFactor,
  liquidationThreshold: 0.8,
  lastUpdated: new Date(),
})

describe('RiskCalculator', () => {
  const calculator = new RiskCalculator()

  describe('assessRisk', () => {
    it('should recommend URGENT_REBALANCE for critical health factor (conservative)', () => {
      const position = createMockPosition('base', 1.4)
      const assessment = calculator.assessRisk(position, 'conservative', [position])

      expect(assessment.action).toBe('URGENT_REBALANCE')
      expect(assessment.healthFactor).toBe(1.4)
      expect(assessment.targetHealthFactor).toBe(2.5)
    })

    it('should recommend PREVENTIVE_REBALANCE for warning health factor', () => {
      const position = createMockPosition('base', 1.7)
      const assessment = calculator.assessRisk(position, 'conservative', [position])

      expect(assessment.action).toBe('PREVENTIVE_REBALANCE')
      expect(assessment.targetHealthFactor).toBe(2.5)
    })

    it('should recommend MONITOR for safe health factor', () => {
      const position = createMockPosition('base', 3.0)
      const assessment = calculator.assessRisk(position, 'conservative', [position])

      expect(assessment.action).toBe('MONITOR')
    })

    it('should use different thresholds for different risk tolerances', () => {
      const position = createMockPosition('base', 1.4)

      const conservative = calculator.assessRisk(position, 'conservative', [position])
      const moderate = calculator.assessRisk(position, 'moderate', [position])
      const aggressive = calculator.assessRisk(position, 'aggressive', [position])

      // 1.4 is below conservative critical (1.5) but above moderate (1.3)
      expect(conservative.action).toBe('URGENT_REBALANCE')
      expect(moderate.action).toBe('PREVENTIVE_REBALANCE')
      expect(aggressive.action).toBe('MONITOR')
    })
  })

  describe('calculateRequiredCollateralUSD', () => {
    it('should calculate correct collateral needed to reach target HF', () => {
      const currentHF = 1.3
      const targetHF = 2.0
      const collateralValue = 1000
      const debtValue = 600
      const liquidationThreshold = 0.8

      const required = calculator.calculateRequiredCollateralUSD(
        currentHF,
        targetHF,
        collateralValue,
        debtValue,
        liquidationThreshold
      )

      // target_HF = (collateral + x) * LT / debt
      // 2.0 = (1000 + x) * 0.8 / 600
      // x = (2.0 * 600 / 0.8) - 1000 = 500
      expect(required).toBe(500)
    })

    it('should return 0 if no additional collateral is needed', () => {
      const currentHF = 3.0
      const targetHF = 2.0
      const collateralValue = 2000
      const debtValue = 600
      const liquidationThreshold = 0.8

      const required = calculator.calculateRequiredCollateralUSD(
        currentHF,
        targetHF,
        collateralValue,
        debtValue,
        liquidationThreshold
      )

      expect(required).toBe(0)
    })
  })

  describe('selectSourceChain', () => {
    it('should select chain with highest health factor', () => {
      const positions = [
        createMockPosition('base', 2.5),
        createMockPosition('arbitrum', 3.5),
      ]

      const sourceChain = calculator.selectSourceChain(positions, 'base')

      expect(sourceChain).toBe('arbitrum') // Higher HF
    })

    it('should return null if no other chain positions exist', () => {
      const positions = [createMockPosition('base', 2.5)]

      const sourceChain = calculator.selectSourceChain(positions, 'base')

      expect(sourceChain).toBeNull()
    })

    it('should return null if other chain HF is too low (< 2.0)', () => {
      const positions = [
        createMockPosition('base', 1.5),
        createMockPosition('arbitrum', 1.8), // Too low to withdraw from
      ]

      const sourceChain = calculator.selectSourceChain(positions, 'base')

      expect(sourceChain).toBeNull()
    })

    it('should only consider positions on different chain', () => {
      const positions = [
        createMockPosition('base', 1.5),
        createMockPosition('base', 3.0), // Same chain, should be ignored
        createMockPosition('arbitrum', 2.5),
      ]

      const sourceChain = calculator.selectSourceChain(positions, 'base')

      expect(sourceChain).toBe('arbitrum')
    })
  })

  describe('assessRiskWithGBM', () => {
    it('should return GBM assessment with liquidation probabilities', () => {
      const position = createMockPosition('base', 1.5)
      const gbmAssessment = calculator.assessRiskWithGBM(position, 0.5)

      expect(gbmAssessment).toHaveProperty('currentHealthFactor')
      expect(gbmAssessment).toHaveProperty('liquidationProbability24h')
      expect(gbmAssessment).toHaveProperty('liquidationProbability7d')
      expect(gbmAssessment).toHaveProperty('riskLevel')
      expect(gbmAssessment).toHaveProperty('recommendedAction')
    })
  })
})
