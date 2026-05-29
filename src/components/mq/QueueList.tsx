import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { QueueInfo, RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/tauri'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { MessageViewer } from './MessageViewer'
import { CreateQueueDialog } from './CreateQueueDialog'

type Slice =
  | {
      queues: QueueInfo[]
      status: 'idle' | 'loading' | 'ok' | 'error'
    }
  | null

export function QueueList({
  connection,
  vhost,
  slice,
}: {
  connection: RabbitConnection
  vhost: string | null
  slice: Slice
}) {
  const { t } = useTranslation()
  const workspaceId = useWorkspaceId()
  const activeVhost = useWorkspaceUiStore((s) => s.activeVhostByWs[workspaceId] ?? null)
  const fetchTopology = useTopologyStore((s) => s.fetch)
  const [filter, setFilter] = useState('')
  const [peekTarget, setPeekTarget] = useState<QueueInfo | null>(null)
  const [confirmPurge, setConfirmPurge] = useState<QueueInfo | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<QueueInfo | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = slice?.queues ?? []
    if (!q) return list
    return list.filter(
      (x) => x.name.toLowerCase().includes(q) || x.vhost.toLowerCase().includes(q),
    )
  }, [slice, filter])

  if (slice?.status === 'loading' && filtered.length === 0) {
    return <div className="text-xs text-zinc-500">{t('panel.loading')}</div>
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('queues.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('queues.count', { count: filtered.length })}
        </span>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 px-2.5 py-1.5 text-[11px] font-medium text-zinc-950 hover:from-cyan-400 hover:to-teal-400"
        >
          + {t('create.queue.button')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <Th>{t('queues.col.name')}</Th>
              <Th>{t('queues.col.vhost')}</Th>
              <Th align="right">{t('queues.col.ready')}</Th>
              <Th align="right">{t('queues.col.unacked')}</Th>
              <Th align="right">{t('queues.col.total')}</Th>
              <Th align="right">{t('queues.col.consumers')}</Th>
              <Th>{t('queues.col.state')}</Th>
              <Th align="right">{t('queues.col.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <tr
                key={`${q.vhost}::${q.name}`}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <Td>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">{q.name}</span>
                  <div className="mt-0.5 flex gap-1">
                    {q.durable ? <Badge>durable</Badge> : null}
                    {q.autoDelete ? <Badge>auto-delete</Badge> : null}
                    {q.exclusive ? <Badge>exclusive</Badge> : null}
                  </div>
                </Td>
                <Td>
                  <span className="font-mono">{q.vhost}</span>
                </Td>
                <Td align="right">{q.messagesReady}</Td>
                <Td align="right">{q.messagesUnacknowledged}</Td>
                <Td align="right">
                  <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                    {q.messages}
                  </span>
                </Td>
                <Td align="right">{q.consumers}</Td>
                <Td>{q.state}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <ActionBtn onClick={() => setPeekTarget(q)}>{t('queues.action.peek')}</ActionBtn>
                    <ActionBtn onClick={() => setConfirmPurge(q)} kind="warn">
                      {t('queues.action.purge')}
                    </ActionBtn>
                    <ActionBtn onClick={() => setConfirmDelete(q)} kind="danger">
                      {t('queues.action.delete')}
                    </ActionBtn>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
                  {t('queues.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MessageViewer
        open={peekTarget !== null}
        connection={connection}
        queue={peekTarget}
        onClose={() => setPeekTarget(null)}
      />

      <Modal
        open={confirmPurge !== null}
        title={t('queues.purgeConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('queues.action.purge')}
        onCancel={() => setConfirmPurge(null)}
        onOk={async () => {
          const target = confirmPurge
          setConfirmPurge(null)
          if (!target) return
          await api.purgeQueue(connection, target.vhost, target.name)
        }}
      >
        {t('queues.purgeConfirmDetail', { name: confirmPurge?.name ?? '' })}
      </Modal>

      <Modal
        open={confirmDelete !== null}
        title={t('queues.deleteConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('queues.action.delete')}
        onCancel={() => setConfirmDelete(null)}
        onOk={async () => {
          const target = confirmDelete
          setConfirmDelete(null)
          if (!target) return
          await api.deleteQueue(connection, target.vhost, target.name)
        }}
      >
        {t('queues.deleteConfirmDetail', { name: confirmDelete?.name ?? '' })}
      </Modal>
      {vhost ? null : null}

      <CreateQueueDialog
        open={showCreate}
        connection={connection}
        vhost={activeVhost ?? connection.vhost}
        onClose={() => setShowCreate(false)}
        onCreated={() => void fetchTopology(workspaceId, connection, activeVhost)}
      />
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </th>
  )
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <td className={`px-3 py-2 align-top ${align === 'right' ? 'text-right tabular-nums' : ''}`}>
      {children}
    </td>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-zinc-200/80 px-1 py-0 text-[9px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      {children}
    </span>
  )
}

function ActionBtn({
  children,
  onClick,
  kind = 'neutral',
}: {
  children: React.ReactNode
  onClick: () => void
  kind?: 'neutral' | 'warn' | 'danger'
}) {
  const cls =
    kind === 'danger'
      ? 'border-red-400/50 text-red-600 hover:bg-red-500/10 dark:text-red-400'
      : kind === 'warn'
        ? 'border-amber-400/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400'
        : 'border-zinc-300 text-zinc-600 hover:bg-zinc-200/80 dark:border-white/10 dark:text-zinc-300'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition ${cls}`}
    >
      {children}
    </button>
  )
}
