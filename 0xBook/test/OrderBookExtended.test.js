const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderBook - Extended Functions", function () {
  let orderBook, weth, usdc;
  let owner, trader1, trader2, trader3;

  beforeEach(async function () {
    [owner, trader1, trader2, trader3] = await ethers.getSigners();

    // Deploy tokens
    const MockWETH = await ethers.getContractFactory("MockWETH");
    weth = await MockWETH.deploy();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    // Deploy OrderBook
    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy(
      await weth.getAddress(),
      await usdc.getAddress(),
      6
    );

    // Mint tokens
    await weth.mint(trader1.address, ethers.parseEther("100"));
    await usdc.mint(trader1.address, ethers.parseUnits("500000", 6));
    await weth.mint(trader2.address, ethers.parseEther("100"));
    await usdc.mint(trader2.address, ethers.parseUnits("500000", 6));
    await weth.mint(trader3.address, ethers.parseEther("100"));
    await usdc.mint(trader3.address, ethers.parseUnits("500000", 6));
  });

  describe("getBestBid and getBestAsk", function () {
    it("Should return 0 when no orders exist", async function () {
      expect(await orderBook.getBestBid()).to.equal(0);
      expect(await orderBook.getBestAsk()).to.equal(0);
    });

    it("Should return correct best bid", async function () {
      // Place buy orders at different prices
      const price1 = ethers.parseUnits("3000", 6);
      const price2 = ethers.parseUnits("3100", 6);
      const price3 = ethers.parseUnits("2900", 6);
      const amount = ethers.parseEther("1");

      await usdc.connect(trader1).approve(await orderBook.getAddress(), ethers.parseUnits("10000", 6));

      await orderBook.connect(trader1).placeOrder(price1, amount, true);
      await orderBook.connect(trader1).placeOrder(price2, amount, true);
      await orderBook.connect(trader1).placeOrder(price3, amount, true);

      const bestBid = await orderBook.getBestBid();
      expect(bestBid).to.equal(price2); // 3100 is highest
    });

    it("Should return correct best ask", async function () {
      // Place sell orders at different prices
      const price1 = ethers.parseUnits("3000", 6);
      const price2 = ethers.parseUnits("3100", 6);
      const price3 = ethers.parseUnits("2900", 6);
      const amount = ethers.parseEther("1");

      await weth.connect(trader1).approve(await orderBook.getAddress(), ethers.parseEther("3"));

      await orderBook.connect(trader1).placeOrder(price1, amount, false);
      await orderBook.connect(trader1).placeOrder(price2, amount, false);
      await orderBook.connect(trader1).placeOrder(price3, amount, false);

      const bestAsk = await orderBook.getBestAsk();
      expect(bestAsk).to.equal(price3); // 2900 is lowest
    });
  });

  describe("getDepthAtPrice", function () {
    it("Should return correct depth at price level", async function () {
      const price = ethers.parseUnits("3000", 6);
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("2");

      await usdc.connect(trader1).approve(await orderBook.getAddress(), ethers.parseUnits("10000", 6));
      await usdc.connect(trader2).approve(await orderBook.getAddress(), ethers.parseUnits("10000", 6));

      // Place two buy orders at same price
      await orderBook.connect(trader1).placeOrder(price, amount1, true);
      await orderBook.connect(trader2).placeOrder(price, amount2, true);

      const [totalAmount, orderCount] = await orderBook.getDepthAtPrice(price, true);

      expect(totalAmount).to.equal(amount1 + amount2);
      expect(orderCount).to.equal(2);
    });

    it("Should return 0 for price with no orders", async function () {
      const price = ethers.parseUnits("5000", 6);
      const [totalAmount, orderCount] = await orderBook.getDepthAtPrice(price, true);

      expect(totalAmount).to.equal(0);
      expect(orderCount).to.equal(0);
    });
  });

  describe("getSpread", function () {
    it("Should return 0 when no orders", async function () {
      expect(await orderBook.getSpread()).to.equal(0);
    });

    it("Should calculate spread correctly", async function () {
      const bidPrice = ethers.parseUnits("3000", 6);
      const askPrice = ethers.parseUnits("3010", 6);
      const amount = ethers.parseEther("1");

      // Place buy order
      await usdc.connect(trader1).approve(await orderBook.getAddress(), ethers.parseUnits("5000", 6));
      await orderBook.connect(trader1).placeOrder(bidPrice, amount, true);

      // Place sell order
      await weth.connect(trader2).approve(await orderBook.getAddress(), amount);
      await orderBook.connect(trader2).placeOrder(askPrice, amount, false);

      const spread = await orderBook.getSpread();
      expect(spread).to.equal(askPrice - bidPrice);
    });
  });
});
