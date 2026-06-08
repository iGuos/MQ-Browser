/**
 * Demo-mode shim for `@tauri-apps/api/core`.
 *
 * Enabled ONLY when the app is built/served with `VITE_DEMO=1`, via a Vite
 * alias in `vite.config.ts`. In that mode every Tauri `invoke` call resolves
 * with hand-written fixtures instead of hitting the Rust backend, so the UI can
 * be rendered in a plain browser (e.g. for documentation screenshots) without a
 * real RabbitMQ broker. This file is never bundled in normal builds.
 *
 * All data below is fictional demo data — it does not represent any real broker.
 */

const CONN_ID = 'demo-prod'

const connections = [
  {
    id: CONN_ID,
    name: 'Acme Production',
    host: 'rabbit.demo.acme.internal',
    amqpPort: 5672,
    mgmtPort: 15672,
    username: 'demo-admin',
    password: 'demo',
    vhost: '/',
    tls: false,
    createdAt: 1717200000000,
  },
  {
    id: 'demo-staging',
    name: 'Acme Staging',
    host: 'rabbit.staging.acme.internal',
    amqpPort: 5672,
    mgmtPort: 15672,
    username: 'demo-ops',
    password: 'demo',
    vhost: '/orders',
    tls: true,
    createdAt: 1717100000000,
  },
]

const vhosts = [
  { name: '/', tracing: false },
  { name: '/orders', tracing: false },
  { name: '/billing', tracing: true },
]

const queues = [
  { name: 'orders.created', vhost: '/', messages: 1284, messagesReady: 1280, messagesUnacknowledged: 4, consumers: 3, durable: true, autoDelete: false, exclusive: false, state: 'running', node: 'rabbit@node-1', arguments: { 'x-queue-type': 'quorum' } },
  { name: 'orders.shipped', vhost: '/', messages: 42, messagesReady: 42, messagesUnacknowledged: 0, consumers: 2, durable: true, autoDelete: false, exclusive: false, state: 'running', node: 'rabbit@node-1', arguments: {} },
  { name: 'payments.capture', vhost: '/', messages: 7, messagesReady: 5, messagesUnacknowledged: 2, consumers: 4, durable: true, autoDelete: false, exclusive: false, state: 'running', node: 'rabbit@node-2', arguments: { 'x-dead-letter-exchange': 'dlx.payments' } },
  { name: 'payments.refund', vhost: '/', messages: 0, messagesReady: 0, messagesUnacknowledged: 0, consumers: 1, durable: true, autoDelete: false, exclusive: false, state: 'idle', node: 'rabbit@node-2', arguments: {} },
  { name: 'notifications.email', vhost: '/', messages: 318, messagesReady: 318, messagesUnacknowledged: 0, consumers: 6, durable: true, autoDelete: false, exclusive: false, state: 'running', node: 'rabbit@node-3', arguments: { 'x-message-ttl': 86400000 } },
  { name: 'notifications.sms', vhost: '/', messages: 12, messagesReady: 12, messagesUnacknowledged: 0, consumers: 2, durable: true, autoDelete: false, exclusive: false, state: 'running', node: 'rabbit@node-3', arguments: {} },
  { name: 'inventory.sync', vhost: '/', messages: 9531, messagesReady: 9520, messagesUnacknowledged: 11, consumers: 8, durable: true, autoDelete: false, exclusive: false, state: 'running', node: 'rabbit@node-1', arguments: { 'x-queue-type': 'quorum', 'x-max-length': 100000 } },
  { name: 'dlq.orders', vhost: '/', messages: 3, messagesReady: 3, messagesUnacknowledged: 0, consumers: 0, durable: true, autoDelete: false, exclusive: false, state: 'running', node: 'rabbit@node-2', arguments: {} },
  { name: 'audit.events', vhost: '/', messages: 58210, messagesReady: 58210, messagesUnacknowledged: 0, consumers: 1, durable: true, autoDelete: false, exclusive: false, state: 'running', node: 'rabbit@node-3', arguments: { 'x-queue-type': 'stream' } },
  { name: 'tmp.reindex-cache', vhost: '/', messages: 0, messagesReady: 0, messagesUnacknowledged: 0, consumers: 0, durable: false, autoDelete: true, exclusive: false, state: 'idle', node: 'rabbit@node-1', arguments: {} },
]

const exchanges = [
  { name: '', vhost: '/', type: 'direct', durable: true, autoDelete: false, internal: false },
  { name: 'orders', vhost: '/', type: 'topic', durable: true, autoDelete: false, internal: false },
  { name: 'payments', vhost: '/', type: 'direct', durable: true, autoDelete: false, internal: false },
  { name: 'notifications', vhost: '/', type: 'fanout', durable: true, autoDelete: false, internal: false },
  { name: 'inventory', vhost: '/', type: 'topic', durable: true, autoDelete: false, internal: false },
  { name: 'dlx.payments', vhost: '/', type: 'fanout', durable: true, autoDelete: false, internal: true },
  { name: 'amq.headers', vhost: '/', type: 'headers', durable: true, autoDelete: false, internal: false },
]

const bindings = [
  { source: 'orders', vhost: '/', destination: 'orders.created', destinationType: 'queue', routingKey: 'order.created', propertiesKey: 'order.created' },
  { source: 'orders', vhost: '/', destination: 'orders.shipped', destinationType: 'queue', routingKey: 'order.shipped', propertiesKey: 'order.shipped' },
  { source: 'orders', vhost: '/', destination: 'audit.events', destinationType: 'queue', routingKey: 'order.#', propertiesKey: 'order.%23' },
  { source: 'payments', vhost: '/', destination: 'payments.capture', destinationType: 'queue', routingKey: 'capture', propertiesKey: 'capture' },
  { source: 'payments', vhost: '/', destination: 'payments.refund', destinationType: 'queue', routingKey: 'refund', propertiesKey: 'refund' },
  { source: 'dlx.payments', vhost: '/', destination: 'dlq.orders', destinationType: 'queue', routingKey: '', propertiesKey: '' },
  { source: 'notifications', vhost: '/', destination: 'notifications.email', destinationType: 'queue', routingKey: '', propertiesKey: '' },
  { source: 'notifications', vhost: '/', destination: 'notifications.sms', destinationType: 'queue', routingKey: '', propertiesKey: '' },
  { source: 'inventory', vhost: '/', destination: 'inventory.sync', destinationType: 'queue', routingKey: 'sku.*.updated', propertiesKey: 'sku.%2A.updated' },
]

const runtimeConnections = [
  { name: '10.4.2.11:54233 -> 10.4.0.5:5672', user: 'orders-svc', peerHost: '10.4.2.11', peerPort: 54233, vhost: '/', state: 'running', protocol: 'AMQP 0-9-1', channels: 4, connectedAt: 1717286400000, clientProperties: { product: 'rabbitmq-java-client', platform: 'Java 17' } },
  { name: '10.4.2.18:51002 -> 10.4.0.5:5672', user: 'payments-svc', peerHost: '10.4.2.18', peerPort: 51002, vhost: '/', state: 'running', protocol: 'AMQP 0-9-1', channels: 2, connectedAt: 1717290000000, clientProperties: { product: 'py-amqp', platform: 'Python 3.12' } },
  { name: '10.4.3.7:60411 -> 10.4.0.5:5672', user: 'notifier-svc', peerHost: '10.4.3.7', peerPort: 60411, vhost: '/', state: 'running', protocol: 'AMQP 0-9-1', channels: 6, connectedAt: 1717293600000, clientProperties: { product: 'rabbitmq-go', platform: 'Go 1.22' } },
  { name: '10.4.5.3:48820 -> 10.4.0.5:5672', user: 'inventory-svc', peerHost: '10.4.5.3', peerPort: 48820, vhost: '/', state: 'flow', protocol: 'AMQP 0-9-1', channels: 8, connectedAt: 1717276800000, clientProperties: { product: 'rabbitmq-dotnet', platform: '.NET 8' } },
]

const channels = [
  { name: '10.4.2.11:54233 -> 10.4.0.5:5672 (1)', user: 'orders-svc', vhost: '/', number: 1, consumerCount: 1, messagesUnacknowledged: 2, messagesUnconfirmed: 0, prefetchCount: 50, state: 'running', connectionDetails: { peer_host: '10.4.2.11' } },
  { name: '10.4.2.11:54233 -> 10.4.0.5:5672 (2)', user: 'orders-svc', vhost: '/', number: 2, consumerCount: 1, messagesUnacknowledged: 0, messagesUnconfirmed: 3, prefetchCount: 50, state: 'running', connectionDetails: { peer_host: '10.4.2.11' } },
  { name: '10.4.2.18:51002 -> 10.4.0.5:5672 (1)', user: 'payments-svc', vhost: '/', number: 1, consumerCount: 2, messagesUnacknowledged: 2, messagesUnconfirmed: 0, prefetchCount: 20, state: 'running', connectionDetails: { peer_host: '10.4.2.18' } },
  { name: '10.4.5.3:48820 -> 10.4.0.5:5672 (3)', user: 'inventory-svc', vhost: '/', number: 3, consumerCount: 4, messagesUnacknowledged: 11, messagesUnconfirmed: 0, prefetchCount: 100, state: 'flow', connectionDetails: { peer_host: '10.4.5.3' } },
]

const consumers = [
  { queue: 'orders.created', vhost: '/', consumerTag: 'amq.ctag-orders-1', channel: '10.4.2.11:54233 (1)', prefetchCount: 50, exclusive: false, ackRequired: true, activityStatus: 'up' },
  { queue: 'payments.capture', vhost: '/', consumerTag: 'amq.ctag-pay-1', channel: '10.4.2.18:51002 (1)', prefetchCount: 20, exclusive: false, ackRequired: true, activityStatus: 'up' },
  { queue: 'payments.capture', vhost: '/', consumerTag: 'amq.ctag-pay-2', channel: '10.4.2.18:51002 (1)', prefetchCount: 20, exclusive: false, ackRequired: true, activityStatus: 'up' },
  { queue: 'notifications.email', vhost: '/', consumerTag: 'amq.ctag-notif-1', channel: '10.4.3.7:60411 (1)', prefetchCount: 30, exclusive: false, ackRequired: true, activityStatus: 'up' },
  { queue: 'inventory.sync', vhost: '/', consumerTag: 'amq.ctag-inv-1', channel: '10.4.5.3:48820 (3)', prefetchCount: 100, exclusive: false, ackRequired: true, activityStatus: 'waiting' },
]

const nodes = [
  { name: 'rabbit@node-1', kind: 'disc', running: true, memUsed: 612_000_000, memLimit: 3_200_000_000, fdUsed: 184, fdTotal: 65536, socketsUsed: 96, socketsTotal: 58890, diskFree: 42_000_000_000, diskFreeLimit: 2_000_000_000, procUsed: 1420, procTotal: 1048576, uptime: 1_987_400_000 },
  { name: 'rabbit@node-2', kind: 'disc', running: true, memUsed: 548_000_000, memLimit: 3_200_000_000, fdUsed: 151, fdTotal: 65536, socketsUsed: 73, socketsTotal: 58890, diskFree: 39_500_000_000, diskFreeLimit: 2_000_000_000, procUsed: 1190, procTotal: 1048576, uptime: 1_987_400_000 },
  { name: 'rabbit@node-3', kind: 'disc', running: true, memUsed: 701_000_000, memLimit: 3_200_000_000, fdUsed: 209, fdTotal: 65536, socketsUsed: 118, socketsTotal: 58890, diskFree: 37_100_000_000, diskFreeLimit: 2_000_000_000, procUsed: 1610, procTotal: 1048576, uptime: 1_400_000_000 },
]

const policies = [
  { vhost: '/', name: 'ha-orders', pattern: '^orders\\.', applyTo: 'queues', priority: 10, definition: { 'ha-mode': 'all', 'ha-sync-mode': 'automatic' } },
  { vhost: '/', name: 'ttl-notifications', pattern: '^notifications\\.', applyTo: 'queues', priority: 5, definition: { 'message-ttl': 86400000, 'max-length': 50000 } },
  { vhost: '/', name: 'dlx-payments', pattern: '^payments\\.', applyTo: 'queues', priority: 8, definition: { 'dead-letter-exchange': 'dlx.payments' } },
]

const whoami = { name: 'demo-admin', tags: ['administrator'] }

const users = [
  { name: 'demo-admin', tags: ['administrator'], passwordHash: '••••••••', hashingAlgorithm: 'rabbit_password_hashing_sha256' },
  { name: 'orders-svc', tags: ['management'], passwordHash: '••••••••', hashingAlgorithm: 'rabbit_password_hashing_sha256' },
  { name: 'payments-svc', tags: ['management'], passwordHash: '••••••••', hashingAlgorithm: 'rabbit_password_hashing_sha256' },
  { name: 'notifier-svc', tags: [], passwordHash: '••••••••', hashingAlgorithm: 'rabbit_password_hashing_sha256' },
  { name: 'monitoring', tags: ['monitoring'], passwordHash: '••••••••', hashingAlgorithm: 'rabbit_password_hashing_sha256' },
]

const permissions = [
  { user: 'demo-admin', vhost: '/', configure: '.*', write: '.*', read: '.*' },
  { user: 'orders-svc', vhost: '/', configure: '^orders\\.', write: '^orders\\.', read: '^orders\\.' },
  { user: 'payments-svc', vhost: '/', configure: '^payments\\.', write: '^payments\\.', read: '^payments\\.' },
  { user: 'notifier-svc', vhost: '/', configure: '', write: '^notifications\\.', read: '^notifications\\.' },
]

const overview = {
  cluster_name: 'acme-rabbit-cluster',
  rabbitmq_version: '3.13.2',
  product_name: 'RabbitMQ',
  object_totals: { queues: queues.length, exchanges: exchanges.length, connections: runtimeConnections.length, consumers: consumers.length },
  message_stats: { publish: 2480, deliver_get: 2412 },
}

const b64 = (s: string) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : '')

const messageBodies = [
  JSON.stringify({ orderId: 'ORD-100245', customer: 'demo-user-7', total: 89.9, currency: 'USD', items: 3 }, null, 2),
  JSON.stringify({ orderId: 'ORD-100246', customer: 'demo-user-2', total: 14.0, currency: 'USD', items: 1 }, null, 2),
  JSON.stringify({ orderId: 'ORD-100247', customer: 'demo-user-9', total: 312.5, currency: 'EUR', items: 7 }, null, 2),
]

const messages = messageBodies.map((body, i) => ({
  deliveryTag: i + 1,
  redelivered: i === 2,
  exchange: 'orders',
  routingKey: 'order.created',
  properties: { content_type: 'application/json', delivery_mode: 2, message_id: `msg-${1000 + i}`, timestamp: 1717293600 + i * 60, headers: { 'x-source': 'checkout-api', 'x-attempt': i + 1 } },
  bodyBase64: b64(body),
  bodyText: body,
  messageCount: messageBodies.length - i - 1,
}))

const templates = [
  { id: 'tpl-order', name: 'Sample order.created', target: 'exchange' as const, exchange: 'orders', routingKey: 'order.created', body: messageBodies[0], persistent: true, contentType: 'application/json', headers: { 'x-source': 'demo' } },
  { id: 'tpl-refund', name: 'Refund request', target: 'queue' as const, queueName: 'payments.refund', exchange: '', routingKey: 'payments.refund', body: JSON.stringify({ orderId: 'ORD-100245', reason: 'customer-request' }, null, 2), persistent: true, contentType: 'application/json', headers: {} },
]

const definitions = {
  rabbitmq_version: '3.13.2',
  vhosts: vhosts.map((v) => ({ name: v.name })),
  queues: queues.map((q) => ({ name: q.name, vhost: q.vhost, durable: q.durable, auto_delete: q.autoDelete, arguments: q.arguments })),
  exchanges: exchanges.filter((e) => e.name).map((e) => ({ name: e.name, vhost: e.vhost, type: e.type, durable: e.durable })),
  bindings: bindings.map((b) => ({ source: b.source, vhost: b.vhost, destination: b.destination, destination_type: b.destinationType, routing_key: b.routingKey })),
  policies,
}

const byVhost = <T extends { vhost: string }>(rows: T[], vhost: unknown): T[] =>
  typeof vhost === 'string' && vhost ? rows.filter((r) => r.vhost === vhost) : rows

/** Drop-in replacement for Tauri's `invoke`, backed by the fixtures above. */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const vhost = args?.vhost
  const handlers: Record<string, () => unknown> = {
    list_connections: () => connections,
    save_connections: () => undefined,
    list_publish_templates: () => templates,
    save_publish_templates: () => undefined,
    test_connection: () => overview,
    list_vhosts: () => vhosts,
    list_queues: () => byVhost(queues, vhost),
    list_exchanges: () => byVhost(exchanges, vhost),
    list_bindings: () => byVhost(bindings, vhost),
    list_runtime_connections: () => byVhost(runtimeConnections, vhost),
    list_channels: () => byVhost(channels, vhost),
    list_consumers: () => byVhost(consumers, vhost),
    list_nodes: () => nodes,
    list_policies: () => byVhost(policies, vhost),
    whoami: () => whoami,
    list_users: () => users,
    list_permissions: () => permissions,
    peek_messages: () => messages,
    publish_message: () => true,
    export_definitions: () => definitions,
  }
  const handler = handlers[cmd]
  return (handler ? handler() : undefined) as T
}
