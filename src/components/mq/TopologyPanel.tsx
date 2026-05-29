import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DetailTab, RabbitConnection } from '@shared/types'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useConnectionsStore } from '@/stores/connectionsStore'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { useTopologyStore } from '@/stores/topologyStore'
import { QueueList } from './QueueList'
import { ExchangeList } from './ExchangeList'
import { BindingList } from './BindingList'
import { OverviewCard } from './OverviewCard'
import { PublishDialog } from './PublishDialog'
import { UsageGuideModal } from '@/components/usage/UsageGuideModal'

const TAB_ORDER: DetailTab[] = ['overview', 'queues', 'exchanges', 'bindings', 'publish']

export function TopologyPanel() {
  const { t } = useTranslation()
  const workspaceId = useWorkspaceId()
  const connections = useConnectionsStore((s) => s.connections)
  const selectedId = useWorkspaceUiStore((s) => s.selectedConnByWs[workspaceId] ?? null)
  const activeVhost = useWorkspaceUiStore((s) => s.activeVhostByWs[workspaceId] ?? null)
  const setActiveVhost = useWorkspaceUiStore((s) => s.setActiveVhost)
  const detailTab = useWorkspaceUiStore((s) => s.detailTabByWs[workspaceId] ?? 'queues')
  const setDetailTab = useWorkspaceUiStore((s) => s.setDetailTab)
  const fetchTopology = useTopologyStore((s) => s.fetch)

  const selected = useMemo<RabbitConnection | null>(
    () => connections.find((c) => c.id === selectedId) ?? null,
    [connections, selectedId],
  )

  const slice = useTopologyStore((s) =>
    s.byKey[`${workspaceId}::${selectedId ?? '<none>'}::${activeVhost ?? '<all>'}`],
  )

  useEffect(() => {
    if (!selected) return
    void fetchTopology(workspaceId, selected, activeVhost)
  }, [workspaceId, selected, activeVhost, fetchTopology])

  const [showUsage, setShowUsage] = useState(false)

  if (!selected) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-zinc-50/40 dark:bg-zinc-950/40">
        <div className="max-w-md select-none px-8 text-center">
          <div className="mb-3 text-3xl">📨</div>
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
            {t('panel.empty.title')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-500">
            {t('panel.empty.hint')}
          </p>
          <button
            type="button"
            onClick={() => setShowUsage(true)}
            className="mt-4 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:border-cyan-400/60 hover:text-cyan-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-cyan-300"
          >
            {t('panel.empty.usage')}
          </button>
          <UsageGuideModal open={showUsage} onClose={() => setShowUsage(false)} />
        </div>
      </div>
    )
  }

  const status = slice?.status ?? 'idle'
  const vhosts = slice?.vhosts ?? []

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50/40 dark:bg-zinc-950/40">
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-white/80 px-4 py-2 backdrop-blur-md dark:border-white/[0.06] dark:bg-zinc-950/80">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {selected.name || selected.host}
          </div>
          <div className="truncate font-mono text-[11px] text-zinc-500">
            {selected.tls ? 'amqps' : 'amqp'}://{selected.host}:{selected.amqpPort} · mgmt:
            {selected.mgmtPort}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="text-[11px] text-zinc-500 dark:text-zinc-500">{t('panel.vhost')}</label>
          <select
            value={activeVhost ?? ''}
            onChange={(e) => setActiveVhost(workspaceId, e.target.value || null)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-zinc-900"
          >
            <option value="">{t('panel.allVhosts')}</option>
            {vhosts.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name === '/' ? '/ (default)' : v.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void fetchTopology(workspaceId, selected, activeVhost)}
            disabled={status === 'loading'}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:border-cyan-400/60 hover:text-cyan-700 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300"
          >
            {status === 'loading' ? t('panel.refreshing') : t('panel.refresh')}
          </button>
        </div>
      </header>

      <nav
        role="tablist"
        className="flex shrink-0 items-center gap-1 border-b border-zinc-200/80 bg-white/40 px-2 dark:border-white/[0.06] dark:bg-zinc-950/50"
      >
        {TAB_ORDER.map((tab) => {
          const active = detailTab === tab
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setDetailTab(workspaceId, tab)}
              className={`relative px-3 py-2 text-xs font-medium transition ${
                active
                  ? 'text-cyan-700 dark:text-cyan-300'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {t(`panel.tab.${tab}`)}
              {active ? (
                <span
                  className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-teal-500"
                  aria-hidden
                />
              ) : null}
            </button>
          )
        })}
        <div className="ml-auto pr-2">
          {status === 'error' ? (
            <span className="text-[11px] text-red-600 dark:text-red-400" title={slice?.error ?? ''}>
              {t('panel.errorShort')}
            </span>
          ) : null}
        </div>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {status === 'error' ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">
            {slice?.error}
          </div>
        ) : null}
        {detailTab === 'overview' ? (
          <OverviewCard slice={slice ?? null} connection={selected} />
        ) : detailTab === 'queues' ? (
          <QueueList connection={selected} vhost={activeVhost} slice={slice ?? null} />
        ) : detailTab === 'exchanges' ? (
          <ExchangeList slice={slice ?? null} />
        ) : detailTab === 'bindings' ? (
          <BindingList slice={slice ?? null} />
        ) : (
          <PublishDialog connection={selected} vhost={activeVhost} slice={slice ?? null} />
        )}
      </div>
    </div>
  )
}
