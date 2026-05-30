//! Message peek + publish via the Management HTTP API.
//!
//! Endpoints:
//! - `POST /api/queues/{vhost}/{queue}/get`        — fetch up to N messages
//! - `POST /api/exchanges/{vhost}/{exchange}/publish` — publish a single message
//!
//! These are part of the `rabbitmq_management` plugin. They are not suited for
//! high-throughput traffic (one HTTP round-trip per call), but are sufficient
//! for an inspector/browser tool and let us avoid a long-lived AMQP socket.

use crate::error::{AppError, AppResult};
use crate::types::RabbitConnection;
use base64::Engine as _;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

fn client() -> AppResult<Client> {
    Ok(Client::builder()
        .timeout(Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()?)
}

fn enc(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeekedMessage {
    pub delivery_tag: u64,
    pub redelivered: bool,
    pub exchange: String,
    pub routing_key: String,
    pub properties: Value,
    pub body_base64: String,
    pub body_text: Option<String>,
    pub message_count: u32,
}

#[derive(Debug, Deserialize)]
struct HttpGetMessage {
    #[serde(default)]
    redelivered: bool,
    #[serde(default)]
    exchange: String,
    #[serde(default)]
    routing_key: String,
    #[serde(default)]
    message_count: u32,
    payload: String,
    payload_encoding: String,
    #[serde(default)]
    properties: Value,
}

#[tauri::command]
pub async fn peek_messages(
    connection: RabbitConnection,
    vhost: String,
    queue: String,
    count: u32,
    requeue: bool,
) -> AppResult<Vec<PeekedMessage>> {
    let url = format!(
        "{}/api/queues/{}/{}/get",
        connection.mgmt_base(),
        enc(&vhost),
        enc(&queue),
    );
    let body = json!({
        "count": count,
        // ack_requeue_true: messages are visibly redelivered but stay in queue (true peek).
        // ack_requeue_false: messages are dropped from the queue.
        "ackmode": if requeue { "ack_requeue_true" } else { "ack_requeue_false" },
        // "auto" returns base64 if body isn't valid UTF-8, else a plain string.
        "encoding": "auto",
        "truncate": 50_000,
    });
    let resp = client()?
        .post(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .json(&body)
        .send()
        .await?;
    if !resp.status().is_success() {
        let s = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::msg(format!("HTTP {} {}: {}", s.as_u16(), url, txt)));
    }
    let raw: Vec<HttpGetMessage> = resp.json().await?;

    let mut out = Vec::with_capacity(raw.len());
    for (i, m) in raw.into_iter().enumerate() {
        let (body_text, body_base64) = match m.payload_encoding.as_str() {
            "base64" => (None, m.payload),
            _ => {
                let b64 = base64::engine::general_purpose::STANDARD.encode(m.payload.as_bytes());
                (Some(m.payload), b64)
            }
        };
        out.push(PeekedMessage {
            // Management API doesn't expose delivery tags — synthesize one for the UI.
            delivery_tag: (i + 1) as u64,
            redelivered: m.redelivered,
            exchange: m.exchange,
            routing_key: m.routing_key,
            properties: m.properties,
            body_base64,
            body_text,
            message_count: m.message_count,
        });
    }
    Ok(out)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishPayload {
    pub exchange: String,
    pub routing_key: String,
    pub body: String,
    #[serde(default)]
    pub persistent: bool,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
    /// Per-message TTL in milliseconds. AMQP encodes this as a shortstr; we
    /// forward it as a decimal string. Empty / missing = no TTL.
    #[serde(default)]
    pub expiration_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct PublishResp {
    routed: bool,
}

#[tauri::command]
pub async fn publish_message(
    connection: RabbitConnection,
    vhost: String,
    payload: PublishPayload,
) -> AppResult<bool> {
    let url = format!(
        "{}/api/exchanges/{}/{}/publish",
        connection.mgmt_base(),
        enc(&vhost),
        enc(&payload.exchange),
    );

    let mut properties = serde_json::Map::new();
    if payload.persistent {
        properties.insert("delivery_mode".into(), json!(2));
    }
    if let Some(ct) = payload.content_type.as_deref() {
        if !ct.is_empty() {
            properties.insert("content_type".into(), json!(ct));
        }
    }
    if !payload.headers.is_empty() {
        properties.insert("headers".into(), json!(payload.headers));
    }
    if let Some(ms) = payload.expiration_ms {
        // AMQP expiration is a shortstr containing decimal milliseconds.
        properties.insert("expiration".into(), json!(ms.to_string()));
    }

    let req = json!({
        "properties": properties,
        "routing_key": payload.routing_key,
        "payload": payload.body,
        "payload_encoding": "string",
    });

    let resp = client()?
        .post(&url)
        .basic_auth(&connection.username, Some(&connection.password))
        .json(&req)
        .send()
        .await?;
    if !resp.status().is_success() {
        let s = resp.status();
        let txt = resp.text().await.unwrap_or_default();
        return Err(AppError::msg(format!("HTTP {} {}: {}", s.as_u16(), url, txt)));
    }
    // `routed: false` means the broker accepted the publish but no queue matched
    // the routing key — surface that back so the UI can warn.
    let r: PublishResp = resp.json().await?;
    Ok(r.routed)
}
