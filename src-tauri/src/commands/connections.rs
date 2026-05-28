//! Persisted connection list.
//!
//! Stored as a single JSON file under the platform app-data dir via
//! `tauri-plugin-store`. The TS side never sees the raw file path; it
//! talks to these two commands.

use crate::error::{AppError, AppResult};
use crate::types::RabbitConnection;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "connections.json";
const STORE_KEY: &str = "connections";

#[tauri::command]
pub fn list_connections<R: Runtime>(app: AppHandle<R>) -> AppResult<Vec<RabbitConnection>> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::msg(format!("open store: {e}")))?;
    let Some(value) = store.get(STORE_KEY) else {
        return Ok(Vec::new());
    };
    let list: Vec<RabbitConnection> = serde_json::from_value(value)?;
    Ok(list)
}

#[tauri::command]
pub fn save_connections<R: Runtime>(
    app: AppHandle<R>,
    connections: Vec<RabbitConnection>,
) -> AppResult<()> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::msg(format!("open store: {e}")))?;
    store.set(STORE_KEY, serde_json::to_value(&connections)?);
    store
        .save()
        .map_err(|e| AppError::msg(format!("save store: {e}")))?;
    Ok(())
}
