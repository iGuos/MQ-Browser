import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExchangeInfo } from '@shared/types'

type Slice = { exchanges: ExchangeInfo[]; status: 'idle' | 'loading' | 'ok' | 'error' } | null

export function ExchangeList({ slice }: { slice: Slice }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = slice?.exchanges ?? []
    if (!q) return list
    return list.filter((x) => x.name.toLowerCase().includes(q) || x.type.toLowerCase().includes(q))
  }, [slice, filter])

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('exchanges.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('exchanges.count', { count: filtered.length })}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('exchanges.col.name')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('exchanges.col.vhost')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('exchanges.col.type')}
              </th>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase">
                {t('exchanges.col.flags')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={`${e.vhost}::${e.name}::${e.type}`}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <td className="px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100">
                  {e.name || <span className="text-zinc-500">(AMQP default)</span>}
                </td>
                <td className="px-3 py-2 font-mono">{e.vhost}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-cyan-700 dark:text-cyan-300">
                    {e.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-[11px]">
                  {e.durable ? 'durable ' : ''}
                  {e.autoDelete ? 'auto-delete ' : ''}
                  {e.internal ? 'internal' : ''}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                  {t('exchanges.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
