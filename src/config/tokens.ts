import type { Chain } from '../types/index.js'
import { getEnv } from '../utils/env.js'

export interface TokenMetadata {
  symbol: string
  decimals: number
  priceUSD: number
  addresses: Record<Chain, string | undefined>
}

const env = getEnv()

const TOKENS: Record<string, TokenMetadata> = {
  USDC: {
    symbol: 'USDC',
    decimals: 6,
    priceUSD: 1,
    addresses: {
      base: env.USDC_BASE_ADDRESS,
      arbitrum: env.USDC_ARBITRUM_ADDRESS,
    },
  },
  USDT: {
    symbol: 'USDT',
    decimals: 6,
    priceUSD: 1,
    addresses: {
      base: env.USDT_BASE_ADDRESS,
      arbitrum: env.USDT_ARBITRUM_ADDRESS,
    },
  },
  WETH: {
    symbol: 'WETH',
    decimals: 18,
    priceUSD: 3000, // TODO: replace with oracle pricing
    addresses: {
      base: env.WETH_BASE_ADDRESS,
      arbitrum: env.WETH_ARBITRUM_ADDRESS,
    },
  },
  ETH: {
    symbol: 'ETH',
    decimals: 18,
    priceUSD: 3000,
    addresses: {
      base: undefined,
      arbitrum: undefined,
    },
  },
}

export function getTokenMetadata(symbol: string): TokenMetadata | undefined {
  return TOKENS[symbol.toUpperCase()]
}

export function getDefaultBridgeToken(): TokenMetadata {
  return TOKENS.USDC
}
