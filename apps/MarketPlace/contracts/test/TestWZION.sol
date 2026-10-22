// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TestWZION — testnet stand-in for wZION (Base Sepolia E2E only)
/// @notice Open faucet ERC-20 so any wallet can fund itself for marketplace testing.
///         NOT for mainnet — mainnet uses real wZION at 0x0c49...2bb6.
contract TestWZION is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 18;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastFaucetAt;

    constructor() ERC20("Test Wrapped ZION", "twZION") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** 18);
    }

    /// @notice Claim 10k twZION (once per hour per address)
    function faucet() external {
        require(
            block.timestamp >= lastFaucetAt[msg.sender] + FAUCET_COOLDOWN,
            "Faucet cooldown"
        );
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner mint (for seeding test accounts / CI)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
