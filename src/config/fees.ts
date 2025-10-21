import { parseUnits } from 'ethers'
import { getEnv } from '../utils/env.js'

/**
 * Fee configuration for 0xGuard services
 * All fees are denominated in PYUSD (6 decimals)
 */

// Service fee: flat rate per rebalance action
export const SERVICE_FEE_PYUSD = parseUnits('3.00', 6) // $3 PYUSD per rebalance

/**
 * Get ETH to PYUSD conversion rate from environment
 * @returns Conversion rate (e.g., 2500 for 1 ETH = $2500)
 */
export function getEthToPyusdRate(): bigint {
  const env = getEnv()
  return BigInt(env.ETH_TO_PYUSD_RATE)
}

/**
 * Calculate total fee in PYUSD
 * @param gasEstimateETH - Estimated gas cost in ETH (18 decimals)
 * @returns Total fee in PYUSD (6 decimals)
 */
export function calculateTotalFeePYUSD(gasEstimateETH: bigint): bigint {
  const ethToPyusdRate = getEthToPyusdRate()

  // Convert ETH gas cost to PYUSD
  // (ETH_amount * price) / 1e18 * 1e6 = (ETH_amount * price * 1e6) / 1e18
  const gasCostPYUSD = (gasEstimateETH * ethToPyusdRate * parseUnits('1', 6)) / parseUnits('1', 18)

  // Add service fee
  const totalFee = gasCostPYUSD + SERVICE_FEE_PYUSD

  return totalFee
}

/**
 * Convert PYUSD amount to human-readable string
 * @param amountPYUSD - Amount in PYUSD (6 decimals)
 * @returns Formatted string (e.g., "3.50 PYUSD")
 */
export function formatPYUSD(amountPYUSD: bigint): string {
  // Use BigInt division to avoid precision loss for large amounts
  const dollars = amountPYUSD / 1_000_000n
  const cents = amountPYUSD % 1_000_000n
  const centsStr = cents.toString().padStart(6, '0').slice(0, 2)
  return `${dollars}.${centsStr} PYUSD`
}
