// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AMMFallback
 * @notice Simple constant product AMM for fallback liquidity
 * @dev x * y = k model, provides guaranteed execution when order book is thin
 */
contract AMMFallback is ReentrancyGuard {
    IERC20 public immutable token0;
    IERC20 public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public totalLiquidity;

    mapping(address => uint256) public liquidity;

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidityMinted);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidityBurned);
    event Swap(address indexed trader, uint256 amountIn, uint256 amountOut, bool token0ToToken1);

    constructor(address _token0, address _token1) {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    /**
     * @notice Add liquidity to the pool
     */
    function addLiquidity(uint256 amount0, uint256 amount1) external nonReentrant returns (uint256 liquidityMinted) {
        require(amount0 > 0 && amount1 > 0, "Invalid amounts");

        require(token0.transferFrom(msg.sender, address(this), amount0), "Transfer token0 failed");
        require(token1.transferFrom(msg.sender, address(this), amount1), "Transfer token1 failed");

        if (totalLiquidity == 0) {
            liquidityMinted = sqrt(amount0 * amount1);
        } else {
            uint256 liquidity0 = (amount0 * totalLiquidity) / reserve0;
            uint256 liquidity1 = (amount1 * totalLiquidity) / reserve1;
            liquidityMinted = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        }

        require(liquidityMinted > 0, "Insufficient liquidity minted");

        liquidity[msg.sender] += liquidityMinted;
        totalLiquidity += liquidityMinted;
        reserve0 += amount0;
        reserve1 += amount1;

        emit LiquidityAdded(msg.sender, amount0, amount1, liquidityMinted);
    }

    /**
     * @notice Remove liquidity from the pool
     */
    function removeLiquidity(uint256 liquidityAmount) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(liquidityAmount > 0, "Invalid liquidity amount");
        require(liquidity[msg.sender] >= liquidityAmount, "Insufficient liquidity");

        amount0 = (liquidityAmount * reserve0) / totalLiquidity;
        amount1 = (liquidityAmount * reserve1) / totalLiquidity;

        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity burned");

        liquidity[msg.sender] -= liquidityAmount;
        totalLiquidity -= liquidityAmount;
        reserve0 -= amount0;
        reserve1 -= amount1;

        require(token0.transfer(msg.sender, amount0), "Transfer token0 failed");
        require(token1.transfer(msg.sender, amount1), "Transfer token1 failed");

        emit LiquidityRemoved(msg.sender, amount0, amount1, liquidityAmount);
    }

    /**
     * @notice Swap tokens using constant product formula
     * @param amountIn Amount of input token
     * @param token0ToToken1 Direction of swap
     * @param minAmountOut Minimum acceptable output (slippage protection)
     */
    function swap(
        uint256 amountIn,
        bool token0ToToken1,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid amount");
        require(reserve0 > 0 && reserve1 > 0, "Insufficient liquidity");

        if (token0ToToken1) {
            amountOut = getAmountOut(amountIn, reserve0, reserve1);
            require(amountOut >= minAmountOut, "Slippage too high");

            require(token0.transferFrom(msg.sender, address(this), amountIn), "Transfer in failed");
            require(token1.transfer(msg.sender, amountOut), "Transfer out failed");

            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            amountOut = getAmountOut(amountIn, reserve1, reserve0);
            require(amountOut >= minAmountOut, "Slippage too high");

            require(token1.transferFrom(msg.sender, address(this), amountIn), "Transfer in failed");
            require(token0.transfer(msg.sender, amountOut), "Transfer out failed");

            reserve1 += amountIn;
            reserve0 -= amountOut;
        }

        emit Swap(msg.sender, amountIn, amountOut, token0ToToken1);
    }

    /**
     * @notice Calculate output amount for a given input
     * @dev Uses constant product formula with 0.3% fee
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "Invalid input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 amountInWithFee = amountIn * 997; // 0.3% fee
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;

        return numerator / denominator;
    }

    /**
     * @notice Get quote for swap
     */
    function getQuote(uint256 amountIn, bool token0ToToken1) external view returns (uint256 amountOut) {
        if (token0ToToken1) {
            return getAmountOut(amountIn, reserve0, reserve1);
        } else {
            return getAmountOut(amountIn, reserve1, reserve0);
        }
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
