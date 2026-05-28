import { useTranslation } from 'react-i18next'
import type { ExchangeInfo, QueueInfo, RabbitConnection } from '@shared/types'

type Slice =
  | {
      status: 'idle' | 'loading' | 'ok' | 'error'
      overview: Record<string, unknown> | null
      queues: QueueInfo[]
      exchanges: ExchangeInfo[]
    }
  | null

export function OverviewCard({
  slice,
  connection,
}: {
  slice: Slice
  connection: RabbitConnection
}) {
  const { t } = useTranslation()
  if (!slice || slice.status === 'loading') {
    return <div className="text-xs text-zinc-500">{t('panel.loading')}</div>
  }

  const ov = slice.overview ?? {}
  const stat = ov.message_stats as Record<string, number> | undefined
  const counts = ov.object_totals as Record<string, number> | undefined

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Stat label={t('overview.cluster')} value={String(ov.cluster_name ?? '—')} />
      <Stat label={t('overview.version')} value={String(ov.rabbitmq_version ?? '—')} />
      <Stat label={t('overview.product')} value={String(ov.product_name ?? 'RabbitMQ')} />
      <Stat label={t('overview.queues')} value={String(counts?.queues ?? slice.queues.length)} />
      <Stat
        label={t('overview.exchanges')}
        value={String(counts?.exchanges ?? slice.exchanges.length)}
      />
      <Stat label={t('overview.connections')} value={String(counts?.connections ?? '—')} />
      <Stat label={t('overview.consumers')} value={String(counts?.consumers ?? '—')} />
      <Stat label={t('overview.publishRate')} value={String(stat?.publish ?? '—')} />
      <Stat label={t('overview.deliverRate')} value={String(stat?.deliver_get ?? '—')} />
      <div className="col-span-2 mt-2 rounded-xl border border-zinc-200 bg-white p-3 text-[11px] font-mono text-zinc-600 dark:border-white/[0.06] dark:bg-zinc-900 dark:text-zinc-400 lg:col-span-3">
        amqp_uri: {connection.tls ? 'amqps' : 'amqp'}://{connection.username}@{connection.host}:
        {connection.amqpPort}/{connection.vhost.replace(/^\//, '') || '%2F'}
        <br />
        mgmt_api: {connection.tls ? 'https' : 'http'}://{connection.host}:{connection.mgmtPort}/api
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/[0.06] dark:bg-zinc-900">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  )
}
