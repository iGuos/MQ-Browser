//! Persisted connection list + publish templates.
//!
//! Stored as JSON files under the platform app-data dir via
//! `tauri-plugin-store`. The TS side never sees the raw file path; it
//! talks to these commands.

use crate::error::{AppError, AppResult};
use crate::types::RabbitConnection;
use serde_json::Value;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const CONN_FILE: &str = "connections.json";
const CONN_KEY: &str = "connections";

const TEMPLATE_FILE: &str = "publish-templates.json";
const TEMPLATE_KEY: &str = "templates";

#[tauri::command]
pub fn list_connections<R: Runtime>(app: AppHandle<R>) -> AppResult<Vec<RabbitConnection>> {
    let store = app
        .store(CONN_FILE)
        .map_err(|e| AppError::msg(format!("open store: {e}")))?;
    let Some(value) = store.get(CONN_KEY) else {
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
        .store(CONN_FILE)
        .map_err(|e| AppError::msg(format!("open store: {e}")))?;
    store.set(CONN_KEY, serde_json::to_value(&connections)?);
    store
        .save()
        .map_err(|e| AppError::msg(format!("save store: {e}")))?;
    Ok(())
}

// Templates are opaque JSON to the backend — we don't need typed access here,
// so the value is whatever the frontend wrote.

#[tauri::command]
pub fn list_publish_templates<R: Runtime>(app: AppHandle<R>) -> AppResult<Value> {
    let store = app
        .store(TEMPLATE_FILE)
        .map_err(|e| AppError::msg(format!("open store: {e}")))?;
    Ok(store.get(TEMPLATE_KEY).unwrap_or(Value::Array(vec![])))
}

#[tauri::command]
pub fn save_publish_templates<R: Runtime>(app: AppHandle<R>, templates: Value) -> AppResult<()> {
    let store = app
        .store(TEMPLATE_FILE)
        .map_err(|e| AppError::msg(format!("open store: {e}")))?;
    store.set(TEMPLATE_KEY, templates);
    store
        .save()
        .map_err(|e| AppError::msg(format!("save store: {e}")))?;
    Ok(())
}
