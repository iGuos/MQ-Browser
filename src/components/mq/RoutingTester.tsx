import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BindingInfo, ExchangeInfo } from '@shared/types'
import { Combobox } from '@/components/Select'

type Slice = {
  exchanges: ExchangeInfo[]
  bindings: BindingInfo[]
} | null

interface MatchedTarget {
  /** queue or exchange */
  kind: 'queue' | 'exchange'
  name: string
  vhost: string
  /** The chain of bindings traversed to reach this target. */
  via: BindingInfo[]
}

export function RoutingTester({ slice }: { slice: Slice }) {
  const { t } = useTranslation()
  const [sourceExchange, setSourceExchange] = useState('')
  const [routingKey, setRoutingKey] = useState('')

  const exchanges = slice?.exchanges ?? []
  const bindings = slice?.bindings ?? []
  const exchangesByName = useMemo(() => {
    const m = new Map<string, ExchangeInfo>()
    for (const e of exchanges) m.set(`${e.vhost}::${e.name}`, e)
    return m
  }, [exchanges])

  const result = useMemo<MatchedTarget[]>(() => {
    if (!sourceExchange.trim() && routingKey.trim() === '') return []
    const out: MatchedTarget[] = []
    const visited = new Set<string>()

    function walk(exchangeName: string, vhost: string, rk: string, chain: BindingInfo[]) {
      const exKey = `${vhost}::${exchangeName}`
      if (visited.has(exKey)) return // cycle protection
      visited.add(exKey)

      const exchange = exchangesByName.get(exKey)
      const type = exchange?.type ?? 'direct'

      for (const b of bindings) {
        if (b.vhost !== vhost) continue
        if (b.source !== exchangeName) continue
        if (!routeMatches(type, b, rk)) continue

        const nextChain = [...chain, b]
        if (b.destinationType === 'queue') {
          out.push({ kind: 'queue', name: b.destination, vhost, via: nextChain })
        } else {
          // exchange-to-exchange — continue walking with the same routing key
          out.push({ kind: 'exchange', name: b.destination, vhost, via: nextChain })
          walk(b.destination, vhost, rk, nextChain)
        }
      }
    }

    // Default vhost lookup heuristic: pick the vhost the source belongs to
    // (matching first hit; user must pick a specific exchange anyway).
    const srcMatches = exchanges.filter((e) => e.name === sourceExchange.trim())
    for (const src of srcMatches) {
      walk(src.name, src.vhost, routingKey, [])
    }
    return out
  }, [exchanges, bindings, exchangesByName, sourceExchange, routingKey])

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-white/[0.06] dark:bg-zinc-900">
        <p className="mb-3 text-[11px] text-zinc-500">{t('routing.intro')}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {t('routing.source')}
            </span>
            <Combobox
              value={sourceExchange}
              onChange={setSourceExchange}
              options={exchanges.map((x) => ({
                value: x.name,
                label: x.name || '(default)',
                hint: `${x.type} · ${x.vhost}`,
              }))}
              placeholder="exchange name"
              inputClassName={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {t('routing.routingKey')}
            </span>
            <input
              className={inputCls}
              value={routingKey}
              onChange={(e) => setRoutingKey(e.target.value)}
              placeholder="orders.created"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <div className="border-b border-zinc-200 px-3 py-2 text-xs font-medium dark:border-white/[0.06]">
          {t('routing.matched', { count: result.length })}
        </div>
        {result.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">
            {sourceExchange.trim() ? t('routing.noMatch') : t('routing.fillIn')}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-white/[0.04]">
            {result.map((m, i) => (
              <li key={i} className="px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                      m.kind === 'queue'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                    }`}
                  >
                    {m.kind}
                  </span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">{m.name}</span>
                  <span className="text-zinc-500">@ {m.vhost}</span>
                </div>
                {m.via.length > 0 ? (
                  <div className="mt-1 ml-3 text-[10px] font-mono text-zinc-500">
                    {m.via.map((b, j) => (
                      <span key={j}>
                        {j > 0 ? ' → ' : ''}
                        {b.source || '(default)'}
                        <span className="text-zinc-400">[{b.routingKey || '∅'}]</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * Local implementation of RabbitMQ's routing-match logic.
 * Doesn't cover x-* custom types or full headers semantics (would need
 * arguments inspection on the binding), but handles direct / fanout / topic.
 */
function routeMatches(exchangeType: string, b: BindingInfo, routingKey: string): boolean {
  switch (exchangeType) {
    case 'fanout':
      return true
    case 'topic':
      return topicMatch(b.routingKey, routingKey)
    case 'headers':
      // Without inspecting the message's actual headers, we can't determine
      // a match. Surface it conservatively as "potentially matches".
      return true
    case 'direct':
    default:
      return b.routingKey === routingKey
  }
}

/** Translate AMQP topic pattern (`*` = one word, `#` = zero or more words) to regex. */
function topicMatch(pattern: string, key: string): boolean {
  const re = pattern
    .split('.')
    .map((seg) => (seg === '*' ? '[^.]+' : seg === '#' ? '.*' : escapeRegex(seg)))
    .join('\\.')
  return new RegExp(`^${re}$`).test(key)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const inputCls =
  'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100'
