import { Contract, getAddress } from 'ethers'
import { rpcClient } from './rpc-client.js'
import { createComponentLogger } from '../../utils/logger.js'
import type { Chain, Position } from '../../types/index.js'

const logger = createComponentLogger('aave-adapter')

// Aave V3 Pool ABI - minimal interface for getUserAccountData
const POOL_ABI = [
  'function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
]

// Aave V3 Pool addresses (Sepolia testnet)
const POOL_ADDRESSES: Record<Chain, string> = {
  base: '0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b', // Base Sepolia
  arbitrum: '0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff', // Arbitrum Sepolia
}

export class AaveAdapter {
  private pools: Map<Chain, Contract> = new Map()

  constructor() {
    this.initializePools()
  }

  private initializePools() {
    for (const [chain, address] of Object.entries(POOL_ADDRESSES)) {
      const provider = rpcClient.getProvider(chain as Chain)
      const pool = new Contract(address, POOL_ABI, provider)
      this.pools.set(chain as Chain, pool)
    }
    logger.info('Aave V3 pools initialized')
  }

  async getUserPosition(userAddress: string, chain: Chain): Promise<Position | null> {
    try {
      const pool = this.pools.get(chain)
      if (!pool) {
        throw new Error(`No Aave pool configured for chain: ${chain}`)
      }

      // Normalize address to checksummed format
      const checksummedAddress = getAddress(userAddress)
      const data = await pool.getUserAccountData(checksummedAddress)

      // Skip if user has no position
      if (data.totalCollateralBase === 0n && data.totalDebtBase === 0n) {
        return null
      }

      // Convert from base units (8 decimals for USD values in Aave)
      const collateralUSD = Number(data.totalCollateralBase) / 1e8
      const debtUSD = Number(data.totalDebtBase) / 1e8
      const healthFactor = Number(data.healthFactor) / 1e18
      const liquidationThreshold = Number(data.currentLiquidationThreshold) / 1e4 // basis points

      return {
        id: `${chain}-aave-${userAddress}`,
        userId: userAddress,
        chain,
        protocol: 'aave',
        collateral: {
          token: 'MIXED', // Aave returns aggregated value
          amount: data.totalCollateralBase,
          valueUSD: collateralUSD,
        },
        debt: {
          token: 'MIXED',
          amount: data.totalDebtBase,
          valueUSD: debtUSD,
        },
        healthFactor,
        liquidationThreshold,
        lastUpdated: new Date(),
      }
    } catch (error) {
      logger.error(`Failed to fetch Aave position for ${userAddress} on ${chain}`, error)
      throw error
    }
  }

  async getAllUserPositions(userAddress: string): Promise<Position[]> {
    const chains: Chain[] = ['base', 'arbitrum']
    const positions: Position[] = []

    await Promise.all(
      chains.map(async (chain) => {
        const position = await this.getUserPosition(userAddress, chain)
        if (position) {
          positions.push(position)
        }
      })
    )

    return positions
  }

  async batchGetPositions(userAddresses: string[], chain: Chain): Promise<Position[]> {
    const positions: Position[] = []

    for (const address of userAddresses) {
      const position = await this.getUserPosition(address, chain)
      if (position) {
        positions.push(position)
      }
    }

    return positions
  }
}

export const aaveAdapter = new AaveAdapter()
