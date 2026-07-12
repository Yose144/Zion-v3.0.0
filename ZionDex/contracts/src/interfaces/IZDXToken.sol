// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IZDXToken
/// @notice Minimal interface for ZDXToken used by staking and registry contracts
interface IZDXToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function burn(uint256 amount) external;
}
