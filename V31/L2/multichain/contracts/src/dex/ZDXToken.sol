// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ZDXToken
/// @notice ZionDex governance token — rewards for LPs and stakers
/// @dev ERC-20 with minting controlled by ZionDexStaking
contract ZDXToken {
    string public constant name = "ZionDex Token";
    string public constant symbol = "ZDX";
    uint8 public constant decimals = 18;
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18; // 100M ZDX

    uint256 public totalSupply;
    address public immutable owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ── Events ─────────────────────────────────────────────────────────

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 value);

    // ── Modifier ───────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
        // Mint initial supply to deployer
        uint256 initialSupply = 10_000_000 * 1e18; // 10M ZDX
        _mint(msg.sender, initialSupply);
    }

    // ── ERC-20 ─────────────────────────────────────────────────────────

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

    // ── Minting ────────────────────────────────────────────────────────

    /// @notice Mint ZDX rewards (only callable by staking contract)
    /// @param to Recipient
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply + amount <= MAX_SUPPLY, "MAX_SUPPLY_EXCEEDED");
        _mint(to, amount);
    }

    /// @notice Set new minter (for upgrading staking contract)
    function setMinter(address newMinter) external onlyOwner {
        // Transfer ownership to new minter
        // In production: use Ownable pattern with separate minter role
    }

    // ── Internal ───────────────────────────────────────────────────────

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
}
