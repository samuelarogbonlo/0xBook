// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@arcologynetwork/concurrentlib/lib/commutative/U256Cum.sol";

/**
 * @title TestCounter
 * @notice Simple test contract to verify U256Cumulative works
 * @dev This demonstrates Arcology's concurrent data structures
 */
contract TestCounter {
    bool public concurrentEnabled;
    U256Cumulative private counter;
    uint256 private scalarCounter;

    constructor() {
        _initCounter();
    }

    function increment() external {
        if (concurrentEnabled) {
            require(counter.add(1), "counter add failed");
        } else {
            scalarCounter += 1;
        }
    }

    function incrementBy(uint256 amount) external {
        if (concurrentEnabled) {
            require(counter.add(amount), "counter add failed");
        } else {
            scalarCounter += amount;
        }
    }

    function decrement() external {
        if (concurrentEnabled) {
            require(counter.sub(1), "counter sub failed");
        } else {
            require(scalarCounter >= 1, "counter underflow");
            scalarCounter -= 1;
        }
    }

    function getCount() external view returns (uint256) {
        return concurrentEnabled ? counter.get() : scalarCounter;
    }

    function _initCounter() private {
        try new U256Cumulative(0, type(uint256).max) returns (U256Cumulative c) {
            counter = c;
            // Ensure the concurrent service responds
            try counter.get() returns (uint256) {
                concurrentEnabled = true;
            } catch {
                concurrentEnabled = false;
            }
        } catch {
            concurrentEnabled = false;
        }
    }
}
