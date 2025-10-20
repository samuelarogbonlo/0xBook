import { describe, it, expect } from 'vitest'
import {
  calculateLiquidationProbability,
  estimateVolatility,
  getRiskLevel,
  assessRiskWithGBM,
} from '../gbm-model.js'

describe('GBM Liquidation Probability Model', () => {
  describe('calculateLiquidationProbability', () => {
    it('should return 1.0 for health factor below liquidation threshold', () => {
      const prob = calculateLiquidationProbability(0.9, 0.5, 7)
      expect(prob).toBe(1.0)
    })

    it('should return 0.0 for very high health factor', () => {
      const prob = calculateLiquidationProbability(15.0, 0.5, 7)
      expect(prob).toBe(0.0)
    })

    it('should increase probability with higher volatility', () => {
      const lowVol = calculateLiquidationProbability(1.5, 0.2, 7)
      const highVol = calculateLiquidationProbability(1.5, 0.8, 7)
      expect(highVol).toBeGreaterThan(lowVol)
    })

    it('should increase probability with longer time horizon', () => {
      const shortTerm = calculateLiquidationProbability(1.3, 0.5, 1)
      const longTerm = calculateLiquidationProbability(1.3, 0.5, 30)
      expect(longTerm).toBeGreaterThan(shortTerm)
    })

    it('should return probability between 0 and 1', () => {
      const prob = calculateLiquidationProbability(1.2, 0.5, 7)
      expect(prob).toBeGreaterThanOrEqual(0)
      expect(prob).toBeLessThanOrEqual(1)
    })
  })

  describe('estimateVolatility', () => {
    it('should return default volatility for insufficient data', () => {
      const vol = estimateVolatility([1.5])
      expect(vol).toBe(0.5)
    })

    it('should calculate volatility from historical data', () => {
      const historicalHF = [2.0, 2.1, 1.9, 2.2, 1.8, 2.0]
      const vol = estimateVolatility(historicalHF)
      expect(vol).toBeGreaterThan(0.1)
      expect(vol).toBeLessThanOrEqual(2.0)
    })

    it('should cap volatility at reasonable bounds', () => {
      const stableHF = [2.0, 2.0, 2.0, 2.0, 2.0]
      const vol = estimateVolatility(stableHF)
      expect(vol).toBeGreaterThanOrEqual(0.1)
      expect(vol).toBeLessThanOrEqual(2.0)
    })
  })

  describe('getRiskLevel', () => {
    it('should return CRITICAL for probability >= 0.5', () => {
      const risk = getRiskLevel(0.6)
      expect(risk.level).toBe('CRITICAL')
    })

    it('should return HIGH for probability >= 0.2', () => {
      const risk = getRiskLevel(0.3)
      expect(risk.level).toBe('HIGH')
    })

    it('should return MODERATE for probability >= 0.05', () => {
      const risk = getRiskLevel(0.1)
      expect(risk.level).toBe('MODERATE')
    })

    it('should return LOW for probability < 0.05', () => {
      const risk = getRiskLevel(0.01)
      expect(risk.level).toBe('LOW')
    })
  })

  describe('assessRiskWithGBM', () => {
    it('should provide comprehensive risk assessment', () => {
      const assessment = assessRiskWithGBM(1.3, 0.5)

      expect(assessment).toHaveProperty('currentHealthFactor')
      expect(assessment).toHaveProperty('liquidationProbability24h')
      expect(assessment).toHaveProperty('liquidationProbability7d')
      expect(assessment).toHaveProperty('riskLevel')
      expect(assessment).toHaveProperty('recommendedAction')
    })

    it('should recommend URGENT_REBALANCE for very low health factor', () => {
      const assessment = assessRiskWithGBM(1.1, 0.5)
      expect(assessment.recommendedAction).toBe('URGENT_REBALANCE')
    })

    it('should recommend REBALANCE_SOON for moderate health factor', () => {
      const assessment = assessRiskWithGBM(1.4, 0.5)
      expect(assessment.recommendedAction).toBe('REBALANCE_SOON')
    })

    it('should recommend MONITOR for high health factor', () => {
      const assessment = assessRiskWithGBM(3.0, 0.5)
      expect(assessment.recommendedAction).toBe('MONITOR')
    })

    it('should have 24h probability <= 7d probability', () => {
      const assessment = assessRiskWithGBM(1.5, 0.5)
      expect(assessment.liquidationProbability24h).toBeLessThanOrEqual(
        assessment.liquidationProbability7d
      )
    })
  })
})
