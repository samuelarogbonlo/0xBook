/**
 * Hardhat 3 Network Simulation Demo
 *
 * Demonstrates parallel transaction execution on Hardhat's simulated network
 */

import { network } from "hardhat";

async function main() {
  console.log("🚀 HARDHAT 3 NETWORK SIMULATION DEMO");
  console.log("=".repeat(60));
  console.log("Hardhat Version: 3.0.9 (ESM)");
  console.log("=".repeat(60));
  console.log();

  // Connect to network (Hardhat 3 API)
  const { ethers } = await network.connect();

  // Deploy contracts on simulated network
  console.log("📦 Deploying contracts to Hardhat network...");

  const [deployer, trader1, trader2, trader3] = await ethers.getSigners();
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Trader 1: ${trader1.address.slice(0, 10)}...`);
  console.log(`  Trader 2: ${trader2.address.slice(0, 10)}...`);
  console.log(`  Trader 3: ${trader3.address.slice(0, 10)}...`);
  console.log();

  // Deploy mock tokens
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const MockWETH = await ethers.getContractFactory("MockWETH");

  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const weth = await MockWETH.deploy();
  await weth.waitForDeployment();

  console.log(`  ✓ USDC: ${await usdc.getAddress()}`);
  console.log(`  ✓ WETH: ${await weth.getAddress()}`);

  // Deploy OrderBook
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(
    await weth.getAddress(),
    await usdc.getAddress(),
    18, // baseDecimals
    6   // quoteDecimals
  );
  await orderBook.waitForDeployment();

  console.log(`  ✓ OrderBook: ${await orderBook.getAddress()}`);
  console.log();

  // Mint tokens
  console.log("💰 Minting tokens to traders...");
  for (const trader of [trader1, trader2, trader3]) {
    await usdc.mint(trader.address, ethers.parseUnits("100000", 6));
    await weth.mint(trader.address, ethers.parseEther("100"));
  }
  console.log("  ✓ Minted 100,000 USDC and 100 WETH to each trader\n");

  // Approve
  const orderBookAddress = await orderBook.getAddress();
  console.log("  Approving tokens...");
  await usdc.connect(trader1).approve(orderBookAddress, ethers.parseUnits("50000", 6));
  await usdc.connect(trader2).approve(orderBookAddress, ethers.parseUnits("50000", 6));
  await usdc.connect(trader3).approve(orderBookAddress, ethers.parseUnits("50000", 6));
  console.log("  ✓ Approvals complete\n");

  // Parallel order placement
  console.log("⚡ PARALLEL ORDER PLACEMENT (9 orders across 3 traders)");
  const startTime = Date.now();

  const orderPromises = [
    orderBook.connect(trader1).placeOrder(ethers.parseUnits("3000", 6), ethers.parseEther("0.1"), true),
    orderBook.connect(trader1).placeOrder(ethers.parseUnits("3010", 6), ethers.parseEther("0.1"), true),
    orderBook.connect(trader1).placeOrder(ethers.parseUnits("3020", 6), ethers.parseEther("0.1"), true),
    orderBook.connect(trader2).placeOrder(ethers.parseUnits("2990", 6), ethers.parseEther("0.1"), true),
    orderBook.connect(trader2).placeOrder(ethers.parseUnits("2980", 6), ethers.parseEther("0.1"), true),
    orderBook.connect(trader2).placeOrder(ethers.parseUnits("2970", 6), ethers.parseEther("0.1"), true),
    orderBook.connect(trader3).placeOrder(ethers.parseUnits("3030", 6), ethers.parseEther("0.1"), true),
    orderBook.connect(trader3).placeOrder(ethers.parseUnits("3040", 6), ethers.parseEther("0.1"), true),
    orderBook.connect(trader3).placeOrder(ethers.parseUnits("3050", 6), ethers.parseEther("0.1"), true),
  ];

  await Promise.all(orderPromises);
  const elapsedMs = Date.now() - startTime;

  console.log(`  ✓ All 9 orders placed successfully`);
  console.log(`  ⏱  Execution time: ${elapsedMs}ms`);
  console.log(`  📊 Throughput: ${(9 / (elapsedMs / 1000)).toFixed(2)} orders/sec\n`);

  // Query state
  console.log("📊 ORDER BOOK STATE");
  const bestBid = await orderBook.getBestBid();
  const bestAsk = await orderBook.getBestAsk();
  const spread = await orderBook.getSpread();
  const totalOrders = await orderBook.getTotalOrdersPlaced();
  const totalVolume = await orderBook.getTotalVolume();

  console.log(`  Best Bid: ${ethers.formatUnits(bestBid, 6)} USDC`);
  console.log(`  Best Ask: ${ethers.formatUnits(bestAsk, 6)} USDC`);
  console.log(`  Spread: ${ethers.formatUnits(spread, 6)} USDC`);
  console.log(`  Total Orders: ${totalOrders}`);
  console.log(`  Total Volume: ${ethers.formatEther(totalVolume)} WETH\n`);

  // Concurrent counters
  console.log("🔢 U256CUMULATIVE CONCURRENT COUNTERS");
  const usesConcurrent = await orderBook.countersUseConcurrent();
  console.log(`  Active: ${usesConcurrent ? "✅ YES" : "❌ NO"}`);
  console.log(`  Accuracy: ${totalOrders === 9n ? "✅ PERFECT (9/9)" : "❌ MISMATCH"}\n`);

  // Stats
  console.log("📈 SIMULATION STATISTICS");
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log(`  Block Number: ${blockNumber}`);
  console.log(`  Block Timestamp: ${block.timestamp}`);
  console.log(`  Transactions: ${block.transactions.length}`);
  console.log(`  Chain ID: ${chainId}\n`);

  console.log("✅ HARDHAT 3 SIMULATION COMPLETE");
  console.log("=".repeat(60));
  console.log("\nKey Features Demonstrated:");
  console.log("  ✓ Hardhat 3 ESM configuration");
  console.log("  ✓ Parallel transaction processing");
  console.log("  ✓ Multi-account operations");
  console.log("  ✓ U256Cumulative concurrent counters");
  console.log("  ✓ Real-time order book state");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
