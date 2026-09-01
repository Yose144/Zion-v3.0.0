// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ZIONDexFactory} from "./ZIONDexFactory.sol";
import {ZIONDexPair} from "./ZIONDexPair.sol";

/// @title ZIONDexRouter — User-facing router for ZIONDex
/// @notice Handles token transfers, approvals, multi-hop swaps and liquidity
///         management against a ZIONDexFactory. Users interact only with this
///         contract; pairs are low-level.
contract ZIONDexRouter {
    /// @notice Factory used to locate / create pairs.
    ZIONDexFactory public immutable factory;

    /// @notice Default deadline window (in seconds) if a caller passes 0.
    uint256 public constant DEFAULT_DEADLINE = 600;

    // ── Events ──────────────────────────────────────────────────────────

    event SwapExecuted(
        address indexed sender,
        address[] path,
        uint256 amountIn,
        uint256 amountOut
    );
    event LiquidityAdded(
        address indexed sender,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed sender,
        address indexed tokenA,
        address indexed tokenB,
        uint256 liquidity,
        uint256 amountA,
        uint256 amountB
    );

    constructor(address _factory) {
        factory = ZIONDexFactory(_factory);
    }

    // ── Modifiers ──────────────────────────────────────────────────────

    modifier ensure(uint256 deadline) {
        uint256 _deadline = deadline == 0 ? block.timestamp + DEFAULT_DEADLINE : deadline;
        require(block.timestamp <= _deadline, "ZIONDex: EXPIRED");
        _;
    }

    // ── Pair lookup ────────────────────────────────────────────────────

    /// @dev Returns the pair address for two tokens (creates it if missing).
    function _pairFor(address tokenA, address tokenB) internal returns (address pair) {
        pair = factory.pairFor(tokenA, tokenB);
        if (pair == address(0)) {
            pair = factory.createPair(tokenA, tokenB);
        }
    }

    // ── Quotes ─────────────────────────────────────────────────────────

    /// @notice Returns the output amounts for each hop along `path`.
    /// @param amountIn Input amount of path[0].
    /// @param path Array of token addresses (length 2 or 3 supported).
    /// @return amounts Output amount at each hop; amounts[path.length-1] is final.
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        public
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "ZIONDex: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            address pair = factory.pairFor(path[i], path[i + 1]);
            require(pair != address(0), "ZIONDex: PAIR_NOT_FOUND");
            (uint112 reserve0, uint112 reserve1, ) = ZIONDexPair(pair).getReserves();
            (address token0, ) = path[i] < path[i + 1] ? (path[i], path[i + 1]) : (path[i + 1], path[i]);
            (uint256 reserveIn, uint256 reserveOut) = path[i] == token0
                ? (uint256(reserve0), uint256(reserve1))
                : (uint256(reserve1), uint256(reserve0));
            amounts[i + 1] = ZIONDexPair(pair).getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    // ── Swap ───────────────────────────────────────────────────────────

    /// @notice Swaps an exact amount of input tokens for as many output
    ///         tokens as possible along `path`. Supports 2-hop paths.
    /// @param amountIn Exact amount of path[0] to swap.
    /// @param amountOutMin Minimum acceptable output of the final token.
    /// @param path Token route (length 2 or 3).
    /// @param to Recipient of the output tokens.
    /// @param deadline Unix timestamp after which the tx reverts.
    /// @return amounts Output amount at each hop.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path.length >= 2 && path.length <= 3, "ZIONDex: INVALID_PATH");
        require(amountIn > 0, "ZIONDex: ZERO_AMOUNT");
        require(to != address(0), "ZIONDex: ZERO_TO");

        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "ZIONDex: INSUFFICIENT_OUTPUT_AMOUNT");

        // Pull input tokens from the caller.
        _safeTransferFrom(path[0], msg.sender, address(this), amountIn);

        // Execute each hop.
        for (uint256 i = 0; i < path.length - 1; i++) {
            address pair = _pairFor(path[i], path[i + 1]);
            (address token0, ) = path[i] < path[i + 1] ? (path[i], path[i + 1]) : (path[i + 1], path[i]);

            uint256 amountInHop = amounts[i];
            uint256 amountOutHop = amounts[i + 1];

            // Approve the pair to pull the input token from the router.
            _approveMax(path[i], pair);

            // Determine output direction.
            (uint256 amount0Out, uint256 amount1Out) = path[i] == token0
                ? (uint256(0), amountOutHop)
                : (amountOutHop, uint256(0));

            // For multi-hop, intermediate output stays at the router; final
            // output goes to `to`.
            address recipient = (i == path.length - 2) ? to : address(this);

            // Transfer input tokens to the pair, then call swap.
            _safeTransfer(path[i], pair, amountInHop);
            ZIONDexPair(pair).swap(amount0Out, amount1Out, recipient);
        }

        emit SwapExecuted(msg.sender, path, amountIn, amounts[amounts.length - 1]);
    }

    // ── Add liquidity ──────────────────────────────────────────────────

    /// @notice Adds liquidity to the pair for (tokenA, tokenB). Creates the
    ///         pair if it does not exist. Tokens are pulled from `msg.sender`.
    /// @return amountA Actual amount of tokenA deposited.
    /// @return amountB Actual amount of tokenB deposited.
    /// @return liquidity LP tokens minted to `to`.
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(tokenA != tokenB, "ZIONDex: IDENTICAL_ADDRESSES");
        require(amountADesired > 0 && amountBDesired > 0, "ZIONDex: INSUFFICIENT_AMOUNT");

        address pair = _pairFor(tokenA, tokenB);
        (uint112 reserve0, uint112 reserve1, ) = ZIONDexPair(pair).getReserves();
        (address token0, ) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        if (reserve0 == 0 && reserve1 == 0) {
            // First liquidity — use desired amounts directly.
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            // Price the deposit against existing reserves.
            (uint256 reserveA, uint256 reserveB) = tokenA == token0
                ? (uint256(reserve0), uint256(reserve1))
                : (uint256(reserve1), uint256(reserve0));
            uint256 amountBOptimal = (amountADesired * reserveB) / reserveA;
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "ZIONDex: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = (amountBDesired * reserveA) / reserveB;
                require(amountAOptimal <= amountADesired, "ZIONDex: BAD_AMOUNTS");
                require(amountAOptimal >= amountAMin, "ZIONDex: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }

        // Pull tokens from the caller and forward to the pair.
        _safeTransferFrom(tokenA, msg.sender, address(this), amountA);
        _safeTransferFrom(tokenB, msg.sender, address(this), amountB);
        _safeTransfer(tokenA, pair, amountA);
        _safeTransfer(tokenB, pair, amountB);

        // Mint LP to `to`. The pair mints to msg.sender, so we must call
        // from a context where msg.sender == to. Since the router holds no
        // LP itself, we mint to the router then forward to `to`.
        liquidity = ZIONDexPair(pair).addLiquidity(amountA, amountB);
        if (to != address(this)) {
            uint256 lpBal = ZIONDexPair(pair).balanceOf(address(this));
            _safeTransfer(pair, to, lpBal);
            liquidity = lpBal;
        }

        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }

    // ── Remove liquidity ───────────────────────────────────────────────

    /// @notice Removes liquidity from the pair for (tokenA, tokenB) and
    ///         returns the underlying tokens to `to`. The caller must have
    ///         approved the router for `liquidity` LP tokens.
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        require(tokenA != tokenB, "ZIONDex: IDENTICAL_ADDRESSES");
        require(liquidity > 0, "ZIONDex: ZERO_LIQUIDITY");

        address pair = factory.pairFor(tokenA, tokenB);
        require(pair != address(0), "ZIONDex: PAIR_NOT_FOUND");

        // Pull LP tokens from the caller.
        _safeTransferFrom(pair, msg.sender, address(this), liquidity);

        // Burn LP and receive tokens at the router.
        (uint256 amount0, uint256 amount1) = ZIONDexPair(pair).removeLiquidity(liquidity);
        (address token0, ) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);

        require(amountA >= amountAMin, "ZIONDex: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "ZIONDex: INSUFFICIENT_B_AMOUNT");

        if (to != address(this)) {
            _safeTransfer(tokenA, to, amountA);
            _safeTransfer(tokenB, to, amountB);
        }

        emit LiquidityRemoved(msg.sender, tokenA, tokenB, liquidity, amountA, amountB);
    }

    // ── Internal: token helpers ────────────────────────────────────────

    function _approveMax(address token, address spender) internal {
        // Set max approval once; cheap and avoids repeated storage writes
        // when the same spender is reused.
        if (IERC20(token).allowance(address(this), spender) == 0) {
            _approve(token, spender, type(uint256).max);
        }
    }

    function _approve(address token, address spender, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, spender, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ZIONDex: APPROVE_FAILED");
    }

    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ZIONDex: TRANSFER_FAILED");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "ZIONDex: TRANSFER_FROM_FAILED");
    }
}

/// @title Minimal ERC-20 interface used by the router.
interface IERC20 {
    function allowance(address owner, address spender) external view returns (uint256);
}
