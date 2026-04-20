# Error Handling（backend）

## 基本原则

- backend command 统一返回 `Result<T, String>`（当前项目约定）。
- 错误要可定位（定位到模块/动作/关键参数上下文）。
- 不允许 silent failure；失败必须返回可解释 message。

## Scenario: Tauri command / storage / process error

### 1. Scope / Trigger

- Trigger：新增或修改 `#[tauri::command]`、storage 读写、外部 process 调用、engine/runtime 边界。
- 这类错误会直接穿透到 frontend `src/services/tauri.ts`，因此 message contract 必须稳定、可读、可追踪。

### 2. Signatures

- Tauri command：`Result<T, String>`
- 内部 helper：可先返回 richer error，但在 command boundary 必须统一 normalize 成 `String`
- frontend 侧按 string message 消费，不依赖 backend 私有 error type

### 3. Contracts

- 返回消息至少包含：动作 + 对象 + 失败原因，例如 `failed to read settings: ...`
- message 可以带上下文，但不能泄露 secret/token/完整敏感内容
- 需要 retry 的操作必须保持 idempotent，避免半成功状态重复污染

### 4. Validation & Error Matrix

| 场景 | 正确处理 | 禁止处理 |
|---|---|---|
| 文件不存在 | 返回 default/fallback 或明确 not found message | `unwrap()` panic |
| JSON 解析失败 | 返回 parse failure message，必要时 fallback | 吞掉错误继续返回成功 |
| lock timeout | 返回 timeout + path context | 无限重试卡死 |
| 外部命令失败 | 附操作上下文返回 `Err(String)` | 只返回 `failed` |

### 5. Good / Base / Bad Cases

- Good：`map_err(|error| format!("failed to write settings: {error}"))`
- Base：读不存在文件时返回 default model
- Bad：`expect("write settings")`、`let _ = write_settings(...)`

### 6. Tests Required

- command happy path / error path
- IO error、parse error、timeout error
- frontend 依赖该 command 时，至少校验一条 message contract 不为空且可读

### 7. Wrong vs Correct

#### Wrong

```rust
let data = std::fs::read_to_string(path).unwrap();
let payload: Settings = serde_json::from_str(&data).unwrap();
Ok(payload)
```

#### Correct

```rust
let data = std::fs::read_to_string(path)
    .map_err(|error| format!("failed to read settings {}: {error}", path.display()))?;
let payload: Settings = serde_json::from_str(&data)
    .map_err(|error| format!("failed to parse settings {}: {error}", path.display()))?;
Ok(payload)
```

## 传播策略

- IO/serde/process 错误统一 `map_err(|e| e.to_string())` 并补充上下文。
- 对外 message 要稳定，不把内部敏感实现细节暴露给 UI。
- 对 retry-safe 操作，保持 idempotent 语义。

## 并发与锁相关错误

- 锁超时必须返回明确提示（例如 lock file timeout）。
- 遇到 stale lock 时按既有策略清理，不可直接 panic。
- `Mutex` 临界区最小化，避免在锁内执行重 IO 或长耗时操作。

## 禁止项

- `unwrap()` / `expect()` 出现在 runtime path。
- 直接吞掉 `Err` 后继续返回成功。
- 在跨层 contract 改动时只改一侧（backend/frontend 不一致）。

## 推荐实践

- 对 command 入口先做参数校验（validate first）。
- 对未知错误统一 normalize 后返回。
- 在测试里覆盖 error path（尤其是 IO/parse/timeout 场景）。

## Scenario: filesystem path segment 参数校验

### 1. Scope / Trigger

- Trigger：任意 `session_id`、文件名、目录名等用户/外部输入会被传入 `Path::join()`、删除、读取或归档逻辑。
- 这类参数必须先按单个 path segment 校验，再进入 IO；不能依赖 `Path::join()` 后的路径结果兜底。

### 2. Signatures

- validator：`fn is_invalid_*_path_segment(value: &str) -> bool`
- command/helper：校验失败统一返回 `Err(String)`，例如 `invalid session_id` 或带稳定 code 的 `[SESSION_NOT_FOUND] Invalid OpenCode session id`

### 3. Contracts

- 空字符串、`.`、包含 `/`、包含 `\`、包含 `..` 的值必须拒绝。
- 合法值只代表一个逻辑 id，不允许表达当前目录、父目录或嵌套路径。
- 删除类操作必须先校验所有 id，再执行任何 IO，避免部分删除。

### 4. Validation & Error Matrix

| 输入 | 正确处理 | 禁止处理 |
|---|---|---|
| `""` | 返回 required/empty error | 当作默认目录 |
| `"."` | 返回 invalid error | `root.join(".")` 后删除 root |
| `"../x"` / `"a/b"` / `"a\\b"` | 返回 invalid error | 尝试 canonicalize 后继续执行 |
| `"ses_valid"` | 进入正常 lookup/delete 流程 | 误判为路径注入 |

### 5. Good / Base / Bad Cases

- Good：`session_id == "." || session_id.contains('/') || session_id.contains('\\') || session_id.contains("..")`
- Base：`ses_abc123`、`codex:global` 这类逻辑 id 按既有业务规则继续处理。
- Bad：只校验 `/`、`\`、`..`，遗漏 `"."`。

### 6. Tests Required

- validator 单测覆盖 `""`、`.`、`../escape`、`folder/session`、`folder\\session`、合法 id。
- 删除/归档入口至少覆盖一个非法 path segment，断言没有执行文件删除副作用。

### 7. Wrong vs Correct

#### Wrong

```rust
if session_id.contains('/') || session_id.contains('\\') || session_id.contains("..") {
    return Err("invalid session_id".to_string());
}
let path = root.join(session_id);
```

#### Correct

```rust
fn is_invalid_session_path_segment(session_id: &str) -> bool {
    session_id == "."
        || session_id.contains('/')
        || session_id.contains('\\')
        || session_id.contains("..")
}

if session_id.is_empty() || is_invalid_session_path_segment(session_id) {
    return Err("invalid session_id".to_string());
}
let path = root.join(session_id);
```
