import { create } from 'zustand'
import type { RabbitConnection, DetailTab } from '@shared/types'
import { releaseTopologyWorkspace } from './topologyStore'

export const DEFAULT_WORKSPACE_ID = 'ws-default'

type State = {
  workspaceOrder: string[]
  activeWorkspaceId: string
  /** Selected connection id per workspace. */
  selectedConnByWs: Record<string, string | null>
  /** Active vhost per workspace; falls back to the connection's stored vhost. */
  activeVhostByWs: Record<string, string | null>
  /** Active detail tab per workspace. */
  detailTabByWs: Record<string, DetailTab>
}

type Actions = {
  setActiveWorkspace: (id: string) => void
  addWorkspaceCloneOfActive: () => void
  removeWorkspace: (workspaceId: string) => void
  setSelectedForWorkspace: (workspaceId: string, connId: string | null) => void
  selectForActiveWorkspace: (connId: string | null) => void
  setActiveVhost: (workspaceId: string, vhost: string | null) => void
  setDetailTab: (workspaceId: string, tab: DetailTab) => void
  pruneSelectionsAfterHydrate: (list: RabbitConnection[]) => void
}

function newWorkspaceId(): string {
  return `ws-${crypto.randomUUID()}`
}

export const useWorkspaceUiStore = create<State & Actions>((set, get) => ({
  workspaceOrder: [DEFAULT_WORKSPACE_ID],
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  selectedConnByWs: { [DEFAULT_WORKSPACE_ID]: null },
  activeVhostByWs: { [DEFAULT_WORKSPACE_ID]: null },
  detailTabByWs: { [DEFAULT_WORKSPACE_ID]: 'queues' },

  setActiveWorkspace: (id) => {
    if (!get().workspaceOrder.includes(id)) return
    set({ activeWorkspaceId: id })
  },

  addWorkspaceCloneOfActive: () => {
    const { workspaceOrder, activeWorkspaceId, selectedConnByWs, activeVhostByWs, detailTabByWs } =
      get()
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
    })
  },

  removeWorkspace: (workspaceId) => {
    const { workspaceOrder, activeWorkspaceId, selectedConnByWs, activeVhostByWs, detailTabByWs } =
      get()
    if (workspaceOrder.length <= 1) return
    const idx = workspaceOrder.indexOf(workspaceId)
    if (idx < 0) return

    const nextOrder = workspaceOrder.filter((x) => x !== workspaceId)
    const nextSel = { ...selectedConnByWs }
    const nextVhost = { ...activeVhostByWs }
    const nextTab = { ...detailTabByWs }
    delete nextSel[workspaceId]
    delete nextVhost[workspaceId]
    delete nextTab[workspaceId]
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
}))
