import { create } from 'zustand'
import type {
  BindingInfo,
  ChannelInfo,
  ExchangeInfo,
  NodeInfo,
  PolicyInfo,
  QueueInfo,
  RabbitConnection,
  RuntimeConnection,
  VhostInfo,
} from '@shared/types'
import { api } from '@/lib/tauri'

type Status = 'idle' | 'loading' | 'ok' | 'error'

interface TopologySlice {
  status: Status
  error: string | null
  vhosts: VhostInfo[]
  queues: QueueInfo[]
  exchanges: ExchangeInfo[]
  bindings: BindingInfo[]
  runtimeConnections: RuntimeConnection[]
  channels: ChannelInfo[]
  nodes: NodeInfo[]
  policies: PolicyInfo[]
  /** Server overview (broker version, cluster name, etc.) */
  overview: Record<string, unknown> | null
}

interface TopologyState {
  /** Keyed by `${workspaceId}::${connectionId}::${vhost ?? '<all>'}` */
  byKey: Record<string, TopologySlice>
  fetch: (
    workspaceId: string,
    connection: RabbitConnection,
    vhost: string | null,
  ) => Promise<void>
  get: (workspaceId: string, connectionId: string, vhost: string | null) => TopologySlice
}

function emptySlice(): TopologySlice {
  return {
    status: 'idle',
    error: null,
    vhosts: [],
    queues: [],
    exchanges: [],
    bindings: [],
    runtimeConnections: [],
    channels: [],
    nodes: [],
    policies: [],
    overview: null,
  }
}

function key(workspaceId: string, connectionId: string, vhost: string | null): string {
  return `${workspaceId}::${connectionId}::${vhost ?? '<all>'}`
}

export const useTopologyStore = create<TopologyState>((set, get) => ({
  byKey: {},

  get: (workspaceId, connectionId, vhost) =>
    get().byKey[key(workspaceId, connectionId, vhost)] ?? emptySlice(),

  fetch: async (workspaceId, connection, vhost) => {
    const k = key(workspaceId, connection.id, vhost)
    set((s) => ({
      byKey: {
        ...s.byKey,
        [k]: { ...(s.byKey[k] ?? emptySlice()), status: 'loading', error: null },
      },
    }))
    try {
      const targetVhost = vhost ?? undefined
      const [
        overview,
        vhosts,
        queues,
        exchanges,
        bindings,
        runtimeConnections,
        channels,
        nodes,
        policies,
      ] = await Promise.all([
        api.testConnection(connection).catch(() => null),
        api.listVhosts(connection).catch(() => [] as VhostInfo[]),
        api.listQueues(connection, targetVhost),
        api.listExchanges(connection, targetVhost),
        api.listBindings(connection, targetVhost),
        api.listRuntimeConnections(connection, targetVhost).catch(() => []),
        api.listChannels(connection, targetVhost).catch(() => []),
        api.listNodes(connection).catch(() => []),
        api.listPolicies(connection, targetVhost).catch(() => []),
      ])
      set((s) => ({
        byKey: {
          ...s.byKey,
          [k]: {
            status: 'ok',
            error: null,
            overview,
            vhosts,
            queues,
            exchanges,
            bindings,
            runtimeConnections,
            channels,
            nodes,
            policies,
          },
        },
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set((s) => ({
        byKey: {
          ...s.byKey,
          [k]: { ...(s.byKey[k] ?? emptySlice()), status: 'error', error: msg },
        },
      }))
    }
  },
}))

/** Drop every cache entry tied to the closed workspace. */
export function releaseTopologyWorkspace(workspaceId: string): void {
  useTopologyStore.setState((s) => {
    const next = { ...s.byKey }
    for (const k of Object.keys(next)) {
      if (k.startsWith(`${workspaceId}::`)) delete next[k]
    }
    return { byKey: next }
  })
}
