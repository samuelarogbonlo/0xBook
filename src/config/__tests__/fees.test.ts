import { describe, it, expect } from 'vitest'
import { parseUnits, formatUnits } from 'ethers'
import { calculateTotalFeePYUSD, formatPYUSD, SERVICE_FEE_PYUSD, getEthToPyusdRate } from '../fees.js'

describe('PYUSD Fee Calculation', () => {
  describe('calculateTotalFeePYUSD', () => {
    it('should convert ETH gas cost to PYUSD correctly', () => {
      // 0.001 ETH at $2500/ETH = $2.50 PYUSD + $3 service fee = $5.50 PYUSD
      const gasEstimateETH = parseUnits('0.001', 18)
      const totalFee = calculateTotalFeePYUSD(gasEstimateETH)

      const expectedGasCost = parseUnits('2.50', 6) // 0.001 * 2500 = 2.50 PYUSD
      const expectedTotal = expectedGasCost + SERVICE_FEE_PYUSD // + 3.00 = 5.50 PYUSD

      expect(totalFee).toBe(expectedTotal)
      expect(formatPYUSD(totalFee)).toBe('5.50 PYUSD')
    })

    it('should include service fee for zero gas', () => {
      const gasEstimateETH = 0n
      const totalFee = calculateTotalFeePYUSD(gasEstimateETH)

      expect(totalFee).toBe(SERVICE_FEE_PYUSD)
      expect(formatPYUSD(totalFee)).toBe('3.00 PYUSD')
    })

    it('should handle high gas costs correctly', () => {
      // 0.01 ETH at $2500/ETH = $25 PYUSD + $3 service fee = $28 PYUSD
      const gasEstimateETH = parseUnits('0.01', 18)
      const totalFee = calculateTotalFeePYUSD(gasEstimateETH)

      expect(formatPYUSD(totalFee)).toBe('28.00 PYUSD')
    })

    it('should use correct conversion rate', () => {
      const oneETH = parseUnits('1', 18)
      const totalFee = calculateTotalFeePYUSD(oneETH)

      // 1 ETH * 2500 = 2500 PYUSD + 3 = 2503 PYUSD
      const expected = parseUnits('2503', 6)
      expect(totalFee).toBe(expected)
    })
  })

  describe('formatPYUSD', () => {
    it('should format PYUSD amount with 2 decimal places', () => {
      const amount = parseUnits('10.5', 6)
      expect(formatPYUSD(amount)).toBe('10.50 PYUSD')
    })

    it('should handle zero amount', () => {
      expect(formatPYUSD(0n)).toBe('0.00 PYUSD')
    })

    it('should handle large amounts', () => {
      const amount = parseUnits('1000000', 6)
      expect(formatPYUSD(amount)).toBe('1000000.00 PYUSD')
    })

    it('should handle fractional cents correctly', () => {
      const amount = parseUnits('0.123456', 6)
      expect(formatPYUSD(amount)).toBe('0.12 PYUSD')
    })
  })

  describe('Fee Constants', () => {
    it('should have correct service fee (6 decimals)', () => {
      expect(SERVICE_FEE_PYUSD).toBe(parseUnits('3.00', 6))
      expect(formatPYUSD(SERVICE_FEE_PYUSD)).toBe('3.00 PYUSD')
    })

    it('should have correct ETH to PYUSD rate', () => {
      expect(getEthToPyusdRate()).toBe(2500n)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very small gas amounts', () => {
      const tinyGas = parseUnits('0.000001', 18) // ~$0.0025
      const totalFee = calculateTotalFeePYUSD(tinyGas)

      // Should be close to service fee + tiny amount
      const formatted = formatPYUSD(totalFee)
      expect(formatted).toBe('3.00 PYUSD') // Tiny gas rounds to 0.00
    })

    it('should maintain precision for typical gas costs', () => {
      // Typical L2 gas: 0.0002 ETH = $0.50 + $3 = $3.50
      const typicalGas = parseUnits('0.0002', 18)
      const totalFee = calculateTotalFeePYUSD(typicalGas)

      expect(formatPYUSD(totalFee)).toBe('3.50 PYUSD')
    })
  })
})
