import { parseUnits } from 'ethers'

/**
 * Fee configuration for 0xGuard services
 * All fees are denominated in PYUSD (6 decimals)
 */

// Service fee: flat rate per rebalance action
export const SERVICE_FEE_PYUSD = parseUnits('3.00', 6) // $3 PYUSD per rebalance

// Gas estimation: ETH to PYUSD conversion rate
// This should ideally be fetched from an oracle in production
export const ETH_TO_PYUSD_RATE = 2500n // 1 ETH = $2500

/**
 * Calculate total fee in PYUSD
 * @param gasEstimateETH - Estimated gas cost in ETH (18 decimals)
 * @returns Total fee in PYUSD (6 decimals)
 */
export function calculateTotalFeePYUSD(gasEstimateETH: bigint): bigint {
  // Convert ETH gas cost to PYUSD
  // (ETH_amount * price) / 1e18 * 1e6 = (ETH_amount * price * 1e6) / 1e18
  const gasCostPYUSD = (gasEstimateETH * ETH_TO_PYUSD_RATE * parseUnits('1', 6)) / parseUnits('1', 18)

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
  const dollars = Number(amountPYUSD) / 1e6
  return `${dollars.toFixed(2)} PYUSD`
}
