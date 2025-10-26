# 0xBook - On-Chain Order Book DEX

**A proof-of-concept on-chain order book DEX leveraging Arcology's storage-slot level parallelism**

Built with **Hardhat 3.0.9** for the Hardhat 3 Bounty and Arcology Parallel Execution Hackathon.

## Overview

0xBook demonstrates how parallel execution enables order books that are impossible on sequential EVM chains. By utilizing Arcology's unique parallel processing capabilities, we achieve 23.38 TPS with zero transaction conflicts.

**Key Innovation:** Orders at different price levels ($3000, $3005, $3010) access different storage slots and execute simultaneously in the same block, eliminating sequential bottlenecks.

## Core Features

1. **OrderBook.sol** - Order management with price-level storage separation
2. **MatchingEngine.sol** - Parallel order matching across price levels
3. **AMMFallback.sol** - Constant product AMM for fallback liquidity
4. **Router.sol** - Intelligent routing between order book and AMM

## Performance

- **23.38 TPS** sustained throughput
- **0% conflict rate** with U256Cumulative counters
- **100% accuracy** on 130 concurrent transactions
- **10/10 tests passing**

See [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md) for detailed analysis.

## Quick Start

**For detailed setup and demos, see [QUICKSTART_JUDGES.md](docs/submission/QUICKSTART_JUDGES.md)**

```bash
# Prerequisites: Node.js 22+
npm install

# Run Hardhat 3 demo
npx hardhat run scripts/hardhat3-simulation.js

# Run benchmark (generates transaction batches)
npx hardhat run scripts/benchmark-parallel-execution.js

# Run tests
npx hardhat test
```

## Architecture Highlights

**Parallel Execution Pattern:**
```solidity
// Different price levels = different storage slots = parallel execution
mapping(uint256 => uint256[]) public buyOrdersByPrice;
// Orders at $3000, $3005, $3010 process simultaneously
```

**U256Cumulative Counters:**
```solidity
import "@arcologynetwork/concurrentlib/lib/commutative/U256Cum.sol";
U256Cumulative totalVolume = new U256Cumulative(0, type(uint256).max);
totalVolume.add(amount);  // Conflict-free concurrent increment
```

**Hardhat 3 ESM Configuration:**
```javascript
import { network } from "hardhat";
const { ethers } = await network.connect();  // New API
```

## Project Structure

```
contracts/core/     OrderBook, MatchingEngine, Router
contracts/amm/      AMMFallback
scripts/            hardhat3-simulation.js, benchmark-parallel-execution.js
test/               10/10 tests passing
docs/submission/    QUICKSTART_JUDGES.md, detailed documentation
```

## Documentation

**→ [Quick Start Guide](docs/submission/QUICKSTART_JUDGES.md)** - Setup and demos in 2 minutes
**→ [Benchmark Results](BENCHMARK_RESULTS.md)** - Detailed performance analysis

Additional docs: See [docs/submission/](docs/submission/) for complete documentation

---

**Built with Hardhat 3.0.9** | **Solidity 0.8.19** | **Arcology U256Cumulative**

MIT License
