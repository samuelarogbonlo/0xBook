# 0xBook DEX - Quick Start Guide

**Hardhat 3 + Arcology Parallel Execution**

---

## Setup (2 minutes)

**Prerequisites:** Node.js 22+

```bash
# Check version
node --version  # Must be v22+

# If needed:
nvm install 22 && nvm use 22
```

**Install:**
```bash
npm install
```

---

## Demo 1: Hardhat 3 Simulation (30 seconds)

```bash
npx hardhat run scripts/hardhat3-simulation.js
```

**Expected output:**
```
✅ HARDHAT 3 SIMULATION COMPLETE
📊 Throughput: 562.50 orders/sec
🔢 Accuracy: ✅ PERFECT (9/9)
```

**Demonstrates:** Hardhat 3 ESM, parallel transactions, U256Cumulative counters

---

## Demo 2: Generate Benchmark Transactions (2 minutes)

```bash
npx hardhat run scripts/benchmark-parallel-execution.js
```

**Expected output:**
```
✅ BENCHMARK 1: 20 TPS (different storage slots)
✅ BENCHMARK 2: Counter accuracy 100%
✅ BENCHMARK 3: 100 orders same price (stress test)

📄 Results saved to: benchmark-results-arcology.json
```

**Demonstrates:** Transaction batch generation, storage-slot parallelism, conflict-free counters

**Note:** This generates raw benchmark data. See [BENCHMARK_RESULTS.md](../../BENCHMARK_RESULTS.md) for detailed analysis

---

## Run Tests (30 seconds)

```bash
npx hardhat test
```

**Expected:** `10 passing`

---

## Key Files

**Hardhat 3 Config:** [hardhat.config.js](../../hardhat.config.js) - ESM, plugins, edr-simulated network
**Simulation:** [hardhat3-simulation.js](../../scripts/hardhat3-simulation.js) - `await network.connect()` API
**Benchmark:** [benchmark-parallel-execution.js](../../scripts/benchmark-parallel-execution.js) - Transaction batch generator
**OrderBook:** [OrderBook.sol](../../contracts/core/OrderBook.sol) - Parallel DEX

---

## Documentation

[README.md](../../README.md) | [BENCHMARK_RESULTS.md](../../BENCHMARK_RESULTS.md)

---

## Troubleshooting

**"Hardhat ESM error"** → `"type": "module"` already set
**"Cannot find module"** → `rm -rf node_modules && npm install`
**Node version** → `nvm use 22 && node --version`
