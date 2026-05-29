//! File I/O helpers used by export / import dialogs.
//!
//! Paths come from the dialog plugin (already vetted by the user via the
//! native file picker), so we just open them directly.

use crate::error::{AppError, AppResult};

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> AppResult<()> {
    std::fs::write(&path, contents)
        .map_err(|e| AppError::msg(format!("write {}: {}", path, e)))
}

#[tauri::command]
pub fn read_text_file(path: String) -> AppResult<String> {
    std::fs::read_to_string(&path).map_err(|e| AppError::msg(format!("read {}: {}", path, e)))
}
