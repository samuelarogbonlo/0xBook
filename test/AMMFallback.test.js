const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AMMFallback", function () {
  let amm, weth, usdc;
  let owner, lp1, trader1;

  beforeEach(async function () {
    [owner, lp1, trader1] = await ethers.getSigners();

    // Deploy tokens
    const MockWETH = await ethers.getContractFactory("MockWETH");
    weth = await MockWETH.deploy();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    // Deploy AMM
    const AMMFallback = await ethers.getContractFactory("AMMFallback");
    amm = await AMMFallback.deploy(await weth.getAddress(), await usdc.getAddress());

    // Mint tokens to LP and trader
    await weth.mint(lp1.address, ethers.parseEther("100"));
    await usdc.mint(lp1.address, ethers.parseUnits("300000", 6));
    await weth.mint(trader1.address, ethers.parseEther("10"));
    await usdc.mint(trader1.address, ethers.parseUnits("30000", 6));
  });

  describe("Liquidity", function () {
    it("Should add liquidity", async function () {
      const wethAmount = ethers.parseEther("10");
      const usdcAmount = ethers.parseUnits("30000", 6);

      await weth.connect(lp1).approve(await amm.getAddress(), wethAmount);
      await usdc.connect(lp1).approve(await amm.getAddress(), usdcAmount);

      await amm.connect(lp1).addLiquidity(wethAmount, usdcAmount);

      expect(await amm.reserve0()).to.equal(wethAmount);
      expect(await amm.reserve1()).to.equal(usdcAmount);
      expect(await amm.liquidity(lp1.address)).to.be.gt(0);
    });

    it("Should remove liquidity", async function () {
      const wethAmount = ethers.parseEther("10");
      const usdcAmount = ethers.parseUnits("30000", 6);

      await weth.connect(lp1).approve(await amm.getAddress(), wethAmount);
      await usdc.connect(lp1).approve(await amm.getAddress(), usdcAmount);
      await amm.connect(lp1).addLiquidity(wethAmount, usdcAmount);

      const lpBalance = await amm.liquidity(lp1.address);
      await amm.connect(lp1).removeLiquidity(lpBalance);

      expect(await amm.liquidity(lp1.address)).to.equal(0);
    });
  });

  describe("Swaps", function () {
    beforeEach(async function () {
      // Add initial liquidity
      const wethAmount = ethers.parseEther("10");
      const usdcAmount = ethers.parseUnits("30000", 6);

      await weth.connect(lp1).approve(await amm.getAddress(), wethAmount);
      await usdc.connect(lp1).approve(await amm.getAddress(), usdcAmount);
      await amm.connect(lp1).addLiquidity(wethAmount, usdcAmount);
    });

    it("Should swap USDC for WETH", async function () {
      const usdcIn = ethers.parseUnits("3000", 6);

      await usdc.connect(trader1).approve(await amm.getAddress(), usdcIn);

      const wethBefore = await weth.balanceOf(trader1.address);
      await amm.connect(trader1).swap(usdcIn, false, 0);
      const wethAfter = await weth.balanceOf(trader1.address);

      expect(wethAfter).to.be.gt(wethBefore);
    });

    it("Should swap WETH for USDC", async function () {
      const wethIn = ethers.parseEther("1");

      await weth.connect(trader1).approve(await amm.getAddress(), wethIn);

      const usdcBefore = await usdc.balanceOf(trader1.address);
      await amm.connect(trader1).swap(wethIn, true, 0);
      const usdcAfter = await usdc.balanceOf(trader1.address);

      expect(usdcAfter).to.be.gt(usdcBefore);
    });

    it("Should get quote", async function () {
      const usdcIn = ethers.parseUnits("3000", 6);
      const quote = await amm.getQuote(usdcIn, false);

      expect(quote).to.be.gt(0);
    });
  });
});
