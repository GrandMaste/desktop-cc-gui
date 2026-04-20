## 1. P0 Runtime Recovery Guard

- [ ] 1.1 [P0][Input: current `runtime_manager`, `ensure_codex_session`, workspace reconnect flows][Output: shared recovery guard keyed by `workspace + engine` with retry budget, backoff, and quarantine state][Verify: Rust unit tests cover repeated acquire/reconnect failure, budget exhaustion, cooldown entry, and success reset] 在 runtime 层建立统一的 bounded recovery guard。
- [ ] 1.2 [P0][Depends: 1.1][Input: current `send` / `resume` / `new thread` / reconnect entry points][Output: runtime-dependent actions routed through shared recovery guard instead of scattered retry logic][Verify: targeted Rust/frontend regression proves all high-risk entry points consume the same guard state] 将高风险 runtime-dependent action 接入共享恢复守卫。

## 2. P0 Structured Diagnostics And Lifecycle Exit

- [ ] 2.1 [P0][Input: current runtime/session error strings and pseudo-processing exit logic][Output: structured stability diagnostic categories for early runtime end, connectivity drift, partial history, and recovery quarantine][Verify: frontend/reducer tests assert threads leave processing deterministically and surface stable diagnostic category] 补齐结构化 stability diagnostics 并清理 pseudo-processing 残留。
- [ ] 2.2 [P0][Depends: 2.1][Input: current thread action / reopen / post-rewind follow-up error handling][Output: recoverable diagnostics visible to user-facing lifecycle surfaces][Verify: regression covers runtime end during turn, reconnect failure, and post-rewind follow-up failure] 让异常恢复链路都能落到统一的用户可见诊断承接。

## 3. P0 Last-Good Continuity For List And History

- [ ] 3.1 [P0][Input: current thread list refresh and reopen/history loaders][Output: last-good snapshot fallback with explicit degraded markers][Verify: component/loader tests assert failed refresh keeps prior visible state instead of empty replacement] 为 thread list 和 history/reopen 增加 last-good continuity。
- [ ] 3.2 [P0][Depends: 3.1][Input: existing partial source and history reload behavior][Output: degraded copy that explains stale/partial state without masquerading as fresh truth][Verify: UI tests assert degraded banner/copy renders when partial or stale fallback is active] 为 degraded/partial 状态补 explainability copy 与前端承接。

## 4. P1 Evidence Path Hardening

- [ ] 4.1 [P1][Input: `runtime_log_*`, renderer diagnostics, `diagnostics.threadSessionLog`][Output: shared correlation fields (`workspaceId`, `engine`, `threadId`, `action`, `recoveryState`) across existing logs][Verify: unit tests or fixture assertions prove the same failure chain can be correlated across runtime and frontend diagnostics] 统一现有 diagnostics 的关联字段。
- [ ] 4.2 [P1][Depends: 4.1][Input: current runtime-log and debug surfaces][Output: minimal operator path for inspecting one failure chain without new incident store][Verify: manual check can retrieve correlated evidence for one failed workspace/thread scenario] 让已有调试入口可串起一次完整故障证据链。

## 5. P1 Verification And Stress Validation

- [ ] 5.1 [P0][Input: updated runtime, loader, reducer, and diagnostics tests][Output: passing targeted regression suite for recovery guard, degraded continuity, and diagnostics mapping][Verify: `cargo test --manifest-path src-tauri/Cargo.toml`, targeted `vitest` for thread actions/loaders/debug hooks] 跑定向自动化回归。
- [ ] 5.2 [P1][Depends: 5.1][Input: integrated local desktop build][Output: manual proof for “failure -> reopen/rewind/new thread” chain without CPU storm][Verify: 手工验证至少覆盖会话提前结束、reconnect 连续失败、history partial、失败后立即新建对话四类场景] 完成一次本地 stress 验证并记录结果。
