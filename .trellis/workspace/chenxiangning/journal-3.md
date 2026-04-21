# Journal - chenxiangning (Part 3)

> Continuation from `journal-2.md` (archived at ~2000 lines)
> Started: 2026-04-21

---



## Session 69: 加固 Codex runtime 异常退出恢复链路

**Date**: 2026-04-21
**Task**: 加固 Codex runtime 异常退出恢复链路
**Branch**: `feature/f-v0.4.6`

### Summary

(Add summary)

### Main Changes

任务目标：对当前工作区进行全面 review，重点检查 runtime recovery 相关改动在边界条件、异常输入、大文件治理和 Windows/macOS 兼容性上的完整性，并直接修复发现的问题后提交。

主要改动：
- 为 Codex runtime 异常退出链路补齐 OpenSpec 变更与后端模块拆分，新增 runtime lifecycle / plan enforcement 模块。
- 在 Rust runtime pool 中记录 active work protection、last exit diagnostics、pending request count，并在 runtime ended / manual release 等场景下正确清理 lease 与状态。
- 在前端 useAppServerEvents 中完善 runtime/ended 事件处理，支持仅凭 affectedActiveTurns 做线程 teardown，并把 pendingRequestCount 归一化为非负整数。
- 在 Runtime Pool Console 与消息恢复卡片中补齐 runtime ended 诊断展示及中英文文案。
- 新增/更新前端与 Rust 定向测试，覆盖 runtime ended、共享线程映射、恢复提示与稳定性诊断。
- 将 runtime ledger 原子写实现对齐项目现有 storage 模式，降低 Windows 文件替换失败时的残留临时文件风险。

涉及模块：
- src-tauri/src/backend/app_server*.rs
- src-tauri/src/runtime/mod.rs
- src/features/app/hooks/useAppServerEvents*
- src/features/messages/components/RuntimeReconnectCard.tsx
- src/features/settings/components/settings-view/sections/RuntimePoolSection.tsx
- src/features/threads/utils/stabilityDiagnostics*
- src/i18n/locales/en.part1.ts
- src/i18n/locales/zh.part1.ts
- openspec/changes/harden-codex-runtime-exit-recovery/**

验证结果：
- npm run typecheck 通过。
- npm run check:runtime-contracts 通过。
- npm run check:large-files 通过，未新增超过 3000 行文件。
- npx vitest run src/features/app/hooks/useAppServerEvents.test.tsx src/features/app/hooks/useAppServerEvents.runtime-ended.test.tsx src/features/messages/components/Messages.runtime-reconnect.test.tsx src/features/threads/utils/stabilityDiagnostics.test.ts 通过（70 tests）。
- cargo test --manifest-path src-tauri/Cargo.toml runtime_ended 通过。
- npm run lint 通过，但仓库内仍存在既有 react-hooks/exhaustive-deps warnings，本次未新增 lint error。

后续事项：
- app_server 模块拆分后，auto-compaction 触发链仍被临时禁用，当前保留手动 compact 路径，后续若恢复自动 compact 需单独补 capability 回归测试。
- 这次录入了新的 OpenSpec change，后续如继续推进该链路，建议补充 validate/sync/archive 流程。


### Git Commits

| Hash | Message |
|------|---------|
| `d34a18547b1b0dd957eeb1dcc2fc94f0c8c85bed` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
