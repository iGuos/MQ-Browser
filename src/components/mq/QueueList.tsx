import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { QueueInfo, RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/tauri'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { toast } from '@/stores/toastStore'
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState<null | 'purge' | 'delete'>(null)

  const keyOf = (q: QueueInfo) => `${q.vhost}::${q.name}`
  const toggle = (q: QueueInfo) =>
    setSelected((s) => {
      const next = new Set(s)
      const k = keyOf(q)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

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
        {selected.size > 0 ? (
          <>
            <span className="text-[11px] text-zinc-500">
              {t('queues.batch.selected', { count: selected.size })}
            </span>
            <button
              type="button"
              onClick={() => setBulkConfirm('purge')}
              className="rounded-md border border-amber-400/60 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
            >
              {t('queues.batch.purge')}
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirm('delete')}
              className="rounded-md border border-red-400/60 px-2 py-1 text-[11px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
            >
              {t('queues.batch.delete')}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 dark:border-white/10 dark:text-zinc-300"
            >
              {t('queues.batch.clear')}
            </button>
          </>
        ) : null}
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
              <th className="w-8 px-2">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((q) => selected.has(keyOf(q)))}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(filtered.map(keyOf)))
                    else setSelected(new Set())
                  }}
                  aria-label="Select all"
                />
              </th>
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
                <td className="px-2 align-middle">
                  <input
                    type="checkbox"
                    checked={selected.has(keyOf(q))}
                    onChange={() => toggle(q)}
                    aria-label={`Select ${q.name}`}
                  />
                </td>
                <Td>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">{q.name}</span>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {q.durable ? <Badge>durable</Badge> : null}
                    {q.autoDelete ? <Badge>auto-delete</Badge> : null}
                    {q.exclusive ? <Badge>exclusive</Badge> : null}
                    {q.arguments && (q.arguments as Record<string, unknown>)['x-dead-letter-exchange'] ? (
                      <Badge tone="warn">
                        DLQ → {String((q.arguments as Record<string, unknown>)['x-dead-letter-exchange'])}
                      </Badge>
                    ) : null}
                    {q.arguments && (q.arguments as Record<string, unknown>)['x-message-ttl'] ? (
                      <Badge tone="info">
                        TTL {String((q.arguments as Record<string, unknown>)['x-message-ttl'])}ms
                      </Badge>
                    ) : null}
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
                <td colSpan={9} className="px-3 py-6 text-center text-zinc-500">
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
          try {
            await api.purgeQueue(connection, target.vhost, target.name)
            toast.success(t('queues.action.purge') + ' ' + target.name)
            void fetchTopology(workspaceId, connection, activeVhost)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
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
          try {
            await api.deleteQueue(connection, target.vhost, target.name)
            toast.success(t('queues.action.delete') + ' ' + target.name)
            void fetchTopology(workspaceId, connection, activeVhost)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
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

      <Modal
        open={bulkConfirm !== null}
        title={
          bulkConfirm === 'delete'
            ? t('queues.batch.deleteConfirmTitle')
            : t('queues.batch.purgeConfirmTitle')
        }
        cancelText={t('queues.cancel')}
        okText={bulkConfirm === 'delete' ? t('queues.action.delete') : t('queues.action.purge')}
        onCancel={() => setBulkConfirm(null)}
        onOk={async () => {
          const op = bulkConfirm
          setBulkConfirm(null)
          if (!op) return
          const list = (slice?.queues ?? []).filter((q) => selected.has(keyOf(q)))
          let ok = 0
          let fail = 0
          for (const q of list) {
            try {
              if (op === 'delete') await api.deleteQueue(connection, q.vhost, q.name)
              else await api.purgeQueue(connection, q.vhost, q.name)
              ok++
            } catch (e) {
              fail++
              toast.error(`${q.name}: ${e instanceof Error ? e.message : String(e)}`)
            }
          }
          setSelected(new Set())
          if (fail === 0) toast.success(t('queues.batch.done', { count: ok }))
          else toast.warning(t('queues.batch.partial', { ok, fail }))
          void fetchTopology(workspaceId, connection, activeVhost)
        }}
      >
        {t('queues.batch.confirmDetail', { count: selected.size })}
      </Modal>
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

function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'warn' | 'info'
}) {
  const cls =
    tone === 'warn'
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
      : tone === 'info'
        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
        : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
  return (
    <span className={`inline-flex items-center rounded px-1 py-0 text-[9px] uppercase tracking-wide ${cls}`}>
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
