import { availClient } from './avail-client.js'
import { getDefaultBridgeToken, getTokenMetadata } from '../../config/tokens.js'
import { db } from '../../utils/db.js'
import { createComponentLogger } from '../../utils/logger.js'
import type { Chain, Position } from '../../types/index.js'
import { formatPYUSD } from '../../config/fees.js'

const logger = createComponentLogger('rebalancer')

interface RebalanceParams {
  userId: string
  sourceChain: Chain
  destChain: Chain
  token: string
  amount: bigint
}

interface AutoRebalanceParams {
  userId: string
  targetPosition: Position
  sourceChain: Chain
  requiredCollateralUSD: number
}

const MIN_TRANSFER_AMOUNT_USD = 1 // Avoid dust transfers

export class Rebalancer {
  async executeRebalance(params: RebalanceParams): Promise<string> {
    const { userId, sourceChain, destChain, token, amount } = params

    logger.info(
      `Executing rebalance for ${userId}: ${amount.toString()} ${token} from ${sourceChain} to ${destChain}`
    )

    try {
      // Step 1: Estimate costs (validates token support)
      const feeEstimate = await availClient.estimateFee({
        sourceChain,
        destChain,
        token,
        amount,
      })

      logger.info(`Estimated fee: ${formatPYUSD(feeEstimate.fee)}`)

      // Step 2: Check user PYUSD balance
      const user = await db.user.findUnique({ where: { address: userId } })
      if (!user) {
        throw new Error(`User ${userId} not found`)
      }

      const pyusdBalance = BigInt(user.pyusdBalance)
      if (pyusdBalance < feeEstimate.fee) {
        throw new Error(
          `Insufficient PYUSD balance. Required: ${formatPYUSD(feeEstimate.fee)}, Available: ${formatPYUSD(pyusdBalance)}`
        )
      }

      // Step 3: Create action record
      const action = await db.action.create({
        data: {
          userAddress: userId,
          type: 'rebalance',
          sourceChain,
          destChain,
          amount: amount.toString(),
          costPYUSD: feeEstimate.fee.toString(),
          status: 'pending',
        },
      })

      // Step 4: Initiate Avail transfer
      const transfer = await availClient.initiateTransfer({
        sourceChain,
        destChain,
        token,
        amount,
        recipient: userId,
      })

      // Step 5: Update action with transfer ID and deduct fee (atomic operation)
      // Only deduct fee if transfer was successfully initiated
      await db.$transaction([
        db.action.update({
          where: { id: action.id },
          data: {
            transferId: transfer.transferId,
            txHash: transfer.hash,
          },
        }),
        db.user.update({
          where: { address: userId },
          data: {
            pyusdBalance: (pyusdBalance - feeEstimate.fee).toString(),
          },
        }),
      ])

      logger.info(`Transfer initiated: ${transfer.transferId}, fee deducted: ${formatPYUSD(feeEstimate.fee)}`)

      return action.id
    } catch (error) {
      logger.error(`Rebalance failed for ${userId}`, error)
      // No fee deduction on failure - transaction rolled back automatically
      throw error
    }
  }

  async executeAutoRebalance(params: AutoRebalanceParams): Promise<string> {
    const { userId, targetPosition, sourceChain, requiredCollateralUSD } = params

    if (requiredCollateralUSD < MIN_TRANSFER_AMOUNT_USD) {
      logger.debug(`Skipping rebalance for ${userId}: delta ${requiredCollateralUSD} USD below minimum`)
      return 'skipped'
    }

    const tokenMeta = this.getBridgeToken(targetPosition)

    const amount = this.convertUsdToTokenAmount(requiredCollateralUSD, tokenMeta.decimals, tokenMeta.priceUSD)

    if (amount <= 0n) {
      throw new Error('Calculated token amount is zero')
    }

    const sourceAddress = tokenMeta.addresses[sourceChain]
    const destAddress = tokenMeta.addresses[targetPosition.chain]

    if (!sourceAddress || !destAddress) {
      throw new Error(`Token ${tokenMeta.symbol} not configured for ${sourceChain}/${targetPosition.chain}`)
    }

    logger.info(
      `Auto-rebalancing ${userId}: ${requiredCollateralUSD.toFixed(
        2
      )} USD (~${amount.toString()} units of ${tokenMeta.symbol}) from ${sourceChain} to ${targetPosition.chain}`
    )

    try {
      // Execute rebalance
      const actionId = await this.executeRebalance({
        userId,
        sourceChain,
        destChain: targetPosition.chain,
        token: tokenMeta.symbol,
        amount,
      })

      if (actionId !== 'skipped') {
        logger.info(`Auto-rebalance action created: ${actionId}`)
      }

      return actionId
    } catch (error) {
      logger.error(`Auto-rebalance failed for ${userId}`, error)
      throw error
    }
  }

  async getActionStatus(actionId: string) {
    const action = await db.action.findUnique({
      where: { id: actionId },
    })

    if (!action) {
      throw new Error(`Action ${actionId} not found`)
    }

    // Check Avail transfer status if available
    if (action.transferId && action.status === 'pending') {
      const status = await availClient.getTransferStatus(action.transferId)

      if (status.status === 'confirmed') {
        await db.action.update({
          where: { id: actionId },
          data: {
            status: 'confirmed',
            txHash: status.txHash,
            completedAt: new Date(),
          },
        })
      } else if (status.status === 'failed') {
        await db.action.update({
          where: { id: actionId },
          data: {
            status: 'failed',
            errorMessage: 'Transfer failed',
          },
        })
      }
    }

    return action
  }

  private getBridgeToken(position: Position) {
    const metadata = getTokenMetadata(position.collateral.token)
    if (metadata?.addresses[position.chain]) {
      return metadata
    }
    return getDefaultBridgeToken()
  }

  private convertUsdToTokenAmount(usd: number, decimals: number, priceUSD: number): bigint {
    if (priceUSD <= 0) {
      throw new Error('Invalid token price')
    }

    const amountInTokens = usd / priceUSD
    const baseDecimals = Math.min(decimals, 12)
    const scale = BigInt(10) ** BigInt(baseDecimals)
    const multiplier = BigInt(Math.round(amountInTokens * Number(scale)))
    const extraDecimals = decimals - baseDecimals

    if (extraDecimals > 0) {
      return multiplier * (BigInt(10) ** BigInt(extraDecimals))
    }

    return multiplier
  }
}

export const rebalancer = new Rebalancer()
