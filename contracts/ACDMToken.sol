// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract ACDMToken is ERC20Burnable {
    address public owner;
    address public platform;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyPlatform {
        require(msg.sender == platform, "Not authorised");
        _;
    }

    constructor() ERC20("ACADEM Coin", "ACDM") {
        _mint(msg.sender, 200000 * 10**uint(decimals()));
        owner = msg.sender;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function setPlatform(address _platform) public onlyOwner {
        platform = _platform;
    }

    function mint(address account, uint256 amount) public onlyPlatform {
        _mint(account, amount);
    }
}
