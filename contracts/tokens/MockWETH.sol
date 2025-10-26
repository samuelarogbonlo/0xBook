// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {
        _mint(msg.sender, 10_000 * 10**18); // 10K WETH
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
