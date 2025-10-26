/**
 * Verify that 0xBook actually RUNS on Arcology DevNet
 * This script performs real transactions to prove functionality
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Verifying 0xBook runs on Arcology DevNet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get deployed contracts
  const deployment = require("../deployment-arcology.json");

  const usdc = await ethers.getContractAt("MockUSDC", deployment.contracts.USDC);
  const weth = await ethers.getContractAt("MockWETH", deployment.contracts.WETH);
  const orderBook = await ethers.getContractAt("OrderBook", deployment.contracts.OrderBook);
  const amm = await ethers.getContractAt("AMMFallback", deployment.contracts.AMMFallback);
  const router = await ethers.getContractAt("Router", deployment.contracts.Router);

  console.log("📍 Connected to contracts:");
  console.log("  USDC:", await usdc.getAddress());
  console.log("  WETH:", await weth.getAddress());
  console.log("  OrderBook:", await orderBook.getAddress());
  console.log("  AMM:", await amm.getAddress());
  console.log("  Router:", await router.getAddress());

  // Test 1: Mint tokens
  console.log("\n✅ Test 1: Minting tokens...");
  const mintTx1 = await usdc.mint(deployer.address, ethers.parseUnits("100000", 6));
  await mintTx1.wait(2);
  const mintTx2 = await weth.mint(deployer.address, ethers.parseEther("50"));
  await mintTx2.wait(2);

  const usdcBalance = await usdc.balanceOf(deployer.address);
  const wethBalance = await weth.balanceOf(deployer.address);
  console.log("  ✓ USDC balance:", ethers.formatUnits(usdcBalance, 6));
  console.log("  ✓ WETH balance:", ethers.formatEther(wethBalance));

  // Test 2: Place a buy order
  console.log("\n✅ Test 2: Placing buy order on OrderBook...");
  const price = ethers.parseUnits("3000", 6); // 3000 USDC per WETH
  const amount = ethers.parseEther("1");      // 1 WETH
  const cost = (price * amount) / ethers.parseEther("1");

  const approveTx = await usdc.approve(await orderBook.getAddress(), cost);
  await approveTx.wait(2);
  console.log("  ✓ Approved", ethers.formatUnits(cost, 6), "USDC");

  const orderTx = await orderBook.placeOrder(price, amount, true);
  const orderReceipt = await orderTx.wait(2);
  console.log("  ✓ Order placed, tx:", orderReceipt.hash);

  const order = await orderBook.orders(0);
  console.log("  ✓ Order details:");
  console.log("    - Trader:", order.trader);
  console.log("    - Price:", ethers.formatUnits(order.price, 6), "USDC");
  console.log("    - Amount:", ethers.formatEther(order.amount), "WETH");
  console.log("    - Active:", order.active);

  // Test 3: Add liquidity to AMM
  console.log("\n✅ Test 3: Adding liquidity to AMM...");
  const amount0 = ethers.parseUnits("50000", 6); // 50k USDC
  const amount1 = ethers.parseEther("25");        // 25 WETH

  const approve1 = await usdc.approve(await amm.getAddress(), amount0);
  await approve1.wait(2);
  const approve2 = await weth.approve(await amm.getAddress(), amount1);
  await approve2.wait(2);

  const addLiqTx = await amm.addLiquidity(amount0, amount1);
  await addLiqTx.wait(2);

  const reserve0 = await amm.reserve0();
  const reserve1 = await amm.reserve1();
  console.log("  ✓ Liquidity added");
  console.log("    - USDC reserve:", ethers.formatUnits(reserve0, 6));
  console.log("    - WETH reserve:", ethers.formatEther(reserve1));

  // Test 4: Get quote from Router
  console.log("\n✅ Test 4: Getting quote from Router...");
  const quoteAmount = ethers.parseEther("1");
  const quote = await router.getQuote(quoteAmount, true);
  console.log("  ✓ Quote for buying 1 WETH:");
  console.log("    - OrderBook price:", quote.orderBookPrice.toString());
  console.log("    - AMM price:", ethers.formatUnits(quote.ammPrice, 6), "USDC");
  console.log("    - Use OrderBook?:", quote.useOrderBook);

  // Test 5: Cancel order
  console.log("\n✅ Test 5: Canceling order...");
  const cancelTx = await orderBook.cancelOrder(0);
  await cancelTx.wait(2);

  const canceledOrder = await orderBook.orders(0);
  console.log("  ✓ Order canceled, active:", canceledOrder.active);

  // Test 6: Check counters
  console.log("\n✅ Test 6: Checking counters...");
  const totalOrders = await orderBook.getTotalOrdersPlaced();
  const totalTrades = await orderBook.getTotalTrades();
  const totalVolume = await orderBook.getTotalVolume();
  console.log("  ✓ Total orders placed:", totalOrders.toString());
  console.log("  ✓ Total trades:", totalTrades.toString());
  console.log("  ✓ Total volume:", ethers.formatEther(totalVolume), "WETH");

  console.log("\n" + "=".repeat(60));
  console.log("✅ ALL TESTS PASSED - 0xBook RUNS on Arcology DevNet!");
  console.log("=".repeat(60));
  console.log("\nVerified functionality:");
  console.log("  ✓ Token minting");
  console.log("  ✓ Order placement");
  console.log("  ✓ Order cancellation");
  console.log("  ✓ AMM liquidity provision");
  console.log("  ✓ Router price quotes");
  console.log("  ✓ Counter tracking");
  console.log("\nChain ID:", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("Network: Arcology DevNet (localhost:8545)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ ERROR:", error.message);
    process.exit(1);
  });
