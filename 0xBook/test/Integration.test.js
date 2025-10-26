const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Phase 2: Integration Tests", function () {
  let orderBook, matchingEngine, amm, router;
  let weth, usdc;
  let owner, trader1, trader2, lp;

  beforeEach(async function () {
    [owner, trader1, trader2, lp] = await ethers.getSigners();

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

    // Deploy MatchingEngine
    const MatchingEngine = await ethers.getContractFactory("MatchingEngine");
    matchingEngine = await MatchingEngine.deploy(await orderBook.getAddress());

    // Deploy AMM
    const AMMFallback = await ethers.getContractFactory("AMMFallback");
    amm = await AMMFallback.deploy(
      await weth.getAddress(),
      await usdc.getAddress()
    );

    // Deploy Router
    const Router = await ethers.getContractFactory("Router");
    router = await Router.deploy(
      await orderBook.getAddress(),
      await amm.getAddress()
    );

    // Mint tokens
    await weth.mint(trader1.address, ethers.parseEther("100"));
    await usdc.mint(trader1.address, ethers.parseUnits("500000", 6));
    await weth.mint(trader2.address, ethers.parseEther("100"));
    await usdc.mint(trader2.address, ethers.parseUnits("500000", 6));
    await weth.mint(lp.address, ethers.parseEther("100"));
    await usdc.mint(lp.address, ethers.parseUnits("500000", 6));
  });

  describe("MatchingEngine Integration", function () {
    it("Should match orders via MatchingEngine", async function () {
      const price = ethers.parseUnits("3000", 6);
      const amount = ethers.parseEther("1");

      // Place buy order
      await usdc.connect(trader1).approve(await orderBook.getAddress(), ethers.parseUnits("3000", 6));
      await orderBook.connect(trader1).placeOrder(price, amount, true);

      // Place sell order
      await weth.connect(trader2).approve(await orderBook.getAddress(), amount);
      await orderBook.connect(trader2).placeOrder(price, amount, false);

      // Match via engine
      await matchingEngine.matchOrders(price, price);

      const buyOrder = await orderBook.orders(0);
      const sellOrder = await orderBook.orders(1);

      expect(buyOrder.filled).to.equal(amount);
      expect(sellOrder.filled).to.equal(amount);
    });

    it("Should batch match multiple price levels", async function () {
      const price1 = ethers.parseUnits("3000", 6);
      const price2 = ethers.parseUnits("3010", 6);
      const amount = ethers.parseEther("1");

      // Approve tokens
      await usdc.connect(trader1).approve(await orderBook.getAddress(), ethers.parseUnits("10000", 6));
      await weth.connect(trader2).approve(await orderBook.getAddress(), ethers.parseEther("2"));

      // Place orders at two price levels
      await orderBook.connect(trader1).placeOrder(price1, amount, true);
      await orderBook.connect(trader1).placeOrder(price2, amount, true);
      await orderBook.connect(trader2).placeOrder(price1, amount, false);
      await orderBook.connect(trader2).placeOrder(price2, amount, false);

      // Batch match
      await matchingEngine.batchMatch([price1, price2], [price1, price2]);

      const order1 = await orderBook.orders(0);
      const order3 = await orderBook.orders(2);

      expect(order1.filled).to.equal(amount);
      expect(order3.filled).to.equal(amount);
    });
  });

  describe("Router Integration", function () {
    it("Should route trade to order book", async function () {
      const price = ethers.parseUnits("3000", 6);
      const amount = ethers.parseEther("1");
      const cost = ethers.parseUnits("3000", 6);

      // Place sell order in order book
      await weth.connect(trader2).approve(await orderBook.getAddress(), amount);
      await orderBook.connect(trader2).placeOrder(price, amount, false);

      // Execute trade via router
      await usdc.connect(trader1).approve(await router.getAddress(), cost);
      await router.connect(trader1).executeTrade(price, amount, true, false);

      // Verify order was placed by router (router is the msg.sender)
      const order = await orderBook.orders(1);
      expect(order.trader).to.equal(await router.getAddress());
    });

    it("Should execute market order via AMM", async function () {
      // Add liquidity to AMM
      const wethLiq = ethers.parseEther("10");
      const usdcLiq = ethers.parseUnits("30000", 6);

      await weth.connect(lp).approve(await amm.getAddress(), wethLiq);
      await usdc.connect(lp).approve(await amm.getAddress(), usdcLiq);
      await amm.connect(lp).addLiquidity(wethLiq, usdcLiq);

      // Execute market order
      const usdcIn = ethers.parseUnits("3000", 6);
      await usdc.connect(trader1).approve(await router.getAddress(), usdcIn);

      const wethBefore = await weth.balanceOf(trader1.address);
      await router.connect(trader1).executeMarketOrder(usdcIn, true, 0);
      const wethAfter = await weth.balanceOf(trader1.address);

      expect(wethAfter).to.be.gt(wethBefore);
    });

    it("Should get quote from router", async function () {
      // Add AMM liquidity
      const wethLiq = ethers.parseEther("10");
      const usdcLiq = ethers.parseUnits("30000", 6);

      await weth.connect(lp).approve(await amm.getAddress(), wethLiq);
      await usdc.connect(lp).approve(await amm.getAddress(), usdcLiq);
      await amm.connect(lp).addLiquidity(wethLiq, usdcLiq);

      // Get quote
      const amount = ethers.parseUnits("1000", 6);
      const [ammQuote, _] = await router.getQuote(amount, true);

      expect(ammQuote).to.be.gt(0);
    });
  });

  describe("Full System Integration", function () {
    it("Should work end-to-end: OrderBook -> Matching -> Settlement", async function () {
      const price = ethers.parseUnits("3000", 6);
      const amount = ethers.parseEther("1");

      // Setup
      await usdc.connect(trader1).approve(await orderBook.getAddress(), ethers.parseUnits("3000", 6));
      await weth.connect(trader2).approve(await orderBook.getAddress(), amount);

      // Place orders
      await orderBook.connect(trader1).placeOrder(price, amount, true);
      await orderBook.connect(trader2).placeOrder(price, amount, false);

      // Check balances before
      const trader1WethBefore = await weth.balanceOf(trader1.address);
      const trader2UsdcBefore = await usdc.balanceOf(trader2.address);

      // Match
      await orderBook.matchOrders(price, price);

      // Check balances after
      const trader1WethAfter = await weth.balanceOf(trader1.address);
      const trader2UsdcAfter = await usdc.balanceOf(trader2.address);

      // Trader1 should receive WETH
      expect(trader1WethAfter).to.be.gt(trader1WethBefore);
      // Trader2 should receive USDC
      expect(trader2UsdcAfter).to.be.gt(trader2UsdcBefore);
    });

    it("Should handle hybrid execution: OrderBook + AMM", async function () {
      // Add AMM liquidity
      const wethLiq = ethers.parseEther("10");
      const usdcLiq = ethers.parseUnits("30000", 6);

      await weth.connect(lp).approve(await amm.getAddress(), wethLiq);
      await usdc.connect(lp).approve(await amm.getAddress(), usdcLiq);
      await amm.connect(lp).addLiquidity(wethLiq, usdcLiq);

      // Place order in order book
      const price = ethers.parseUnits("3000", 6);
      const amount = ethers.parseEther("0.5");

      await weth.connect(trader2).approve(await orderBook.getAddress(), amount);
      await orderBook.connect(trader2).placeOrder(price, amount, false);

      // Verify both venues are available
      const [ammQuote, _] = await router.getQuote(ethers.parseUnits("1000", 6), true);
      const ordersAtPrice = await orderBook.getOrdersByPrice(price, false);

      expect(ammQuote).to.be.gt(0);
      expect(ordersAtPrice.length).to.equal(1);
    });
  });
});
