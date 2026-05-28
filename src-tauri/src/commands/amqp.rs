//! AMQP operations via lapin.
//!
//! Two operations are surfaced today:
//! - `peek_messages`: short-lived consumer using `basic.get` with `requeue=true`
//!   so the broker copy is untouched. Equivalent to "Get messages" in the
//!   management UI.
//! - `publish_message`: one-shot publish with optional persistence + headers.

use crate::error::{AppError, AppResult};
use crate::types::RabbitConnection;
use lapin::{
    options::{BasicGetOptions, BasicPublishOptions, BasicRejectOptions},
    types::FieldTable,
    BasicProperties, Connection, ConnectionProperties,
};
use serde::{Deserialize, Serialize};

async fn open(c: &RabbitConnection) -> AppResult<Connection> {
    let conn = Connection::connect(&c.amqp_uri(), ConnectionProperties::default())
        .await
        .map_err(|e| AppError::msg(format!("amqp connect: {e}")))?;
    Ok(conn)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeekedMessage {
    pub delivery_tag: u64,
    pub redelivered: bool,
    pub exchange: String,
    pub routing_key: String,
    pub properties: serde_json::Value,
    pub body_base64: String,
    pub body_text: Option<String>,
    pub message_count: u32,
}

fn props_to_json(p: &BasicProperties) -> serde_json::Value {
    use serde_json::json;
    json!({
        "contentType": p.content_type().as_ref().map(|s| s.to_string()),
        "contentEncoding": p.content_encoding().as_ref().map(|s| s.to_string()),
        "deliveryMode": p.delivery_mode(),
        "priority": p.priority(),
        "correlationId": p.correlation_id().as_ref().map(|s| s.to_string()),
        "replyTo": p.reply_to().as_ref().map(|s| s.to_string()),
        "expiration": p.expiration().as_ref().map(|s| s.to_string()),
        "messageId": p.message_id().as_ref().map(|s| s.to_string()),
        "timestamp": p.timestamp(),
        "type": p.kind().as_ref().map(|s| s.to_string()),
        "userId": p.user_id().as_ref().map(|s| s.to_string()),
        "appId": p.app_id().as_ref().map(|s| s.to_string()),
    })
}

#[tauri::command]
pub async fn peek_messages(
    connection: RabbitConnection,
    queue: String,
    count: u32,
    requeue: bool,
) -> AppResult<Vec<PeekedMessage>> {
    let conn = open(&connection).await?;
    let channel = conn
        .create_channel()
        .await
        .map_err(|e| AppError::msg(format!("create channel: {e}")))?;

    let mut out = Vec::with_capacity(count as usize);
    for _ in 0..count {
        let got = channel
            .basic_get(&queue, BasicGetOptions { no_ack: false })
            .await
            .map_err(|e| AppError::msg(format!("basic.get: {e}")))?;
        let Some(delivery) = got else { break };

        let body_text = match std::str::from_utf8(&delivery.data) {
            Ok(s) => Some(s.to_string()),
            Err(_) => None,
        };
        use base64::Engine as _;
        let body_base64 = base64::engine::general_purpose::STANDARD.encode(&delivery.data);

        out.push(PeekedMessage {
            delivery_tag: delivery.delivery_tag,
            redelivered: delivery.redelivered,
            exchange: delivery.exchange.to_string(),
            routing_key: delivery.routing_key.to_string(),
            properties: props_to_json(&delivery.properties),
            body_base64,
            body_text,
            message_count: delivery.message_count,
        });

        // requeue=true puts the message back; requeue=false drops to DLX (or nirvana).
        channel
            .basic_reject(
                delivery.delivery_tag,
                BasicRejectOptions { requeue },
            )
            .await
            .map_err(|e| AppError::msg(format!("basic.reject: {e}")))?;
    }

    let _ = channel.close(200, "ok").await;
    let _ = conn.close(200, "ok").await;
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
}

#[tauri::command]
pub async fn publish_message(
    connection: RabbitConnection,
    payload: PublishPayload,
) -> AppResult<()> {
    let conn = open(&connection).await?;
    let channel = conn
        .create_channel()
        .await
        .map_err(|e| AppError::msg(format!("create channel: {e}")))?;

    let mut props = BasicProperties::default();
    if payload.persistent {
        props = props.with_delivery_mode(2);
    }
    if let Some(ct) = payload.content_type.as_deref() {
        props = props.with_content_type(ct.into());
    }
    if !payload.headers.is_empty() {
        let mut table = FieldTable::default();
        for (k, v) in &payload.headers {
            table.insert(k.as_str().into(), lapin::types::AMQPValue::LongString(v.clone().into()));
        }
        props = props.with_headers(table);
    }

    channel
        .basic_publish(
            &payload.exchange,
            &payload.routing_key,
            BasicPublishOptions::default(),
            payload.body.as_bytes(),
            props,
        )
        .await
        .map_err(|e| AppError::msg(format!("basic.publish: {e}")))?
        .await
        .map_err(|e| AppError::msg(format!("publish confirm: {e}")))?;

    let _ = channel.close(200, "ok").await;
    let _ = conn.close(200, "ok").await;
    Ok(())
}
