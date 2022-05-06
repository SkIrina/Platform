// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStaking {
    function balances(address) external view returns (uint);
} 
