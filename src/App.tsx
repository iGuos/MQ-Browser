import { useEffect, useState } from 'react'
import type { RabbitConnection } from '@shared/types'
import { ConnectionSidebar } from '@/components/mq/ConnectionSidebar'
import { ConnectionDialog } from '@/components/mq/ConnectionDialog'
import { TopologyPanel } from '@/components/mq/TopologyPanel'
import { WorkspaceTabBar } from '@/components/workspace/WorkspaceTabBar'
import { WorkspaceProvider } from '@/context/WorkspaceContext'
import { useConnectionsStore } from '@/stores/connectionsStore'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'

/** Per-workspace shell — sidebar + detail panel. */
function MqWorkspaceShell({
  onAdd,
  onEdit,
}: {
  onAdd: () => void
  onEdit: (c: RabbitConnection) => void
}) {
  return (
    <div className="relative z-10 flex min-h-0 min-w-0 flex-1">
      <ConnectionSidebar onAdd={onAdd} onEdit={onEdit} />
      <TopologyPanel />
    </div>
  )
}

export default function App() {
  const hydrate = useConnectionsStore((s) => s.hydrate)
  const [dialog, setDialog] = useState<{ mode: 'add' | 'edit'; source: RabbitConnection | null } | null>(
    null,
  )
  const workspaceOrder = useWorkspaceUiStore((s) => s.workspaceOrder)
  const activeWorkspaceId = useWorkspaceUiStore((s) => s.activeWorkspaceId)
  const multiTab = workspaceOrder.length > 1

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-40"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56, 189, 248, 0.15), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(45, 212, 191, 0.08), transparent), radial-gradient(ellipse 50% 30% at 0% 80%, rgba(99, 102, 241, 0.06), transparent)',
        }}
      />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <WorkspaceTabBar />
        <div className="flex min-h-0 flex-1">
          {workspaceOrder.map((id) => (
            <div
              key={id}
              className={
                multiTab && id !== activeWorkspaceId
                  ? 'hidden'
                  : 'flex min-h-0 min-w-0 flex-1'
              }
            >
              <WorkspaceProvider id={id}>
                <MqWorkspaceShell
                  onAdd={() => setDialog({ mode: 'add', source: null })}
                  onEdit={(c) => setDialog({ mode: 'edit', source: c })}
                />
              </WorkspaceProvider>
            </div>
          ))}
        </div>
      </div>
      <ConnectionDialog
        open={dialog !== null}
        mode={dialog?.mode ?? 'add'}
        source={dialog?.source ?? null}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
