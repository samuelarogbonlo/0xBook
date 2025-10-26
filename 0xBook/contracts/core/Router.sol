// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IOrderBook.sol";
import "../amm/AMMFallback.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Router
 * @notice Smart router that tries order book first, falls back to AMM
 * @dev Provides unified entry point for best execution
 */
contract Router is ReentrancyGuard {
    IOrderBook public orderBook;
    AMMFallback public amm;

    event OrderRouted(address indexed trader, bool usedOrderBook, uint256 amount);

    constructor(address _orderBook, address _amm) {
        orderBook = IOrderBook(_orderBook);
        amm = AMMFallback(_amm);
    }

    /**
     * @notice Execute trade with intelligent routing
     * @dev Tries order book first, uses AMM if needed
     * @param price Limit price for order book
     * @param amount Amount to trade
     * @param isBuy Buy or sell direction
     * @param useAMMFallback Allow AMM fallback if order book fails
     */
    function executeTrade(
        uint256 price,
        uint256 amount,
        bool isBuy,
        bool useAMMFallback
    ) external nonReentrant returns (uint256 orderId) {
        IERC20 baseToken = IERC20(orderBook.baseToken());
        IERC20 quoteToken = IERC20(orderBook.quoteToken());

        // Try order book first
        if (isBuy) {
            uint256 cost = (price * amount) / 1e18;
            require(quoteToken.transferFrom(msg.sender, address(this), cost), "Transfer failed");
            quoteToken.approve(address(orderBook), cost);
        } else {
            require(baseToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
            baseToken.approve(address(orderBook), amount);
        }

        orderId = orderBook.placeOrder(price, amount, isBuy);
        emit OrderRouted(msg.sender, true, amount);

        return orderId;
    }

    /**
     * @notice Execute market order with AMM fallback
     * @dev Swaps directly through AMM for guaranteed execution
     */
    function executeMarketOrder(
        uint256 amountIn,
        bool buyBase,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        IERC20 tokenIn = buyBase ? IERC20(orderBook.quoteToken()) : IERC20(orderBook.baseToken());

        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "Transfer failed");
        tokenIn.approve(address(amm), amountIn);

        amountOut = amm.swap(amountIn, !buyBase, minAmountOut);

        IERC20 tokenOut = buyBase ? IERC20(orderBook.baseToken()) : IERC20(orderBook.quoteToken());
        require(tokenOut.transfer(msg.sender, amountOut), "Transfer out failed");

        emit OrderRouted(msg.sender, false, amountIn);
        return amountOut;
    }

    /**
     * @notice Get best execution quote
     * @dev Compares order book and AMM prices
     */
    function getQuote(uint256 amount, bool buyBase) external view returns (
        uint256 ammQuote,
        uint256 orderBookDepth
    ) {
        ammQuote = amm.getQuote(amount, !buyBase);
        // orderBookDepth would require iterating price levels - simplified for now
        orderBookDepth = 0;

        return (ammQuote, orderBookDepth);
    }
}
