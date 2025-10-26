const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debugging Arcology DevNet...\n");

  const [deployer, trader1] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Trader1:", trader1.address);

  // Check balances
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH\n");

  // Test 1: Deploy simple tokens
  console.log("Test 1: Deploying Mock Tokens...");
  const MockWETH = await ethers.getContractFactory("MockWETH");
  const weth = await MockWETH.deploy();
  await weth.waitForDeployment();
  const wethTx = weth.deploymentTransaction();
  if (wethTx) await wethTx.wait(2);
  console.log("✅ WETH deployed:", await weth.getAddress());

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcTx = usdc.deploymentTransaction();
  if (usdcTx) await usdcTx.wait(2);
  console.log("✅ USDC deployed:", await usdc.getAddress());

  // Test 2: Mint tokens
  console.log("\nTest 2: Minting tokens...");
  try {
    const mintTx = await weth.mint(trader1.address, ethers.parseEther("100"));
    const receipt = await mintTx.wait(2);
    console.log("✅ Minted 100 WETH to trader1, status:", receipt.status);
  } catch (error) {
    console.error("❌ Mint failed:", error.message);
  }

  // Test 3: Deploy OrderBook WITHOUT U256Cumulative
  console.log("\nTest 3: Checking if U256Cumulative is the issue...");
  console.log("Attempting to deploy OrderBook with U256Cumulative...");

  try {
    const OrderBook = await ethers.getContractFactory("OrderBook");
    const orderBook = await OrderBook.deploy(
      await weth.getAddress(),
      await usdc.getAddress(),
      18, // baseDecimals
      6   // quoteDecimals
    );
    await orderBook.waitForDeployment();
    const obTx = orderBook.deploymentTransaction();
    if (obTx) {
      const receipt = await obTx.wait(2);
      console.log("✅ OrderBook deployed:", await orderBook.getAddress());
      console.log("   Deployment status:", receipt.status);
      console.log("   Gas used:", receipt.gasUsed.toString());
    }

    // Test calling concurrent counter getter
    console.log("\nTest 4: Reading concurrent counters...");
    try {
      const volume = await orderBook.getTotalVolume();
      console.log("✅ Total volume:", volume.toString());
    } catch (error) {
      console.error("❌ Reading counter failed:", error.message);
    }

  } catch (error) {
    console.error("❌ OrderBook deployment failed:", error.message);
    if (error.receipt) {
      console.error("   Receipt status:", error.receipt.status);
      console.error("   Gas used:", error.receipt.gasUsed.toString());
    }
  }

  // Test 4: Try placing an order
  console.log("\nTest 5: Attempting to place an order...");
  try {
    const OrderBook = await ethers.getContractFactory("OrderBook");
    const orderBookAddress = "0xFF899142ac90F923331D7da52B5Cd230AFB35ee8"; // From latest deployment
    const orderBook = OrderBook.attach(orderBookAddress);

    const price = ethers.parseUnits("3000", 6);
    const amount = ethers.parseEther("1");
    const cost = (price * amount) / ethers.parseEther("1");

    console.log("  Approving USDC...");
    const approveTx = await usdc.connect(trader1).approve(orderBookAddress, cost);
    const approveReceipt = await approveTx.wait(2);
    console.log("  ✅ Approval status:", approveReceipt.status);

    console.log("  Placing order...");
    const placeTx = await orderBook.connect(trader1).placeOrder(price, amount, true);
    const placeReceipt = await placeTx.wait(2);
    console.log("  ✅ Order placed, status:", placeReceipt.status);

  } catch (error) {
    console.error("❌ Place order failed:", error.message);
    if (error.receipt) {
      console.error("   Receipt status:", error.receipt.status);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
