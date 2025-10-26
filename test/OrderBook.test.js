const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderBook", function () {
  let orderBook, weth, usdc;
  let owner, trader1, trader2;

  beforeEach(async function () {
    [owner, trader1, trader2] = await ethers.getSigners();

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
      18, // base (WETH) decimals
      6   // quote (USDC) decimals
    );

    // Mint tokens to traders
    await weth.mint(trader1.address, ethers.parseEther("100"));
    await usdc.mint(trader1.address, ethers.parseUnits("500000", 6));
    await weth.mint(trader2.address, ethers.parseEther("100"));
    await usdc.mint(trader2.address, ethers.parseUnits("500000", 6));
  });

  describe("Order Placement", function () {
    it("Should place a buy order", async function () {
      const price = ethers.parseUnits("3000", 6); // Price: 3000 USDC per WETH
      const amount = ethers.parseEther("1");      // Amount: 1 WETH
      const cost = ethers.parseUnits("3000", 6);  // Cost in USDC

      await usdc.connect(trader1).approve(await orderBook.getAddress(), cost);

      const tx = await orderBook.connect(trader1).placeOrder(price, amount, true);
      await expect(tx).to.emit(orderBook, "OrderPlaced");

      const order = await orderBook.orders(0);
      expect(order.trader).to.equal(trader1.address);
      expect(order.price).to.equal(price);
      expect(order.amount).to.equal(amount);
      expect(order.isBuy).to.be.true;
    });

    it("Should place a sell order", async function () {
      const price = ethers.parseUnits("3000", 6);
      const amount = ethers.parseEther("1");

      await weth.connect(trader1).approve(await orderBook.getAddress(), amount);

      const tx = await orderBook.connect(trader1).placeOrder(price, amount, false);
      await expect(tx).to.emit(orderBook, "OrderPlaced");

      const order = await orderBook.orders(0);
      expect(order.isBuy).to.be.false;
    });

    it("Should store orders at correct price levels", async function () {
      const price1 = ethers.parseUnits("3000", 6);
      const price2 = ethers.parseUnits("3100", 6);
      const amount = ethers.parseEther("1");

      await usdc.connect(trader1).approve(await orderBook.getAddress(), ethers.parseUnits("10000", 6));

      await orderBook.connect(trader1).placeOrder(price1, amount, true);
      await orderBook.connect(trader1).placeOrder(price2, amount, true);

      const ordersAtPrice1 = await orderBook.getOrdersByPrice(price1, true);
      const ordersAtPrice2 = await orderBook.getOrdersByPrice(price2, true);

      expect(ordersAtPrice1.length).to.equal(1);
      expect(ordersAtPrice2.length).to.equal(1);
    });
  });

  describe("Order Cancellation", function () {
    it("Should cancel an order and refund tokens", async function () {
      const price = ethers.parseUnits("3000", 6);
      const amount = ethers.parseEther("1");
      const cost = ethers.parseUnits("3000", 6);

      await usdc.connect(trader1).approve(await orderBook.getAddress(), cost);
      await orderBook.connect(trader1).placeOrder(price, amount, true);

      const balanceBefore = await usdc.balanceOf(trader1.address);
      await orderBook.connect(trader1).cancelOrder(0);
      const balanceAfter = await usdc.balanceOf(trader1.address);

      const order = await orderBook.orders(0);
      expect(order.active).to.be.false;
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("Order Matching", function () {
    it("Should match buy and sell orders at same price", async function () {
      const price = ethers.parseUnits("3000", 6);
      const amount = ethers.parseEther("1");
      const cost = ethers.parseUnits("3000", 6);

      // Trader1 places buy order
      await usdc.connect(trader1).approve(await orderBook.getAddress(), cost);
      await orderBook.connect(trader1).placeOrder(price, amount, true);

      // Trader2 places sell order
      await weth.connect(trader2).approve(await orderBook.getAddress(), amount);
      await orderBook.connect(trader2).placeOrder(price, amount, false);

      // Match orders
      const tx = await orderBook.matchOrders(price, price);
      await expect(tx).to.emit(orderBook, "OrderMatched");

      // Verify fills
      const buyOrder = await orderBook.orders(0);
      const sellOrder = await orderBook.orders(1);

      expect(buyOrder.filled).to.equal(amount);
      expect(sellOrder.filled).to.equal(amount);
    });
  });
});
