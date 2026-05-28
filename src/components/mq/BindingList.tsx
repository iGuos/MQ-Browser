import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BindingInfo } from '@shared/types'

type Slice = { bindings: BindingInfo[]; status: 'idle' | 'loading' | 'ok' | 'error' } | null

export function BindingList({ slice }: { slice: Slice }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
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
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  {t('bindings.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
