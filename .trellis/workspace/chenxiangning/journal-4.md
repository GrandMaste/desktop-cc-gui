# Journal - chenxiangning (Part 4)

> Continuation from `journal-3.md` (archived at ~2000 lines)
> Started: 2026-04-22

---



## Session 102: 新增 Claude 桌面流式慢体验修复提案

**Date**: 2026-04-22
**Task**: 新增 Claude 桌面流式慢体验修复提案
**Branch**: `feature/v-0.4.7`

### Summary

(Add summary)

### Main Changes

任务目标:
- 针对 issue #399 落一个 OpenSpec 修复提案，明确是否需要修、修复边界、实现顺序与验证方式。

主要改动:
- 新建 openspec/changes/fix-qwen-desktop-streaming-latency change。
- 编写 proposal，明确该问题属于 provider/platform 相关的流式慢体验，不按全局性能大重构处理。
- 编写 design，确定“诊断先行 + provider-scoped mitigation”的技术路线。
- 新增 conversation-stream-latency-diagnostics 与 conversation-provider-stream-mitigation 两条 delta specs。
- 编写 tasks，拆分 diagnostics、provider fingerprint、mitigation profile 与验证步骤。

涉及模块:
- openspec/changes/fix-qwen-desktop-streaming-latency/proposal.md
- openspec/changes/fix-qwen-desktop-streaming-latency/design.md
- openspec/changes/fix-qwen-desktop-streaming-latency/specs/conversation-stream-latency-diagnostics/spec.md
- openspec/changes/fix-qwen-desktop-streaming-latency/specs/conversation-provider-stream-mitigation/spec.md
- openspec/changes/fix-qwen-desktop-streaming-latency/tasks.md

验证结果:
- openspec status --change fix-qwen-desktop-streaming-latency 显示 4/4 artifacts complete。
- openspec validate fix-qwen-desktop-streaming-latency --type change --strict --no-interactive 通过。
- 本次仅提交 OpenSpec artifacts，未混入工作区其他未提交实现改动。

后续事项:
- 按 tasks 先补 stream latency diagnostics，再实现 provider-scoped mitigation。
- 若后续需要把 change 名称从 qwen 收敛为更通用的 claude/provider 语义，可在实现前再评估是否 rename。


### Git Commits

| Hash | Message |
|------|---------|
| `16a34090253c0409803301c960f585681917c7ee` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 103: docs(openspec): 回写并归档实时 markdown streaming 兼容性提案

**Date**: 2026-04-22
**Task**: docs(openspec): 回写并归档实时 markdown streaming 兼容性提案
**Branch**: `feature/v-0.4.7`

### Summary

(Add summary)

### Main Changes

任务目标：将 fix-live-inline-code-markdown-rendering 的 delta spec 回写到主 specs，并将该 change 归档，完成 OpenSpec 层面的最终收口。

主要改动：
- 新增主 spec `openspec/specs/message-markdown-streaming-compatibility/spec.md`
- 将 `fix-live-inline-code-markdown-rendering` 从活跃 change 目录归档到 `openspec/changes/archive/2026-04-22-fix-live-inline-code-markdown-rendering/`
- 保留 proposal、design、tasks 和 delta spec，形成可追溯 archive

涉及模块：
- OpenSpec 主 specs
- OpenSpec archive changes

验证结果：
- `openspec list --changes` 中已不再显示 `fix-live-inline-code-markdown-rendering`
- 主 spec 文件已存在并包含 4 条正式 requirement
- 归档目录已存在并包含 proposal/design/tasks/specs

后续事项：
- 本次仅提交 OpenSpec 回写与归档，不包含其他未提交工作区改动
- 如需继续推进，可后续单独整理 qwen latency 等其他变更边界


### Git Commits

| Hash | Message |
|------|---------|
| `cd332b84` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 104: 补齐 Claude 流式延迟诊断并启用定向缓解

**Date**: 2026-04-22
**Task**: 补齐 Claude 流式延迟诊断并启用定向缓解
**Branch**: `feature/v-0.4.7`

### Summary

(Add summary)

### Main Changes

任务目标:
- 为 Claude 桌面流式慢体验补齐可关联的 per-thread latency diagnostics，并在命中特定 provider/platform 指纹时启用更激进的渲染缓解。

主要改动:
- 新增 src/features/threads/utils/streamLatencyDiagnostics.ts，统一维护 thread 级流式延迟快照、provider 指纹、platform 判定、延迟分类与 mitigation profile 解析。
- 在线程发送、turn start、首个 delta、首个可见 render、turn completed/error 等链路记录 first token、chunk cadence、render lag 相关证据，并输出 upstream-pending / render-amplification 诊断。
- 在 Messages / MessagesTimeline 渲染链路下传 stream mitigation profile，让命中 Qwen-compatible Claude provider + Windows 的路径动态提高 assistant/reasoning markdown 的 streaming throttle。
- 补充 streamLatencyDiagnostics、MessagesRows.stream-mitigation、useThreadEventHandlers 的测试覆盖，验证 provider 命中、未命中、等待首个 delta 与完成态关联维度。

涉及模块:
- src/features/threads/utils/streamLatencyDiagnostics.ts
- src/features/threads/utils/streamLatencyDiagnostics.test.ts
- src/features/threads/hooks/threadMessagingHelpers.ts
- src/features/threads/hooks/useThreadMessaging.ts
- src/features/threads/hooks/useThreadEventHandlers.ts
- src/features/threads/hooks/useThreadEventHandlers.test.ts
- src/features/messages/components/Messages.tsx
- src/features/messages/components/MessagesTimeline.tsx
- src/features/messages/components/MessagesRows.stream-mitigation.test.tsx

验证结果:
- 本次未额外运行 lint/typecheck/test；仅完成代码提交与范围核对。
- 提交范围已排除 CHANGELOG、settingsViewConstants、markdownCodeRegions.test.ts 以及其他未完成 OpenSpec 草稿，避免混入无关改动。

后续事项:
- 如需交付前闭环，建议继续运行针对性 Vitest 以及基础质量门禁。
- 当前 active task 仍显示 fix-live-inline-code-markdown-rendering，后续可视情况整理任务指向，减少 record 与实际实现主题的偏移。


### Git Commits

| Hash | Message |
|------|---------|
| `9d16c31953ae2e48919e6da91c6062abe1c8295d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 105: Add codex computer use plugin bridge change

**Date**: 2026-04-22
**Task**: Add codex computer use plugin bridge change
**Branch**: `feature/v-0.4.7`

### Summary

(Add summary)

### Main Changes

任务目标：为 Codex Computer Use plugin bridge 创建完整 OpenSpec 提案，限定为独立模块、最小侵入、可插拔、macOS/Windows 分治，并明确当前阶段为 status-only bridge。

主要改动：
- 新建 OpenSpec change `add-codex-computer-use-plugin-bridge`
- 完成 proposal、design、3 份 capability specs 与 tasks
- 根据提案审查结果回填 Phase 1 边界，明确本期不包含 helper invoke
- 固化 availability status 优先级与最小 blockedReasons contract

涉及模块：
- openspec/changes/add-codex-computer-use-plugin-bridge/proposal.md
- openspec/changes/add-codex-computer-use-plugin-bridge/design.md
- openspec/changes/add-codex-computer-use-plugin-bridge/specs/codex-computer-use-plugin-bridge/spec.md
- openspec/changes/add-codex-computer-use-plugin-bridge/specs/computer-use-platform-adapter/spec.md
- openspec/changes/add-codex-computer-use-plugin-bridge/specs/computer-use-availability-surface/spec.md
- openspec/changes/add-codex-computer-use-plugin-bridge/tasks.md

验证结果：
- `openspec status --change add-codex-computer-use-plugin-bridge --json` 返回 `isComplete: true`
- proposal/design/specs/tasks 四个 artifacts 全部为 `done`
- 本次未执行 lint/typecheck/test，因为只提交 OpenSpec 文档

后续事项：
- 下一阶段可进入 `openspec-apply-change`
- 建议从 backend status model、platform adapter、availability surface 开始实现
- helper invoke 需在后续独立 phase 验证宿主桥接性后再议


### Git Commits

| Hash | Message |
|------|---------|
| `e8933fdd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 106: fix(notifications): 收紧运行时提示悬浮点右下角定位

**Date**: 2026-04-22
**Task**: fix(notifications): 收紧运行时提示悬浮点右下角定位
**Branch**: `feature/v-0.4.7`

### Summary

(Add summary)

### Main Changes

任务目标：将右下角运行时提示悬浮点进一步贴近窗口右下角。
主要改动：调整 global-runtime-notice-dock-shell 的 right/bottom 定位偏移，从 20px 收紧到 4px，并保留 safe-area 计算。
涉及模块：src/styles/global-runtime-notice-dock.css（notifications 全局悬浮提示样式）。
验证结果：已检查业务提交仅包含该 CSS 文件 diff；未运行 lint/test，本次为纯样式定位微调。
后续事项：如需更激进的贴边效果，可继续评估 0px + safe-area 或同步优化展开面板贴角展开体验。


### Git Commits

| Hash | Message |
|------|---------|
| `74fbc0bb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 107: 完成 Computer Use Phase 1 状态桥接实现

**Date**: 2026-04-22
**Task**: 完成 Computer Use Phase 1 状态桥接实现
**Branch**: `feature/v-0.4.7`

### Summary

(Add summary)

### Main Changes

## 任务目标
- 执行 OpenSpec change `add-codex-computer-use-plugin-bridge`
- 完成 Phase 1 status-only bridge，实现对本机官方 Codex Computer Use 安装状态的只读探测与设置页可见面板

## 主要改动
- 新增 Rust `src-tauri/src/computer_use/**` 模块，提供 status model、platform dispatch、macOS/Windows adapter 与 `get_computer_use_bridge_status` command
- 新增前端 `src/features/computer-use/**` feature、`src/services/tauri/computerUse.ts` bridge、`src/types.ts` contract 与 settings surface
- 修复 `.mcp.json` helper 相对路径解析，按 `descriptor dir + cwd` 解析真实 helper 二进制路径，避免误报 `helper missing`
- 同步 OpenSpec artifacts 与 `.trellis/spec/backend|frontend/computer-use-bridge.md` code-spec 契约
- 补充 blocked / unsupported UI 与 helper path regression tests

## 涉及模块
- backend: `src-tauri/src/computer_use/**`, `src-tauri/src/command_registry.rs`, `src-tauri/src/lib.rs`
- frontend: `src/features/computer-use/**`, `src/services/tauri.ts`, `src/services/tauri.test.ts`, `src/services/tauri/computerUse.ts`, `src/types.ts`
- settings/i18n: `src/features/settings/components/settings-view/sections/CodexSection.tsx`, `src/features/settings/components/settings-view/settingsViewConstants.ts`, `src/i18n/locales/en.part1.ts`, `src/i18n/locales/zh.part1.ts`
- specs: `openspec/changes/add-codex-computer-use-plugin-bridge/**`, `.trellis/spec/backend/computer-use-bridge.md`, `.trellis/spec/frontend/computer-use-bridge.md`

## 验证结果
- `npm run lint` 通过（仅有现存 warning）
- `npm run typecheck` 通过
- `npm run test` 通过
- `cargo test --manifest-path src-tauri/Cargo.toml` 通过
- `cargo test --manifest-path src-tauri/Cargo.toml computer_use -- --nocapture` 通过
- `npx vitest run src/features/computer-use/components/ComputerUseStatusCard.test.tsx` 通过
- `macOS` 实机验证：状态为预期内的 `blocked`，helper 路径解析正确

## 后续事项
- `E.3` 仍保留 1 个 blocker：缺少 Windows 真机 `unsupported` 验证
- 工作区仍存在与本次提交无关的未提交改动，后续需要分开处理


### Git Commits

| Hash | Message |
|------|---------|
| `7cbf1f60` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 108: 修复 OpenCode 自动探测抖动

**Date**: 2026-04-22
**Task**: 修复 OpenCode 自动探测抖动
**Branch**: `feature/v-0.4.7`

### Summary

(Add summary)

### Main Changes

任务目标：收敛 OpenCode 在 sidebar 菜单打开、菜单常驻与 Claude 模型刷新路径上的自动探测，避免后台反复拉起 opencode CLI 导致 CPU 抖动与菜单长时间停留在检测态。

主要改动：
- 移除 useSidebarMenus 在菜单打开和 rerender 期间的自动 provider health probe，仅保留用户显式 refresh 时的探测路径。
- 调整 useEngineController 的刷新策略，新增 engine-scoped model refresh，避免 Claude-only 刷新放大成 all-engine detection。
- 更新 Sidebar 刷新按钮事件处理，确保手动刷新行为稳定且不会误触菜单关闭。
- 同步补齐 useSidebarMenus、useEngineController、Sidebar 相关前端回归测试。
- 新增并同步提交 OpenSpec change：fix-opencode-auto-probe-churn。

涉及模块：
- src/features/app/hooks/useSidebarMenus.ts
- src/features/engine/hooks/useEngineController.ts
- src/features/app/components/Sidebar.tsx
- src/app-shell.tsx
- openspec/changes/fix-opencode-auto-probe-churn/

验证结果：
- 本次回合未额外执行 lint / typecheck / test；提交依据是当前工作区现有实现与测试改动分组结果。

后续事项：
- 后续可补跑 targeted frontend tests 与质量门禁，确认 manual refresh-only 行为在完整测试矩阵下无回退。


### Git Commits

| Hash | Message |
|------|---------|
| `f3448982` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
