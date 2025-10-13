import { getEnv } from '../src/utils/env.js'
import { rpcClient } from '../src/services/data/rpc-client.js'
import { logger } from '../src/utils/logger.js'

async function verifyRPC() {
  try {
    getEnv()
    logger.info('✓ Environment variables loaded')

    const baseBlock = await rpcClient.getBlockNumber('base')
    logger.info(`✓ Base Sepolia: Connected (block ${baseBlock})`)

    const arbitrumBlock = await rpcClient.getBlockNumber('arbitrum')
    logger.info(`✓ Arbitrum Sepolia: Connected (block ${arbitrumBlock})`)

    logger.info('All RPC providers verified successfully')
    process.exit(0)
  } catch (error) {
    logger.error('RPC verification failed', error)
    process.exit(1)
  }
}

verifyRPC()
