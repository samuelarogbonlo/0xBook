const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("Testing parallel orders at SAME price level...\n");

  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);

  const deployment = require("../deployment-arcology.json");
  const orderBook = await ethers.getContractAt("OrderBook", deployment.contracts.OrderBook);
  const usdc = await ethers.getContractAt("MockUSDC", deployment.contracts.USDC);

  const price = ethers.parseUnits("3000", 6);
  const amount = ethers.parseEther("0.05");
  const cost = (price * amount) / ethers.parseEther("1");
  const NUM_ORDERS = 5;

  // Approve total
  console.log(`Approving ${ethers.formatUnits(cost * BigInt(NUM_ORDERS), 6)} USDC...`);
  const approveTx = await usdc.approve(deployment.contracts.OrderBook, cost * BigInt(NUM_ORDERS));
  await approveTx.wait(2);
  console.log(`  ✓ Approved\n`);

  // Get starting nonce
  const startNonce = await signer.getNonce();
  console.log(`Starting nonce: ${startNonce}`);

  // Place orders with manual nonce management
  console.log(`\nPlacing ${NUM_ORDERS} orders at price ${ethers.formatUnits(price, 6)}...`);
  const txPromises = [];

  for (let i = 0; i < NUM_ORDERS; i++) {
    const txPromise = orderBook.placeOrder(price, amount, true, {
      nonce: startNonce + i
    });
    txPromises.push(txPromise);
    console.log(`  Submitted order ${i + 1} with nonce ${startNonce + i}`);
  }

  console.log(`\nWaiting for ${NUM_ORDERS} transactions...`);
  const txs = await Promise.all(txPromises);

  console.log(`\nWaiting for confirmations...`);
  const receipts = await Promise.all(
    txs.map(async (tx, idx) => {
      console.log(`  TX ${idx + 1}: ${tx.hash}`);
      const receipt = await tx.wait(2, 60000);
      console.log(`    Status: ${receipt.status}, Gas: ${receipt.gasUsed}`);
      return receipt;
    })
  );

  const successCount = receipts.filter(r => r.status === 1).length;
  console.log(`\n✅ ${successCount}/${NUM_ORDERS} orders succeeded`);

  const totalOrders = await orderBook.getTotalOrdersPlaced();
  console.log(`Total orders placed (counter): ${totalOrders}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
