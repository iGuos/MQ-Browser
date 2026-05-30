import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BindingInfo, ExchangeInfo, RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/tauri'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { EmptyState } from '@/components/EmptyState'
import { CreateExchangeDialog } from './CreateExchangeDialog'
import { ExchangeDetailDrawer } from './ExchangeDetailDrawer'

type Slice =
  | {
      exchanges: ExchangeInfo[]
      bindings?: BindingInfo[]
      status: 'idle' | 'loading' | 'ok' | 'error'
    }
  | null

export function ExchangeList({
  slice,
  connection,
}: {
  slice: Slice
  connection: RabbitConnection
}) {
  const { t } = useTranslation()
  const workspaceId = useWorkspaceId()
  const activeVhost = useWorkspaceUiStore((s) => s.activeVhostByWs[workspaceId] ?? null)
  const fetchTopology = useTopologyStore((s) => s.fetch)
  const [filter, setFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ExchangeInfo | null>(null)
  const [detailTarget, setDetailTarget] = useState<ExchangeInfo | null>(null)
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = slice?.exchanges ?? []
    if (!q) return list
    return list.filter((x) => x.name.toLowerCase().includes(q) || x.type.toLowerCase().includes(q))
  }, [slice, filter])

  const total = slice?.exchanges?.length ?? 0
  if (total === 0 && slice?.status === 'ok') {
    return (
      <>
        <EmptyState
          icon="🚏"
          title={t('exchanges.empty.title')}
          hint={t('exchanges.empty.hint')}
          cta={{ label: t('create.exchange.button'), onClick: () => setShowCreate(true) }}
        />
        <CreateExchangeDialog
          open={showCreate}
          connection={connection}
          vhost={activeVhost ?? connection.vhost}
          onClose={() => setShowCreate(false)}
          onCreated={() => void fetchTopology(workspaceId, connection, activeVhost)}
        />
      </>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('exchanges.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('exchanges.count', { count: filtered.length })}
        </span>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 px-2.5 py-1.5 text-[11px] font-medium text-zinc-950 hover:from-cyan-400 hover:to-teal-400"
        >
          + {t('create.exchange.button')}
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('exchanges.col.name')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('exchanges.col.vhost')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('exchanges.col.type')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('exchanges.col.flags')}
              </th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase">
                {t('queues.col.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={`${e.vhost}::${e.name}::${e.type}`}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setDetailTarget(e)}
                    className="font-mono text-zinc-900 hover:text-cyan-700 hover:underline dark:text-zinc-100 dark:hover:text-cyan-300"
                  >
                    {e.name || <span className="text-zinc-500">(AMQP default)</span>}
                  </button>
                </td>
                <td className="px-3 py-2 font-mono">{e.vhost}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cyan-700 dark:text-cyan-300">
                    {e.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-[11px]">
                  {e.durable ? 'durable ' : ''}
                  {e.autoDelete ? 'auto-delete ' : ''}
                  {e.internal ? 'internal' : ''}
                </td>
                <td className="px-3 py-2 text-right">
                  {/* Default + system exchanges (name "" or "amq.*") cannot be deleted. */}
                  {e.name && !e.name.startsWith('amq.') ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(e)}
                      className="rounded-md border border-red-400/50 px-2 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    >
                      {t('queues.action.delete')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  {t('exchanges.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <CreateExchangeDialog
        open={showCreate}
        connection={connection}
        vhost={activeVhost ?? connection.vhost}
        onClose={() => setShowCreate(false)}
        onCreated={() => void fetchTopology(workspaceId, connection, activeVhost)}
      />

      <ExchangeDetailDrawer
        open={detailTarget !== null}
        exchange={detailTarget}
        allBindings={slice?.bindings ?? []}
        onClose={() => setDetailTarget(null)}
      />

      <Modal
        open={confirmDelete !== null}
        title={t('exchanges.deleteConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('queues.action.delete')}
        onCancel={() => setConfirmDelete(null)}
        onOk={async () => {
          const target = confirmDelete
          setConfirmDelete(null)
          if (!target) return
          await api.deleteExchange(connection, target.vhost, target.name)
          void fetchTopology(workspaceId, connection, activeVhost)
        }}
      >
        {t('exchanges.deleteConfirmDetail', { name: confirmDelete?.name ?? '' })}
      </Modal>
    </div>
  )
}
