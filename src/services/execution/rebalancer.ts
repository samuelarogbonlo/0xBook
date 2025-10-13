import { availClient } from './avail-stub.js'
import { db } from '../../utils/db.js'
import { createComponentLogger } from '../../utils/logger.js'
import type { Chain } from '../../types/index.js'

const logger = createComponentLogger('rebalancer')

interface RebalanceParams {
  userId: string
  sourceChain: Chain
  destChain: Chain
  token: string
  amount: bigint
}

export class Rebalancer {
  async executeRebalance(params: RebalanceParams): Promise<string> {
    const { userId, sourceChain, destChain, token, amount } = params

    logger.info(
      `Executing rebalance for ${userId}: ${amount.toString()} ${token} from ${sourceChain} to ${destChain}`
    )

    try {
      // Step 1: Estimate costs
      const feeEstimate = await availClient.estimateFee({
        sourceChain,
        destChain,
        token,
        amount,
      })

      logger.info(`Estimated fee: ${feeEstimate.fee.toString()} ${feeEstimate.feeToken}`)

      // Step 2: Check user PYUSD balance
      const user = await db.user.findUnique({ where: { address: userId } })
      if (!user) {
        throw new Error(`User ${userId} not found`)
      }

      const pyusdBalance = BigInt(user.pyusdBalance)
      if (pyusdBalance < feeEstimate.fee) {
        throw new Error(
          `Insufficient PYUSD balance. Required: ${feeEstimate.fee}, Available: ${pyusdBalance}`
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

      // Step 5: Update action with transfer ID
      await db.action.update({
        where: { id: action.id },
        data: {
          transferId: transfer.transferId,
        },
      })

      logger.info(`Transfer initiated: ${transfer.transferId}`)

      // Step 6: Deduct PYUSD cost
      await db.user.update({
        where: { address: userId },
        data: {
          pyusdBalance: (pyusdBalance - feeEstimate.fee).toString(),
        },
      })

      // TODO: Monitor transfer status and update on completion
      // For now, we assume success in stub mode

      return action.id
    } catch (error) {
      logger.error(`Rebalance failed for ${userId}`, error)
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
}

export const rebalancer = new Rebalancer()
