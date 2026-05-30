import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChannelInfo, RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { SortableTh } from '@/components/SortableTh'
import { useSortable } from '@/lib/sort'
import { api } from '@/lib/tauri'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { toast } from '@/stores/toastStore'

type Slice =
  | {
      channels: ChannelInfo[]
      status: 'idle' | 'loading' | 'ok' | 'error'
    }
  | null

export function ChannelList({
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
  const [confirmClose, setConfirmClose] = useState<ChannelInfo | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = slice?.channels ?? []
    if (!q) return list
    return list.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.user.toLowerCase().includes(q) ||
        x.vhost.toLowerCase().includes(q),
    )
  }, [slice, filter])

  type SortKey =
    | 'name'
    | 'user'
    | 'vhost'
    | 'consumerCount'
    | 'messagesUnacknowledged'
    | 'messagesUnconfirmed'
    | 'prefetchCount'
    | 'state'
  const { sorted, sort, toggle } = useSortable<ChannelInfo, SortKey>(filtered)

  if (slice?.status === 'loading' && filtered.length === 0) {
    return <div className="text-xs text-zinc-500">{t('panel.loading')}</div>
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('channels.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('channels.count', { count: filtered.length })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <SortableTh sortKey="name" sortState={sort} onSort={toggle}>
                {t('channels.col.name')}
              </SortableTh>
              <SortableTh sortKey="user" sortState={sort} onSort={toggle}>
                {t('channels.col.user')}
              </SortableTh>
              <SortableTh sortKey="vhost" sortState={sort} onSort={toggle}>
                {t('channels.col.vhost')}
              </SortableTh>
              <SortableTh sortKey="consumerCount" sortState={sort} onSort={toggle} align="right">
                {t('channels.col.consumers')}
              </SortableTh>
              <SortableTh
                sortKey="messagesUnacknowledged"
                sortState={sort}
                onSort={toggle}
                align="right"
              >
                {t('channels.col.unacked')}
              </SortableTh>
              <SortableTh
                sortKey="messagesUnconfirmed"
                sortState={sort}
                onSort={toggle}
                align="right"
              >
                {t('channels.col.unconfirmed')}
              </SortableTh>
              <SortableTh sortKey="prefetchCount" sortState={sort} onSort={toggle} align="right">
                {t('channels.col.prefetch')}
              </SortableTh>
              <SortableTh sortKey="state" sortState={sort} onSort={toggle}>
                {t('channels.col.state')}
              </SortableTh>
              <SortableTh sortKey={null} sortState={sort} onSort={toggle} align="right">
                {t('queues.col.actions')}
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.name}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <Td>
                  <span className="font-mono text-[10px] text-zinc-700 dark:text-zinc-300">
                    {c.name}
                  </span>
                </Td>
                <Td>{c.user}</Td>
                <Td>
                  <span className="font-mono">{c.vhost}</span>
                </Td>
                <Td align="right">{c.consumerCount}</Td>
                <Td align="right">{c.messagesUnacknowledged}</Td>
                <Td align="right">{c.messagesUnconfirmed}</Td>
                <Td align="right">{c.prefetchCount}</Td>
                <Td>
                  <span
                    className={
                      c.state === 'running'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {c.state || '-'}
                  </span>
                </Td>
                <Td align="right">
                  <button
                    type="button"
                    onClick={() => setConfirmClose(c)}
                    className="rounded-md border border-red-400/50 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
                  >
                    {t('connections.action.close')}
                  </button>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-zinc-500">
                  {t('channels.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={confirmClose !== null}
        title={t('channels.closeConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('connections.action.close')}
        onCancel={() => setConfirmClose(null)}
        onOk={async () => {
          const target = confirmClose
          setConfirmClose(null)
          if (!target) return
          try {
            await api.closeChannel(connection, target.name, 'Closed via MQ Browser')
            toast.success(t('channels.closed', { name: target.name }))
            void fetchTopology(workspaceId, connection, activeVhost)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        {t('channels.closeConfirmDetail', { name: confirmClose?.name ?? '' })}
      </Modal>
    </div>
  )
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <td className={`px-3 py-2 align-middle ${align === 'right' ? 'text-right tabular-nums' : ''}`}>
      {children}
    </td>
  )
}
