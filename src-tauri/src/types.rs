use serde::{Deserialize, Serialize};

/// Persisted RabbitMQ connection profile.
///
/// All broker interaction goes through the Management HTTP plugin on
/// (`host`, `mgmt_port`). `amqp_port` is kept around purely as metadata so the
/// UI can surface it; we don't open AMQP sockets ourselves.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RabbitConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    #[serde(default)]
    pub amqp_port: Option<u16>,
    #[serde(default = "default_mgmt_port")]
    pub mgmt_port: u16,
    pub username: String,
    pub password: String,
    #[serde(default = "default_vhost")]
    pub vhost: String,
    #[serde(default)]
    pub tls: bool,
    #[serde(default)]
    pub created_at: i64,
}

fn default_mgmt_port() -> u16 { 15672 }
fn default_vhost() -> String { "/".to_string() }

impl RabbitConnection {
    pub fn mgmt_base(&self) -> String {
        let scheme = if self.tls { "https" } else { "http" };
        format!("{scheme}://{}:{}", self.host, self.mgmt_port)
    }
}

// NOTE on field naming:
// The RabbitMQ Management API returns snake_case JSON. The frontend expects
// camelCase. We keep `rename_all = "camelCase"` so the *outgoing* Tauri payload
// is camelCase, and add `#[serde(alias = "snake_case")]` on each multi-word
// field so we can still *deserialize* the broker's snake_case response.

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueInfo {
    pub name: String,
    pub vhost: String,
    #[serde(default)]
    pub messages: u64,
    #[serde(default, alias = "messages_ready")]
    pub messages_ready: u64,
    #[serde(default, alias = "messages_unacknowledged")]
    pub messages_unacknowledged: u64,
    #[serde(default)]
    pub consumers: u64,
    #[serde(default)]
    pub durable: bool,
    #[serde(default, alias = "auto_delete")]
    pub auto_delete: bool,
    #[serde(default)]
    pub exclusive: bool,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub node: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeInfo {
    pub name: String,
    pub vhost: String,
    #[serde(rename = "type", default)]
    pub kind: String,
    #[serde(default)]
    pub durable: bool,
    #[serde(default, alias = "auto_delete")]
    pub auto_delete: bool,
    #[serde(default)]
    pub internal: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BindingInfo {
    pub source: String,
    pub vhost: String,
    pub destination: String,
    #[serde(alias = "destination_type")]
    pub destination_type: String,
    #[serde(alias = "routing_key")]
    pub routing_key: String,
    #[serde(default, alias = "properties_key")]
    pub properties_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VhostInfo {
    pub name: String,
    #[serde(default)]
    pub tracing: bool,
}
