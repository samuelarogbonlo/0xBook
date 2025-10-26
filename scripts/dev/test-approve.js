const { ethers } = require("hardhat");

async function main() {
  console.log("Testing approve on Arcology DevNet\n");

  const [owner, trader1, trader2] = await ethers.getSigners();

  console.log("Accounts:");
  console.log("  owner:", owner.address);
  console.log("  trader1:", trader1.address);
  console.log("  trader2:", trader2.address);

  // Get deployed USDC
  const usdc = await ethers.getContractAt("MockUSDC", "0x87eE35FAeB603F7A959b9C8c1f6014A1F61b3870");

  console.log("\nBefore approve:");
  console.log("  trader1 balance:", await usdc.balanceOf(trader1.address));
  console.log("  trader1 allowance to owner:", await usdc.allowance(trader1.address, owner.address));

  // Try to approve from trader1
  console.log("\nApproving from trader1...");
  const approveTx = await usdc.connect(trader1).approve(owner.address, ethers.parseUnits("1000", 6));
  console.log("  Tx hash:", approveTx.hash);
  console.log("  Tx from:", approveTx.from);

  const receipt = await approveTx.wait(2);
  console.log("  Receipt from:", receipt.from);
  console.log("  Receipt status:", receipt.status);

  console.log("\nAfter approve:");
  console.log("  trader1 allowance to owner:", await usdc.allowance(trader1.address, owner.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
