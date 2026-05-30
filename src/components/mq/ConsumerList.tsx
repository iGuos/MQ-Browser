import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConsumerInfo } from '@shared/types'
import { exportCsv } from '@/lib/csv'
import { SortableTh } from '@/components/SortableTh'
import { useSortable } from '@/lib/sort'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'

type Slice =
  | {
      consumers: ConsumerInfo[]
      status: 'idle' | 'loading' | 'ok' | 'error'
    }
  | null

export function ConsumerList({ slice }: { slice: Slice }) {
  const { t } = useTranslation()
  const workspaceId = useWorkspaceId()
  const nav = useWorkspaceUiStore((s) => s.navByWs[workspaceId])
  const navigateTo = useWorkspaceUiStore((s) => s.navigateTo)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!nav) return
    if (nav.diagnosticsSection === 'consumers') setFilter(nav.filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav?.nonce])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = slice?.consumers ?? []
    if (!q) return list
    return list.filter(
      (c) =>
        c.queue.toLowerCase().includes(q) ||
        c.consumerTag.toLowerCase().includes(q) ||
        c.vhost.toLowerCase().includes(q) ||
        c.channel.toLowerCase().includes(q),
    )
  }, [slice, filter])

  type SortKey =
    | 'queue'
    | 'vhost'
    | 'consumerTag'
    | 'channel'
    | 'prefetchCount'
    | 'ackRequired'
    | 'activityStatus'
  const { sorted, sort, toggle } = useSortable<ConsumerInfo, SortKey>(filtered)

  if (slice?.status === 'loading' && filtered.length === 0) {
    return <div className="text-xs text-zinc-500">{t('panel.loading')}</div>
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('consumers.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('consumers.count', { count: filtered.length })}
        </span>
        <button
          type="button"
          disabled={filtered.length === 0}
          onClick={() =>
            exportCsv(
              filtered as unknown as Array<Record<string, unknown>>,
              [
                { key: 'queue', label: 'queue' },
                { key: 'vhost', label: 'vhost' },
                { key: 'consumerTag', label: 'consumer_tag' },
                { key: 'channel', label: 'channel' },
                { key: 'prefetchCount', label: 'prefetch_count' },
                { key: 'exclusive', label: 'exclusive' },
                { key: 'ackRequired', label: 'ack_required' },
                { key: 'activityStatus', label: 'activity_status' },
              ],
              'consumers.csv',
            )
          }
          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:border-cyan-400/50 hover:text-cyan-700 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300"
        >
          {t('csv.export')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <SortableTh sortKey="queue" sortState={sort} onSort={toggle}>
                {t('consumers.col.queue')}
              </SortableTh>
              <SortableTh sortKey="vhost" sortState={sort} onSort={toggle}>
                {t('consumers.col.vhost')}
              </SortableTh>
              <SortableTh sortKey="consumerTag" sortState={sort} onSort={toggle}>
                {t('consumers.col.tag')}
              </SortableTh>
              <SortableTh sortKey="channel" sortState={sort} onSort={toggle}>
                {t('consumers.col.channel')}
              </SortableTh>
              <SortableTh sortKey="prefetchCount" sortState={sort} onSort={toggle} align="right">
                {t('consumers.col.prefetch')}
              </SortableTh>
              <SortableTh sortKey="ackRequired" sortState={sort} onSort={toggle}>
                {t('consumers.col.ack')}
              </SortableTh>
              <SortableTh sortKey="activityStatus" sortState={sort} onSort={toggle}>
                {t('consumers.col.status')}
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={`${c.vhost}::${c.queue}::${c.consumerTag}::${i}`}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <td className="px-3 py-2 align-middle font-mono">
                  <button
                    type="button"
                    title={t('consumers.openQueue')}
                    onClick={() =>
                      navigateTo(workspaceId, {
                        detailTab: 'queues',
                        openQueueName: c.queue,
                      })
                    }
                    className="rounded px-1 text-zinc-900 hover:bg-cyan-500/10 hover:text-cyan-700 hover:underline dark:text-zinc-100 dark:hover:text-cyan-300"
                  >
                    {c.queue}
                  </button>
                </td>
                <td className="px-3 py-2 align-middle font-mono">{c.vhost}</td>
                <td className="px-3 py-2 align-middle font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                  {c.consumerTag}
                  {c.exclusive ? (
                    <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] uppercase text-amber-700 dark:text-amber-300">
                      exclusive
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-middle font-mono text-[10px]">
                  <button
                    type="button"
                    title={t('consumers.openChannel')}
                    onClick={() =>
                      navigateTo(workspaceId, {
                        diagnosticsSection: 'channels',
                        filter: c.channel,
                      })
                    }
                    className="rounded px-1 text-zinc-600 hover:bg-cyan-500/10 hover:text-cyan-700 hover:underline dark:text-zinc-400 dark:hover:text-cyan-300"
                  >
                    {c.channel}
                  </button>
                </td>
                <td className="px-3 py-2 text-right align-middle">{c.prefetchCount}</td>
                <td className="px-3 py-2 align-middle">
                  {c.ackRequired ? 'manual' : 'auto'}
                </td>
                <td className="px-3 py-2 align-middle">
                  <span
                    className={
                      c.activityStatus === 'up'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {c.activityStatus || '-'}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  {t('consumers.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

