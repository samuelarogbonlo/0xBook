// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@arcologynetwork/concurrentlib/lib/commutative/U256Cum.sol";

/**
 * @title OrderBook
 * @notice On-chain order book leveraging Arcology's parallel execution
 * @dev Orders at different price levels execute in parallel (different storage slots)
 * Price is always in quote token decimals (e.g., 3000 USDC = 3000e6)
 * Amount is always in base token decimals (e.g., 1 WETH = 1e18)
 */
contract OrderBook is ReentrancyGuard {
    struct Order {
        address trader;
        uint256 price;          // Price in quote token units per base token
        uint256 amount;         // Amount in base token units
        uint256 filled;         // Filled amount in base token units
        uint256 timestamp;
        bool isBuy;
        bool active;
    }

    IERC20 public immutable baseToken;  // e.g., WETH (18 decimals) or WBTC (8 decimals)
    IERC20 public immutable quoteToken; // e.g., USDC (6 decimals)
    uint8 public immutable baseDecimals;
    uint8 public immutable quoteDecimals;

    uint256 public nextOrderId;

    // Counter configuration (auto-detects Arcology concurrent service)
    bool public countersUseConcurrent;
    U256Cumulative private totalVolumeCounter;
    U256Cumulative private totalTradesCounter;
    U256Cumulative private totalOrdersCounter;
    uint256 private totalVolumeScalar;
    uint256 private totalTradesScalar;
    uint256 private totalOrdersScalar;

    // Price level -> array of order IDs (enables parallel execution at storage-slot level)
    mapping(uint256 => uint256[]) public buyOrdersByPrice;
    mapping(uint256 => uint256[]) public sellOrdersByPrice;

    // Order ID -> Order details
    mapping(uint256 => Order) public orders;

    // User -> their order IDs
    mapping(address => uint256[]) public userOrders;

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        uint256 price,
        uint256 amount,
        bool isBuy
    );

    event OrderCancelled(uint256 indexed orderId, address indexed trader);

    event OrderMatched(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint256 price,
        uint256 amount
    );

    constructor(
        address _baseToken,
        address _quoteToken,
        uint8 _baseDecimals,
        uint8 _quoteDecimals
    ) {
        baseToken = IERC20(_baseToken);
        quoteToken = IERC20(_quoteToken);
        baseDecimals = _baseDecimals;
        quoteDecimals = _quoteDecimals;

        _initCounters();
    }

    /**
     * @notice Place a limit order
     * @dev Different prices access different storage slots -> parallel execution
     */
    function placeOrder(uint256 price, uint256 amount, bool isBuy) external nonReentrant returns (uint256) {
        require(price > 0, "Invalid price");
        require(amount > 0, "Invalid amount");

        // Escrow tokens
        // CRITICAL FIX: Use actual baseDecimals instead of hardcoded 1e18
        // For buy orders: cost = (price * amount) / 10^baseDecimals
        // For sell orders: escrow the base token amount
        if (isBuy) {
            uint256 cost = (price * amount) / (10 ** baseDecimals);
            require(quoteToken.transferFrom(msg.sender, address(this), cost), "Transfer failed");
        } else {
            require(baseToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        }

        uint256 orderId = nextOrderId++;

        orders[orderId] = Order({
            trader: msg.sender,
            price: price,
            amount: amount,
            filled: 0,
            timestamp: block.timestamp,
            isBuy: isBuy,
            active: true
        });

        // Add to price level (parallel-friendly storage)
        if (isBuy) {
            buyOrdersByPrice[price].push(orderId);
        } else {
            sellOrdersByPrice[price].push(orderId);
        }

        userOrders[msg.sender].push(orderId);

        _incrementOrders();

        emit OrderPlaced(orderId, msg.sender, price, amount, isBuy);
        return orderId;
    }

    /**
     * @notice Cancel an active order
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.active, "Order not active");
        require(order.trader == msg.sender, "Not order owner");

        order.active = false;

        // Return escrowed tokens
        uint256 remaining = order.amount - order.filled;
        if (order.isBuy) {
            uint256 refund = (order.price * remaining) / (10 ** baseDecimals);
            require(quoteToken.transfer(msg.sender, refund), "Refund failed");
        } else {
            require(baseToken.transfer(msg.sender, remaining), "Refund failed");
        }

        emit OrderCancelled(orderId, msg.sender);
    }

    /**
     * @notice Match orders at specific price levels
     * @dev Can be called by anyone (keepers, users, etc.)
     */
    function matchOrders(uint256 buyPrice, uint256 sellPrice) external nonReentrant {
        require(buyPrice >= sellPrice, "No price overlap");

        uint256[] memory buyOrders = buyOrdersByPrice[buyPrice];
        uint256[] memory sellOrders = sellOrdersByPrice[sellPrice];

        for (uint256 i = 0; i < buyOrders.length; i++) {
            Order storage buyOrder = orders[buyOrders[i]];
            if (!buyOrder.active || buyOrder.filled >= buyOrder.amount) continue;

            for (uint256 j = 0; j < sellOrders.length; j++) {
                Order storage sellOrder = orders[sellOrders[j]];
                if (!sellOrder.active || sellOrder.filled >= sellOrder.amount) continue;

                uint256 matchAmount = _min(
                    buyOrder.amount - buyOrder.filled,
                    sellOrder.amount - sellOrder.filled
                );

                if (matchAmount == 0) continue;

                // Execute trade at sell price (price-time priority)
                uint256 executionPrice = sellOrder.price;
                uint256 cost = (executionPrice * matchAmount) / (10 ** baseDecimals);

                buyOrder.filled += matchAmount;
                sellOrder.filled += matchAmount;

                // Mark orders as inactive if fully filled
                if (buyOrder.filled >= buyOrder.amount) {
                    buyOrder.active = false;
                }
                if (sellOrder.filled >= sellOrder.amount) {
                    sellOrder.active = false;
                }

                // Transfer tokens
                require(baseToken.transfer(buyOrder.trader, matchAmount), "Base transfer failed");
                require(quoteToken.transfer(sellOrder.trader, cost), "Quote transfer failed");

                // Refund excess if buy price > sell price
                if (buyOrder.price > sellOrder.price) {
                    uint256 excess = ((buyOrder.price - sellOrder.price) * matchAmount) / (10 ** baseDecimals);
                    require(quoteToken.transfer(buyOrder.trader, excess), "Excess refund failed");
                }

                _incrementVolume(matchAmount);
                _incrementTrades();

                emit OrderMatched(buyOrders[i], sellOrders[j], executionPrice, matchAmount);

                if (buyOrder.filled >= buyOrder.amount) {
                    buyOrder.active = false;
                    break;
                }
            }
        }
    }

    /**
     * @notice Get orders at a specific price level
     */
    function getOrdersByPrice(uint256 price, bool isBuy) external view returns (uint256[] memory) {
        return isBuy ? buyOrdersByPrice[price] : sellOrdersByPrice[price];
    }

    /**
     * @notice Get user's orders
     */
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    /**
     * @notice Get best bid price (highest buy price with active orders)
     * @dev In production, would maintain sorted price levels for O(1) lookup
     */
    function getBestBid() external view returns (uint256 bestBid) {
        bestBid = 0;
        // Simple implementation: would be optimized with price tracking in production
        for (uint256 i = 0; i < nextOrderId; i++) {
            if (orders[i].active && orders[i].isBuy && orders[i].filled < orders[i].amount) {
                if (orders[i].price > bestBid) {
                    bestBid = orders[i].price;
                }
            }
        }
        return bestBid;
    }

    /**
     * @notice Get best ask price (lowest sell price with active orders)
     * @dev In production, would maintain sorted price levels for O(1) lookup
     */
    function getBestAsk() external view returns (uint256 bestAsk) {
        bestAsk = type(uint256).max;
        // Simple implementation: would be optimized with price tracking in production
        for (uint256 i = 0; i < nextOrderId; i++) {
            if (orders[i].active && !orders[i].isBuy && orders[i].filled < orders[i].amount) {
                if (orders[i].price < bestAsk) {
                    bestAsk = orders[i].price;
                }
            }
        }
        return bestAsk == type(uint256).max ? 0 : bestAsk;
    }

    /**
     * @notice Get order book depth at specific price level
     * @param price Price level to query
     * @param isBuy True for buy orders, false for sell orders
     * @return totalAmount Total amount available at this price level
     * @return orderCount Number of active orders at this price
     */
    function getDepthAtPrice(uint256 price, bool isBuy) external view returns (
        uint256 totalAmount,
        uint256 orderCount
    ) {
        uint256[] memory orderIds = isBuy ? buyOrdersByPrice[price] : sellOrdersByPrice[price];

        totalAmount = 0;
        orderCount = 0;

        for (uint256 i = 0; i < orderIds.length; i++) {
            Order memory order = orders[orderIds[i]];
            if (order.active && order.filled < order.amount) {
                totalAmount += (order.amount - order.filled);
                orderCount++;
            }
        }

        return (totalAmount, orderCount);
    }

    /**
     * @notice Get spread (difference between best bid and best ask)
     */
    function getSpread() external view returns (uint256 spread) {
        uint256 bestBid = this.getBestBid();
        uint256 bestAsk = this.getBestAsk();

        if (bestBid == 0 || bestAsk == 0) {
            return 0;
        }

        return bestAsk > bestBid ? bestAsk - bestBid : 0;
    }

    function getTotalVolume() external view returns (uint256) {
        return countersUseConcurrent ? totalVolumeCounter.get() : totalVolumeScalar;
    }

    function getTotalTrades() external view returns (uint256) {
        return countersUseConcurrent ? totalTradesCounter.get() : totalTradesScalar;
    }

    function getTotalOrdersPlaced() external view returns (uint256) {
        return countersUseConcurrent ? totalOrdersCounter.get() : totalOrdersScalar;
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function _incrementOrders() private {
        if (countersUseConcurrent) {
            require(totalOrdersCounter.add(1), "orders counter failed");
        } else {
            totalOrdersScalar += 1;
        }
    }

    function _incrementTrades() private {
        if (countersUseConcurrent) {
            require(totalTradesCounter.add(1), "trades counter failed");
        } else {
            totalTradesScalar += 1;
        }
    }

    function _incrementVolume(uint256 amount) private {
        if (countersUseConcurrent) {
            require(totalVolumeCounter.add(amount), "volume counter failed");
        } else {
            totalVolumeScalar += amount;
        }
    }

    function _initCounters() private {
        // Attempt to instantiate concurrent counters (requires Arcology service at 0x85).
        try new U256Cumulative(0, type(uint256).max) returns (U256Cumulative volumeCounter) {
            totalVolumeCounter = volumeCounter;
            try new U256Cumulative(0, type(uint256).max) returns (U256Cumulative tradesCounter) {
                totalTradesCounter = tradesCounter;
                totalOrdersCounter = new U256Cumulative(0, type(uint256).max);
                // Ensure the concurrent service responds before enabling it
                try totalOrdersCounter.get() returns (uint256) {
                    countersUseConcurrent = true;
                } catch {
                    countersUseConcurrent = false;
                }
            } catch {
                countersUseConcurrent = false;
            }
        } catch {
            countersUseConcurrent = false;
        }
    }
}
