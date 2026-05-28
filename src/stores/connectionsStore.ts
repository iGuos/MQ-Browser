import { create } from 'zustand'
import type { RabbitConnection } from '@shared/types'
import { api } from '@/lib/tauri'
import { useWorkspaceUiStore } from './workspaceUiStore'

interface ConnectionsState {
  connections: RabbitConnection[]
  ready: boolean
  hydrate: () => Promise<void>
  addConnection: (c: Omit<RabbitConnection, 'id' | 'createdAt'>) => Promise<void>
  updateConnection: (id: string, patch: Omit<RabbitConnection, 'id' | 'createdAt'>) => Promise<void>
  removeConnection: (id: string) => Promise<void>
  reorderConnections: (fromIndex: number, beforeIndex: number) => Promise<void>
  replaceAll: (list: RabbitConnection[]) => Promise<void>
}

async function persist(list: RabbitConnection[]): Promise<boolean> {
  try {
    await api.saveConnections(list)
    return true
  } catch (e) {
    console.error('[connectionsStore] persist failed', e)
    return false
  }
}

function patchSelectionsAfterRemove(removedId: string, next: RabbitConnection[]): void {
  const fallback = next[0]?.id ?? null
  useWorkspaceUiStore.setState((s) => {
    const sel = { ...s.selectedConnByWs }
    for (const w of Object.keys(sel)) {
      if (sel[w] === removedId) sel[w] = fallback
    }
    return { selectedConnByWs: sel }
  })
}

function setAllSelections(id: string | null): void {
  useWorkspaceUiStore.setState((s) => {
    const sel = { ...s.selectedConnByWs }
    for (const w of Object.keys(sel)) sel[w] = id
    return { selectedConnByWs: sel }
  })
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connections: [],
  ready: false,

  hydrate: async () => {
    try {
      const list = await api.listConnections()
      set({ connections: list, ready: true })
      useWorkspaceUiStore.getState().pruneSelectionsAfterHydrate(list)
    } catch {
      set({ connections: [], ready: true })
      useWorkspaceUiStore.getState().pruneSelectionsAfterHydrate([])
    }
  },

  addConnection: async (c) => {
    const item: RabbitConnection = {
      ...c,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }
    const next = [item, ...get().connections]
    if (!(await persist(next))) return
    set({ connections: next })
    useWorkspaceUiStore.getState().selectForActiveWorkspace(item.id)
  },

  updateConnection: async (id, patch) => {
    const next = get().connections.map((x) =>
      x.id !== id ? x : { ...x, ...patch, id: x.id, createdAt: x.createdAt },
    )
    if (!(await persist(next))) return
    set({ connections: next })
  },

  removeConnection: async (id) => {
    const next = get().connections.filter((x) => x.id !== id)
    if (!(await persist(next))) return
    set({ connections: next })
    patchSelectionsAfterRemove(id, next)
  },

  reorderConnections: async (fromIndex, beforeIndex) => {
    const list = get().connections
    const n = list.length
    if (fromIndex < 0 || fromIndex >= n) return
    if (beforeIndex < 0 || beforeIndex > n) return
    if (fromIndex === beforeIndex || fromIndex + 1 === beforeIndex) return
    const next = [...list]
    const [item] = next.splice(fromIndex, 1)
    const insertAt = fromIndex < beforeIndex ? beforeIndex - 1 : beforeIndex
    next.splice(insertAt, 0, item)
    if (!(await persist(next))) return
    set({ connections: next })
  },

  replaceAll: async (list) => {
    if (!(await persist(list))) return
    set({ connections: list })
    setAllSelections(list[0]?.id ?? null)
  },
}))
