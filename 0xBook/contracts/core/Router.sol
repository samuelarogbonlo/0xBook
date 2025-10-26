// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IOrderBook.sol";
import "../amm/AMMFallback.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Router
 * @notice Smart router for hybrid order book + AMM execution
 * @dev CRITICAL FIX: Users place orders directly on OrderBook
 *      Router ONLY handles market orders via AMM fallback
 */
contract Router is ReentrancyGuard {
    IOrderBook public immutable orderBook;
    AMMFallback public immutable amm;
    IERC20 public immutable baseToken;
    IERC20 public immutable quoteToken;

    event MarketOrderExecuted(
        address indexed trader,
        bool buyBase,
        uint256 amountIn,
        uint256 amountOut
    );


    constructor(address _orderBook, address _amm) {
        orderBook = IOrderBook(_orderBook);
        amm = AMMFallback(_amm);
        baseToken = IERC20(orderBook.baseToken());
        quoteToken = IERC20(orderBook.quoteToken());
    }

    /**
     * @notice Execute market order via AMM
     * @dev Used when order book liquidity insufficient or for instant execution
     * @param amountIn Amount of input token
     * @param buyBase True if buying base token, false if selling
     * @param minAmountOut Minimum output amount (slippage protection)
     * @return amountOut Actual amount received
     */
    function executeMarketOrder(
        uint256 amountIn,
        bool buyBase,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        IERC20 tokenIn = buyBase ? quoteToken : baseToken;
        IERC20 tokenOut = buyBase ? baseToken : quoteToken;

        // Transfer tokens from user
        require(
            tokenIn.transferFrom(msg.sender, address(this), amountIn),
            "Router: transfer in failed"
        );

        // Approve AMM
        tokenIn.approve(address(amm), amountIn);

        // Execute swap (buyBase=true means selling quote for base, so isSell=false)
        amountOut = amm.swap(amountIn, !buyBase, minAmountOut);

        // Transfer output tokens to user
        require(
            tokenOut.transfer(msg.sender, amountOut),
            "Router: transfer out failed"
        );

        emit MarketOrderExecuted(msg.sender, buyBase, amountIn, amountOut);
        return amountOut;
    }

    /**
     * @notice Get best execution quote comparing order book and AMM
     * @param amount Amount to trade
     * @param buyBase Direction
     * @return orderBookPrice Best price from order book (0 if no liquidity)
     * @return ammPrice Price from AMM
     * @return useOrderBook True if order book offers better price
     */
    function getQuote(
        uint256 amount,
        bool buyBase
    ) external view returns (
        uint256 orderBookPrice,
        uint256 ammPrice,
        bool useOrderBook
    ) {
        // Get AMM quote
        ammPrice = amm.getQuote(amount, !buyBase);

        // Get order book best price
        if (buyBase) {
            // Buying base = need best ask (lowest sell price)
            orderBookPrice = orderBook.getBestAsk();
        } else {
            // Selling base = need best bid (highest buy price)
            orderBookPrice = orderBook.getBestBid();
        }

        // If order book has no liquidity, price will be 0
        if (orderBookPrice == 0) {
            useOrderBook = false;
        } else {
            // Compare prices (better price depends on direction)
            if (buyBase) {
                // Lower is better when buying
                useOrderBook = orderBookPrice < ammPrice;
            } else {
                // Higher is better when selling
                useOrderBook = orderBookPrice > ammPrice;
            }
        }

        return (orderBookPrice, ammPrice, useOrderBook);
    }

    /**
     * @notice Get depth at specific price level from order book
     * @param price Price level to query
     * @param isBuy True for buy side, false for sell side
     * @return totalAmount Total liquidity at that price
     * @return orderCount Number of orders at that price
     */
    function getOrderBookDepth(
        uint256 price,
        bool isBuy
    ) external view returns (uint256 totalAmount, uint256 orderCount) {
        return orderBook.getDepthAtPrice(price, isBuy);
    }

    /**
     * @notice Get current spread from order book
     * @return spread Difference between best bid and ask
     */
    function getSpread() external view returns (uint256 spread) {
        return orderBook.getSpread();
    }
}
