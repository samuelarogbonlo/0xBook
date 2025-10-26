const { expect } = require("chai");
const { ethers } = require("hardhat");

const runOnArcology = process.env.RUN_ARCOLOGY_TESTS === "true";

/**
 * Arcology-specific smoke tests
 * Designed for 1.5s block time with proper tx.wait() and event detection
 */
(runOnArcology ? describe : describe.skip)("Arcology Smoke Tests", function () {
  this.timeout(180000); // 3 minute timeout for Arcology consensus

  let orderBook, matchingEngine, amm, router;
  let weth, usdc;
  let owner, trader1, trader2;

  before(async function () {
    console.log("🚀 Setting up Arcology smoke tests...");
    [owner, trader1, trader2] = await ethers.getSigners();

    // Deploy tokens
    console.log("  Deploying tokens...");
    const MockWETH = await ethers.getContractFactory("MockWETH");
    weth = await MockWETH.deploy();
    await weth.waitForDeployment();
    const wethTx = weth.deploymentTransaction();
    if (wethTx) await wethTx.wait(2); // Wait 2 confirmations

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    const usdcTx = usdc.deploymentTransaction();
    if (usdcTx) await usdcTx.wait(2);

    // Deploy OrderBook
    console.log("  Deploying OrderBook...");
    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy(
      await weth.getAddress(),
      await usdc.getAddress(),
      18, // baseDecimals (WETH)
      6   // quoteDecimals (USDC)
    );
    await orderBook.waitForDeployment();
    const obTx = orderBook.deploymentTransaction();
    if (obTx) await obTx.wait(2);

    // Deploy MatchingEngine
    console.log("  Deploying MatchingEngine...");
    const MatchingEngine = await ethers.getContractFactory("MatchingEngine");
    matchingEngine = await MatchingEngine.deploy(await orderBook.getAddress());
    await matchingEngine.waitForDeployment();
    const meTx = matchingEngine.deploymentTransaction();
    if (meTx) await meTx.wait(2);

    // Deploy AMM
    console.log("  Deploying AMMFallback...");
    const AMMFallback = await ethers.getContractFactory("AMMFallback");
    amm = await AMMFallback.deploy(
      await usdc.getAddress(),
      await weth.getAddress()
    );
    await amm.waitForDeployment();
    const ammTx = amm.deploymentTransaction();
    if (ammTx) await ammTx.wait(2);

    // Deploy Router
    console.log("  Deploying Router...");
    const Router = await ethers.getContractFactory("Router");
    router = await Router.deploy(
      await orderBook.getAddress(),
      await amm.getAddress()
    );
    await router.waitForDeployment();
    const routerTx = router.deploymentTransaction();
    if (routerTx) await routerTx.wait(2);

    // Mint tokens
    console.log("  Minting tokens...");
    const mintTx1 = await weth.mint(trader1.address, ethers.parseEther("100"));
    await mintTx1.wait(2);
    const mintTx2 = await usdc.mint(trader1.address, ethers.parseUnits("500000", 6));
    await mintTx2.wait(2);
    const mintTx3 = await weth.mint(trader2.address, ethers.parseEther("100"));
    await mintTx3.wait(2);
    const mintTx4 = await usdc.mint(trader2.address, ethers.parseUnits("500000", 6));
    await mintTx4.wait(2);

    console.log("✅ Setup complete\n");
  });

  describe("OrderBook - Basic Operations", function () {
    it("Should place a buy order and emit event", async function () {
      const price = ethers.parseUnits("3000", 6);
      const amount = ethers.parseEther("1");
      const cost = (price * amount) / ethers.parseEther("1");

      // Debug: Check balances and allowances
      console.log("\n🔍 Debug Info:");
      console.log("  trader1 address:", trader1.address);
      console.log("  orderBook address:", await orderBook.getAddress());
      console.log("  trader1 USDC balance:", await usdc.balanceOf(trader1.address));
      console.log("  trader1 ETH balance:", await ethers.provider.getBalance(trader1.address));
      console.log("  Required USDC cost:", cost);

      const approveTx = await usdc.connect(trader1).approve(await orderBook.getAddress(), cost);
      await approveTx.wait(2);

      console.log("  trader1 USDC allowance:", await usdc.allowance(trader1.address, await orderBook.getAddress()));

      // Try staticCall first to get revert reason
      try {
        await orderBook.connect(trader1).placeOrder.staticCall(price, amount, true);
        console.log("  ✅ staticCall succeeded");
      } catch (err) {
        console.log("  ❌ staticCall revert:", err.message);
      }

      const tx = await orderBook.connect(trader1).placeOrder(price, amount, true);
      const receipt = await tx.wait(2);

      // Verify event from receipt logs
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "OrderPlaced"
      );
      expect(event).to.not.be.undefined;

      const order = await orderBook.orders(0);
      expect(order.trader).to.equal(trader1.address);
      expect(order.price).to.equal(price);
      expect(order.amount).to.equal(amount);
      expect(order.isBuy).to.be.true;
      expect(order.active).to.be.true;
    });

    it("Should place a sell order and emit event", async function () {
      const price = ethers.parseUnits("2900", 6);
      const amount = ethers.parseEther("1");

      const approveTx = await weth.connect(trader2).approve(await orderBook.getAddress(), amount);
      await approveTx.wait(2);

      const tx = await orderBook.connect(trader2).placeOrder(price, amount, false);
      const receipt = await tx.wait(2);

      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "OrderPlaced"
      );
      expect(event).to.not.be.undefined;

      const order = await orderBook.orders(1);
      expect(order.trader).to.equal(trader2.address);
      expect(order.isBuy).to.be.false;
    });
  });

  describe("OrderBook - Order Matching", function () {
    it("Should match orders and mark them inactive when filled", async function () {
      // Place buy order
      const buyPrice = ethers.parseUnits("3000", 6);
      const buyAmount = ethers.parseEther("1");
      const buyCost = (buyPrice * buyAmount) / ethers.parseEther("1");

      const approve1 = await usdc.connect(trader1).approve(await orderBook.getAddress(), buyCost);
      await approve1.wait(2);
      const buy = await orderBook.connect(trader1).placeOrder(buyPrice, buyAmount, true);
      await buy.wait(2);

      // Place sell order
      const sellPrice = ethers.parseUnits("2900", 6);
      const sellAmount = ethers.parseEther("1");

      const approve2 = await weth.connect(trader2).approve(await orderBook.getAddress(), sellAmount);
      await approve2.wait(2);
      const sell = await orderBook.connect(trader2).placeOrder(sellPrice, sellAmount, false);
      await sell.wait(2);

      // Match orders
      const matchTx = await orderBook.matchOrders(buyPrice, sellPrice);
      const receipt = await matchTx.wait(2);

      // Verify OrderMatched event
      const matchEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "OrderMatched"
      );
      expect(matchEvent).to.not.be.undefined;

      // Verify orders are marked inactive
      const buyOrder = await orderBook.orders(2);
      const sellOrder = await orderBook.orders(3);
      expect(buyOrder.active).to.be.false;
      expect(sellOrder.active).to.be.false;
    });
  });

  describe("OrderBook - Parallel Execution Counters", function () {
    it("Should increment U256Cumulative counters", async function () {
      const initialVolume = await orderBook.getTotalVolume();
      const initialTrades = await orderBook.getTotalTrades();
      const initialOrders = await orderBook.getTotalOrdersPlaced();

      // Place and match orders
      const price = ethers.parseUnits("3000", 6);
      const amount = ethers.parseEther("0.5");
      const cost = (price * amount) / ethers.parseEther("1");

      const approve1 = await usdc.connect(trader1).approve(await orderBook.getAddress(), cost);
      await approve1.wait(2);
      const buy = await orderBook.connect(trader1).placeOrder(price, amount, true);
      await buy.wait(2);

      const approve2 = await weth.connect(trader2).approve(await orderBook.getAddress(), amount);
      await approve2.wait(2);
      const sell = await orderBook.connect(trader2).placeOrder(price, amount, false);
      await sell.wait(2);

      const match = await orderBook.matchOrders(price, price);
      await match.wait(2);

      // Verify counters increased
      const finalVolume = await orderBook.getTotalVolume();
      const finalTrades = await orderBook.getTotalTrades();
      const finalOrders = await orderBook.getTotalOrdersPlaced();

      expect(finalVolume).to.be.gt(initialVolume);
      expect(finalTrades).to.be.gt(initialTrades);
      expect(finalOrders).to.equal(initialOrders + 2n);
    });
  });

  describe("AMM - Liquidity and Swaps", function () {
    it("Should add liquidity to AMM", async function () {
      const amount0 = ethers.parseUnits("100000", 6); // 100k USDC
      const amount1 = ethers.parseEther("50");         // 50 WETH

      const approve1 = await usdc.connect(owner).approve(await amm.getAddress(), amount0);
      await approve1.wait(2);
      const approve2 = await weth.connect(owner).approve(await amm.getAddress(), amount1);
      await approve2.wait(2);

      const tx = await amm.connect(owner).addLiquidity(amount0, amount1);
      const receipt = await tx.wait(2);

      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "LiquidityAdded"
      );
      expect(event).to.not.be.undefined;

      const reserve0 = await amm.reserve0();
      const reserve1 = await amm.reserve1();
      expect(reserve0).to.equal(amount0);
      expect(reserve1).to.equal(amount1);
    });

    it("Should execute swap through AMM", async function () {
      const amountIn = ethers.parseUnits("1000", 6); // 1000 USDC

      const approve = await usdc.connect(trader1).approve(await amm.getAddress(), amountIn);
      await approve.wait(2);

      const tx = await amm.connect(trader1).swap(amountIn, true, 0);
      const receipt = await tx.wait(2);

      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "Swap"
      );
      expect(event).to.not.be.undefined;
    });
  });

  describe("Router - Market Orders via AMM", function () {
    it("Should execute market order and return funds to user", async function () {
      const amountIn = ethers.parseUnits("1000", 6);

      const balanceBefore = await weth.balanceOf(trader1.address);

      const approve = await usdc.connect(trader1).approve(await router.getAddress(), amountIn);
      await approve.wait(2);

      const tx = await router.connect(trader1).executeMarketOrder(amountIn, true, 0);
      const receipt = await tx.wait(2);

      const balanceAfter = await weth.balanceOf(trader1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);

      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === "MarketOrderExecuted"
      );
      expect(event).to.not.be.undefined;
    });

    it("Should get price quotes from order book and AMM", async function () {
      const amount = ethers.parseEther("1");
      const quote = await router.getQuote(amount, true);

      expect(quote.orderBookPrice).to.be.a("bigint");
      expect(quote.ammPrice).to.be.a("bigint");
      expect(quote.useOrderBook).to.be.a("boolean");
    });
  });
});
