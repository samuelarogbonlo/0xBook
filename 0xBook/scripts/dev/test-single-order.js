const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("Testing single order placement on Arcology...\n");

  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);

  // Load deployed contracts
  const deployment = require("../deployment-arcology.json");

  const orderBook = await ethers.getContractAt("OrderBook", deployment.contracts.OrderBook);
  const usdc = await ethers.getContractAt("MockUSDC", deployment.contracts.USDC);
  const weth = await ethers.getContractAt("MockWETH", deployment.contracts.WETH);

  console.log(`OrderBook: ${deployment.contracts.OrderBook}`);
  console.log(`USDC: ${deployment.contracts.USDC}`);
  console.log(`WETH: ${deployment.contracts.WETH}\n`);

  // Check balances
  const usdcBalance = await usdc.balanceOf(signer.address);
  const wethBalance = await weth.balanceOf(signer.address);
  console.log(`USDC balance: ${ethers.formatUnits(usdcBalance, 6)}`);
  console.log(`WETH balance: ${ethers.formatEther(wethBalance)}\n`);

  // Test single order
  const price = ethers.parseUnits("3000", 6);
  const amount = ethers.parseEther("0.1");
  const cost = (price * amount) / ethers.parseEther("1");

  console.log(`Approving ${ethers.formatUnits(cost, 6)} USDC...`);
  const approveTx = await usdc.approve(deployment.contracts.OrderBook, cost);
  console.log(`  TX: ${approveTx.hash}`);
  const approveReceipt = await approveTx.wait(2);
  console.log(`  Status: ${approveReceipt.status}\n`);

  console.log(`Placing buy order: ${ethers.formatEther(amount)} WETH @ ${ethers.formatUnits(price, 6)} USDC...`);
  const orderTx = await orderBook.placeOrder(price, amount, true);
  console.log(`  TX: ${orderTx.hash}`);

  console.log(`  Waiting for confirmation (timeout 60s)...`);
  const orderReceipt = await orderTx.wait(2, 60000);
  console.log(`  Status: ${orderReceipt.status}`);
  console.log(`  Gas used: ${orderReceipt.gasUsed.toString()}\n`);

  const totalOrders = await orderBook.getTotalOrdersPlaced();
  console.log(`✅ Total orders placed: ${totalOrders}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
