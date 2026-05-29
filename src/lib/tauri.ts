import { invoke } from '@tauri-apps/api/core'
import type {
  BindingInfo,
  ExchangeInfo,
  PeekedMessage,
  PublishPayload,
  QueueInfo,
  RabbitConnection,
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
}
