// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDao {
    function withdrawalTime(address) external view returns (uint);
}