// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IOrderBook {
    function orders(uint256 orderId) external view returns (
        address trader,
        uint256 price,
        uint256 amount,
        uint256 filled,
        uint256 timestamp,
        bool isBuy,
        bool active
    );

    function placeOrder(uint256 price, uint256 amount, bool isBuy) external returns (uint256);
    function cancelOrder(uint256 orderId) external;
    function matchOrders(uint256 buyPrice, uint256 sellPrice) external;
    function getOrdersByPrice(uint256 price, bool isBuy) external view returns (uint256[] memory);
    function getUserOrders(address user) external view returns (uint256[] memory);

    function baseToken() external view returns (address);
    function quoteToken() external view returns (address);

    function getBestBid() external view returns (uint256);
    function getBestAsk() external view returns (uint256);
    function getDepthAtPrice(uint256 price, bool isBuy) external view returns (uint256 totalAmount, uint256 orderCount);
    function getSpread() external view returns (uint256);

    function getTotalVolume() external view returns (uint256);
    function getTotalTrades() external view returns (uint256);
    function getTotalOrdersPlaced() external view returns (uint256);
}
