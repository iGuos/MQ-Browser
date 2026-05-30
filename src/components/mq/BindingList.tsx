import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BindingInfo, ExchangeInfo, QueueInfo, RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/tauri'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { toast } from '@/stores/toastStore'
import { CreateBindingDialog } from './CreateBindingDialog'

type Slice =
  | {
      bindings: BindingInfo[]
      exchanges: ExchangeInfo[]
      queues: QueueInfo[]
      status: 'idle' | 'loading' | 'ok' | 'error'
    }
  | null

export function BindingList({
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
  const [editing, setEditing] = useState<BindingInfo | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<BindingInfo | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = slice?.bindings ?? []
    if (!q) return list
    return list.filter(
      (x) =>
        x.source.toLowerCase().includes(q) ||
        x.destination.toLowerCase().includes(q) ||
        x.routingKey.toLowerCase().includes(q),
    )
  }, [slice, filter])

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('bindings.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('bindings.count', { count: filtered.length })}
        </span>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 px-2.5 py-1.5 text-[11px] font-medium text-zinc-950 hover:from-cyan-400 hover:to-teal-400"
        >
          + {t('create.binding.button')}
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('bindings.col.source')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('bindings.col.destination')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('bindings.col.destinationType')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('bindings.col.routingKey')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('bindings.col.vhost')}
              </th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase">
                {t('queues.col.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, i) => (
              <tr
                key={`${b.vhost}::${b.source}::${b.destination}::${b.routingKey}::${i}`}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <td className="px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100">
                  {b.source || <span className="text-zinc-500">(AMQP default)</span>}
                </td>
                <td className="px-3 py-2 font-mono">{b.destination}</td>
                <td className="px-3 py-2">{b.destinationType}</td>
                <td className="px-3 py-2 font-mono">{b.routingKey}</td>
                <td className="px-3 py-2 font-mono">{b.vhost}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    {/* Default bindings (auto-created queue↔default exchange) cannot be edited/deleted. */}
                    {b.source !== '' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(b)}
                          className="rounded-md border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 hover:border-cyan-400/50 hover:text-cyan-700 dark:border-white/10 dark:text-zinc-300"
                        >
                          {t('bindings.action.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(b)}
                          className="rounded-md border border-red-400/50 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
                        >
                          {t('queues.action.delete')}
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-zinc-500">(default)</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  {t('bindings.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <CreateBindingDialog
        open={showCreate}
        connection={connection}
        vhost={activeVhost ?? connection.vhost}
        exchanges={slice?.exchanges ?? []}
        queues={slice?.queues ?? []}
        onClose={() => setShowCreate(false)}
        onCreated={() => void fetchTopology(workspaceId, connection, activeVhost)}
      />

      <CreateBindingDialog
        open={editing !== null}
        connection={connection}
        vhost={activeVhost ?? connection.vhost}
        exchanges={slice?.exchanges ?? []}
        queues={slice?.queues ?? []}
        editing={editing}
        onClose={() => setEditing(null)}
        onCreated={() => {
          toast.success(t('bindings.replaced'))
          void fetchTopology(workspaceId, connection, activeVhost)
        }}
      />

      <Modal
        open={confirmDelete !== null}
        title={t('bindings.deleteConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('queues.action.delete')}
        onCancel={() => setConfirmDelete(null)}
        onOk={async () => {
          const target = confirmDelete
          setConfirmDelete(null)
          if (!target) return
          try {
            await api.deleteBinding(connection, {
              vhost: target.vhost,
              source: target.source,
              destination: target.destination,
              destinationType: target.destinationType,
              propertiesKey: target.propertiesKey,
            })
            toast.success(t('bindings.deleted'))
            void fetchTopology(workspaceId, connection, activeVhost)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        {t('bindings.deleteConfirmDetail', {
          source: confirmDelete?.source ?? '',
          destination: confirmDelete?.destination ?? '',
          routingKey: confirmDelete?.routingKey ?? '',
        })}
      </Modal>
    </div>
  )
}
