// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

/// @title ZDXToken
/// @notice ZionDex governance token — rewards for LPs and stakers
/// @dev ERC-20 with minting controlled by MINTER_ROLE (e.g. staking contract).
///      SLASHER_ROLE can burn tokens during slashing (SolverRegistry).
///      DEFAULT_ADMIN_ROLE manages role assignments (multisig).
contract ZDXToken is AccessControlEnumerable {
    string public constant name = "ZionDex Token";
    string public constant symbol = "ZDX";
    uint8 public constant decimals = 18;
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 value);
    event Burn(address indexed from, uint256 value);

    constructor(address admin, address minter, address slasher) {
        if (admin == address(0) || minter == address(0) || slasher == address(0)) {
            revert("Zero address");
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(SLASHER_ROLE, slasher);

        uint256 initialSupply = 10_000_000 * 1e18;
        _mint(admin, initialSupply);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "INSUFFICIENT_ALLOWANCE");
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply + amount <= MAX_SUPPLY, "MAX_SUPPLY_EXCEEDED");
        _mint(to, amount);
    }

    function burn(uint256 amount) external onlyRole(SLASHER_ROLE) {
        _burn(msg.sender, amount);
    }

    /// @notice Replace the current minter with a new one.
    /// @dev Only the admin (DEFAULT_ADMIN_ROLE) can call this.
    ///      This is a convenience wrapper around grantRole/revokeRole
    ///      that atomically transfers MINTER_ROLE from the current minter
    ///      to `newMinter`, enabling safe upgradeability of the staking contract.
    function setMinter(address newMinter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address current = getMinter();
        if (current != address(0)) {
            revokeRole(MINTER_ROLE, current);
        }
        grantRole(MINTER_ROLE, newMinter);
    }

    /// @notice Returns the current minter address (or zero if none).
    function getMinter() public view returns (address) {
        // MINTER_ROLE has at most one member; iterate via getRoleMember
        // AccessControl requires the role to exist with at least one member.
        return getRoleMember(MINTER_ROLE, 0);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "INSUFFICIENT_BALANCE");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
        emit Mint(to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "INSUFFICIENT_BALANCE");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
        emit Burn(from, amount);
    }
}
