const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderBook - Core Functionality", function () {
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
      18, // baseDecimals (WETH)
      6   // quoteDecimals (USDC)
    );

    // Mint tokens
    await weth.mint(trader1.address, ethers.parseEther("100"));
    await usdc.mint(trader1.address, ethers.parseUnits("500000", 6));
    await weth.mint(trader2.address, ethers.parseEther("100"));
    await usdc.mint(trader2.address, ethers.parseUnits("500000", 6));
  });

  it("Should place a buy order with correct decimal handling", async function () {
    const price = ethers.parseUnits("3000", 6); // 3000 USDC
    const amount = ethers.parseEther("1");       // 1 WETH
    const cost = (price * amount) / ethers.parseEther("1"); // 3000 USDC

    await usdc.connect(trader1).approve(await orderBook.getAddress(), cost);
    await orderBook.connect(trader1).placeOrder(price, amount, true);

    const order = await orderBook.orders(0);
    expect(order.trader).to.equal(trader1.address);
    expect(order.price).to.equal(price);
    expect(order.amount).to.equal(amount);
    expect(order.isBuy).to.be.true;
    expect(order.active).to.be.true;
  });

  it("Should place a sell order", async function () {
    const price = ethers.parseUnits("2900", 6);
    const amount = ethers.parseEther("1");

    await weth.connect(trader2).approve(await orderBook.getAddress(), amount);
    await orderBook.connect(trader2).placeOrder(price, amount, false);

    const order = await orderBook.orders(0);
    expect(order.trader).to.equal(trader2.address);
    expect(order.isBuy).to.be.false;
  });

  it("Should match orders and mark them inactive when filled", async function () {
    // Place buy order
    const buyPrice = ethers.parseUnits("3000", 6);
    const buyAmount = ethers.parseEther("1");
    const buyCost = (buyPrice * buyAmount) / ethers.parseEther("1");

    await usdc.connect(trader1).approve(await orderBook.getAddress(), buyCost);
    await orderBook.connect(trader1).placeOrder(buyPrice, buyAmount, true);

    // Place sell order
    const sellPrice = ethers.parseUnits("2900", 6);
    const sellAmount = ethers.parseEther("1");

    await weth.connect(trader2).approve(await orderBook.getAddress(), sellAmount);
    await orderBook.connect(trader2).placeOrder(sellPrice, sellAmount, false);

    // Match orders
    await orderBook.matchOrders(buyPrice, sellPrice);

    // Verify orders are marked inactive
    const buyOrder = await orderBook.orders(0);
    const sellOrder = await orderBook.orders(1);
    expect(buyOrder.active).to.be.false;
    expect(sellOrder.active).to.be.false;
  });

  it("Should increment counters on order placement and matching", async function () {
    const initialOrders = await orderBook.getTotalOrdersPlaced();
    const initialTrades = await orderBook.getTotalTrades();
    const initialVolume = await orderBook.getTotalVolume();

    // Place and match orders
    const price = ethers.parseUnits("3000", 6);
    const amount = ethers.parseEther("0.5");
    const cost = (price * amount) / ethers.parseEther("1");

    await usdc.connect(trader1).approve(await orderBook.getAddress(), cost);
    await orderBook.connect(trader1).placeOrder(price, amount, true);

    await weth.connect(trader2).approve(await orderBook.getAddress(), amount);
    await orderBook.connect(trader2).placeOrder(price, amount, false);

    await orderBook.matchOrders(price, price);

    // Verify counters increased
    expect(await orderBook.getTotalOrdersPlaced()).to.equal(initialOrders + 2n);
    expect(await orderBook.getTotalTrades()).to.be.gt(initialTrades);
    expect(await orderBook.getTotalVolume()).to.be.gt(initialVolume);
  });

  it("Should cancel order and refund with correct decimals", async function () {
    const price = ethers.parseUnits("3000", 6);
    const amount = ethers.parseEther("1");
    const cost = (price * amount) / ethers.parseEther("1");

    const balanceBefore = await usdc.balanceOf(trader1.address);

    await usdc.connect(trader1).approve(await orderBook.getAddress(), cost);
    await orderBook.connect(trader1).placeOrder(price, amount, true);

    const balanceAfterPlace = await usdc.balanceOf(trader1.address);
    expect(balanceAfterPlace).to.equal(balanceBefore - cost);

    await orderBook.connect(trader1).cancelOrder(0);

    const balanceAfterCancel = await usdc.balanceOf(trader1.address);
    expect(balanceAfterCancel).to.equal(balanceBefore);

    const order = await orderBook.orders(0);
    expect(order.active).to.be.false;
  });
});
