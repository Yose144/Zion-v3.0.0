// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ZIONDexFactory interface — minimal interface used by the pair.
interface IZIONDexFactory {
    function feeTo() external view returns (address);
    function protocolFeeBps() external view returns (uint256);
}

/// @title ZIONDexPair — AMM pair with LP tokens and protocol fee
/// @notice Uniswap V2 pair clone. Holds two ERC-20 tokens, enforces the
///         constant-product K invariant on swaps, and mints a protocol fee
///         share of LP tokens to the factory's `feeTo` during swaps.
contract ZIONDexPair {
    // ── ERC20 state (LP token) ─────────────────────────────────────────
    string public constant name = "ZIONDex LP Token";
    string public constant symbol = "ZDX-LP";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ── Pair state ─────────────────────────────────────────────────────
    address public token0;
    address public token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    /// @notice Factory that created this pair (governance / feeTo source).
    address public factory;

    /// @notice Minimum liquidity locked forever on first mint.
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    /// @notice Emitted on transfer of LP tokens.
    event Transfer(address indexed from, address indexed to, uint256 value);
    /// @notice Emitted on approval of LP tokens.
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice Emitted when reserves are synced.
    event Sync(uint112 reserve0, uint112 reserve1);
    /// @notice Emitted on a swap.
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    /// @notice Emitted on mint of LP tokens.
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    /// @notice Emitted on burn of LP tokens.
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);

    // ── Initialization ─────────────────────────────────────────────────

    /// @notice Called once by the factory right after creation.
    function initialize(address _token0, address _token1, address _factory) external {
        require(token0 == address(0) && token1 == address(0), "ZIONDex: ALREADY_INITIALIZED");
        token0 = _token0;
        token1 = _token1;
        factory = _factory;
    }

    // ── Reserves ───────────────────────────────────────────────────────

    /// @notice Returns the current reserves and last-synced timestamp.
    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    /// @notice Forces reserves to match the actual token balances.
    function sync() external {
        _update(uint112(_balanceOfThis(token0)), uint112(_balanceOfThis(token1)), reserve0, reserve1);
    }

    // ── ERC20 LP token ─────────────────────────────────────────────────

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "ZIONDex: INSUFFICIENT_ALLOWANCE");
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "ZIONDex: INSUFFICIENT_BALANCE");
        unchecked {
            balanceOf[from] -= value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        totalSupply += value;
        unchecked {
            balanceOf[to] += value;
        }
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        require(balanceOf[from] >= value, "ZIONDex: INSUFFICIENT_BALANCE");
        unchecked {
            balanceOf[from] -= value;
            totalSupply -= value;
        }
        emit Transfer(from, address(0), value);
    }

    // ── Liquidity ──────────────────────────────────────────────────────

    /// @notice Mints LP tokens for the deposited `amount0` / `amount1`.
    ///         Tokens must already be transferred to this pair before calling.
    ///         LP tokens are minted to `msg.sender`.
    function addLiquidity(uint256 amount0, uint256 amount1) external returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves();
        uint256 _totalSupply = totalSupply;

        if (_totalSupply == 0) {
            // First liquidity provider.
            liquidity = _sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY); // lock minimum forever
            _mint(msg.sender, liquidity);
        } else {
            // Subsequent providers — proportional mint.
            uint256 liq0 = (amount0 * _totalSupply) / _reserve0;
            uint256 liq1 = (amount1 * _totalSupply) / _reserve1;
            liquidity = liq0 < liq1 ? liq0 : liq1;
            require(liquidity > 0, "ZIONDex: INSUFFICIENT_LIQUIDITY_MINTED");
            _mint(msg.sender, liquidity);
        }

        // Verify tokens actually arrived.
        require(_balanceOfThis(token0) >= uint256(_reserve0) + amount0, "ZIONDex: INSUFFICIENT_TOKEN0_AMOUNT");
        require(_balanceOfThis(token1) >= uint256(_reserve1) + amount1, "ZIONDex: INSUFFICIENT_TOKEN1_AMOUNT");

        _update(
            uint112(_balanceOfThis(token0)),
            uint112(_balanceOfThis(token1)),
            _reserve0,
            _reserve1
        );

        emit Mint(msg.sender, amount0, amount1);
    }

    /// @notice Burns `lpAmount` of LP tokens held by `msg.sender` and returns
    ///         the underlying tokens to `msg.sender`.
    function removeLiquidity(uint256 lpAmount) external returns (uint256 amount0, uint256 amount1) {
        require(lpAmount > 0, "ZIONDex: ZERO_LIQUIDITY");
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves();
        uint256 _totalSupply = totalSupply;

        amount0 = (lpAmount * _reserve0) / _totalSupply;
        amount1 = (lpAmount * _reserve1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "ZIONDex: INSUFFICIENT_LIQUIDITY_BURNED");

        _burn(msg.sender, lpAmount);

        _safeTransfer(token0, msg.sender, amount0);
        _safeTransfer(token1, msg.sender, amount1);

        _update(
            uint112(_balanceOfThis(token0)),
            uint112(_balanceOfThis(token1)),
            _reserve0,
            _reserve1
        );

        emit Burn(msg.sender, amount0, amount1, msg.sender);
    }

    // ── Swap ───────────────────────────────────────────────────────────

    /// @notice Swaps `amount0Out` / `amount1Out` of the pair tokens to `to`.
    ///         The input tokens must already be transferred to this pair
    ///         before calling. The K invariant is verified after the swap.
    ///         A protocol fee share of LP tokens is minted to `feeTo`.
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external {
        require(amount0Out > 0 || amount1Out > 0, "ZIONDex: INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves();
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "ZIONDex: INSUFFICIENT_LIQUIDITY");

        // Mint protocol fee (in LP tokens) to feeTo before reserves change.
        _mintFee(_reserve0, _reserve1);

        uint256 balance0 = _balanceOfThis(token0) - amount0Out;
        uint256 balance1 = _balanceOfThis(token1) - amount1Out;

        // Send output tokens.
        if (amount0Out > 0) _safeTransfer(token0, to, amount0Out);
        if (amount1Out > 0) _safeTransfer(token1, to, amount1Out);

        // Compute input amounts (tokens sent in beyond the reserves).
        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "ZIONDex: INSUFFICIENT_INPUT_AMOUNT");

        // K invariant check with 0.3% fee.
        // balance*Adjusted = balance* * 1000 - amount*In * 3
        uint256 balance0Adjusted = balance0 * 1000 - amount0In * 3;
        uint256 balance1Adjusted = balance1 * 1000 - amount1In * 3;
        require(
            balance0Adjusted * balance1Adjusted >= uint256(_reserve0) * uint256(_reserve1) * (1000 * 1000),
            "ZIONDex: K"
        );

        _update(uint112(balance0), uint112(balance1), _reserve0, _reserve1);

        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    // ── Quote helper ───────────────────────────────────────────────────

    /// @notice Pure helper that computes the output amount for a given input,
    ///         using the 0.3% fee formula. Matches Uniswap V2 getAmountOut.
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        require(amountIn > 0, "ZIONDex: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "ZIONDex: INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        return numerator / denominator;
    }

    // ── Internal: protocol fee mint ────────────────────────────────────

    /// @dev Mints a protocol fee share of LP tokens to `feeTo` based on the
    ///      factory's `protocolFeeBps`. This is a simplified version of
    ///      Uniswap V2's mintFee: it mints a small fraction of the current
    ///      total supply each swap, proportional to the protocol fee share.
    function _mintFee(uint112 _reserve0, uint112 _reserve1) internal {
        address _feeTo = IZIONDexFactory(factory).feeTo();
        if (_feeTo == address(0)) return; // protocol fee disabled

        uint256 bps = IZIONDexFactory(factory).protocolFeeBps();
        if (bps == 0) return;

        uint256 _totalSupply = totalSupply;
        if (_totalSupply == 0) return;

        // Mint `bps / 10000` of total supply to feeTo per swap event.
        // This is a lightweight approximation; a production system would
        // accumulate fees over a window. Kept simple and gas-bounded.
        uint256 feeLiquidity = (_totalSupply * bps) / 10000;
        if (feeLiquidity == 0) return;

        // Cap so fee mint never exceeds a reasonable fraction of supply.
        if (feeLiquidity > _totalSupply / 100) {
            feeLiquidity = _totalSupply / 100;
        }

        _mint(_feeTo, feeLiquidity);
        // Touch reserves so the K check uses post-fee supply consistently.
        _update(_reserve0, _reserve1, _reserve0, _reserve1);
    }

    // ── Internal: reserve update ───────────────────────────────────────

    function _update(
        uint112 _balance0,
        uint112 _balance1,
        uint112 _reserve0,
        uint112 _reserve1
    ) internal {
        require(_balance0 <= type(uint112).max && _balance1 <= type(uint112).max, "ZIONDex: OVERFLOW");
        reserve0 = _balance0;
        reserve1 = _balance1;
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(_reserve0, _reserve1);
    }

    // ── Internal: safe token helpers ───────────────────────────────────

    function _balanceOfThis(address token) internal view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(0x70a08231, address(this)));
        require(ok && data.length >= 32, "ZIONDex: BALANCE_CALL_FAILED");
        return abi.decode(data, (uint256));
    }

    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ZIONDex: TRANSFER_FAILED");
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
