// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract XXXToken is ERC20Burnable {
    address public owner;
    constructor() ERC20("XXX Coin", "XXX") {
        _mint(msg.sender, 20000 * 10**uint(decimals()));
        owner = msg.sender;
    }
}
