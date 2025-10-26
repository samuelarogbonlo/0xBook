/**
 * Deploy 0xBook contracts to Arcology DevNet
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying 0xBook to Arcology DevNet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy Mock Tokens
  console.log("📦 Deploying Mock Tokens...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("  MockUSDC deployed to:", await usdc.getAddress());

  const MockWETH = await ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  await weth.waitForDeployment();
  console.log("  MockWETH deployed to:", await weth.getAddress());

  // Deploy OrderBook
  console.log("\n📖 Deploying OrderBook...");
  const OrderBook = await ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(
    await weth.getAddress(),  // baseToken
    await usdc.getAddress(),  // quoteToken
    18,                        // baseDecimals (WETH)
    6                          // quoteDecimals (USDC)
  );
  await orderBook.waitForDeployment();
  console.log("  OrderBook deployed to:", await orderBook.getAddress());

  // Deploy MatchingEngine
  console.log("\n⚙️  Deploying MatchingEngine...");
  const MatchingEngine = await ethers.getContractFactory("MatchingEngine");
  const matchingEngine = await MatchingEngine.deploy(await orderBook.getAddress());
  await matchingEngine.waitForDeployment();
  console.log("  MatchingEngine deployed to:", await matchingEngine.getAddress());

  // Deploy AMMFallback
  console.log("\n💧 Deploying AMMFallback...");
  const AMMFallback = await ethers.getContractFactory("AMMFallback");
  const amm = await AMMFallback.deploy(
    await usdc.getAddress(),
    await weth.getAddress()
  );
  await amm.waitForDeployment();
  console.log("  AMMFallback deployed to:", await amm.getAddress());

  // Deploy Router
  console.log("\n🔀 Deploying Router...");
  const Router = await ethers.getContractFactory("Router");
  const router = await Router.deploy(
    await orderBook.getAddress(),
    await amm.getAddress()
  );
  await router.waitForDeployment();
  console.log("  Router deployed to:", await router.getAddress());

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\nContract Addresses:");
  console.log("  USDC:           ", await usdc.getAddress());
  console.log("  WETH:           ", await weth.getAddress());
  console.log("  OrderBook:      ", await orderBook.getAddress());
  console.log("  MatchingEngine: ", await matchingEngine.getAddress());
  console.log("  AMMFallback:    ", await amm.getAddress());
  console.log("  Router:         ", await router.getAddress());
  console.log("=".repeat(60));

  // Save deployment info
  const fs = require('fs');
  const deployment = {
    network: (await ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    contracts: {
      USDC: await usdc.getAddress(),
      WETH: await weth.getAddress(),
      OrderBook: await orderBook.getAddress(),
      MatchingEngine: await matchingEngine.getAddress(),
      AMMFallback: await amm.getAddress(),
      Router: await router.getAddress()
    }
  };

  fs.writeFileSync(
    'deployment-arcology.json',
    JSON.stringify(deployment, null, 2)
  );
  console.log("\n📄 Deployment info saved to deployment-arcology.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
