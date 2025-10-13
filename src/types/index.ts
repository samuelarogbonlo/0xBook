export type Chain = 'base' | 'arbitrum'
export type Protocol = 'aave' | 'compound'
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'
export type ActionType = 'rebalance' | 'supply' | 'withdraw' | 'repay'
export type ActionStatus = 'pending' | 'confirmed' | 'failed'

export interface Position {
  id: string
  userId: string
  chain: Chain
  protocol: Protocol
  collateral: {
    token: string
    amount: bigint
    valueUSD: number
  }
  debt: {
    token: string
    amount: bigint
    valueUSD: number
  }
  healthFactor: number
  liquidationThreshold: number
  lastUpdated: Date
}

export interface UserPolicy {
  address: string
  riskTolerance: RiskTolerance
  maxSpendDaily: bigint
  enabled: boolean
  pyusdBalance: bigint
}

export interface RiskAssessment {
  action: 'MONITOR' | 'PREVENTIVE_REBALANCE' | 'URGENT_REBALANCE'
  healthFactor: number
  targetHealthFactor: number
  requiredCollateral?: bigint
  sourceChain?: Chain
  destChain?: Chain
}

export interface Action {
  id: string
  userId: string
  type: ActionType
  sourceChain?: Chain
  destChain?: Chain
  amount: bigint
  costPYUSD: bigint
  status: ActionStatus
  txHash?: string
  transferId?: string
  errorMessage?: string
  createdAt: Date
  completedAt?: Date
}
