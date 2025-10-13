import { ethers, JsonRpcProvider, FallbackProvider } from 'ethers'
import { getEnv } from '../../utils/env.js'
import { createComponentLogger } from '../../utils/logger.js'
import type { Chain } from '../../types/index.js'

const logger = createComponentLogger('rpc-client')

class RPCClientManager {
  private providers: Map<Chain, FallbackProvider> = new Map()

  constructor() {
    const env = getEnv()
    this.initializeProviders(env.BASE_RPC_URL, env.ARBITRUM_RPC_URL)
  }

  private initializeProviders(baseRPC: string, arbitrumRPC: string) {
    this.providers.set('base', this.createFallbackProvider([baseRPC]))
    this.providers.set('arbitrum', this.createFallbackProvider([arbitrumRPC]))
    logger.info('RPC providers initialized')
  }

  private createFallbackProvider(urls: string[]): FallbackProvider {
    const providers = urls.map((url, index) => ({
      provider: new JsonRpcProvider(url),
      priority: index + 1,
      weight: 1,
    }))
    return new ethers.FallbackProvider(providers)
  }

  getProvider(chain: Chain): FallbackProvider {
    const provider = this.providers.get(chain)
    if (!provider) {
      throw new Error(`No provider configured for chain: ${chain}`)
    }
    return provider
  }

  async getBlockNumber(chain: Chain): Promise<number> {
    try {
      const provider = this.getProvider(chain)
      return await provider.getBlockNumber()
    } catch (error) {
      logger.error(`Failed to get block number for ${chain}`, error)
      throw error
    }
  }

  async healthCheck(): Promise<Record<Chain, boolean>> {
    const results: Record<Chain, boolean> = {} as Record<Chain, boolean>

    for (const [chain, provider] of this.providers) {
      try {
        await provider.getBlockNumber()
        results[chain] = true
      } catch {
        results[chain] = false
      }
    }

    return results
  }
}

export const rpcClient = new RPCClientManager()
