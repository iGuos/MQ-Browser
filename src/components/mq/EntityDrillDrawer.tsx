import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  BindingInfo,
  ConsumerInfo,
  ExchangeInfo,
  QueueInfo,
} from '@shared/types'
import { Drawer } from '@/components/Drawer'

type DrillTarget =
  | { kind: 'queue'; vhost: string; name: string }
  | { kind: 'exchange'; vhost: string; name: string }

interface Props {
  initial: DrillTarget | null
  onClose: () => void
  /** All loaded queues for resolving drill targets by name. */
  queues: QueueInfo[]
  exchanges: ExchangeInfo[]
  bindings: BindingInfo[]
  consumers: ConsumerInfo[]
  /** Optional peek-messages hook for queue view. */
  onPeek?: (queue: QueueInfo) => void
}

/**
 * Single shared drawer for queue + exchange details. Maintains a back stack
 * so users can drill from an exchange into a bound queue (or chain
 * exchange → exchange) and return.
 */
export function EntityDrillDrawer({
  initial,
  onClose,
  queues,
  exchanges,
  bindings,
  consumers,
  onPeek,
}: Props) {
  const { t } = useTranslation()
  const [stack, setStack] = useState<DrillTarget[]>(initial ? [initial] : [])

  // When parent flips initial (open new entity), reset the stack.
  useEffect(() => {
    setStack(initial ? [initial] : [])
  }, [initial?.kind, initial?.vhost, initial?.name])

  const current = stack[stack.length - 1]
  const drillInto = (t: DrillTarget) => setStack((s) => [...s, t])
  const back = () => setStack((s) => s.slice(0, -1))

  if (!current) return null

  // Resolve the current target's data.
  const queue =
    current.kind === 'queue'
      ? queues.find((q) => q.vhost === current.vhost && q.name === current.name)
      : null
  const exchange =
    current.kind === 'exchange'
      ? exchanges.find((e) => e.vhost === current.vhost && e.name === current.name)
      : null

  const title = (
    <div className="flex min-w-0 items-center gap-2">
      {stack.length > 1 ? (
        <button
          type="button"
          onClick={back}
          className="shrink-0 rounded-md border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 hover:border-cyan-400/50 hover:text-cyan-700 dark:border-white/10 dark:text-zinc-300"
          title={t('drill.back')}
        >
          ← {t('drill.back')}
        </button>
      ) : null}
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
          current.kind === 'queue'
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
        }`}
      >
        {current.kind === 'queue' ? 'queue' : exchange?.type ?? 'exchange'}
      </span>
      <span className="truncate font-mono">{current.name || '(default)'}</span>
      <span className="shrink-0 text-[11px] text-zinc-500">@ {current.vhost}</span>
    </div>
  )

  return (
    <Drawer open title={title} onClose={onClose}>
      {current.kind === 'queue' && queue ? (
        <QueueDetail
          queue={queue}
          allBindings={bindings}
          allConsumers={consumers}
          onPeek={onPeek}
          onDrillTo={drillInto}
        />
      ) : current.kind === 'exchange' && exchange ? (
        <ExchangeDetail
          exchange={exchange}
          allBindings={bindings}
          onDrillTo={drillInto}
        />
      ) : (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          {t('drill.notFound', { name: current.name })}
        </div>
      )}
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Queue content
// ---------------------------------------------------------------------------

function QueueDetail({
  queue,
  allBindings,
  allConsumers,
  onPeek,
  onDrillTo,
}: {
  queue: QueueInfo
  allBindings: BindingInfo[]
  allConsumers: ConsumerInfo[]
  onPeek?: (q: QueueInfo) => void
  onDrillTo: (t: DrillTarget) => void
}) {
  const { t } = useTranslation()
  const inbound = useMemo(
    () =>
      allBindings.filter(
        (b) =>
          b.vhost === queue.vhost &&
          b.destination === queue.name &&
          b.destinationType === 'queue',
      ),
    [allBindings, queue],
  )
  const consumers = useMemo(
    () => allConsumers.filter((c) => c.vhost === queue.vhost && c.queue === queue.name),
    [allConsumers, queue],
  )
  const args = (queue.arguments as Record<string, unknown> | undefined) ?? {}
  const dlx = args['x-dead-letter-exchange']

  return (
    <div className="space-y-4">
      <Section title={t('queueDetail.metrics')}>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="ready" value={queue.messagesReady} />
          <Metric label="unacked" value={queue.messagesUnacknowledged} />
          <Metric label="total" value={queue.messages} accent />
          <Metric label="consumers" value={queue.consumers} />
          <Metric label="state" value={queue.state} />
          <Metric label="node" value={queue.node || '—'} />
        </div>
      </Section>

      <Section title={t('queueDetail.flags')}>
        <div className="flex flex-wrap gap-1.5">
          <Flag on={queue.durable} label="durable" />
          <Flag on={queue.autoDelete} label="auto-delete" />
          <Flag on={queue.exclusive} label="exclusive" />
        </div>
      </Section>

      {Object.keys(args).length > 0 ? (
        <Section title={t('queueDetail.arguments')}>
          <table className="w-full text-[11px]">
            <tbody>
              {Object.entries(args).map(([k, v]) => (
                <tr key={k} className="border-t border-zinc-200/60 dark:border-white/[0.04]">
                  <td className="py-1 pr-3 font-mono text-zinc-600 dark:text-zinc-400">{k}</td>
                  <td className="py-1 font-mono text-zinc-900 dark:text-zinc-100">
                    {/* If this is a DLX reference, make it clickable. */}
                    {k === 'x-dead-letter-exchange' && typeof v === 'string' ? (
                      <button
                        type="button"
                        onClick={() =>
                          onDrillTo({ kind: 'exchange', vhost: queue.vhost, name: v })
                        }
                        className="rounded px-1 text-cyan-700 hover:bg-cyan-500/10 hover:underline dark:text-cyan-300"
                      >
                        {v}
                      </button>
                    ) : typeof v === 'object' ? (
                      JSON.stringify(v)
                    ) : (
                      String(v)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dlx ? null : null}
        </Section>
      ) : null}

      <Section title={t('queueDetail.inboundBindings', { count: inbound.length })}>
        {inbound.length === 0 ? (
          <Empty>{t('queueDetail.noBindings')}</Empty>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-white/[0.04] dark:border-white/[0.06]">
            {inbound.map((b, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 px-2 py-1.5 font-mono text-[11px]"
              >
                <button
                  type="button"
                  onClick={() =>
                    onDrillTo({ kind: 'exchange', vhost: queue.vhost, name: b.source })
                  }
                  className="rounded px-1 text-zinc-700 hover:bg-cyan-500/10 hover:text-cyan-700 hover:underline dark:text-zinc-300 dark:hover:text-cyan-300"
                  title={t('drill.openExchange')}
                >
                  {b.source || '(default exchange)'}
                </button>
                <span className="text-zinc-400">→</span>
                <span className="text-zinc-900 dark:text-zinc-100">{queue.name}</span>
                <span className="ml-auto text-[10px] text-zinc-500">
                  rk: {b.routingKey || '∅'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('queueDetail.consumers', { count: consumers.length })}>
        {consumers.length === 0 ? (
          <Empty>{t('queueDetail.noConsumers')}</Empty>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-white/[0.04] dark:border-white/[0.06]">
            {consumers.map((c, i) => (
              <li key={i} className="px-2 py-1.5">
                <div className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                  {c.consumerTag}
                  {c.exclusive ? (
                    <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] uppercase text-amber-700 dark:text-amber-300">
                      exclusive
                    </span>
                  ) : null}
                </div>
                <div className="text-[10px] text-zinc-500">
                  ch: <span className="font-mono">{c.channel}</span> · prefetch {c.prefetchCount}{' '}
                  · {c.ackRequired ? 'manual ack' : 'auto ack'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {onPeek ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onPeek(queue)}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1.5 text-xs font-medium text-zinc-950"
          >
            {t('queueDetail.peekMessages')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exchange content
// ---------------------------------------------------------------------------

function ExchangeDetail({
  exchange,
  allBindings,
  onDrillTo,
}: {
  exchange: ExchangeInfo
  allBindings: BindingInfo[]
  onDrillTo: (t: DrillTarget) => void
}) {
  const { t } = useTranslation()
  const outbound = useMemo(
    () => allBindings.filter((b) => b.vhost === exchange.vhost && b.source === exchange.name),
    [allBindings, exchange],
  )
  const toQueue = outbound.filter((b) => b.destinationType === 'queue')
  const toExchange = outbound.filter((b) => b.destinationType === 'exchange')

  return (
    <div className="space-y-4">
      <Section title={t('exchangeDetail.flags')}>
        <div className="flex flex-wrap gap-1.5">
          <Flag on={exchange.durable} label="durable" />
          <Flag on={exchange.autoDelete} label="auto-delete" />
          <Flag on={exchange.internal} label="internal" />
        </div>
      </Section>

      <Section title={t('exchangeDetail.toQueues', { count: toQueue.length })}>
        {toQueue.length === 0 ? (
          <Empty>{t('exchangeDetail.noToQueues')}</Empty>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-white/[0.04] dark:border-white/[0.06]">
            {toQueue.map((b, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 px-2 py-1.5 font-mono text-[11px]"
              >
                <button
                  type="button"
                  onClick={() =>
                    onDrillTo({ kind: 'queue', vhost: exchange.vhost, name: b.destination })
                  }
                  className="rounded px-1 text-zinc-900 hover:bg-cyan-500/10 hover:text-cyan-700 hover:underline dark:text-zinc-100 dark:hover:text-cyan-300"
                  title={t('drill.openQueue')}
                >
                  {b.destination}
                </button>
                <span className="ml-auto text-[10px] text-zinc-500">
                  rk: {b.routingKey || '∅'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('exchangeDetail.toExchanges', { count: toExchange.length })}>
        {toExchange.length === 0 ? (
          <Empty>{t('exchangeDetail.noToExchanges')}</Empty>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-white/[0.04] dark:border-white/[0.06]">
            {toExchange.map((b, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 px-2 py-1.5 font-mono text-[11px]"
              >
                <button
                  type="button"
                  onClick={() =>
                    onDrillTo({ kind: 'exchange', vhost: exchange.vhost, name: b.destination })
                  }
                  className="rounded px-1 text-zinc-900 hover:bg-cyan-500/10 hover:text-cyan-700 hover:underline dark:text-zinc-100 dark:hover:text-cyan-300"
                  title={t('drill.openExchange')}
                >
                  {b.destination}
                </button>
                <span className="ml-auto text-[10px] text-zinc-500">
                  rk: {b.routingKey || '∅'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// shared bits
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h4>
      {children}
    </section>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-white/[0.06] dark:bg-zinc-900">
      <div className="text-[9px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div
        className={`mt-0.5 truncate text-xs font-semibold ${
          accent ? 'text-cyan-700 dark:text-cyan-300' : 'text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {value}
      </div>
    </div>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-center text-[11px] text-zinc-500 dark:border-white/10">
      {children}
    </div>
  )
}
