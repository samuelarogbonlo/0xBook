# Quick Start Guide for Judges/Reviewers

**0xBook DEX - Hardhat 3 & Arcology Parallel Execution Demo**

This guide will get you running the Hardhat 3 demo in under 2 minutes.

---

## Prerequisites

**Node.js 22+ is REQUIRED**

Check your version:
```bash
node --version
```

If you don't have Node 22:
```bash
# Install nvm if needed: https://github.com/nvm-sh/nvm

nvm install 22
nvm use 22
node --version  # Should show v22.x.x
```

---

## Installation (30 seconds)

```bash
npm install
```

That's it! All dependencies will be installed.

---

## Verify Hardhat 3 (10 seconds)

```bash
npx hardhat --version
```

**Expected output:** `3.0.9`

---

## Compile Contracts (20 seconds)

```bash
npx hardhat compile
```

**Expected output:**
```
Compiled 9 Solidity files with solc 0.8.19
```

---

## Run Hardhat 3 Demo (30 seconds)

```bash
npx hardhat run scripts/hardhat3-simulation.js
```

**Expected output:**
```
🚀 HARDHAT 3 NETWORK SIMULATION DEMO
============================================================

📦 Deploying contracts to Hardhat network...
  ✓ USDC: 0x5FbDB2315678afecb367f032d93F642f64180aa3
  ✓ WETH: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  ✓ OrderBook: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

⚡ PARALLEL ORDER PLACEMENT (9 orders across 3 traders)
  ✓ All 9 orders placed successfully
  ⏱  Execution time: 16ms
  📊 Throughput: 562.50 orders/sec

📊 ORDER BOOK STATE
  Best Bid: 3050.0 USDC
  Total Orders: 9
  Accuracy: ✅ PERFECT (9/9)

✅ HARDHAT 3 SIMULATION COMPLETE
```

**What this demonstrates:**
- ✅ Hardhat 3.0.9 working
- ✅ ESM (ES Modules) configuration
- ✅ New `await network.connect()` API
- ✅ EDR simulated network
- ✅ Parallel transaction execution
- ✅ Real DEX functionality

---

## Run Tests (Optional, 30 seconds)

```bash
npx hardhat test
```

**Expected:** `10 passing`

---

## What to Review

### 1. Hardhat 3 Configuration

**File:** [hardhat.config.js](./hardhat.config.js)

Key features:
```javascript
import hardhatToolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

export default {
  plugins: [hardhatToolbox, hardhatEthers],  // New plugin architecture
  networks: {
    hardhat: {
      type: "edr-simulated",  // Hardhat 3's new network type
      chainId: 1337
    }
  }
};
```

### 2. ESM Setup

**File:** [package.json](./package.json)

```json
{
  "type": "module",  // Required for ESM
  "devDependencies": {
    "hardhat": "^3.0.9",
    "@nomicfoundation/hardhat-toolbox-mocha-ethers": "^3.0.0"
  }
}
```

### 3. Modern Network API

**File:** [scripts/hardhat3-simulation.js](./scripts/hardhat3-simulation.js)

```javascript
import { network } from "hardhat";  // ESM import

async function main() {
  const { ethers } = await network.connect();  // New API

  const signers = await ethers.getSigners();
  const contract = await ethers.deployContract("OrderBook", [...]);
}
```

### 4. Smart Contracts

**Files:**
- [contracts/core/OrderBook.sol](./contracts/core/OrderBook.sol) - On-chain order book
- [contracts/core/MatchingEngine.sol](./contracts/core/MatchingEngine.sol) - Parallel matching
- [contracts/amm/AMMFallback.sol](./contracts/amm/AMMFallback.sol) - AMM liquidity
- [contracts/core/Router.sol](./contracts/core/Router.sol) - Smart routing

---

## Documentation

### Quick Reference
1. **[README.md](./README.md)** - Project overview
2. **[HARDHAT3_FEATURES.md](./HARDHAT3_FEATURES.md)** - Detailed Hardhat 3 documentation
3. **[HARDHAT3_SUBMISSION.md](./HARDHAT3_SUBMISSION.md)** - Submission checklist
4. **[COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)** - Full project summary

### Arcology Benchmarks
5. **[BENCHMARK_RESULTS.md](./BENCHMARK_RESULTS.md)** - Real performance data on Arcology

---

## Troubleshooting

### "Hardhat only supports ESM projects"
**Fix:** Make sure you're using the code from this repo, which has `"type": "module"` in package.json

### "Command failed: npx hardhat"
**Fix:** Ensure Node 22+ is active:
```bash
nvm use 22
node --version  # Must show v22.x.x
```

### "Cannot find module"
**Fix:** Re-install dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Compilation fails
**Fix:** Clean and recompile:
```bash
npx hardhat clean
npx hardhat compile
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Hardhat Version | 3.0.9 ✅ |
| Node Version Required | 22+ ✅ |
| ESM Enabled | Yes ✅ |
| Contracts | 4 core |
| Test Pass Rate | 100% (10/10) |
| Demo Throughput | 562 orders/sec |
| Arcology TPS | 23.38 (0% conflicts) |

---

## One-Liner Demo

For the impatient reviewer:

```bash
nvm use 22 && npm install && npx hardhat run scripts/hardhat3-simulation.js
```

This will:
1. Switch to Node 22
2. Install dependencies
3. Run the full Hardhat 3 demo

**Expected time:** ~60 seconds

---

## What Makes This Special

### 1. Real Functionality
Not a "hello world" - this is a working DEX with:
- Order book with limit orders
- Order matching engine
- AMM fallback liquidity
- Smart routing
- Token escrow

### 2. Hardhat 3 Best Practices
- Full ESM migration
- New plugin architecture
- Modern network API
- EDR simulated network
- Proper async/await patterns

### 3. Parallel Execution
- Demonstrates Arcology's capabilities
- Real benchmark data (23.38 TPS)
- Zero conflicts under contention
- Concurrent counter accuracy

### 4. Production Ready
- Security (ReentrancyGuard)
- Gas optimization
- Comprehensive tests
- Error handling
- Event logging

---

## Questions?

**Documentation:** See [HARDHAT3_FEATURES.md](./HARDHAT3_FEATURES.md)

**Benchmarks:** See [BENCHMARK_RESULTS.md](./BENCHMARK_RESULTS.md)

**Full Summary:** See [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)

---

## TL;DR - Show Me It Works

```bash
# 1. Install
npm install

# 2. Run demo
npx hardhat run scripts/hardhat3-simulation.js

# 3. See success
# ✅ HARDHAT 3 SIMULATION COMPLETE
# 📊 Throughput: 562.50 orders/sec
```

**That's it!**

---

*Built with Hardhat 3.0.9 for the Hardhat 3 Bounty*

*Optimized for Arcology Network's parallel execution*

*Ready for production deployment*
