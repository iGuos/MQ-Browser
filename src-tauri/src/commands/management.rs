//! RabbitMQ Management HTTP API client.
//!
//! lapin only speaks the AMQP wire protocol — it cannot enumerate topology.
//! For listing queues / exchanges / bindings / vhosts and for ops like purge,
//! we call the management plugin's REST API (default port 15672).
//!
//! Docs: https://rawcdn.githack.com/rabbitmq/rabbitmq-server/v3.13.0/deps/rabbitmq_management/priv/www/api/index.html

use crate::error::{AppError, AppResult};
use crate::types::{
    BindingInfo, ChannelInfo, ConsumerInfo, ExchangeInfo, NodeInfo, PermissionInfo, PolicyInfo,
    QueueInfo, RabbitConnection, RuntimeConnection, UserInfo, VhostInfo, WhoamiInfo,
};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
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
    let status = resp.status();
    let ct = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(AppError::msg(format!(
            "HTTP {} {}: {}",
            status.as_u16(),
            url,
            preview(&body),
        )));
    }
    // Surface a clear error when the server (often a reverse proxy / WAF) returns
    // a non-JSON 2xx response (e.g. an HTML login page).
    if !ct.contains("json") && !looks_like_json(&body) {
        return Err(AppError::msg(format!(
            "{} returned content-type {:?} (expected JSON). Body preview: {}",
            url,
            ct,
            preview(&body),
        )));
    }
    serde_json::from_str::<T>(&body).map_err(|e| {
        AppError::msg(format!("decode {}: {} -- body preview: {}", url, e, preview(&body)))
    })
}

fn looks_like_json(s: &str) -> bool {
    let t = s.trim_start();
    t.starts_with('{') || t.starts_with('[')
}

fn preview(s: &str) -> String {
    let trimmed = s.trim();
    if trimmed.len() <= 240 {
        trimmed.to_string()
    } else {
        format!("{}…(+{} bytes)", &trimmed[..240], trimmed.len() - 240)
    }
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

// ----------------------------------------------------------------------------
// Runtime connections + channels (live AMQP state on the broker)
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn list_runtime_connections(
    connection: RabbitConnection,
    vhost: Option<String>,
) -> AppResult<Vec<RuntimeConnection>> {
    let path = match vhost {
        Some(v) => format!("/api/vhosts/{}/connections", enc_vhost(&v)),
        None => "/api/connections".to_string(),
    };
    get_json(&connection, &path).await
}

#[tauri::command]
pub async fn list_consumers(
    connection: RabbitConnection,
    vhost: Option<String>,
) -> AppResult<Vec<ConsumerInfo>> {
    let path = match vhost {
        Some(v) => format!("/api/consumers/{}", enc_vhost(&v)),
        None => "/api/consumers".to_string(),
    };
    let raw: Value = get_json(&connection, &path).await?;
    let arr = raw.as_array().cloned().unwrap_or_default();
    let mut out = Vec::with_capacity(arr.len());
    for item in arr {
        let queue_obj = item.get("queue").cloned().unwrap_or(Value::Null);
        let chan_obj = item.get("channel_details").cloned().unwrap_or(Value::Null);
        out.push(ConsumerInfo {
            queue: queue_obj
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            vhost: queue_obj
                .get("vhost")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            consumer_tag: item
                .get("consumer_tag")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            channel: chan_obj
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            prefetch_count: item
                .get("prefetch_count")
                .and_then(|x| x.as_u64())
                .unwrap_or(0) as u32,
            exclusive: item.get("exclusive").and_then(|x| x.as_bool()).unwrap_or(false),
            ack_required: item
                .get("ack_required")
                .and_then(|x| x.as_bool())
                .unwrap_or(false),
            activity_status: item
                .get("activity_status")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn list_channels(
    connection: RabbitConnection,
    vhost: Option<String>,
) -> AppResult<Vec<ChannelInfo>> {
    let path = match vhost {
        Some(v) => format!("/api/vhosts/{}/channels", enc_vhost(&v)),
        None => "/api/channels".to_string(),
    };
    get_json(&connection, &path).await
}

#[tauri::command]
pub async fn close_runtime_connection(
    connection: RabbitConnection,
    name: String,
    reason: Option<String>,
) -> AppResult<()> {
    let url = format!(
        "{}/api/connections/{}",
        connection.mgmt_base(),
        enc_vhost(&name),
    );
    let mut req = client()?
        .delete(&url)
        .basic_auth(&connection.username, Some(&connection.password));
    if let Some(r) = reason {
        req = req.header("X-Reason", r);
    }
    let resp = req.send().await?;
    if !resp.status().is_success() {
        return Err(AppError::msg(format!("close HTTP {}", resp.status())));
    }
    Ok(())
}

// ----------------------------------------------------------------------------
// Create / declare: queues, exchanges, bindings
// ----------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueSpec {
    pub name: String,
    pub vhost: String,
    #[serde(default = "default_true")]
    pub durable: bool,
    #[serde(default)]
    pub auto_delete: bool,
    /// Free-form arguments map (x-message-ttl, x-dead-letter-exchange, etc.)
    #[serde(default)]
    pub arguments: serde_json::Map<String, Value>,
}

fn default_true() -> bool { true }

#[tauri::command]
pub async fn create_queue(connection: RabbitConnection, spec: QueueSpec) -> AppResult<()> {
    let url = format!(
        "{}/api/queues/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&spec.vhost),
        enc_vhost(&spec.name),
    );
    let body = json!({
        "durable": spec.durable,
        "auto_delete": spec.auto_delete,
        "arguments": spec.arguments,
    });
    declare(&connection, &url, body).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeSpec {
    pub name: String,
    pub vhost: String,
    /// direct | fanout | topic | headers | x-*
    #[serde(default = "default_exchange_type")]
    pub kind: String,
    #[serde(default = "default_true")]
    pub durable: bool,
    #[serde(default)]
    pub auto_delete: bool,
    #[serde(default)]
    pub internal: bool,
    #[serde(default)]
    pub arguments: serde_json::Map<String, Value>,
}

fn default_exchange_type() -> String { "direct".to_string() }

#[tauri::command]
pub async fn create_exchange(connection: RabbitConnection, spec: ExchangeSpec) -> AppResult<()> {
    let url = format!(
        "{}/api/exchanges/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&spec.vhost),
        enc_vhost(&spec.name),
    );
    let body = json!({
        "type": spec.kind,
        "durable": spec.durable,
        "auto_delete": spec.auto_delete,
        "internal": spec.internal,
        "arguments": spec.arguments,
    });
    declare(&connection, &url, body).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BindingSpec {
    pub vhost: String,
    pub source: String,
    pub destination: String,
    /// "queue" | "exchange"
    pub destination_type: String,
    #[serde(default)]
    pub routing_key: String,
    #[serde(default)]
    pub arguments: serde_json::Map<String, Value>,
}

#[tauri::command]
pub async fn create_binding(connection: RabbitConnection, spec: BindingSpec) -> AppResult<()> {
    // POST /api/bindings/{vhost}/e/{source}/{q|e}/{dest}
    let dest_kind = match spec.destination_type.as_str() {
        "exchange" | "e" => "e",
        _ => "q",
    };
    let url = format!(
        "{}/api/bindings/{}/e/{}/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&spec.vhost),
        enc_vhost(&spec.source),
        dest_kind,
        enc_vhost(&spec.destination),
    );
    let body = json!({
        "routing_key": spec.routing_key,
        "arguments": spec.arguments,
    });
    let resp = client()?
        .post(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .json(&body)
        .send()
        .await?;
    if !resp.status().is_success() {
        let s = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::msg(format!(
            "HTTP {} {}: {}",
            s.as_u16(),
            url,
            preview(&body),
        )));
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_binding(
    connection: RabbitConnection,
    vhost: String,
    source: String,
    destination: String,
    destination_type: String,
    properties_key: String,
) -> AppResult<()> {
    let dest_kind = match destination_type.as_str() {
        "exchange" | "e" => "e",
        _ => "q",
    };
    // properties_key is RabbitMQ's stable handle for the routing-key + args pair.
    let url = format!(
        "{}/api/bindings/{}/e/{}/{}/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&vhost),
        enc_vhost(&source),
        dest_kind,
        enc_vhost(&destination),
        enc_vhost(&properties_key),
    );
    let resp = client()?
        .delete(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .send()
        .await?;
    if !resp.status().is_success() {
        let s = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::msg(format!(
            "HTTP {} {}: {}",
            s.as_u16(),
            url,
            preview(&txt),
        )));
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_exchange(
    connection: RabbitConnection,
    vhost: String,
    exchange: String,
) -> AppResult<()> {
    let url = format!(
        "{}/api/exchanges/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&vhost),
        enc_vhost(&exchange),
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

// ----------------------------------------------------------------------------
// Cluster nodes + policies + channels + definitions
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn list_nodes(connection: RabbitConnection) -> AppResult<Vec<NodeInfo>> {
    get_json(&connection, "/api/nodes").await
}

#[tauri::command]
pub async fn list_policies(
    connection: RabbitConnection,
    vhost: Option<String>,
) -> AppResult<Vec<PolicyInfo>> {
    let path = match vhost {
        Some(v) => format!("/api/policies/{}", enc_vhost(&v)),
        None => "/api/policies".to_string(),
    };
    get_json(&connection, &path).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicySpec {
    pub vhost: String,
    pub name: String,
    pub pattern: String,
    /// "all" | "queues" | "exchanges" | "classic_queues" | "quorum_queues" | "streams"
    #[serde(default = "default_apply_to")]
    pub apply_to: String,
    #[serde(default)]
    pub priority: i32,
    /// The actual policy definition — map of policy keys to values
    /// (e.g. {"max-length": 10000, "message-ttl": 60000}).
    #[serde(default)]
    pub definition: serde_json::Map<String, Value>,
}

fn default_apply_to() -> String { "all".to_string() }

#[tauri::command]
pub async fn create_policy(connection: RabbitConnection, spec: PolicySpec) -> AppResult<()> {
    let url = format!(
        "{}/api/policies/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&spec.vhost),
        enc_vhost(&spec.name),
    );
    let body = json!({
        "pattern": spec.pattern,
        "apply-to": spec.apply_to,
        "priority": spec.priority,
        "definition": spec.definition,
    });
    declare(&connection, &url, body).await
}

#[tauri::command]
pub async fn delete_policy(
    connection: RabbitConnection,
    vhost: String,
    name: String,
) -> AppResult<()> {
    let url = format!(
        "{}/api/policies/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&vhost),
        enc_vhost(&name),
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

#[tauri::command]
pub async fn close_channel(
    connection: RabbitConnection,
    name: String,
    reason: Option<String>,
) -> AppResult<()> {
    let url = format!(
        "{}/api/channels/{}",
        connection.mgmt_base(),
        enc_vhost(&name),
    );
    let mut req = client()?
        .delete(&url)
        .basic_auth(&connection.username, Some(&connection.password));
    if let Some(r) = reason {
        req = req.header("X-Reason", r);
    }
    let resp = req.send().await?;
    if !resp.status().is_success() {
        return Err(AppError::msg(format!("close HTTP {}", resp.status())));
    }
    Ok(())
}

/// Snapshot of the full broker topology (queues, exchanges, bindings, vhosts,
/// users, parameters, policies) — same shape as the official "Export
/// definitions" feature in the management UI.
#[tauri::command]
pub async fn export_definitions(
    connection: RabbitConnection,
    vhost: Option<String>,
) -> AppResult<Value> {
    let path = match vhost {
        Some(v) => format!("/api/definitions/{}", enc_vhost(&v)),
        None => "/api/definitions".to_string(),
    };
    get_json(&connection, &path).await
}

#[tauri::command]
pub async fn import_definitions(
    connection: RabbitConnection,
    vhost: Option<String>,
    definitions: Value,
) -> AppResult<()> {
    let url = match vhost {
        Some(v) => format!(
            "{}/api/definitions/{}",
            connection.mgmt_base(),
            enc_vhost(&v),
        ),
        None => format!("{}/api/definitions", connection.mgmt_base()),
    };
    let resp = client()?
        .post(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .json(&definitions)
        .send()
        .await?;
    if !resp.status().is_success() {
        let s = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::msg(format!(
            "HTTP {} {}: {}",
            s.as_u16(),
            url,
            preview(&txt),
        )));
    }
    Ok(())
}

// ----------------------------------------------------------------------------
// Admin: whoami + users + permissions + vhosts
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn whoami(connection: RabbitConnection) -> AppResult<WhoamiInfo> {
    get_json(&connection, "/api/whoami").await
}

#[tauri::command]
pub async fn list_users(connection: RabbitConnection) -> AppResult<Vec<UserInfo>> {
    get_json(&connection, "/api/users").await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSpec {
    pub name: String,
    /// Plain-text password. Leave empty when only updating tags on an existing user.
    #[serde(default)]
    pub password: String,
    /// Comma-separated or array; we forward as a comma-separated string to RabbitMQ.
    #[serde(default)]
    pub tags: Vec<String>,
}

#[tauri::command]
pub async fn create_or_update_user(
    connection: RabbitConnection,
    spec: UserSpec,
) -> AppResult<()> {
    let url = format!(
        "{}/api/users/{}",
        connection.mgmt_base(),
        enc_vhost(&spec.name),
    );
    let tags = spec.tags.join(",");
    let body = if spec.password.is_empty() {
        json!({ "tags": tags })
    } else {
        json!({ "password": spec.password, "tags": tags })
    };
    declare(&connection, &url, body).await
}

#[tauri::command]
pub async fn delete_user(connection: RabbitConnection, name: String) -> AppResult<()> {
    let url = format!(
        "{}/api/users/{}",
        connection.mgmt_base(),
        enc_vhost(&name),
    );
    let resp = client()?
        .delete(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(AppError::msg(format!("delete user HTTP {}", resp.status())));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_permissions(
    connection: RabbitConnection,
) -> AppResult<Vec<PermissionInfo>> {
    get_json(&connection, "/api/permissions").await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionSpec {
    pub user: String,
    pub vhost: String,
    /// Regex patterns. ".*" means full access, "" means no access.
    pub configure: String,
    pub write: String,
    pub read: String,
}

#[tauri::command]
pub async fn set_permissions(
    connection: RabbitConnection,
    spec: PermissionSpec,
) -> AppResult<()> {
    let url = format!(
        "{}/api/permissions/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&spec.vhost),
        enc_vhost(&spec.user),
    );
    let body = json!({
        "configure": spec.configure,
        "write": spec.write,
        "read": spec.read,
    });
    declare(&connection, &url, body).await
}

#[tauri::command]
pub async fn clear_permissions(
    connection: RabbitConnection,
    user: String,
    vhost: String,
) -> AppResult<()> {
    let url = format!(
        "{}/api/permissions/{}/{}",
        connection.mgmt_base(),
        enc_vhost(&vhost),
        enc_vhost(&user),
    );
    let resp = client()?
        .delete(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(AppError::msg(format!("clear perms HTTP {}", resp.status())));
    }
    Ok(())
}

#[tauri::command]
pub async fn create_vhost(connection: RabbitConnection, name: String) -> AppResult<()> {
    let url = format!(
        "{}/api/vhosts/{}",
        connection.mgmt_base(),
        enc_vhost(&name),
    );
    declare(&connection, &url, json!({})).await
}

#[tauri::command]
pub async fn delete_vhost(connection: RabbitConnection, name: String) -> AppResult<()> {
    let url = format!(
        "{}/api/vhosts/{}",
        connection.mgmt_base(),
        enc_vhost(&name),
    );
    let resp = client()?
        .delete(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(AppError::msg(format!("delete vhost HTTP {}", resp.status())));
    }
    Ok(())
}

async fn declare(connection: &RabbitConnection, url: &str, body: Value) -> AppResult<()> {
    let resp = client()?
        .put(url)
        .basic_auth(&connection.username, Some(&connection.password))
        .json(&body)
        .send()
        .await?;
    if !resp.status().is_success() {
        let s = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::msg(format!(
            "HTTP {} {}: {}",
            s.as_u16(),
            url,
            preview(&txt),
        )));
    }
    Ok(())
}
