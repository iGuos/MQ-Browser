mod commands;
mod error;
mod types;

use commands::{amqp, connections, management};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            // connections
            connections::list_connections,
            connections::save_connections,
            // management api (HTTP)
            management::test_connection,
            management::list_vhosts,
            management::list_queues,
            management::list_exchanges,
            management::list_bindings,
            management::purge_queue,
            management::delete_queue,
            // amqp (lapin)
            amqp::peek_messages,
            amqp::publish_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MQ Browser");
}
