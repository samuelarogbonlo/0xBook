const hre = require("hardhat");

async function main() {
  console.log("Deploying 0xBook DEX contracts...\n");

  // Deploy test tokens
  console.log("1. Deploying Mock Tokens...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log(`   USDC deployed to: ${await usdc.getAddress()}`);

  const MockWETH = await hre.ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  await weth.waitForDeployment();
  console.log(`   WETH deployed to: ${await weth.getAddress()}`);

  // Deploy OrderBook
  console.log("\n2. Deploying OrderBook...");
  const OrderBook = await hre.ethers.getContractFactory("OrderBook");
  const orderBook = await OrderBook.deploy(
    await weth.getAddress(),
    await usdc.getAddress(),
    6 // USDC decimals
  );
  await orderBook.waitForDeployment();
  console.log(`   OrderBook deployed to: ${await orderBook.getAddress()}`);

  console.log("\n✅ Deployment complete!");
  console.log("\nContract Addresses:");
  console.log("-------------------");
  console.log(`USDC:      ${await usdc.getAddress()}`);
  console.log(`WETH:      ${await weth.getAddress()}`);
  console.log(`OrderBook: ${await orderBook.getAddress()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
