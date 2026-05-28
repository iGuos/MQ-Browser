//! RabbitMQ Management HTTP API client.
//!
//! lapin only speaks the AMQP wire protocol — it cannot enumerate topology.
//! For listing queues / exchanges / bindings / vhosts and for ops like purge,
//! we call the management plugin's REST API (default port 15672).
//!
//! Docs: https://rawcdn.githack.com/rabbitmq/rabbitmq-server/v3.13.0/deps/rabbitmq_management/priv/www/api/index.html

use crate::error::{AppError, AppResult};
use crate::types::{BindingInfo, ExchangeInfo, QueueInfo, RabbitConnection, VhostInfo};
use reqwest::Client;
use std::time::Duration;

fn client() -> AppResult<Client> {
    Ok(Client::builder()
        .timeout(Duration::from_secs(15))
        .danger_accept_invalid_certs(true) // local/dev mgmt UIs often use self-signed
        .build()?)
}

fn enc_vhost(vhost: &str) -> String {
    // RabbitMQ uses `%2F` for the default vhost in URLs.
    let mut out = String::with_capacity(vhost.len() * 3);
    for b in vhost.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

async fn get_json<T: serde::de::DeserializeOwned>(
    c: &RabbitConnection,
    path: &str,
) -> AppResult<T> {
    let url = format!("{}{}", c.mgmt_base(), path);
    let resp = client()?
        .get(&url)
        .basic_auth(&c.username, Some(&c.password))
        .send()
        .await?;
    if !resp.status().is_success() {
        let s = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::msg(format!("HTTP {} {}: {}", s.as_u16(), url, body)));
    }
    Ok(resp.json::<T>().await?)
}

#[tauri::command]
pub async fn test_connection(connection: RabbitConnection) -> AppResult<serde_json::Value> {
    // /api/overview gives broker version + cluster name and is cheap.
    let v: serde_json::Value = get_json(&connection, "/api/overview").await?;
    Ok(v)
}

#[tauri::command]
pub async fn list_vhosts(connection: RabbitConnection) -> AppResult<Vec<VhostInfo>> {
    get_json(&connection, "/api/vhosts").await
}

#[tauri::command]
pub async fn list_queues(
    connection: RabbitConnection,
    vhost: Option<String>,
) -> AppResult<Vec<QueueInfo>> {
    let path = match vhost {
        Some(v) => format!("/api/queues/{}", enc_vhost(&v)),
        None => "/api/queues".to_string(),
    };
    get_json(&connection, &path).await
}

#[tauri::command]
pub async fn list_exchanges(
    connection: RabbitConnection,
    vhost: Option<String>,
) -> AppResult<Vec<ExchangeInfo>> {
    let path = match vhost {
        Some(v) => format!("/api/exchanges/{}", enc_vhost(&v)),
        None => "/api/exchanges".to_string(),
    };
    get_json(&connection, &path).await
}

#[tauri::command]
pub async fn list_bindings(
    connection: RabbitConnection,
    vhost: Option<String>,
) -> AppResult<Vec<BindingInfo>> {
    let path = match vhost {
        Some(v) => format!("/api/bindings/{}", enc_vhost(&v)),
        None => "/api/bindings".to_string(),
    };
    get_json(&connection, &path).await
}

#[tauri::command]
pub async fn purge_queue(
    connection: RabbitConnection,
    vhost: String,
    queue: String,
) -> AppResult<()> {
    let url = format!(
        "{}/api/queues/{}/{}/contents",
        connection.mgmt_base(),
        enc_vhost(&vhost),
        enc_vhost(&queue),
    );
    let resp = client()?
        .delete(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(AppError::msg(format!("purge HTTP {}", resp.status())));
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_queue(
    connection: RabbitConnection,
    vhost: String,
    queue: String,
) -> AppResult<()> {
    let url = format!(
        "{}/api/queues/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&vhost),
        enc_vhost(&queue),
    );
    let resp = client()?
        .delete(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(AppError::msg(format!("delete HTTP {}", resp.status())));
    }
    Ok(())
}
