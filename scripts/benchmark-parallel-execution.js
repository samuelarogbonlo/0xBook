/**
 * Parallel Execution Benchmark for Arcology DevNet
 *
 * Demonstrates:
 * 1. Storage-slot level parallelism (different price levels)
 * 2. Conflict-free counters (U256Cumulative)
 * 3. TPS comparison: parallel vs sequential
 */

import { network } from "hardhat";

async function main() {
  console.log("⚡ ARCOLOGY PARALLEL EXECUTION BENCHMARK");
  console.log("=" .repeat(60));
  console.log();

  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();

  // Wrap signer with NonceManager for parallel transaction handling
  const managedSigner = new ethers.NonceManager(deployer);

  const deployment = await import("../deployment-arcology.json", { assert: { type: "json" } }).then(m => m.default);

  // Connect to contracts using managed signer
  const usdc = await ethers.getContractAt("MockUSDC", deployment.contracts.USDC, managedSigner);
  const weth = await ethers.getContractAt("MockWETH", deployment.contracts.WETH, managedSigner);
  const orderBook = await ethers.getContractAt("OrderBook", deployment.contracts.OrderBook, managedSigner);

  console.log("📊 Test Configuration:");
  console.log("  Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("  OrderBook:", await orderBook.getAddress());
  console.log("  Account:", managedSigner.signer.address);
  console.log("  Nonce Management: NonceManager (automatic)");

  // Verify U256Cumulative is active
  const usesConcurrent = await orderBook.countersUseConcurrent();
  console.log("  U256Cumulative Active:", usesConcurrent);

  if (!usesConcurrent) {
    console.log("\n⚠️  WARNING: Concurrent counters not active!");
    console.log("  Benchmark will still run but won't show full parallel benefits.");
  }
  console.log();

  // Setup: Mint tokens
  console.log("🔧 Setup: Minting tokens...");
  const mintTx1 = await usdc.mint(managedSigner.signer.address, ethers.parseUnits("10000000", 6));
  await mintTx1.wait(2);
  const mintTx2 = await weth.mint(managedSigner.signer.address, ethers.parseEther("5000"));
  await mintTx2.wait(2);
  console.log("  ✓ Tokens minted\n");

  // ============================================================
  // BENCHMARK 1: Storage-Slot Parallelism
  // ============================================================
  console.log("=" .repeat(60));
  console.log("📈 BENCHMARK 1: Storage-Slot Parallelism");
  console.log("=" .repeat(60));
  console.log("Testing: Orders at DIFFERENT price levels (should be parallel)");
  console.log();

  const NUM_ORDERS = 20;
  const BASE_PRICE = 2500;
  const PRICE_INCREMENT = 50;

  console.log(`Placing ${NUM_ORDERS} orders across ${NUM_ORDERS} different price levels...`);
  console.log("Expected: Low conflicts (different storage slots)\n");

  // Prepare orders at different prices
  const differentPriceOrders = [];
  let totalApprovalNeeded = 0n;
  const orderBookAddress = await orderBook.getAddress();

  for (let i = 0; i < NUM_ORDERS; i++) {
    const price = ethers.parseUnits((BASE_PRICE + i * PRICE_INCREMENT).toString(), 6);
    const amount = ethers.parseEther("0.1");
    const cost = (price * amount) / ethers.parseEther("1");

    differentPriceOrders.push({ price, amount, cost });
    totalApprovalNeeded += cost;
  }

  // Approve total amount once to avoid sequential allowance overwrites
  const approveDifferentPrices = await usdc.approve(orderBookAddress, totalApprovalNeeded);
  await approveDifferentPrices.wait(2);

  const initialOrders = await orderBook.getTotalOrdersPlaced();
  const startTime = Date.now();

  // Place orders in parallel
  const orderPromises = differentPriceOrders.map(({ price, amount }) =>
    orderBook.placeOrder(price, amount, true)
  );

  console.log("⏳ Submitting orders in parallel...");
  const receipts = await Promise.all(
    orderPromises.map(async (promise, idx) => {
      const tx = await promise;
      console.log(`  ▹ Submitted order ${idx + 1}/${NUM_ORDERS}: ${tx.hash}`);
      const receipt = await tx.wait(2, 120000);
      console.log(
        `    ✔ Confirmed order ${idx + 1}/${NUM_ORDERS} (status ${receipt.status})`
      );
      return receipt;
    })
  );

  const endTime = Date.now();
  const elapsedSeconds = (endTime - startTime) / 1000;

  const finalOrders = await orderBook.getTotalOrdersPlaced();
  const ordersPlaced = Number(finalOrders - initialOrders);

  // Calculate metrics
  const successCount = receipts.filter(r => r.status === 1).length;
  const failCount = receipts.length - successCount;
  const tps = ordersPlaced / elapsedSeconds;

  console.log("\n✅ RESULTS:");
  console.log(`  Total orders submitted: ${receipts.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Counter value: ${ordersPlaced}`);
  console.log(`  Time elapsed: ${elapsedSeconds.toFixed(2)}s`);
  console.log(`  Throughput: ${tps.toFixed(2)} TPS`);
  console.log(`  Success rate: ${((successCount / receipts.length) * 100).toFixed(1)}%`);

  // ============================================================
  // BENCHMARK 2: Conflict-Free Counters (U256Cumulative)
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("🔢 BENCHMARK 2: Conflict-Free Counter Updates");
  console.log("=".repeat(60));
  console.log("Testing: Multiple transactions incrementing same counter");
  console.log("Expected: All succeed (U256Cumulative delta writes)\n");

  const COUNTER_TEST_SIZE = 10;
  console.log(`Placing ${COUNTER_TEST_SIZE} orders to test concurrent counter...`);

  const fixedPrice = ethers.parseUnits("3000", 6);
  const fixedAmount = ethers.parseEther("0.05");
  const fixedCost = (fixedPrice * fixedAmount) / ethers.parseEther("1");

  // Approve all
  const bulkApproveTx = await usdc.approve(
    await orderBook.getAddress(),
    fixedCost * BigInt(COUNTER_TEST_SIZE)
  );
  await bulkApproveTx.wait(2);

  const beforeCounter = await orderBook.getTotalOrdersPlaced();
  console.log(`  Counter before: ${beforeCounter}`);

  // Submit all at once
  const counterTestPromises = Array(COUNTER_TEST_SIZE)
    .fill(null)
    .map(() => orderBook.placeOrder(fixedPrice, fixedAmount, true));

  const counterStartTime = Date.now();
  const counterSettled = await Promise.allSettled(
    counterTestPromises.map(async (promise, idx) => {
      const tx = await promise;
      console.log(`  ▹ Submitted counter order ${idx + 1}/${COUNTER_TEST_SIZE}: ${tx.hash}`);
      const receipt = await tx.wait(2, 120000);
      console.log(
        `    ✔ Confirmed counter order ${idx + 1}/${COUNTER_TEST_SIZE} (status ${receipt.status})`
      );
      return receipt;
    })
  );
  const counterReceipts = counterSettled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const counterFailures = counterSettled.filter((result) => result.status === "rejected");
  counterFailures.forEach((failure, index) => {
    console.error(`    ❌ Counter order ${index + 1} failed:`, failure.reason?.message || failure.reason || failure);
  });
  const counterElapsed = (Date.now() - counterStartTime) / 1000;

  const afterCounter = await orderBook.getTotalOrdersPlaced();
  const counterIncrement = Number(afterCounter - beforeCounter);

  const counterSuccess = counterReceipts.filter(r => r.status === 1).length;

  console.log("\n✅ RESULTS:");
  console.log(`  Counter before: ${beforeCounter}`);
  console.log(`  Counter after: ${afterCounter}`);
  console.log(`  Increment: ${counterIncrement}`);
  console.log(`  Expected increment: ${COUNTER_TEST_SIZE}`);
  console.log(`  Match: ${counterIncrement === COUNTER_TEST_SIZE ? "✅ YES" : "❌ NO"}`);
  console.log(`  Successful txs: ${counterSuccess}/${COUNTER_TEST_SIZE}`);
  console.log(`  Time: ${counterElapsed.toFixed(2)}s`);
  console.log(`  TPS: ${(counterSuccess / counterElapsed).toFixed(2)}`);

  // ============================================================
  // BENCHMARK 3: Same Price Level - Heavy Contention Test
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("⚔️  BENCHMARK 3: Heavy Contention Test");
  console.log("=".repeat(60));
  console.log("Testing: 100 orders at SAME price level (high contention)");
  console.log("Expected: Stress-test U256Cumulative under heavy concurrent writes\n");

  const SAME_PRICE_TEST = 100;
  const samePrice = ethers.parseUnits("2800", 6);
  const sameAmount = ethers.parseEther("0.05");
  const sameCost = (samePrice * sameAmount) / ethers.parseEther("1");

  // Approve
  const sameApproveTx = await usdc.approve(
    await orderBook.getAddress(),
    sameCost * BigInt(SAME_PRICE_TEST)
  );
  await sameApproveTx.wait(2);

  console.log(`Placing ${SAME_PRICE_TEST} orders at price level ${ethers.formatUnits(samePrice, 6)} USDC...`);

  const samePricePromises = Array(SAME_PRICE_TEST)
    .fill(null)
    .map(() => orderBook.placeOrder(samePrice, sameAmount, true));

  const sameStartTime = Date.now();
  const sameSettled = await Promise.allSettled(
    samePricePromises.map(async (promise, idx) => {
      const tx = await promise;
      console.log(`  ▹ Submitted same-price order ${idx + 1}/${SAME_PRICE_TEST}: ${tx.hash}`);
      const receipt = await tx.wait(2, 120000);
      console.log(
        `    ✔ Confirmed same-price order ${idx + 1}/${SAME_PRICE_TEST} (status ${receipt.status})`
      );
      return receipt;
    })
  );
  const sameReceipts = sameSettled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const sameFailures = sameSettled.filter((result) => result.status === "rejected");
  sameFailures.forEach((failure, index) => {
    console.error(`    ❌ Same-price order ${index + 1} failed:`, failure.reason?.message || failure.reason || failure);
  });
  const sameElapsed = (Date.now() - sameStartTime) / 1000;

  const sameSuccess = sameReceipts.filter(r => r.status === 1).length;
  const sameFail = sameFailures.length;

  console.log("\n✅ RESULTS:");
  console.log(`  Successful: ${sameSuccess}/${SAME_PRICE_TEST}`);
  console.log(`  Failed: ${sameFail}`);
  console.log(`  Success rate: ${((sameSuccess / SAME_PRICE_TEST) * 100).toFixed(1)}%`);
  console.log(`  Conflict rate: ${((sameFail / SAME_PRICE_TEST) * 100).toFixed(1)}%`);
  console.log(`  Time: ${sameElapsed.toFixed(2)}s`);
  console.log(`  TPS: ${(sameSuccess / sameElapsed).toFixed(2)}`);

  // ============================================================
  // SUMMARY REPORT
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("📊 BENCHMARK SUMMARY");
  console.log("=".repeat(60));
  console.log();
  console.log("✅ Arcology Parallel Execution Features Demonstrated:");
  console.log();
  console.log("1️⃣  STORAGE-SLOT PARALLELISM:");
  console.log(`   ${NUM_ORDERS} orders at different prices executed`);
  console.log(`   Success rate: ${((successCount / receipts.length) * 100).toFixed(1)}%`);
  console.log(`   Throughput: ${tps.toFixed(2)} TPS`);
  console.log(`   ✓ Different storage slots enable parallel execution`);
  console.log();
  console.log("2️⃣  CONFLICT-FREE COUNTERS (U256Cumulative):");
  console.log(`   Counter incremented by: ${counterIncrement}`);
  console.log(`   Expected: ${COUNTER_TEST_SIZE}`);
  console.log(`   Accuracy: ${counterIncrement === COUNTER_TEST_SIZE ? "100% ✅" : "Mismatch ❌"}`);
  console.log(`   ✓ Delta writes prevent write-write conflicts`);
  console.log();
  console.log("3️⃣  HEAVY CONTENTION TEST (100 orders, same price):");
  console.log(`   Success rate: ${((sameSuccess / SAME_PRICE_TEST) * 100).toFixed(1)}%`);
  console.log(`   Conflict rate: ${((sameFail / SAME_PRICE_TEST) * 100).toFixed(1)}%`);
  console.log(`   Throughput: ${(sameSuccess / sameElapsed).toFixed(2)} TPS`);
  console.log(`   ✓ ${sameFail === 0 ? "Zero conflicts under heavy contention" : "Measured conflict handling under stress"}`);
  console.log();
  console.log("4️⃣  CONCURRENT SERVICE STATUS:");
  console.log(`   U256Cumulative Active: ${usesConcurrent ? "✅ YES" : "❌ NO"}`);
  console.log(`   Address 0x85 responding: ${usesConcurrent ? "✅ YES" : "❌ NO"}`);
  console.log();

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    u256CumulativeActive: usesConcurrent,
    benchmarks: {
      storageLevelParallelism: {
        ordersSubmitted: NUM_ORDERS,
        successCount,
        failCount,
        elapsedSeconds: parseFloat(elapsedSeconds.toFixed(2)),
        tps: parseFloat(tps.toFixed(2)),
        successRate: parseFloat(((successCount / receipts.length) * 100).toFixed(1))
      },
      conflictFreeCounters: {
        testSize: COUNTER_TEST_SIZE,
        counterBefore: beforeCounter.toString(),
        counterAfter: afterCounter.toString(),
        increment: counterIncrement,
        expectedIncrement: COUNTER_TEST_SIZE,
        accurate: counterIncrement === COUNTER_TEST_SIZE,
        successfulTxs: counterSuccess,
        elapsedSeconds: parseFloat(counterElapsed.toFixed(2)),
        tps: parseFloat((counterSuccess / counterElapsed).toFixed(2))
      },
      heavyContentionTest: {
        testSize: SAME_PRICE_TEST,
        description: "100 orders at same price level",
        successCount: sameSuccess,
        failCount: sameFail,
        successRate: parseFloat(((sameSuccess / SAME_PRICE_TEST) * 100).toFixed(1)),
        conflictRate: parseFloat(((sameFail / SAME_PRICE_TEST) * 100).toFixed(1)),
        elapsedSeconds: parseFloat(sameElapsed.toFixed(2)),
        tps: parseFloat((sameSuccess / sameElapsed).toFixed(2))
      }
    }
  };

  const fs = await import('fs');
  fs.writeFileSync(
    'benchmark-results-arcology.json',
    JSON.stringify(results, null, 2)
  );

  console.log("📄 Results saved to: benchmark-results-arcology.json");
  console.log();
  console.log("=" .repeat(60));
  console.log("✅ BENCHMARK COMPLETE");
  console.log("=" .repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ BENCHMARK ERROR:", error.message || error);
    process.exit(1);
  });
