import { Contract, Wallet, parseUnits, formatUnits, JsonRpcProvider } from 'ethers'
import { createComponentLogger } from '../../utils/logger.js'
import type { Chain } from '../../types/index.js'
import { getEnv } from '../../utils/env.js'
import { getTokenMetadata } from '../../config/tokens.js'
import type { TokenMetadata } from '../../config/tokens.js'
import { calculateTotalFeePYUSD, formatPYUSD } from '../../config/fees.js'

const logger = createComponentLogger('avail')

// Avail Nexus Testnet API
const NEXUS_API_BASE = 'https://turing-bridge-api.avail.so'

// Supported tokens whitelist
const SUPPORTED_TOKENS = new Set(['USDC', 'USDT', 'ETH', 'WETH'])

interface TransferParams {
  sourceChain: Chain
  destChain: Chain
  token: string
  amount: bigint
  recipient: string
}

interface FeeEstimate {
  fee: bigint
  feeToken: string
}

interface TransferResult {
  transferId: string
  hash: string
}

interface TransferStatus {
  status: 'pending' | 'confirmed' | 'failed'
  txHash?: string
  errorMessage?: string
}

interface BridgeInfo {
  availChainName: string
  bridgeContractAddress: string
  vectorXChainId: string
  vectorXContractAddress: string
}

export class AvailNexusClient {
  private initialized = false
  private bridgeInfo: BridgeInfo | null = null
  private providers: Map<Chain, JsonRpcProvider> = new Map()
  private signers: Map<Chain, Wallet> = new Map()
  private agentPrivateKey?: string

  async initialize() {
    if (this.initialized) {
      return
    }

    try {
      const env = getEnv()
      this.agentPrivateKey = env.AGENT_PRIVATE_KEY

      this.providers.set('base', new JsonRpcProvider(env.BASE_RPC_URL))
      this.providers.set('arbitrum', new JsonRpcProvider(env.ARBITRUM_RPC_URL))

      if (this.agentPrivateKey) {
        for (const [chain, provider] of this.providers.entries()) {
          this.signers.set(chain, new Wallet(this.agentPrivateKey, provider))
        }
      } else {
        logger.warn('AGENT_PRIVATE_KEY not set – bridge transactions require external signing')
      }

      const response = await fetch(`${NEXUS_API_BASE}/info`)
      if (!response.ok) {
        throw new Error(`Bridge API returned ${response.status}`)
      }

      this.bridgeInfo = (await response.json()) as BridgeInfo
      this.initialized = true

      logger.info('Avail Nexus client initialized', {
        bridge: this.bridgeInfo?.bridgeContractAddress ?? 'unknown',
      })
    } catch (error) {
      logger.error('Failed to initialize Avail client', error)
      throw error
    }
  }

  private validateToken(token: string): TokenMetadata {
    const upperToken = token.toUpperCase()
    if (!SUPPORTED_TOKENS.has(upperToken)) {
      throw new Error(`Token ${token} not supported`)
    }

    const metadata = getTokenMetadata(upperToken)
    if (!metadata) {
      throw new Error(`Token metadata missing for ${upperToken}`)
    }

    return metadata
  }

  async estimateFee(params: Omit<TransferParams, 'recipient'>): Promise<FeeEstimate> {
    if (!this.initialized || !this.bridgeInfo) {
      throw new Error('Client not initialized')
    }

    const metadata = this.validateToken(params.token)
    const tokenAddress = metadata.addresses[params.sourceChain]

    if (!tokenAddress) {
      throw new Error(`Token ${metadata.symbol} not deployed on ${params.sourceChain}`)
    }

    try {
      const provider = this.providers.get(params.sourceChain)
      if (!provider) {
        throw new Error(`No provider for chain ${params.sourceChain}`)
      }

      const feeData = await provider.getFeeData()
      const gasPrice = feeData.gasPrice || 0n
      const estimatedGas = 300000n

      const bridgeFee = parseUnits('0.001', 18)
      const totalFeeETH = gasPrice * estimatedGas + bridgeFee

      // Calculate total fee in PYUSD (includes gas + service fee)
      const totalFeePYUSD = calculateTotalFeePYUSD(totalFeeETH)

      logger.debug(`Estimated fee: ${formatUnits(totalFeeETH, 18)} ETH → ${formatPYUSD(totalFeePYUSD)}`)

      return {
        fee: totalFeePYUSD,
        feeToken: 'PYUSD',
      }
    } catch (error) {
      logger.error('Fee estimation failed', error)
      throw error
    }
  }

  async initiateTransfer(params: TransferParams): Promise<TransferResult> {
    if (!this.initialized || !this.bridgeInfo) {
      throw new Error('Client not initialized')
    }

    const metadata = this.validateToken(params.token)
    const tokenAddress = metadata.addresses[params.sourceChain]

    if (!tokenAddress) {
      throw new Error(`Token ${metadata.symbol} not deployed on ${params.sourceChain}`)
    }

    try {
      const signer = this.signers.get(params.sourceChain)
      if (!signer) {
        throw new Error('Bridge signing unavailable – set AGENT_PRIVATE_KEY')
      }

      const bridgeContract = new Contract(
        this.bridgeInfo.bridgeContractAddress,
        [
          'function bridgeToken(address token, uint256 amount, uint32 destinationDomain, bytes32 recipient) external payable',
        ],
        signer
      )

      logger.info(
        `Initiating transfer: ${params.amount.toString()} ${metadata.symbol} from ${params.sourceChain} to ${params.destChain}`
      )

      const recipientBytes32 = this.addressToBytes32(params.recipient)
      const destDomain = this.getChainId(params.destChain)

      const tx = await bridgeContract.bridgeToken(tokenAddress, params.amount, destDomain, recipientBytes32) as { hash: string; wait: () => Promise<{ hash: string }> }
      logger.info(`Bridge transaction submitted: ${tx.hash}`)

      const receipt = await tx.wait()

      return {
        transferId: receipt.hash,
        hash: tx.hash,
      }
    } catch (error) {
      logger.error('Transfer initiation failed', error)
      throw error
    }
  }

  async getTransferStatus(transferId: string): Promise<TransferStatus> {
    if (!this.initialized) {
      throw new Error('Client not initialized')
    }

    try {
      const response = await fetch(`${NEXUS_API_BASE}/liveness`)
      if (!response.ok) {
        throw new Error('Bridge API unavailable')
      }

      for (const provider of this.providers.values()) {
        const receipt = await provider.getTransactionReceipt(transferId)
        if (receipt) {
          if (receipt.status === 1) {
            return {
              status: 'confirmed',
              txHash: receipt.hash,
            }
          }

          return {
            status: 'failed',
            txHash: receipt.hash,
            errorMessage: 'Transaction reverted',
          }
        }
      }

      return {
        status: 'pending',
        txHash: transferId,
      }
    } catch (error) {
      logger.error('Status check failed', error)
      return {
        status: 'pending',
      }
    }
  }

  private addressToBytes32(address: string): string {
    return '0x' + address.slice(2).padStart(64, '0')
  }

  private getChainId(chain: Chain): number {
    const chainIds: Record<Chain, number> = {
      base: 84532,
      arbitrum: 421614,
    }
    return chainIds[chain]
  }
}

export const availClient = new AvailNexusClient()
