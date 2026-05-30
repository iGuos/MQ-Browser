/**
 * Persisted RabbitMQ connection profile.
 *
 * All broker calls go through the management HTTP plugin at
 * (`host`, `mgmtPort`). `amqpPort` is optional metadata only — kept so the UI
 * can display the broker's AMQP port if the operator wants to record it.
 */
export interface RabbitConnection {
  id: string
  name: string
  host: string
  amqpPort?: number
  mgmtPort: number
  username: string
  password: string
  vhost: string
  tls: boolean
  createdAt: number
}

export interface QueueInfo {
  name: string
  vhost: string
  messages: number
  messagesReady: number
  messagesUnacknowledged: number
  consumers: number
  durable: boolean
  autoDelete: boolean
  exclusive: boolean
  state: string
  node: string
  /** Raw arguments map from RabbitMQ (e.g. x-dead-letter-exchange). */
  arguments?: Record<string, unknown>
}

export interface ExchangeInfo {
  name: string
  vhost: string
  /** direct | fanout | topic | headers | x-* */
  type: string
  durable: boolean
  autoDelete: boolean
  internal: boolean
}

export interface BindingInfo {
  source: string
  vhost: string
  destination: string
  destinationType: string
  routingKey: string
  propertiesKey: string
}

export interface VhostInfo {
  name: string
  tracing: boolean
}

export interface RuntimeConnection {
  name: string
  user: string
  peerHost: string
  peerPort: number
  vhost: string
  state: string
  protocol: string
  channels: number
  /** Unix epoch milliseconds. */
  connectedAt: number
  clientProperties: Record<string, unknown>
}

export interface ChannelInfo {
  name: string
  user: string
  vhost: string
  number: number
  consumerCount: number
  messagesUnacknowledged: number
  messagesUnconfirmed: number
  prefetchCount: number
  state: string
  connectionDetails: Record<string, unknown>
}

export interface NodeInfo {
  name: string
  kind: string
  running: boolean
  memUsed: number
  memLimit: number
  fdUsed: number
  fdTotal: number
  socketsUsed: number
  socketsTotal: number
  diskFree: number
  diskFreeLimit: number
  procUsed: number
  procTotal: number
  /** Milliseconds since broker startup. */
  uptime: number
}

export interface PolicyInfo {
  vhost: string
  name: string
  pattern: string
  /** all | queues | exchanges | classic_queues | quorum_queues | streams */
  applyTo: string
  priority: number
  definition: Record<string, unknown>
}

export interface WhoamiInfo {
  name: string
  tags: string[]
}

export interface UserInfo {
  name: string
  tags: string[]
  passwordHash: string
  hashingAlgorithm: string
}

export interface UserSpec {
  name: string
  /** Plain-text password. Empty = leave existing password untouched. */
  password: string
  tags: string[]
}

export interface PermissionInfo {
  user: string
  vhost: string
  configure: string
  write: string
  read: string
}

export interface PermissionSpec {
  user: string
  vhost: string
  configure: string
  write: string
  read: string
}

export interface PolicySpec {
  vhost: string
  name: string
  pattern: string
  applyTo: string
  priority: number
  definition: Record<string, unknown>
}

export interface QueueSpec {
  name: string
  vhost: string
  durable: boolean
  autoDelete: boolean
  arguments: Record<string, unknown>
}

export interface ExchangeSpec {
  name: string
  vhost: string
  /** direct | fanout | topic | headers | x-* */
  kind: string
  durable: boolean
  autoDelete: boolean
  internal: boolean
  arguments: Record<string, unknown>
}

export interface BindingSpec {
  vhost: string
  source: string
  destination: string
  /** "queue" | "exchange" */
  destinationType: string
  routingKey: string
  arguments: Record<string, unknown>
}

export interface PeekedMessage {
  deliveryTag: number
  redelivered: boolean
  exchange: string
  routingKey: string
  properties: Record<string, unknown>
  bodyBase64: string
  bodyText: string | null
  messageCount: number
}

export interface PublishPayload {
  exchange: string
  routingKey: string
  body: string
  persistent: boolean
  contentType?: string
  headers: Record<string, string>
}

export interface PublishTemplate {
  id: string
  name: string
  exchange: string
  routingKey: string
  body: string
  persistent: boolean
  contentType?: string
  headers: Record<string, string>
}

/** Discriminator for the right-hand detail panel. */
export type DetailTab =
  | 'overview'
  | 'queues'
  | 'exchanges'
  | 'bindings'
  | 'connections'
  | 'channels'
  | 'nodes'
  | 'policies'
  | 'admin'
  | 'publish'
