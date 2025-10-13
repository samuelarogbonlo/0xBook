import express from 'express'
import { getEnv } from './utils/env.js'
import { logger } from './utils/logger.js'
import { connectDB, disconnectDB } from './utils/db.js'
import { rpcClient } from './services/data/rpc-client.js'
import { positionMonitor } from './services/monitor.js'
import positionsRouter from './api/positions.js'
import policyRouter from './api/policy.js'
import actionsRouter from './api/actions.js'

async function main() {
  const env = getEnv()

  // Initialize database
  await connectDB()

  // Health check RPC providers
  const rpcHealth = await rpcClient.healthCheck()
  logger.info('RPC health check', rpcHealth)

  // Initialize Express server
  const app = express()
  app.use(express.json())

  // API routes
  app.use('/api/positions', positionsRouter)
  app.use('/api/policy', policyRouter)
  app.use('/api/actions', actionsRouter)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', rpc: rpcHealth })
  })

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`)
  })

  // Start position monitoring
  positionMonitor.start()

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...')
    positionMonitor.stop()
    server.close()
    await disconnectDB()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((error) => {
  logger.error('Fatal error', error)
  process.exit(1)
})
