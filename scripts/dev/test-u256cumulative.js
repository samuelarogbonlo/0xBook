const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Testing U256Cumulative on Arcology DevNet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Testing with:", deployer.address);

  // Check if address 0x85 has code
  console.log("\n1. Checking address 0x85 for code:");
  const code = await ethers.provider.getCode("0x0000000000000000000000000000000000000085");
  console.log("  Code at 0x85:", code);
  console.log("  Has code?", code !== "0x");

  // Try to deploy a simple U256Cumulative test
  console.log("\n2. Attempting to deploy U256Cumulative test contract:");

  const TestContract = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.19;

    import "@arcologynetwork/concurrentlib/lib/commutative/U256Cum.sol";

    contract TestU256Cumulative {
        U256Cumulative public counter;

        constructor() {
            counter = new U256Cumulative(0, type(uint256).max);
        }

        function increment() external {
            counter.add(1);
        }

        function get() external view returns (uint256) {
            return counter.get();
        }
    }
  `;

  // Write test contract
  const fs = require('fs');
  fs.writeFileSync('contracts/TestU256Cumulative.sol', TestContract);

  try {
    // Compile
    console.log("  Compiling test contract...");
    await require('child_process').execSync('npx hardhat compile', { stdio: 'inherit' });

    // Deploy
    console.log("  Deploying test contract...");
    const TestFactory = await ethers.getContractFactory("TestU256Cumulative");
    const testContract = await TestFactory.deploy();
    await testContract.waitForDeployment();

    const deployTx = testContract.deploymentTransaction();
    if (deployTx) {
      const receipt = await deployTx.wait(2);
      console.log("  ✅ Deployed at:", await testContract.getAddress());
      console.log("  Deploy status:", receipt.status);
      console.log("  Gas used:", receipt.gasUsed.toString());
    }

    // Try to increment
    console.log("\n3. Testing increment operation:");
    const incrementTx = await testContract.increment();
    const incrementReceipt = await incrementTx.wait(2);
    console.log("  Increment status:", incrementReceipt.status);

    if (incrementReceipt.status === 1) {
      console.log("  ✅ INCREMENT SUCCEEDED!");

      // Read value
      const value = await testContract.get();
      console.log("  Counter value:", value.toString());

      console.log("\n🎉 U256Cumulative WORKS on this DevNet!");
    } else {
      console.log("  ❌ INCREMENT FAILED - U256Cumulative not available");
    }

  } catch (error) {
    console.log("  ❌ Error:", error.message);
    console.log("\n💡 U256Cumulative appears to be unavailable on this DevNet");
  }

  // Cleanup
  fs.unlinkSync('contracts/TestU256Cumulative.sol');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
