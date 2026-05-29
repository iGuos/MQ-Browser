import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import type { DetailTab } from '@shared/types'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { useTopologyStore } from '@/stores/topologyStore'
import { useConnectionsStore } from '@/stores/connectionsStore'

interface PaletteItem {
  id: string
  kind: 'queue' | 'exchange' | 'binding' | 'connection' | 'action'
  label: string
  hint?: string
  onSelect: () => void
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeWsId = useWorkspaceUiStore((s) => s.activeWorkspaceId)
  const selectedConn = useWorkspaceUiStore((s) => s.selectedConnByWs[activeWsId] ?? null)
  const setDetailTab = useWorkspaceUiStore((s) => s.setDetailTab)
  const select = useWorkspaceUiStore((s) => s.setSelectedForWorkspace)
  const connections = useConnectionsStore((s) => s.connections)
  const topology = useTopologyStore((s) => s.byKey)

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlight(0)
      // Focus on next tick so the modal mount is committed first
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = []

    // Topology entries from the currently selected connection's slices.
    if (selectedConn) {
      for (const k of Object.keys(topology)) {
        if (!k.includes(`::${selectedConn}::`)) continue
        const slice = topology[k]!
        for (const q of slice.queues) {
          out.push({
            id: `q::${q.vhost}::${q.name}`,
            kind: 'queue',
            label: q.name,
            hint: `queue · ${q.vhost} · ready ${q.messagesReady}`,
            onSelect: () => setDetailTab(activeWsId, 'queues'),
          })
        }
        for (const e of slice.exchanges) {
          out.push({
            id: `e::${e.vhost}::${e.name}`,
            kind: 'exchange',
            label: e.name || '(default)',
            hint: `exchange · ${e.type} · ${e.vhost}`,
            onSelect: () => setDetailTab(activeWsId, 'exchanges'),
          })
        }
        for (const b of slice.bindings) {
          out.push({
            id: `b::${b.vhost}::${b.source}::${b.destination}::${b.routingKey}`,
            kind: 'binding',
            label: `${b.source || '(default)'} → ${b.destination}`,
            hint: `binding · rk=${b.routingKey || '∅'} · ${b.vhost}`,
            onSelect: () => setDetailTab(activeWsId, 'bindings'),
          })
        }
        break // only first matching slice is enough for search
      }
    }

    // Connections — quick-switch
    for (const c of connections) {
      out.push({
        id: `c::${c.id}`,
        kind: 'connection',
        label: c.name || c.host,
        hint: `${c.host}:${c.mgmtPort}`,
        onSelect: () => select(activeWsId, c.id),
      })
    }

    // Static actions — tab jumps
    const tabs: DetailTab[] = [
      'overview',
      'queues',
      'exchanges',
      'bindings',
      'connections',
      'channels',
      'nodes',
      'policies',
      'publish',
    ]
    for (const tab of tabs) {
      out.push({
        id: `t::${tab}`,
        kind: 'action',
        label: `→ ${t(`panel.tab.${tab}`)}`,
        hint: `tab ${tab}`,
        onSelect: () => setDetailTab(activeWsId, tab),
      })
    }

    return out
  }, [topology, selectedConn, connections, activeWsId, select, setDetailTab, t])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 80)
    return items
      .filter(
        (x) =>
          x.label.toLowerCase().includes(q) ||
          (x.hint ?? '').toLowerCase().includes(q),
      )
      .slice(0, 80)
  }, [items, query])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[highlight]
      if (item) {
        item.onSelect()
        onClose()
      }
    }
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1500] flex items-start justify-center bg-black/40 px-4 pt-[15vh] backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('palette.placeholder')}
          className="w-full bg-transparent px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />
        <div className="max-h-[55vh] overflow-y-auto border-t border-zinc-200 py-1 text-sm dark:border-white/10">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-zinc-500">
              {t('palette.empty')}
            </div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  item.onSelect()
                  onClose()
                }}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition ${
                  i === highlight
                    ? 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
                    : 'text-zinc-800 dark:text-zinc-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.label}</div>
                  {item.hint ? (
                    <div className="truncate text-[10px] text-zinc-500">{item.hint}</div>
                  ) : null}
                </div>
                <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {item.kind}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-zinc-200 px-4 py-2 text-[10px] text-zinc-500 dark:border-white/10">
          ↑↓ {t('palette.hintNav')} · ↵ {t('palette.hintSelect')} · esc {t('palette.hintClose')}
        </div>
      </div>
    </div>,
    document.body,
  )
}
