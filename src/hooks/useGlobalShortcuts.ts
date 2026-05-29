import { useEffect } from 'react'
import type { DetailTab } from '@shared/types'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { useConnectionsStore } from '@/stores/connectionsStore'
import { useTopologyStore } from '@/stores/topologyStore'

const TAB_BY_DIGIT: Record<string, DetailTab> = {
  '1': 'overview',
  '2': 'queues',
  '3': 'exchanges',
  '4': 'bindings',
  '5': 'connections',
  '6': 'channels',
  '7': 'nodes',
  '8': 'policies',
  '9': 'publish',
}

interface Options {
  onOpenPalette: () => void
}

export function useGlobalShortcuts({ onOpenPalette }: Options) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      const mod = e.metaKey || e.ctrlKey

      // Cmd/Ctrl+K opens command palette — works even while typing
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenPalette()
        return
      }
      // Cmd/Ctrl+R refreshes current workspace topology
      if (mod && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        const wsId = useWorkspaceUiStore.getState().activeWorkspaceId
        const connId = useWorkspaceUiStore.getState().selectedConnByWs[wsId] ?? null
        const vhost = useWorkspaceUiStore.getState().activeVhostByWs[wsId] ?? null
        const conn = useConnectionsStore.getState().connections.find((c) => c.id === connId)
        if (conn) void useTopologyStore.getState().fetch(wsId, conn, vhost)
        return
      }

      // Digit tab-switch — but only when NOT typing
      if (isTyping) return
      if (!mod && TAB_BY_DIGIT[e.key]) {
        e.preventDefault()
        const wsId = useWorkspaceUiStore.getState().activeWorkspaceId
        useWorkspaceUiStore.getState().setDetailTab(wsId, TAB_BY_DIGIT[e.key]!)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpenPalette])
}
