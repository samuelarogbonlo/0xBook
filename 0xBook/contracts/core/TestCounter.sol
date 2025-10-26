// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@arcologynetwork/concurrentlib/lib/commutative/U256Cum.sol";

/**
 * @title TestCounter
 * @notice Simple test contract to verify U256Cumulative works
 * @dev This demonstrates Arcology's concurrent data structures
 */
contract TestCounter {
    U256Cumulative public counter;

    constructor() {
        counter = new U256Cumulative(0, type(uint256).max);
    }

    function increment() external {
        counter.add(1);
    }

    function incrementBy(uint256 amount) external {
        counter.add(amount);
    }

    function decrement() external {
        counter.sub(1);
    }

    function getCount() external view returns (uint256) {
        return counter.get();
    }
}
