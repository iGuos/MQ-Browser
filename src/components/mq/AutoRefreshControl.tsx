import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { RabbitConnection } from '@shared/types'
import { Select } from '@/components/Select'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { useTopologyStore } from '@/stores/topologyStore'

const INTERVALS_MS = [5_000, 10_000, 30_000, 60_000]

interface Props {
  workspaceId: string
  connection: RabbitConnection
  vhost: string | null
}

/**
 * Toggle + interval picker that drives a setInterval-based refetch. Each
 * workspace stores its own enabled flag + interval in workspaceUiStore so
 * the choice survives tab switching.
 */
export function AutoRefreshControl({ workspaceId, connection, vhost }: Props) {
  const { t } = useTranslation()
  const auto = useWorkspaceUiStore(
    (s) => s.autoRefreshByWs[workspaceId] ?? { enabled: false, intervalMs: 10_000 },
  )
  const setAutoRefresh = useWorkspaceUiStore((s) => s.setAutoRefresh)
  const fetchTopology = useTopologyStore((s) => s.fetch)

  // Latest-args ref so the interval always sees current connection/vhost
  // even if the user switches them without toggling auto-refresh off.
  const argsRef = useRef({ connection, vhost })
  argsRef.current = { connection, vhost }

  useEffect(() => {
    if (!auto.enabled) return
    const tick = () => {
      const { connection: c, vhost: v } = argsRef.current
      void fetchTopology(workspaceId, c, v)
    }
    const id = window.setInterval(tick, auto.intervalMs)
    return () => window.clearInterval(id)
  }, [auto.enabled, auto.intervalMs, workspaceId, fetchTopology])

  return (
    <div className="flex items-center gap-2">
      <label className="inline-flex select-none items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={auto.enabled}
          onChange={(e) => setAutoRefresh(workspaceId, { enabled: e.target.checked })}
        />
        {t('panel.autoRefresh')}
      </label>
      <Select
        value={String(auto.intervalMs)}
        onChange={(v) => setAutoRefresh(workspaceId, { intervalMs: Number(v) })}
        options={INTERVALS_MS.map((ms) => ({
          value: String(ms),
          label: ms < 60_000 ? `${ms / 1000}s` : `${ms / 60_000}m`,
        }))}
        disabled={!auto.enabled}
        className="min-w-[64px]"
      />
    </div>
  )
}
