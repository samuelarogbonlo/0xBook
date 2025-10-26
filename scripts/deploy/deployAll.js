const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying 0xBook DEX - Full System\n");

  // Deploy test tokens
  console.log("1. Deploying Mock Tokens...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log(`   ✅ USDC: ${await usdc.getAddress()}`);

  const MockWETH = await hre.ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  await weth.waitForDeployment();
  console.log(`   ✅ WETH: ${await weth.getAddress()}`);

  // Deploy OrderBook
  console.log("\n2. Deploying OrderBook...");
  const OrderBook = await hre.ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(
    await weth.getAddress(),
    await usdc.getAddress(),
    6 // USDC decimals
  );
  await orderBook.waitForDeployment();
  console.log(`   ✅ OrderBook: ${await orderBook.getAddress()}`);

  // Deploy MatchingEngine
  console.log("\n3. Deploying MatchingEngine...");
  const MatchingEngine = await hre.ethers.getContractFactory("MatchingEngine");
  const matchingEngine = await MatchingEngine.deploy(await orderBook.getAddress());
  await matchingEngine.waitForDeployment();
  console.log(`   ✅ MatchingEngine: ${await matchingEngine.getAddress()}`);

  // Deploy AMMFallback
  console.log("\n4. Deploying AMMFallback...");
  const AMMFallback = await hre.ethers.getContractFactory("AMMFallback");
  const amm = await AMMFallback.deploy(
    await weth.getAddress(),
    await usdc.getAddress()
  );
  await amm.waitForDeployment();
  console.log(`   ✅ AMMFallback: ${await amm.getAddress()}`);

  // Deploy Router
  console.log("\n5. Deploying Router...");
  const Router = await hre.ethers.getContractFactory("Router");
  const router = await Router.deploy(
    await orderBook.getAddress(),
    await amm.getAddress()
  );
  await router.waitForDeployment();
  console.log(`   ✅ Router: ${await router.getAddress()}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("-----------------------------------------------------------");
  console.log(`USDC:           ${await usdc.getAddress()}`);
  console.log(`WETH:           ${await weth.getAddress()}`);
  console.log(`OrderBook:      ${await orderBook.getAddress()}`);
  console.log(`MatchingEngine: ${await matchingEngine.getAddress()}`);
  console.log(`AMMFallback:    ${await amm.getAddress()}`);
  console.log(`Router:         ${await router.getAddress()}`);
  console.log("-----------------------------------------------------------\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
