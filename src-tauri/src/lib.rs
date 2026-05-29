mod commands;
mod error;
mod types;

use commands::{connections, management, messages};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(window) = _app.get_webview_window("main") {
                    window.close_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // connections
            connections::list_connections,
            connections::save_connections,
            connections::list_publish_templates,
            connections::save_publish_templates,
            // management api (HTTP)
            management::test_connection,
            management::list_vhosts,
            management::list_queues,
            management::list_exchanges,
            management::list_bindings,
            management::purge_queue,
            management::delete_queue,
            management::delete_exchange,
            management::list_runtime_connections,
            management::list_channels,
            management::close_runtime_connection,
            management::create_queue,
            management::create_exchange,
            management::create_binding,
            // messages (over management HTTP)
            messages::peek_messages,
            messages::publish_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MQ Browser");
}
