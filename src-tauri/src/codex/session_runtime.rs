use super::*;
use crate::runtime::RuntimeAcquireGate;
use tauri::AppHandle;
use tokio::time::Duration;

const SESSION_HEALTH_PROBE_TIMEOUT_SECS: u64 = 3;

async fn reuse_existing_session_if_healthy<FProbe, FutProbe, FTouch, FutTouch, FStop, FutStop>(
    workspace_id: &str,
    probe: FProbe,
    touch: FTouch,
    stop: FStop,
) -> bool
where
    FProbe: FnOnce() -> FutProbe,
    FutProbe: std::future::Future<Output = Result<(), String>>,
    FTouch: FnOnce() -> FutTouch,
    FutTouch: std::future::Future<Output = ()>,
    FStop: FnOnce() -> FutStop,
    FutStop: std::future::Future<Output = Result<(), String>>,
{
    match probe().await {
        Ok(()) => {
            touch().await;
            true
        }
        Err(error) => {
            log::warn!(
                "[ensure_codex_session] stale session detected for workspace {}: {}",
                workspace_id,
                error
            );
            if let Err(stop_error) = stop().await {
                log::warn!(
                    "[ensure_codex_session] failed to stop stale session for workspace {}: {}",
                    workspace_id,
                    stop_error
                );
            }
            false
        }
    }
}

/// Ensure a Codex session exists for the workspace. If not, spawn one.
/// This is called before sending messages to handle the case where user
/// switches from Claude to Codex engine without reconnecting the workspace.
pub(crate) async fn ensure_codex_session(
    workspace_id: &str,
    state: &AppState,
    app: &AppHandle,
) -> Result<(), String> {
    loop {
        let existing_session = {
            let sessions = state.sessions.lock().await;
            sessions.get(workspace_id).cloned()
        };
        if let Some(session) = existing_session {
            if reuse_existing_session_if_healthy(
                workspace_id,
                || session.probe_health(Duration::from_secs(SESSION_HEALTH_PROBE_TIMEOUT_SECS)),
                || async {
                    state
                        .runtime_manager
                        .touch("codex", workspace_id, "ensure-runtime-ready")
                        .await;
                },
                || async {
                    crate::runtime::stop_workspace_session(
                        &state.sessions,
                        &state.runtime_manager,
                        workspace_id,
                    )
                    .await
                },
            )
            .await
            {
                return Ok(());
            }
        }

        match state
            .runtime_manager
            .begin_runtime_acquire("codex", workspace_id)
            .await
        {
            RuntimeAcquireGate::Leader => break,
            RuntimeAcquireGate::Waiter(notify) => notify.notified().await,
        }
    }

    log::info!(
        "[ensure_codex_session] No session for workspace {}, spawning new Codex session",
        workspace_id
    );

    let (entry, parent_entry) = {
        let workspaces = state.workspaces.lock().await;
        let entry = workspaces
            .get(workspace_id)
            .cloned()
            .ok_or_else(|| "workspace not found".to_string())?;
        let parent_entry = entry
            .parent_id
            .as_ref()
            .and_then(|pid| workspaces.get(pid).cloned());
        (entry, parent_entry)
    };

    let (default_bin, codex_args) = {
        let settings = state.app_settings.lock().await;
        (
            settings.codex_bin.clone(),
            resolve_workspace_codex_args(&entry, parent_entry.as_ref(), Some(&settings)),
        )
    };

    let codex_home = resolve_workspace_codex_home(&entry, parent_entry.as_ref());
    let mode_enforcement_enabled = {
        let settings = state.app_settings.lock().await;
        settings.codex_mode_enforcement_enabled
    };

    state
        .runtime_manager
        .record_starting(&entry, "codex", "ensure-runtime-ready")
        .await;

    let spawn_result = spawn_workspace_session(
        entry.clone(),
        default_bin,
        codex_args,
        app.clone(),
        codex_home,
    )
    .await;
    let session = match spawn_result {
        Ok(session) => session,
        Err(error) => {
            state
                .runtime_manager
                .record_failure(&entry, "codex", "ensure-runtime-ready", error.clone())
                .await;
            state
                .runtime_manager
                .finish_runtime_acquire("codex", workspace_id)
                .await;
            return Err(error);
        }
    };
    session.set_mode_enforcement_enabled(mode_enforcement_enabled);
    session.attach_runtime_manager(state.runtime_manager.clone());
    let replace_result = crate::runtime::replace_workspace_session(
        &state.sessions,
        Some(&state.runtime_manager),
        entry.id,
        session,
        "ensure-runtime-ready",
    )
    .await;
    state
        .runtime_manager
        .finish_runtime_acquire("codex", workspace_id)
        .await;
    replace_result
}

#[cfg(test)]
mod tests {
    use super::reuse_existing_session_if_healthy;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    #[tokio::test]
    async fn reuses_existing_session_when_probe_succeeds() {
        let touched = Arc::new(AtomicBool::new(false));
        let stopped = Arc::new(AtomicBool::new(false));

        let reused = reuse_existing_session_if_healthy(
            "ws-1",
            || async { Ok(()) },
            {
                let touched = Arc::clone(&touched);
                move || async move {
                    touched.store(true, Ordering::SeqCst);
                }
            },
            {
                let stopped = Arc::clone(&stopped);
                move || async move {
                    stopped.store(true, Ordering::SeqCst);
                    Ok(())
                }
            },
        )
        .await;

        assert!(reused);
        assert!(touched.load(Ordering::SeqCst));
        assert!(!stopped.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn stops_stale_session_when_probe_fails() {
        let touched = Arc::new(AtomicBool::new(false));
        let stopped = Arc::new(AtomicBool::new(false));

        let reused = reuse_existing_session_if_healthy(
            "ws-1",
            || async { Err("Broken pipe (os error 32)".to_string()) },
            {
                let touched = Arc::clone(&touched);
                move || async move {
                    touched.store(true, Ordering::SeqCst);
                }
            },
            {
                let stopped = Arc::clone(&stopped);
                move || async move {
                    stopped.store(true, Ordering::SeqCst);
                    Ok(())
                }
            },
        )
        .await;

        assert!(!reused);
        assert!(!touched.load(Ordering::SeqCst));
        assert!(stopped.load(Ordering::SeqCst));
    }
}
