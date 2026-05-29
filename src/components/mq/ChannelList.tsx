import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChannelInfo } from '@shared/types'

type Slice =
  | {
      channels: ChannelInfo[]
      status: 'idle' | 'loading' | 'ok' | 'error'
    }
  | null

export function ChannelList({ slice }: { slice: Slice }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = slice?.channels ?? []
    if (!q) return list
    return list.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.user.toLowerCase().includes(q) ||
        x.vhost.toLowerCase().includes(q),
    )
  }, [slice, filter])

  if (slice?.status === 'loading' && filtered.length === 0) {
    return <div className="text-xs text-zinc-500">{t('panel.loading')}</div>
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('channels.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('channels.count', { count: filtered.length })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <Th>{t('channels.col.name')}</Th>
              <Th>{t('channels.col.user')}</Th>
              <Th>{t('channels.col.vhost')}</Th>
              <Th align="right">{t('channels.col.consumers')}</Th>
              <Th align="right">{t('channels.col.unacked')}</Th>
              <Th align="right">{t('channels.col.unconfirmed')}</Th>
              <Th align="right">{t('channels.col.prefetch')}</Th>
              <Th>{t('channels.col.state')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.name}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <Td>
                  <span className="font-mono text-[10px] text-zinc-700 dark:text-zinc-300">
                    {c.name}
                  </span>
                </Td>
                <Td>{c.user}</Td>
                <Td>
                  <span className="font-mono">{c.vhost}</span>
                </Td>
                <Td align="right">{c.consumerCount}</Td>
                <Td align="right">{c.messagesUnacknowledged}</Td>
                <Td align="right">{c.messagesUnconfirmed}</Td>
                <Td align="right">{c.prefetchCount}</Td>
                <Td>
                  <span
                    className={
                      c.state === 'running'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {c.state || '-'}
                  </span>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
                  {t('channels.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </th>
  )
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <td className={`px-3 py-2 align-top ${align === 'right' ? 'text-right tabular-nums' : ''}`}>
      {children}
    </td>
  )
}
