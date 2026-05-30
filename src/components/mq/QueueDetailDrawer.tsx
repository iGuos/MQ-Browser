import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  BindingInfo,
  ConsumerInfo,
  QueueInfo,
} from '@shared/types'
import { Drawer } from '@/components/Drawer'

interface Props {
  open: boolean
  queue: QueueInfo | null
  allBindings: BindingInfo[]
  allConsumers: ConsumerInfo[]
  onClose: () => void
  onPeek: (queue: QueueInfo) => void
}

export function QueueDetailDrawer({
  open,
  queue,
  allBindings,
  allConsumers,
  onClose,
  onPeek,
}: Props) {
  const { t } = useTranslation()

  const inboundBindings = useMemo(() => {
    if (!queue) return []
    return allBindings.filter(
      (b) =>
        b.vhost === queue.vhost &&
        b.destination === queue.name &&
        b.destinationType === 'queue',
    )
  }, [allBindings, queue])

  const consumers = useMemo(() => {
    if (!queue) return []
    return allConsumers.filter((c) => c.vhost === queue.vhost && c.queue === queue.name)
  }, [allConsumers, queue])

  const args = useMemo(
    () => (queue?.arguments as Record<string, unknown> | undefined) ?? {},
    [queue],
  )

  return (
    <Drawer
      open={open && queue !== null}
      title={
        <div className="flex items-center gap-2">
          <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            queue
          </span>
          <span className="font-mono">{queue?.name}</span>
          <span className="text-[11px] text-zinc-500">@ {queue?.vhost}</span>
        </div>
      }
      onClose={onClose}
    >
      {queue ? (
        <div className="space-y-4">
          {/* Metrics ----------------------------------------------------- */}
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

          {/* Flags ------------------------------------------------------- */}
          <Section title={t('queueDetail.flags')}>
            <div className="flex flex-wrap gap-1.5">
              <Flag on={queue.durable} label="durable" />
              <Flag on={queue.autoDelete} label="auto-delete" />
              <Flag on={queue.exclusive} label="exclusive" />
            </div>
          </Section>

          {/* Arguments --------------------------------------------------- */}
          {Object.keys(args).length > 0 ? (
            <Section title={t('queueDetail.arguments')}>
              <table className="w-full text-[11px]">
                <tbody>
                  {Object.entries(args).map(([k, v]) => (
                    <tr key={k} className="border-t border-zinc-200/60 dark:border-white/[0.04]">
                      <td className="py-1 pr-3 font-mono text-zinc-600 dark:text-zinc-400">{k}</td>
                      <td className="py-1 font-mono text-zinc-900 dark:text-zinc-100">
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          {/* Bindings ---------------------------------------------------- */}
          <Section
            title={t('queueDetail.inboundBindings', { count: inboundBindings.length })}
          >
            {inboundBindings.length === 0 ? (
              <Empty>{t('queueDetail.noBindings')}</Empty>
            ) : (
              <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-white/[0.04] dark:border-white/[0.06]">
                {inboundBindings.map((b, i) => (
                  <li key={i} className="px-2 py-1.5 font-mono text-[11px]">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {b.source || '(default exchange)'}
                    </span>
                    <span className="mx-1 text-zinc-400">→</span>
                    <span className="text-zinc-900 dark:text-zinc-100">{queue.name}</span>
                    <span className="ml-2 text-[10px] text-zinc-500">
                      rk: {b.routingKey || '∅'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Consumers --------------------------------------------------- */}
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
                      ch: <span className="font-mono">{c.channel}</span> · prefetch{' '}
                      {c.prefetchCount} · {c.ackRequired ? 'manual ack' : 'auto ack'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Actions ----------------------------------------------------- */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onPeek(queue)}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1.5 text-xs font-medium text-zinc-950"
            >
              {t('queueDetail.peekMessages')}
            </button>
          </div>
        </div>
      ) : null}
    </Drawer>
  )
}

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
