const { ethers } = require("hardhat");

async function main() {
  const deployment = require("../deployment-arcology.json");
  const orderBook = await ethers.getContractAt("OrderBook", deployment.contracts.OrderBook);

  console.log("Checking deployed OrderBook at:", deployment.contracts.OrderBook);

  try {
    const usesConcurrent = await orderBook.countersUseConcurrent();
    console.log("\n✅ countersUseConcurrent:", usesConcurrent);

    if (usesConcurrent) {
      console.log("🎉 U256Cumulative is ACTIVE!");
    } else {
      console.log("⚠️  Using scalar counters (U256Cumulative unavailable)");
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
    console.log("(Contract may not have countersUseConcurrent method)");
  }
}

main();
