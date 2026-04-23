use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Instant;
use tauri::{AppHandle, State};

use super::{
    path_looks_like_codex_cli_computer_use_cache, resolve_computer_use_bridge_status,
    ComputerUseAvailabilityStatus, ComputerUseBlockedReason, ComputerUseBridgeStatus,
    COMPUTER_USE_BRIDGE_ENABLED,
};

const COMPUTER_USE_BROKER_RESULT_LIMIT: usize = 4_000;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComputerUseBrokerRequest {
    pub(crate) workspace_id: String,
    pub(crate) instruction: String,
    pub(crate) model: Option<String>,
    pub(crate) effort: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ComputerUseBrokerOutcome {
    Completed,
    Blocked,
    Failed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ComputerUseBrokerFailureKind {
    UnsupportedPlatform,
    BridgeUnavailable,
    BridgeBlocked,
    WorkspaceMissing,
    CodexRuntimeUnavailable,
    AlreadyRunning,
    InvalidInstruction,
    Timeout,
    CodexError,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComputerUseBrokerResult {
    pub(crate) outcome: ComputerUseBrokerOutcome,
    pub(crate) failure_kind: Option<ComputerUseBrokerFailureKind>,
    pub(crate) bridge_status: ComputerUseBridgeStatus,
    pub(crate) text: Option<String>,
    pub(crate) diagnostic_message: Option<String>,
    pub(crate) duration_ms: u64,
}

#[tauri::command]
pub(crate) async fn run_computer_use_codex_broker(
    app: AppHandle,
    state: State<'_, crate::state::AppState>,
    request: ComputerUseBrokerRequest,
) -> Result<ComputerUseBrokerResult, String> {
    let started_at = Instant::now();
    let instruction = request.instruction.trim().to_string();
    let activation_verification = state
        .computer_use_activation_verification
        .lock()
        .await
        .clone();
    let bridge_status = tokio::task::spawn_blocking(move || {
        resolve_computer_use_bridge_status(activation_verification.as_ref())
    })
    .await
    .map_err(|error| format!("failed to join computer use broker preflight task: {error}"))?;

    if let Some(failure_kind) = evaluate_broker_gate(&bridge_status, &instruction) {
        return Ok(build_broker_result(
            broker_outcome_for_failure(failure_kind),
            Some(failure_kind),
            bridge_status,
            None,
            Some(broker_failure_message(failure_kind).to_string()),
            started_at.elapsed().as_millis() as u64,
        ));
    }

    if !workspace_exists(&state, &request.workspace_id).await {
        return Ok(build_broker_result(
            ComputerUseBrokerOutcome::Failed,
            Some(ComputerUseBrokerFailureKind::WorkspaceMissing),
            bridge_status,
            None,
            Some("Computer Use broker workspace was not found.".to_string()),
            started_at.elapsed().as_millis() as u64,
        ));
    }

    let _broker_guard = match state.computer_use_activation_lock.try_lock() {
        Ok(guard) => guard,
        Err(_) => {
            return Ok(build_broker_result(
                ComputerUseBrokerOutcome::Failed,
                Some(ComputerUseBrokerFailureKind::AlreadyRunning),
                bridge_status,
                None,
                Some(
                    "Another Computer Use investigation or broker run is already running."
                        .to_string(),
                ),
                started_at.elapsed().as_millis() as u64,
            ));
        }
    };

    let broker_prompt = build_codex_broker_prompt(&instruction);
    let broker_result = crate::engine::codex_prompt_service::run_codex_prompt_sync(
        &request.workspace_id,
        &broker_prompt,
        request.model,
        request.effort,
        Some("read-only".to_string()),
        None,
        &app,
        &state,
    )
    .await;

    match broker_result {
        Ok(text) => Ok(build_broker_result(
            ComputerUseBrokerOutcome::Completed,
            None,
            bridge_status,
            bounded_broker_text(text),
            Some("Computer Use task completed through the official Codex runtime.".to_string()),
            started_at.elapsed().as_millis() as u64,
        )),
        Err(error) => Ok(build_broker_result(
            ComputerUseBrokerOutcome::Failed,
            Some(classify_broker_codex_error(&error)),
            bridge_status,
            None,
            Some(error),
            started_at.elapsed().as_millis() as u64,
        )),
    }
}

fn evaluate_broker_gate(
    status: &ComputerUseBridgeStatus,
    instruction: &str,
) -> Option<ComputerUseBrokerFailureKind> {
    if instruction.trim().is_empty() {
        return Some(ComputerUseBrokerFailureKind::InvalidInstruction);
    }

    if !COMPUTER_USE_BRIDGE_ENABLED {
        return Some(ComputerUseBrokerFailureKind::BridgeUnavailable);
    }

    if status.platform != "macos" || status.status == ComputerUseAvailabilityStatus::Unsupported {
        return Some(ComputerUseBrokerFailureKind::UnsupportedPlatform);
    }

    if status.status == ComputerUseAvailabilityStatus::Unavailable
        || !status.plugin_detected
        || !status.plugin_enabled
        || status.helper_path.is_none()
        || status.helper_descriptor_path.is_none()
    {
        return Some(ComputerUseBrokerFailureKind::BridgeUnavailable);
    }

    let uses_cli_cache_contract = status
        .helper_path
        .as_deref()
        .map(Path::new)
        .is_some_and(path_looks_like_codex_cli_computer_use_cache)
        && status
            .helper_descriptor_path
            .as_deref()
            .map(Path::new)
            .is_some_and(path_looks_like_codex_cli_computer_use_cache);
    if !uses_cli_cache_contract {
        return Some(ComputerUseBrokerFailureKind::BridgeBlocked);
    }

    if status
        .blocked_reasons
        .contains(&ComputerUseBlockedReason::HelperBridgeUnverified)
    {
        return Some(ComputerUseBrokerFailureKind::BridgeBlocked);
    }

    let has_hard_blocker = status.blocked_reasons.iter().any(|reason| {
        !matches!(
            reason,
            ComputerUseBlockedReason::PermissionRequired
                | ComputerUseBlockedReason::ApprovalRequired
        )
    });
    if has_hard_blocker {
        return Some(ComputerUseBrokerFailureKind::BridgeBlocked);
    }

    None
}

fn broker_outcome_for_failure(
    failure_kind: ComputerUseBrokerFailureKind,
) -> ComputerUseBrokerOutcome {
    match failure_kind {
        ComputerUseBrokerFailureKind::BridgeUnavailable
        | ComputerUseBrokerFailureKind::BridgeBlocked
        | ComputerUseBrokerFailureKind::UnsupportedPlatform => ComputerUseBrokerOutcome::Blocked,
        _ => ComputerUseBrokerOutcome::Failed,
    }
}

fn broker_failure_message(failure_kind: ComputerUseBrokerFailureKind) -> &'static str {
    match failure_kind {
        ComputerUseBrokerFailureKind::UnsupportedPlatform => {
            "Computer Use broker is only available on macOS."
        }
        ComputerUseBrokerFailureKind::BridgeUnavailable => {
            "Computer Use broker prerequisites are unavailable."
        }
        ComputerUseBrokerFailureKind::BridgeBlocked => {
            "Computer Use broker is blocked until the CLI helper bridge is verified."
        }
        ComputerUseBrokerFailureKind::WorkspaceMissing => {
            "Computer Use broker workspace was not found."
        }
        ComputerUseBrokerFailureKind::CodexRuntimeUnavailable => {
            "Codex runtime is unavailable for Computer Use broker."
        }
        ComputerUseBrokerFailureKind::AlreadyRunning => {
            "Another Computer Use broker run is already running."
        }
        ComputerUseBrokerFailureKind::InvalidInstruction => {
            "Computer Use broker instruction cannot be empty."
        }
        ComputerUseBrokerFailureKind::Timeout => "Computer Use broker timed out.",
        ComputerUseBrokerFailureKind::CodexError => {
            "Codex returned an error for Computer Use broker."
        }
        ComputerUseBrokerFailureKind::Unknown => {
            "Computer Use broker ended in an unexpected state."
        }
    }
}

async fn workspace_exists(state: &crate::state::AppState, workspace_id: &str) -> bool {
    let trimmed = workspace_id.trim();
    if trimmed.is_empty() {
        return false;
    }

    let workspaces = state.workspaces.lock().await;
    workspaces.contains_key(trimmed)
}

fn build_codex_broker_prompt(instruction: &str) -> String {
    format!(
        r#"You are running inside the official Codex runtime with the official Computer Use plugin available when this host is authorized.

This is an explicit user-requested Computer Use task from mossx.

Task:
"""
{instruction}
"""

Use the official Computer Use tools only if they are needed to inspect or operate desktop apps. Do not edit repository files unless the task explicitly asks for file changes. If macOS permissions or app approvals are missing, report the exact blocker and stop. Finish with a concise summary of what you did and the observed result."#
    )
}

fn bounded_broker_text(text: String) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.len() <= COMPUTER_USE_BROKER_RESULT_LIMIT {
        return Some(trimmed.to_string());
    }

    let mut bounded = trimmed
        .chars()
        .take(COMPUTER_USE_BROKER_RESULT_LIMIT)
        .collect::<String>();
    bounded.push_str("...");
    Some(bounded)
}

fn classify_broker_codex_error(error: &str) -> ComputerUseBrokerFailureKind {
    let normalized = error.to_ascii_lowercase();
    if normalized.contains("timeout") || normalized.contains("timed out") {
        return ComputerUseBrokerFailureKind::Timeout;
    }
    if normalized.contains("workspace") && normalized.contains("not found") {
        return ComputerUseBrokerFailureKind::WorkspaceMissing;
    }
    if normalized.contains("codex") || normalized.contains("runtime") {
        return ComputerUseBrokerFailureKind::CodexRuntimeUnavailable;
    }
    ComputerUseBrokerFailureKind::CodexError
}

fn build_broker_result(
    outcome: ComputerUseBrokerOutcome,
    failure_kind: Option<ComputerUseBrokerFailureKind>,
    bridge_status: ComputerUseBridgeStatus,
    text: Option<String>,
    diagnostic_message: Option<String>,
    duration_ms: u64,
) -> ComputerUseBrokerResult {
    ComputerUseBrokerResult {
        outcome,
        failure_kind,
        bridge_status,
        text,
        diagnostic_message,
        duration_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::computer_use::{ComputerUseAvailabilityStatus, ComputerUseGuidanceCode};

    fn blocked_bridge_status(
        blocked_reasons: Vec<ComputerUseBlockedReason>,
    ) -> ComputerUseBridgeStatus {
        ComputerUseBridgeStatus {
            feature_enabled: true,
            activation_enabled: true,
            status: if blocked_reasons.is_empty() {
                ComputerUseAvailabilityStatus::Ready
            } else {
                ComputerUseAvailabilityStatus::Blocked
            },
            platform: "macos".to_string(),
            codex_app_detected: true,
            plugin_detected: true,
            plugin_enabled: true,
            blocked_reasons,
            guidance_codes: Vec::<ComputerUseGuidanceCode>::new(),
            codex_config_path: Some("/Users/demo/.codex/config.toml".to_string()),
            plugin_manifest_path: Some(
                "/Users/demo/.codex/plugins/cache/openai-bundled/computer-use/1/.codex-plugin/plugin.json"
                    .to_string(),
            ),
            helper_path: Some(
                "/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
                    .to_string(),
            ),
            helper_descriptor_path: Some(
                "/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/.mcp.json"
                    .to_string(),
            ),
            marketplace_path: None,
            diagnostic_message: None,
        }
    }

    fn broker_ready_cli_cache_status(
        blocked_reasons: Vec<ComputerUseBlockedReason>,
    ) -> ComputerUseBridgeStatus {
        ComputerUseBridgeStatus {
            helper_path: Some(
                "/Users/demo/.codex/plugins/cache/openai-bundled/computer-use/1.0.755/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
                    .to_string(),
            ),
            helper_descriptor_path: Some(
                "/Users/demo/.codex/plugins/cache/openai-bundled/computer-use/1.0.755/.mcp.json"
                    .to_string(),
            ),
            ..blocked_bridge_status(blocked_reasons)
        }
    }

    #[test]
    fn broker_gate_allows_cli_cache_with_manual_permission_blockers() {
        let status = broker_ready_cli_cache_status(vec![
            ComputerUseBlockedReason::PermissionRequired,
            ComputerUseBlockedReason::ApprovalRequired,
        ]);

        assert_eq!(evaluate_broker_gate(&status, "open Safari"), None);
    }

    #[test]
    fn broker_gate_rejects_empty_instruction_and_unverified_helper() {
        let status = broker_ready_cli_cache_status(Vec::new());
        assert_eq!(
            evaluate_broker_gate(&status, "   "),
            Some(ComputerUseBrokerFailureKind::InvalidInstruction)
        );

        let blocked_status =
            broker_ready_cli_cache_status(vec![ComputerUseBlockedReason::HelperBridgeUnverified]);
        assert_eq!(
            evaluate_broker_gate(&blocked_status, "open Safari"),
            Some(ComputerUseBrokerFailureKind::BridgeBlocked)
        );
    }

    #[test]
    fn broker_gate_rejects_non_cli_cache_helper_contract() {
        let status = blocked_bridge_status(Vec::new());

        assert_eq!(
            evaluate_broker_gate(&status, "open Safari"),
            Some(ComputerUseBrokerFailureKind::BridgeBlocked)
        );
    }

    #[test]
    fn broker_text_is_bounded_and_trimmed() {
        assert_eq!(
            bounded_broker_text("  done  ".to_string()),
            Some("done".to_string())
        );
        assert_eq!(bounded_broker_text("   ".to_string()), None);

        let oversized = "a".repeat(COMPUTER_USE_BROKER_RESULT_LIMIT + 5);
        let bounded = bounded_broker_text(oversized).expect("bounded text");
        assert!(bounded.ends_with("..."));
        assert_eq!(
            bounded.chars().count(),
            COMPUTER_USE_BROKER_RESULT_LIMIT + 3
        );
    }
}
