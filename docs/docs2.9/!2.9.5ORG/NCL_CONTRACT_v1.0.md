# NCL (Neural Compute Layer) Contract v1.0

## Overview

NCL is ZION's 5th revenue stream - decentralized AI computation rewarded alongside traditional mining.
This document defines the protocol contract between pool and miners.

## Protocol Version

**Current Version**: `1.0`

Both pool and miner must agree on the protocol version. Version is included in all messages.

## Task Types

| Type | Enum Value | Deterministic | Description |
|------|------------|---------------|-------------|
| `hash_chaining_v1` | `HashChainingV1` | ✅ Yes | Blake3 hash chaining (CPU-verifiable) |
| `embedding` | `Embedding` | ❌ No | Text embedding inference |
| `llm_inference` | `LlmInference` | ❌ No | LLM text generation |
| `image_classification` | `ImageClassification` | ❌ No | Image classification |

### Deterministic Tasks

Only deterministic tasks can be cryptographically verified by the pool.
Non-deterministic tasks require statistical verification or trust.

## Task Contract (NclTask)

```json
{
  "version": "1.0",                    // REQUIRED: Protocol version
  "task_id": "uuid-v4",                // REQUIRED: Unique UUID
  "task_type": "hash_chaining_v1",     // REQUIRED: Must be valid NclTaskType
  "payload": {},                       // REQUIRED: Task-specific data
  "deadline_ms": 1706000000000,        // REQUIRED: Absolute Unix timestamp (ms)
  "created_at": 1706000000000,         // AUTO: Creation timestamp
  "reward": {                          // OPTIONAL: Defaults to 0
    "zion": 0.0,
    "multiplier": 1.0,
    "min_hashrate": null
  },
  "verification": {                    // REQUIRED: How to verify result
    "method": "blake3_chain",
    "seed": "hex-string",
    "expected": "hex-string",
    "rounds": 128
  },
  "retry_policy": {                    // OPTIONAL: Defaults provided
    "max_retries": 3,
    "retry_delay_ms": 5000,
    "allow_reassignment": true
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | `string` | Protocol version (must be "1.0") |
| `task_id` | `string` | UUID v4 format |
| `task_type` | `string` | One of defined task types |
| `payload` | `object` | Task-specific parameters |
| `deadline_ms` | `u64` | Absolute deadline (Unix ms) |
| `verification` | `object` | Verification method and data |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `created_at` | `u64` | current time | Auto-set by pool |
| `reward` | `object` | `{zion: 0.0}` | Reward configuration |
| `retry_policy` | `object` | see below | Retry settings |

## Stratum Messages

### 1. ncl.register

Miner registers NCL capabilities with pool.

**Request:**
```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "ncl.register",
  "params": {
    "version": "1.0",
    "npu_type": "cpu",
    "npu_tflops": 0.5,
    "allocation": 0.3,
    "supported_task_types": ["hash_chaining_v1", "embedding"]
  }
}
```

**Response:**
```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": {
    "status": "registered",
    "version": "1.0"
  }
}
```

### 2. ncl.get_task

Miner requests a task from pool.

**Request:**
```json
{
  "id": 2,
  "jsonrpc": "2.0",
  "method": "ncl.get_task",
  "params": {}
}
```

**Response:**
```json
{
  "id": 2,
  "jsonrpc": "2.0",
  "result": {
    "version": "1.0",
    "task_id": "...",
    "task_type": "hash_chaining_v1",
    ...
  }
}
```

### 3. ncl.submit

Miner submits task result.

**Request:**
```json
{
  "id": 3,
  "jsonrpc": "2.0",
  "method": "ncl.submit",
  "params": {
    "version": "1.0",
    "task_id": "...",
    "result": "hex-hash",
    "result_hash": "hex-hash",
    "compute_time_ms": 1234
  }
}
```

**Response:**
```json
{
  "id": 3,
  "jsonrpc": "2.0",
  "result": {
    "status": "accepted",
    "reward": 0.001
  }
}
```

**Possible Outcomes:**
- `accepted` - Task verified and rewarded
- `rejected` - Verification failed
- `unknown_task` - Task ID not found
- `expired` - Task deadline passed

### 4. ncl.status

Get NCL statistics.

**Request:**
```json
{
  "id": 4,
  "jsonrpc": "2.0",
  "method": "ncl.status",
  "params": {}
}
```

**Response:**
```json
{
  "id": 4,
  "jsonrpc": "2.0",
  "result": {
    "version": "1.0",
    "tasks_created": 1000,
    "tasks_submitted": 950,
    "tasks_accepted": 940,
    "tasks_rejected": 5,
    "tasks_expired": 5,
    "in_flight": 10
  }
}
```

## Verification Methods

### blake3_chain

Used for `hash_chaining_v1` task type.

```
state = seed (32 bytes)
for i in 0..rounds:
    state = blake3(state)
return hex(state)
```

Parameters:
- `seed`: Initial 32-byte hex string
- `rounds`: Number of hash iterations
- `expected`: Pre-computed expected result

## Error Handling

### Task Validation

Pool validates:
1. `version` matches NCL_PROTOCOL_VERSION
2. `task_type` is a known type
3. `task_id` is valid UUID
4. `deadline_ms` is in the future

### Expiration

- Pool cleans up expired in-flight tasks periodically
- Submissions after deadline return `expired` status
- Expired tasks are NOT retried (unless retry_policy allows)

### Retry Policy

```json
{
  "max_retries": 3,        // Maximum retry attempts
  "retry_delay_ms": 5000,  // Delay between retries
  "allow_reassignment": true  // Allow different miner
}
```

## Migration Notes

### From v0.x

Old miners without `version` field:
- Pool accepts with warning
- Assumes version "1.0"
- Legacy fields (`input_data`, `model`, `max_time_ms`) still supported

### Adding New Task Types

1. Add to `NclTaskType` enum in both pool and miner
2. Implement verification method
3. Document in this spec
4. Bump minor version if breaking

## Security Considerations

1. **Task ID Uniqueness**: UUID v4 prevents replay attacks
2. **Deadline Enforcement**: Prevents stale submissions
3. **Deterministic Verification**: Only verifiable tasks get full rewards
4. **Rate Limiting**: Pool should limit task requests per miner

## Files

- Pool: `zion-native/pool/src/ncl.rs`
- Miner: `zion-universal-miner/src/ncl/mod.rs`

---

*NCL Contract v1.0 - ZION TerraNova v2.9.5*
