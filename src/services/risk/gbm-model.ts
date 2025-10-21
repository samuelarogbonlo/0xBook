/**
 * Geometric Brownian Motion (GBM) model for liquidation probability estimation
 *
 * Uses simplified GBM to estimate the probability that a position's health factor
 * will drop below 1.0 (liquidation threshold) within a given time horizon.
 *
 * Assumptions:
 * - Asset prices follow GBM: dS/S = μdt + σdW
 * - 7-day historical volatility (simplified from typical 30-day)
 * - Risk-free rate approximation for drift
 */

/**
 * Calculate liquidation probability using GBM model
 *
 * @param currentHF - Current health factor
 * @param volatility - Annualized volatility (e.g., 0.5 for 50%)
 * @param timeHorizonDays - Time horizon in days (default: 7)
 * @param drift - Expected return/drift (default: 0, conservative assumption)
 * @returns Probability of liquidation (0-1)
 */
export function calculateLiquidationProbability(
  currentHF: number,
  volatility: number,
  timeHorizonDays: number = 7,
  drift: number = 0
): number {
  // If already below liquidation threshold
  if (currentHF <= 1.0) {
    return 1.0
  }

  // If health factor is very high, probability is near zero
  if (currentHF > 10.0) {
    return 0.0
  }

  // Convert time to years for calculations
  const timeYears = timeHorizonDays / 365

  // Calculate distance to liquidation in terms of standard deviations
  // Using log-normal distribution: ln(HF_t / HF_0) ~ N((μ - σ²/2)t, σ²t)
  const logRatio = Math.log(1.0 / currentHF) // ln(liquidation_HF / current_HF)
  const mean = (drift - 0.5 * volatility ** 2) * timeYears
  const stdDev = Math.max(volatility * Math.sqrt(timeYears), 1e-10) // Guard against division by zero

  // Z-score: how many standard deviations away is liquidation
  const zScore = (logRatio - mean) / stdDev

  // Probability using cumulative normal distribution
  const probability = normalCDF(zScore)

  return Math.max(0, Math.min(1, probability))
}

/**
 * Estimate volatility from historical health factor data
 * Simplified version using recent HF variance
 *
 * @param historicalHF - Array of historical health factors
 * @returns Annualized volatility estimate
 */
export function estimateVolatility(historicalHF: number[]): number {
  if (historicalHF.length < 2) {
    // Default conservative volatility for crypto (50%)
    return 0.5
  }

  // Calculate log returns
  const logReturns: number[] = []
  for (let i = 1; i < historicalHF.length; i++) {
    if (historicalHF[i] > 0 && historicalHF[i - 1] > 0) {
      logReturns.push(Math.log(historicalHF[i] / historicalHF[i - 1]))
    }
  }

  if (logReturns.length < 2) {
    return 0.5
  }

  // Calculate sample standard deviation
  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length
  const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1)
  const stdDev = Math.sqrt(variance)

  // Annualize assuming daily data (simplified)
  const annualizedVol = stdDev * Math.sqrt(365)

  // Cap at reasonable bounds
  return Math.max(0.1, Math.min(2.0, annualizedVol))
}

/**
 * Cumulative distribution function for standard normal distribution
 * Using error function approximation
 *
 * @param x - Input value
 * @returns P(Z <= x) for Z ~ N(0,1)
 */
function normalCDF(x: number): number {
  // Using error function approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const probability =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

  return x > 0 ? 1 - probability : probability
}

/**
 * Get risk assessment based on liquidation probability
 *
 * @param probability - Liquidation probability (0-1)
 * @returns Risk level description
 */
export function getRiskLevel(probability: number): {
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  description: string
} {
  if (probability >= 0.5) {
    return { level: 'CRITICAL', description: 'Very high liquidation risk' }
  } else if (probability >= 0.2) {
    return { level: 'HIGH', description: 'Significant liquidation risk' }
  } else if (probability >= 0.05) {
    return { level: 'MODERATE', description: 'Moderate liquidation risk' }
  } else {
    return { level: 'LOW', description: 'Low liquidation risk' }
  }
}

/**
 * Enhanced risk assessment with GBM probability
 */
export interface GBMRiskAssessment {
  currentHealthFactor: number
  liquidationProbability7d: number
  liquidationProbability24h: number
  riskLevel: ReturnType<typeof getRiskLevel>
  recommendedAction: 'MONITOR' | 'CONSIDER_REBALANCE' | 'REBALANCE_SOON' | 'URGENT_REBALANCE'
}

/**
 * Perform comprehensive GBM-based risk assessment
 *
 * @param currentHF - Current health factor
 * @param volatility - Asset volatility (optional, will use default if not provided)
 * @returns Comprehensive risk assessment
 */
export function assessRiskWithGBM(currentHF: number, volatility: number = 0.5): GBMRiskAssessment {
  const prob7d = calculateLiquidationProbability(currentHF, volatility, 7)
  const prob24h = calculateLiquidationProbability(currentHF, volatility, 1)
  const riskLevel = getRiskLevel(prob7d)

  let recommendedAction: GBMRiskAssessment['recommendedAction']

  if (prob24h >= 0.3 || currentHF < 1.2) {
    recommendedAction = 'URGENT_REBALANCE'
  } else if (prob7d >= 0.3 || currentHF < 1.5) {
    recommendedAction = 'REBALANCE_SOON'
  } else if (prob7d >= 0.1 || currentHF < 2.0) {
    recommendedAction = 'CONSIDER_REBALANCE'
  } else {
    recommendedAction = 'MONITOR'
  }

  return {
    currentHealthFactor: currentHF,
    liquidationProbability7d: prob7d,
    liquidationProbability24h: prob24h,
    riskLevel,
    recommendedAction,
  }
}
