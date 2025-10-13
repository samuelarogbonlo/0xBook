import { PrismaClient } from '@prisma/client'
import { logger } from './logger.js'

export const db = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
})

db.$on('warn', (e) => {
  logger.warn(`Prisma warning: ${e.message}`)
})

db.$on('error', (e) => {
  logger.error(`Prisma error: ${e.message}`)
})

export async function connectDB() {
  try {
    await db.$connect()
    logger.info('Database connected')
  } catch (error) {
    logger.error('Failed to connect to database', error)
    throw error
  }
}

export async function disconnectDB() {
  await db.$disconnect()
  logger.info('Database disconnected')
}
