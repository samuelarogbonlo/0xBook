const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TestCounter - U256Cumulative", function () {
  let counter;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const TestCounter = await ethers.getContractFactory("TestCounter");
    counter = await TestCounter.deploy();
  });

  it("Should initialize with zero count", async function () {
    expect(await counter.getCount()).to.equal(0);
  });

  it("Should increment counter", async function () {
    await counter.increment();
    expect(await counter.getCount()).to.equal(1);

    await counter.increment();
    expect(await counter.getCount()).to.equal(2);
  });

  it("Should increment by specific amount", async function () {
    await counter.incrementBy(10);
    expect(await counter.getCount()).to.equal(10);

    await counter.incrementBy(5);
    expect(await counter.getCount()).to.equal(15);
  });

  it("Should decrement counter", async function () {
    await counter.incrementBy(10);
    await counter.decrement();
    expect(await counter.getCount()).to.equal(9);
  });

  it("Should handle concurrent increments from multiple users", async function () {
    // Simulate parallel execution - multiple users increment simultaneously
    await Promise.all([
      counter.connect(user1).increment(),
      counter.connect(user2).increment(),
      counter.connect(owner).increment()
    ]);

    expect(await counter.getCount()).to.equal(3);
  });
});
