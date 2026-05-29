import { invoke } from '@tauri-apps/api/core'
import type {
  BindingInfo,
  BindingSpec,
  ChannelInfo,
  ExchangeInfo,
  ExchangeSpec,
  PeekedMessage,
  PublishPayload,
  PublishTemplate,
  QueueInfo,
  QueueSpec,
  RabbitConnection,
  RuntimeConnection,
  VhostInfo,
} from '@shared/types'

/** Centralised typed wrappers over Tauri `invoke`. */
export const api = {
  listConnections: () => invoke<RabbitConnection[]>('list_connections'),
  saveConnections: (connections: RabbitConnection[]) =>
    invoke<void>('save_connections', { connections }),

  testConnection: (connection: RabbitConnection) =>
    invoke<Record<string, unknown>>('test_connection', { connection }),

  listVhosts: (connection: RabbitConnection) =>
    invoke<VhostInfo[]>('list_vhosts', { connection }),

  listQueues: (connection: RabbitConnection, vhost?: string) =>
    invoke<QueueInfo[]>('list_queues', { connection, vhost: vhost ?? null }),

  listExchanges: (connection: RabbitConnection, vhost?: string) =>
    invoke<ExchangeInfo[]>('list_exchanges', { connection, vhost: vhost ?? null }),

  listBindings: (connection: RabbitConnection, vhost?: string) =>
    invoke<BindingInfo[]>('list_bindings', { connection, vhost: vhost ?? null }),

  purgeQueue: (connection: RabbitConnection, vhost: string, queue: string) =>
    invoke<void>('purge_queue', { connection, vhost, queue }),

  deleteQueue: (connection: RabbitConnection, vhost: string, queue: string) =>
    invoke<void>('delete_queue', { connection, vhost, queue }),

  peekMessages: (
    connection: RabbitConnection,
    vhost: string,
    queue: string,
    count: number,
    requeue: boolean,
  ) => invoke<PeekedMessage[]>('peek_messages', { connection, vhost, queue, count, requeue }),

  /** Resolves to `true` if the broker routed the message to at least one queue. */
  publishMessage: (
    connection: RabbitConnection,
    vhost: string,
    payload: PublishPayload,
  ) => invoke<boolean>('publish_message', { connection, vhost, payload }),

  // Runtime state ------------------------------------------------------------
  listRuntimeConnections: (connection: RabbitConnection, vhost?: string | null) =>
    invoke<RuntimeConnection[]>('list_runtime_connections', {
      connection,
      vhost: vhost ?? null,
    }),
  listChannels: (connection: RabbitConnection, vhost?: string | null) =>
    invoke<ChannelInfo[]>('list_channels', { connection, vhost: vhost ?? null }),
  closeRuntimeConnection: (connection: RabbitConnection, name: string, reason?: string) =>
    invoke<void>('close_runtime_connection', { connection, name, reason: reason ?? null }),

  // Create / declare ---------------------------------------------------------
  createQueue: (connection: RabbitConnection, spec: QueueSpec) =>
    invoke<void>('create_queue', { connection, spec }),
  createExchange: (connection: RabbitConnection, spec: ExchangeSpec) =>
    invoke<void>('create_exchange', { connection, spec }),
  createBinding: (connection: RabbitConnection, spec: BindingSpec) =>
    invoke<void>('create_binding', { connection, spec }),
  deleteExchange: (connection: RabbitConnection, vhost: string, exchange: string) =>
    invoke<void>('delete_exchange', { connection, vhost, exchange }),

  // Publish templates (persisted via tauri-plugin-store) -------------------
  listPublishTemplates: () => invoke<PublishTemplate[]>('list_publish_templates'),
  savePublishTemplates: (templates: PublishTemplate[]) =>
    invoke<void>('save_publish_templates', { templates }),
}
