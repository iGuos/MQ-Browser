use serde::{Deserialize, Serialize};

/// Persisted RabbitMQ connection profile.
///
/// AMQP is reached on (`host`, `amqp_port`), Management HTTP API on
/// (`host`, `mgmt_port`). The same credentials are used for both — RabbitMQ
/// shares its internal users between the AMQP plane and the management plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RabbitConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    #[serde(default = "default_amqp_port")]
    pub amqp_port: u16,
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

fn default_amqp_port() -> u16 { 5672 }
fn default_mgmt_port() -> u16 { 15672 }
fn default_vhost() -> String { "/".to_string() }

impl RabbitConnection {
    pub fn amqp_uri(&self) -> String {
        let scheme = if self.tls { "amqps" } else { "amqp" };
        let user = urlencode(&self.username);
        let pass = urlencode(&self.password);
        let vhost = urlencode(self.vhost.trim_start_matches('/'));
        format!(
            "{scheme}://{user}:{pass}@{host}:{port}/{vhost}",
            scheme = scheme,
            user = user,
            pass = pass,
            host = self.host,
            port = self.amqp_port,
            vhost = vhost,
        )
    }

    pub fn mgmt_base(&self) -> String {
        let scheme = if self.tls { "https" } else { "http" };
        format!("{scheme}://{}:{}", self.host, self.mgmt_port)
    }
}

fn urlencode(s: &str) -> String {
    // Lightweight: only encode characters that break URI userinfo / vhost segments.
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueInfo {
    pub name: String,
    pub vhost: String,
    #[serde(default)]
    pub messages: u64,
    #[serde(default)]
    pub messages_ready: u64,
    #[serde(default)]
    pub messages_unacknowledged: u64,
    #[serde(default)]
    pub consumers: u64,
    #[serde(default)]
    pub durable: bool,
    #[serde(default)]
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
    #[serde(default)]
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
    pub destination_type: String,
    pub routing_key: String,
    #[serde(default)]
    pub properties_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VhostInfo {
    pub name: String,
    #[serde(default)]
    pub tracing: bool,
}
