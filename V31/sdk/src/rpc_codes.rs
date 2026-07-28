//! JSON-RPC 2.0 error codes used by `zion-node`.

pub const PARSE_ERROR: i32 = -32700;
pub const INVALID_REQUEST: i32 = -32600;
pub const METHOD_NOT_FOUND: i32 = -32601;
pub const INVALID_PARAMS: i32 = -32602;
pub const INTERNAL_ERROR: i32 = -32603;

pub const NODE_NOT_READY: i32 = -32000;
pub const BLOCK_NOT_FOUND: i32 = -32001;
pub const TX_REJECTED: i32 = -32002;
pub const TEMPLATE_STALE: i32 = -32003;
