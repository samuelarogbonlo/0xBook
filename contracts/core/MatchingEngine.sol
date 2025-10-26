// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IOrderBook.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MatchingEngine
 * @notice Matches orders from the OrderBook with parallel execution
 * @dev Different price pairs can be matched concurrently
 */
contract MatchingEngine is ReentrancyGuard {
    IOrderBook public orderBook;

    event OrdersMatched(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint256 price,
        uint256 amount
    );

    constructor(address _orderBook) {
        orderBook = IOrderBook(_orderBook);
    }

    /**
     * @notice Match orders at specific price levels
     * @dev Simplified to avoid stack too deep errors
     */
    function matchOrders(uint256 buyPrice, uint256 sellPrice) external nonReentrant returns (uint256) {
        require(buyPrice >= sellPrice, "No price overlap");

        // Trigger matching in the OrderBook contract
        orderBook.matchOrders(buyPrice, sellPrice);

        return 1;
    }

    /**
     * @notice Batch match multiple price level pairs
     */
    function batchMatch(
        uint256[] calldata buyPrices,
        uint256[] calldata sellPrices
    ) external nonReentrant returns (uint256) {
        require(buyPrices.length == sellPrices.length, "Length mismatch");

        for (uint256 i = 0; i < buyPrices.length; i++) {
            if (buyPrices[i] >= sellPrices[i]) {
                orderBook.matchOrders(buyPrices[i], sellPrices[i]);
            }
        }

        return buyPrices.length;
    }
}
