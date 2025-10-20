import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  DATABASE_URL: z.string(),
  ALCHEMY_API_KEY: z.string(),
  BASE_RPC_URL: z.string().url(),
  ARBITRUM_RPC_URL: z.string().url(),
  AVAIL_API_KEY: z.string().optional(),
  AVAIL_ENDPOINT: z.string().url().optional(),
  PYUSD_BASE_ADDRESS: z.string().optional(),
  PYUSD_ARBITRUM_ADDRESS: z.string().optional(),
  AGENT_PRIVATE_KEY: z.string().optional(),
  USDC_BASE_ADDRESS: z.string().optional(),
  USDC_ARBITRUM_ADDRESS: z.string().optional(),
  USDT_BASE_ADDRESS: z.string().optional(),
  USDT_ARBITRUM_ADDRESS: z.string().optional(),
  WETH_BASE_ADDRESS: z.string().optional(),
  WETH_ARBITRUM_ADDRESS: z.string().optional(),
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
  DEMO_WALLET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let envCache: Env | null = null

export function getEnv(): Env {
  if (envCache) return envCache

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }

  envCache = parsed.data
  return envCache
}
