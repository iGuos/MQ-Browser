import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RabbitConnection, RuntimeConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/tauri'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { toast } from '@/stores/toastStore'

type Slice =
  | {
      runtimeConnections: RuntimeConnection[]
      status: 'idle' | 'loading' | 'ok' | 'error'
    }
  | null

export function ConnectionList({
  connection,
  slice,
}: {
  connection: RabbitConnection
  slice: Slice
}) {
  const { t } = useTranslation()
  const workspaceId = useWorkspaceId()
  const activeVhost = useWorkspaceUiStore((s) => s.activeVhostByWs[workspaceId] ?? null)
  const fetchTopology = useTopologyStore((s) => s.fetch)
  const [filter, setFilter] = useState('')
  const [confirmClose, setConfirmClose] = useState<RuntimeConnection | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = slice?.runtimeConnections ?? []
    if (!q) return list
    return list.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.user.toLowerCase().includes(q) ||
        x.peerHost.toLowerCase().includes(q),
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
          placeholder={t('connections.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('connections.count', { count: filtered.length })}
        </span>
      </div>

      {error ? (
        <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <Th>{t('connections.col.peer')}</Th>
              <Th>{t('connections.col.user')}</Th>
              <Th>{t('connections.col.vhost')}</Th>
              <Th>{t('connections.col.protocol')}</Th>
              <Th align="right">{t('connections.col.channels')}</Th>
              <Th>{t('connections.col.state')}</Th>
              <Th align="right">{t('connections.col.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.name}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <Td>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">
                    {c.peerHost}:{c.peerPort}
                  </span>
                  <div className="font-mono text-[10px] text-zinc-500">{c.name}</div>
                </Td>
                <Td>{c.user}</Td>
                <Td>
                  <span className="font-mono">{c.vhost}</span>
                </Td>
                <Td>{c.protocol}</Td>
                <Td align="right">{c.channels}</Td>
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
                <Td align="right">
                  <button
                    type="button"
                    onClick={() => setConfirmClose(c)}
                    className="rounded-md border border-red-400/50 px-2 py-0.5 text-[10px] font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                  >
                    {t('connections.action.close')}
                  </button>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  {t('connections.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={confirmClose !== null}
        title={t('connections.closeConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('connections.action.close')}
        onCancel={() => setConfirmClose(null)}
        onOk={async () => {
          const target = confirmClose
          setConfirmClose(null)
          if (!target) return
          try {
            await api.closeRuntimeConnection(connection, target.name, 'Closed via MQ Browser')
            toast.success(t('connections.action.close') + ' ' + target.name)
            void fetchTopology(workspaceId, connection, activeVhost)
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        {t('connections.closeConfirmDetail', { name: confirmClose?.name ?? '' })}
      </Modal>
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
