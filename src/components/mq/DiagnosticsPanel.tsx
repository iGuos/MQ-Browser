import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import type {
  BindingInfo,
  ChannelInfo,
  ConsumerInfo,
  ExchangeInfo,
  NodeInfo,
  RabbitConnection,
  RuntimeConnection,
} from '@shared/types'
import { ConnectionList } from './ConnectionList'
import { ChannelList } from './ChannelList'
import { ConsumerList } from './ConsumerList'
import { NodeList } from './NodeList'
import { RoutingTester } from './RoutingTester'

type Section = 'connections' | 'channels' | 'consumers' | 'nodes' | 'routingTester'

type Slice =
  | {
      status: 'idle' | 'loading' | 'ok' | 'error'
      runtimeConnections: RuntimeConnection[]
      channels: ChannelInfo[]
      consumers: ConsumerInfo[]
      nodes: NodeInfo[]
      exchanges: ExchangeInfo[]
      bindings: BindingInfo[]
    }
  | null

interface Props {
  connection: RabbitConnection
  slice: Slice
  /** Optional pre-selected sub-section (e.g. when navigating from a queue drill-down). */
  initialSection?: Section
}

/**
 * Groups "is the broker behaving?" tabs in one place — connections / channels
 * / consumers / nodes / routing tester. Same sub-tab pattern as AdminPanel.
 */
export function DiagnosticsPanel({ connection, slice, initialSection }: Props) {
  const { t } = useTranslation()
  const workspaceId = useWorkspaceId()
  const nav = useWorkspaceUiStore((s) => s.navByWs[workspaceId])
  const [section, setSection] = useState<Section>(initialSection ?? 'connections')

  // External nav requests can switch the active sub-tab. The child list reacts
  // to the same nonce and prefills its filter.
  useEffect(() => {
    if (nav?.diagnosticsSection) setSection(nav.diagnosticsSection as Section)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav?.nonce])

  const counts: Record<Section, number> = {
    connections: slice?.runtimeConnections.length ?? 0,
    channels: slice?.channels.length ?? 0,
    consumers: slice?.consumers.length ?? 0,
    nodes: slice?.nodes.length ?? 0,
    routingTester: 0,
  }

  const SECTIONS: Section[] = ['connections', 'channels', 'consumers', 'nodes', 'routingTester']

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-zinc-200 dark:border-white/[0.06]">
        {SECTIONS.map((s) => {
          const active = section === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'text-cyan-700 dark:text-cyan-300'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {t(`panel.tab.${s}`)}
              {s !== 'routingTester' ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                      : 'bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {counts[s]}
                </span>
              ) : null}
              {active ? (
                <span className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-teal-500" />
              ) : null}
            </button>
          )
        })}
      </div>

      <p className="rounded-md border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 text-[11px] leading-relaxed text-zinc-600 dark:border-white/[0.06] dark:bg-zinc-900/40 dark:text-zinc-400">
        {t(`diagnostics.intro.${section}`)}
      </p>

      {section === 'connections' ? (
        <ConnectionList connection={connection} slice={slice ?? null} />
      ) : section === 'channels' ? (
        <ChannelList connection={connection} slice={slice ?? null} />
      ) : section === 'consumers' ? (
        <ConsumerList slice={slice ?? null} />
      ) : section === 'nodes' ? (
        <NodeList slice={slice ?? null} />
      ) : (
        <RoutingTester slice={slice ?? null} />
      )}
    </div>
  )
}
