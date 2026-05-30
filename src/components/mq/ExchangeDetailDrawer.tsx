import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { BindingInfo, ExchangeInfo } from '@shared/types'
import { Drawer } from '@/components/Drawer'

interface Props {
  open: boolean
  exchange: ExchangeInfo | null
  allBindings: BindingInfo[]
  onClose: () => void
}

export function ExchangeDetailDrawer({ open, exchange, allBindings, onClose }: Props) {
  const { t } = useTranslation()

  const outbound = useMemo(() => {
    if (!exchange) return []
    return allBindings.filter(
      (b) => b.vhost === exchange.vhost && b.source === exchange.name,
    )
  }, [allBindings, exchange])

  const toQueue = outbound.filter((b) => b.destinationType === 'queue')
  const toExchange = outbound.filter((b) => b.destinationType === 'exchange')

  return (
    <Drawer
      open={open && exchange !== null}
      title={
        <div className="flex items-center gap-2">
          <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            {exchange?.type}
          </span>
          <span className="font-mono">{exchange?.name || '(default)'}</span>
          <span className="text-[11px] text-zinc-500">@ {exchange?.vhost}</span>
        </div>
      }
      onClose={onClose}
    >
      {exchange ? (
        <div className="space-y-4">
          <section>
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {t('exchangeDetail.flags')}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              <Flag on={exchange.durable} label="durable" />
              <Flag on={exchange.autoDelete} label="auto-delete" />
              <Flag on={exchange.internal} label="internal" />
            </div>
          </section>

          <section>
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {t('exchangeDetail.toQueues', { count: toQueue.length })}
            </h4>
            <BindingList rows={toQueue} kind="queue" />
          </section>

          <section>
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {t('exchangeDetail.toExchanges', { count: toExchange.length })}
            </h4>
            <BindingList rows={toExchange} kind="exchange" />
          </section>
        </div>
      ) : null}
    </Drawer>
  )
}

function BindingList({
  rows,
  kind,
}: {
  rows: BindingInfo[]
  kind: 'queue' | 'exchange'
}) {
  const { t } = useTranslation()
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-center text-[11px] text-zinc-500 dark:border-white/10">
        {kind === 'queue' ? t('exchangeDetail.noToQueues') : t('exchangeDetail.noToExchanges')}
      </div>
    )
  }
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-white/[0.04] dark:border-white/[0.06]">
      {rows.map((b, i) => (
        <li key={i} className="px-2 py-1.5 font-mono text-[11px]">
          <span className="text-zinc-900 dark:text-zinc-100">{b.destination}</span>
          <span className="ml-2 text-[10px] text-zinc-500">rk: {b.routingKey || '∅'}</span>
        </li>
      ))}
    </ul>
  )
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
        on
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800'
      }`}
    >
      {label}
    </span>
  )
}
