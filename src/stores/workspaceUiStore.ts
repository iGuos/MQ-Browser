import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { RabbitConnection, DetailTab } from '@shared/types'
import { releaseTopologyWorkspace } from './topologyStore'

export const DEFAULT_WORKSPACE_ID = 'ws-default'

export interface AutoRefresh {
  enabled: boolean
  /** Milliseconds between refresh calls. */
  intervalMs: number
}

export const DEFAULT_AUTO_REFRESH: AutoRefresh = { enabled: false, intervalMs: 10_000 }

export type DiagnosticsSection =
  | 'connections'
  | 'channels'
  | 'consumers'
  | 'nodes'
  | 'routingTester'

/** Cross-component navigation request. Components listen on `nonce` and apply
 *  the relevant fields. */
export interface NavTarget {
  diagnosticsSection: DiagnosticsSection | null
  /** Prefill the destination list's filter input. */
  filter: string
  /** When set + detail tab is `queues`, the queue list opens that queue's drawer. */
  openQueueName: string | null
  /** Monotonic counter — used as effect dependency to trigger consumers. */
  nonce: number
}

const EMPTY_NAV: NavTarget = {
  diagnosticsSection: null,
  filter: '',
  openQueueName: null,
  nonce: 0,
}

type State = {
  workspaceOrder: string[]
  activeWorkspaceId: string
  /** Selected connection id per workspace. */
  selectedConnByWs: Record<string, string | null>
  /** Active vhost per workspace; falls back to the connection's stored vhost. */
  activeVhostByWs: Record<string, string | null>
  /** Active detail tab per workspace. */
  detailTabByWs: Record<string, DetailTab>
  /** Auto-refresh config per workspace. */
  autoRefreshByWs: Record<string, AutoRefresh>
  /** Pending navigation request per workspace. */
  navByWs: Record<string, NavTarget>
}

type Actions = {
  setActiveWorkspace: (id: string) => void
  addWorkspaceCloneOfActive: () => void
  removeWorkspace: (workspaceId: string) => void
  setSelectedForWorkspace: (workspaceId: string, connId: string | null) => void
  selectForActiveWorkspace: (connId: string | null) => void
  setActiveVhost: (workspaceId: string, vhost: string | null) => void
  setDetailTab: (workspaceId: string, tab: DetailTab) => void
  setAutoRefresh: (workspaceId: string, patch: Partial<AutoRefresh>) => void
  /** Dispatch a navigation request to the active workspace. */
  navigateTo: (
    workspaceId: string,
    target: Partial<Omit<NavTarget, 'nonce'>> & { detailTab?: DetailTab },
  ) => void
  pruneSelectionsAfterHydrate: (list: RabbitConnection[]) => void
}

function newWorkspaceId(): string {
  return `ws-${crypto.randomUUID()}`
}

export const useWorkspaceUiStore = create<State & Actions>()(
  persist(
    (set, get) => ({
  workspaceOrder: [DEFAULT_WORKSPACE_ID],
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  selectedConnByWs: { [DEFAULT_WORKSPACE_ID]: null },
  activeVhostByWs: { [DEFAULT_WORKSPACE_ID]: null },
  detailTabByWs: { [DEFAULT_WORKSPACE_ID]: 'queues' },
  autoRefreshByWs: { [DEFAULT_WORKSPACE_ID]: { ...DEFAULT_AUTO_REFRESH } },
  navByWs: { [DEFAULT_WORKSPACE_ID]: { ...EMPTY_NAV } },

  setActiveWorkspace: (id) => {
    if (!get().workspaceOrder.includes(id)) return
    set({ activeWorkspaceId: id })
  },

  addWorkspaceCloneOfActive: () => {
    const {
      workspaceOrder,
      activeWorkspaceId,
      selectedConnByWs,
      activeVhostByWs,
      detailTabByWs,
      autoRefreshByWs,
      navByWs,
    } = get()
    const nid = newWorkspaceId()
    set({
      workspaceOrder: [...workspaceOrder, nid],
      activeWorkspaceId: nid,
      selectedConnByWs: {
        ...selectedConnByWs,
        [nid]: selectedConnByWs[activeWorkspaceId] ?? null,
      },
      activeVhostByWs: {
        ...activeVhostByWs,
        [nid]: activeVhostByWs[activeWorkspaceId] ?? null,
      },
      detailTabByWs: {
        ...detailTabByWs,
        [nid]: detailTabByWs[activeWorkspaceId] ?? 'queues',
      },
      autoRefreshByWs: {
        ...autoRefreshByWs,
        [nid]: { ...(autoRefreshByWs[activeWorkspaceId] ?? DEFAULT_AUTO_REFRESH) },
      },
      navByWs: { ...navByWs, [nid]: { ...EMPTY_NAV } },
    })
  },

  removeWorkspace: (workspaceId) => {
    const {
      workspaceOrder,
      activeWorkspaceId,
      selectedConnByWs,
      activeVhostByWs,
      detailTabByWs,
      autoRefreshByWs,
      navByWs,
    } = get()
    if (workspaceOrder.length <= 1) return
    const idx = workspaceOrder.indexOf(workspaceId)
    if (idx < 0) return

    const nextOrder = workspaceOrder.filter((x) => x !== workspaceId)
    const nextSel = { ...selectedConnByWs }
    const nextVhost = { ...activeVhostByWs }
    const nextTab = { ...detailTabByWs }
    const nextAuto = { ...autoRefreshByWs }
    const nextNav = { ...navByWs }
    delete nextSel[workspaceId]
    delete nextVhost[workspaceId]
    delete nextTab[workspaceId]
    delete nextAuto[workspaceId]
    delete nextNav[workspaceId]
    releaseTopologyWorkspace(workspaceId)

    let nextActive = activeWorkspaceId
    if (activeWorkspaceId === workspaceId) {
      nextActive = idx > 0 ? nextOrder[idx - 1]! : nextOrder[0]!
    }

    set({
      workspaceOrder: nextOrder,
      activeWorkspaceId: nextActive,
      selectedConnByWs: nextSel,
      activeVhostByWs: nextVhost,
      detailTabByWs: nextTab,
      autoRefreshByWs: nextAuto,
      navByWs: nextNav,
    })
  },

  setSelectedForWorkspace: (workspaceId, connId) =>
    set((s) => ({
      selectedConnByWs: { ...s.selectedConnByWs, [workspaceId]: connId },
      activeVhostByWs: { ...s.activeVhostByWs, [workspaceId]: null },
    })),

  selectForActiveWorkspace: (connId) =>
    get().setSelectedForWorkspace(get().activeWorkspaceId, connId),

  setActiveVhost: (workspaceId, vhost) =>
    set((s) => ({
      activeVhostByWs: { ...s.activeVhostByWs, [workspaceId]: vhost },
    })),

  setDetailTab: (workspaceId, tab) =>
    set((s) => ({ detailTabByWs: { ...s.detailTabByWs, [workspaceId]: tab } })),

  setAutoRefresh: (workspaceId, patch) =>
    set((s) => ({
      autoRefreshByWs: {
        ...s.autoRefreshByWs,
        [workspaceId]: {
          ...(s.autoRefreshByWs[workspaceId] ?? DEFAULT_AUTO_REFRESH),
          ...patch,
        },
      },
    })),

  navigateTo: (workspaceId, target) =>
    set((s) => {
      const cur = s.navByWs[workspaceId] ?? EMPTY_NAV
      const nextNav: NavTarget = {
        diagnosticsSection:
          target.diagnosticsSection !== undefined ? target.diagnosticsSection : null,
        filter: target.filter ?? '',
        openQueueName: target.openQueueName ?? null,
        nonce: cur.nonce + 1,
      }
      const nextDetailTabByWs = target.detailTab
        ? { ...s.detailTabByWs, [workspaceId]: target.detailTab }
        : s.detailTabByWs
      return {
        navByWs: { ...s.navByWs, [workspaceId]: nextNav },
        detailTabByWs: nextDetailTabByWs,
      }
    }),

  pruneSelectionsAfterHydrate: (list) => {
    const ids = new Set(list.map((x) => x.id))
    const fallback = list[0]?.id ?? null
    set((s) => {
      const next = { ...s.selectedConnByWs }
      for (const ws of Object.keys(next)) {
        const cur = next[ws]
        if (list.length === 0) next[ws] = null
        else if (cur == null || !ids.has(cur)) next[ws] = fallback
      }
      return { selectedConnByWs: next }
    })
  },
    }),
    {
      name: 'mq-browser/workspace-ui/v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        workspaceOrder: s.workspaceOrder,
        activeWorkspaceId: s.activeWorkspaceId,
        selectedConnByWs: s.selectedConnByWs,
        activeVhostByWs: s.activeVhostByWs,
        detailTabByWs: s.detailTabByWs,
        autoRefreshByWs: s.autoRefreshByWs,
      }),
    },
  ),
)
