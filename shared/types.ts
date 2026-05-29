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

/** Discriminator for the right-hand detail panel. */
export type DetailTab = 'overview' | 'queues' | 'exchanges' | 'bindings' | 'publish'
