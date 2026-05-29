import { useTranslation } from 'react-i18next'
import type { NodeInfo } from '@shared/types'

type Slice = { nodes: NodeInfo[]; status: 'idle' | 'loading' | 'ok' | 'error' } | null

export function NodeList({ slice }: { slice: Slice }) {
  const { t } = useTranslation()
  const nodes = slice?.nodes ?? []

  if (slice?.status === 'loading' && nodes.length === 0) {
    return <div className="text-xs text-zinc-500">{t('panel.loading')}</div>
  }

  return (
    <div className="space-y-3">
      {nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-xs text-zinc-500 dark:border-white/10">
          {t('nodes.none')}
        </div>
      ) : (
        nodes.map((n) => <NodeCard key={n.name} node={n} />)
      )}
    </div>
  )
}

function NodeCard({ node }: { node: NodeInfo }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs dark:border-white/[0.06] dark:bg-zinc-900/40">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            node.running ? 'bg-emerald-500' : 'bg-red-500'
          }`}
          aria-hidden
        />
        <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {node.name}
        </span>
        {node.kind ? (
          <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            {node.kind}
          </span>
        ) : null}
        <span className="ml-auto text-zinc-500">
          {t('nodes.uptime', { hours: Math.floor(node.uptime / 3_600_000) })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] md:grid-cols-3">
        <Metric label={t('nodes.metric.mem')} used={node.memUsed} total={node.memLimit} unit="bytes" />
        <Metric label={t('nodes.metric.fd')} used={node.fdUsed} total={node.fdTotal} />
        <Metric
          label={t('nodes.metric.sockets')}
          used={node.socketsUsed}
          total={node.socketsTotal}
        />
        <Metric
          label={t('nodes.metric.disk')}
          used={Math.max(0, node.diskFreeLimit - node.diskFree)}
          total={node.diskFreeLimit}
          unit="bytes"
        />
        <Metric label={t('nodes.metric.proc')} used={node.procUsed} total={node.procTotal} />
      </div>
    </div>
  )
}

function Metric({
  label,
  used,
  total,
  unit,
}: {
  label: string
  used: number
  total: number
  unit?: 'bytes'
}) {
  const ratio = total > 0 ? Math.min(1, used / total) : 0
  const danger = ratio > 0.85
  const warn = ratio > 0.6 && !danger
  const barCls = danger
    ? 'bg-red-500'
    : warn
      ? 'bg-amber-500'
      : 'bg-emerald-500'
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className="font-mono text-[10px] text-zinc-500">
          {unit === 'bytes' ? humanBytes(used) : used.toLocaleString()}
          {total > 0 ? ` / ${unit === 'bytes' ? humanBytes(total) : total.toLocaleString()}` : ''}
        </span>
      </div>
      {total > 0 ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className={`h-full ${barCls}`} style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
        </div>
      ) : null}
    </div>
  )
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  for (let i = 0; i < units.length; i++) {
    if (v < 1024) return `${v.toFixed(1)} ${units[i]}`
    v /= 1024
  }
  return `${v.toFixed(1)} PB`
}
