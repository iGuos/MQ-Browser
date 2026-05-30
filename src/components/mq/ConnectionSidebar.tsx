import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { save, open as openDialog } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import type { RabbitConnection } from '@shared/types'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Modal } from '@/components/Modal'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useConnectionsStore } from '@/stores/connectionsStore'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { useTopologyStore } from '@/stores/topologyStore'
import { useUiPrefsStore } from '@/stores/uiPrefsStore'
import { toast } from '@/stores/toastStore'
import { AboutDialog } from '@/components/AboutDialog'

type HealthStatus = 'idle' | 'loading' | 'ok' | 'error'

function pickHealth(byKey: Record<string, { status: HealthStatus }>, connId: string): HealthStatus {
  // The same connection may have several slices keyed by (workspace, vhost).
  // We surface the "best" status — green if any slice succeeded recently.
  let best: HealthStatus = 'idle'
  const rank: Record<HealthStatus, number> = { idle: 0, loading: 1, error: 2, ok: 3 }
  for (const k of Object.keys(byKey)) {
    if (!k.includes(`::${connId}::`)) continue
    const s = byKey[k]!.status
    if (rank[s] > rank[best]) best = s
  }
  return best
}

const HEALTH_DOT: Record<HealthStatus, string> = {
  idle: 'bg-zinc-400/60 dark:bg-zinc-600',
  loading: 'bg-amber-400 animate-pulse',
  ok: 'bg-emerald-500',
  error: 'bg-red-500',
}

interface ConnectionSidebarProps {
  onAdd: () => void
  onEdit: (c: RabbitConnection) => void
}

export function ConnectionSidebar({ onAdd, onEdit }: ConnectionSidebarProps) {
  const { t } = useTranslation()
  const workspaceId = useWorkspaceId()
  const { connections, removeConnection, reorderConnections, replaceAll, ready } =
    useConnectionsStore(
      useShallow((s) => ({
        connections: s.connections,
        ready: s.ready,
        removeConnection: s.removeConnection,
        reorderConnections: s.reorderConnections,
        replaceAll: s.replaceAll,
      })),
    )
  const selectedId = useWorkspaceUiStore((s) => s.selectedConnByWs[workspaceId] ?? null)
  const topologyByKey = useTopologyStore((s) => s.byKey)
  const sidebarWidth = useUiPrefsStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUiPrefsStore((s) => s.setSidebarWidth)
  const density = useUiPrefsStore((s) => s.density)
  const setDensity = useUiPrefsStore((s) => s.setDensity)
  const [collapsed, setCollapsed] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const dragStartRef = useRef<{ x: number; w: number } | null>(null)

  // Auto-collapse below 800px window width.
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth < 800) setCollapsed(true)
    }
    window.addEventListener('resize', handler)
    handler()
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Apply density class to body.
  useEffect(() => {
    document.body.classList.toggle('density-compact', density === 'compact')
  }, [density])

  const onResizerDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragStartRef.current = { x: e.clientX, w: sidebarWidth }
    const onMove = (ev: MouseEvent) => {
      const s = dragStartRef.current
      if (!s) return
      setSidebarWidth(s.w + (ev.clientX - s.x))
    }
    const onUp = () => {
      dragStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const select = useCallback(
    (id: string | null) => {
      useWorkspaceUiStore.getState().setSelectedForWorkspace(workspaceId, id)
    },
    [workspaceId],
  )
  const dragFromRef = useRef<number | null>(null)
  const [dropBefore, setDropBefore] = useState<number | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const pendingDelete = useMemo(
    () => (pendingDeleteId ? connections.find((c) => c.id === pendingDeleteId) : undefined),
    [connections, pendingDeleteId],
  )

  const clearDrop = useCallback(() => setDropBefore(null), [])

  const onRowDragStart = useCallback((index: number, e: React.DragEvent) => {
    e.stopPropagation()
    dragFromRef.current = index
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onRowDragEnd = useCallback(() => {
    dragFromRef.current = null
    clearDrop()
  }, [clearDrop])

  const onRowDragOver = useCallback((beforeIndex: number, e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropBefore(beforeIndex)
  }, [])

  const onRowDrop = useCallback(
    (beforeIndex: number, e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const raw = e.dataTransfer.getData('text/plain')
      const from = raw ? Number.parseInt(raw, 10) : dragFromRef.current ?? NaN
      if (Number.isNaN(from)) return
      void reorderConnections(from, beforeIndex)
      clearDrop()
    },
    [reorderConnections, clearDrop],
  )

  const endDropBefore = connections.length

  if (collapsed) {
    return (
      <>
        <aside className="flex h-full w-10 shrink-0 flex-col items-center border-r border-zinc-200/80 bg-white/70 py-2 dark:border-white/[0.06] dark:bg-zinc-950/80">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title={t('sidebar.expand')}
            className="rounded-md p-1 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Expand sidebar"
          >
            »
          </button>
        </aside>
        <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />
      </>
    )
  }

  return (
    <>
      <aside
        className="relative flex h-full shrink-0 flex-col border-r border-zinc-200/80 bg-white/70 shadow-[inset_-1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/[0.06] dark:bg-zinc-950/80 dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]"
        style={{ width: sidebarWidth }}
      >
        <div className="border-b border-zinc-200/80 px-4 pb-4 pt-2 dark:border-white/[0.06]">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-400/90">
              MQ BROWSER
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
                title={t(`sidebar.density.${density === 'compact' ? 'comfortable' : 'compact'}`)}
                className="rounded-md px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {density === 'compact' ? '⛶' : '☰'}
              </button>
              <button
                type="button"
                onClick={() => setShowAbout(true)}
                title={t('about.title')}
                className="rounded-md px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                ⓘ
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title={t('sidebar.collapse')}
                className="rounded-md px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                «
              </button>
              <LanguageSwitcher />
            </div>
          </div>
          <div className="select-none">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
              {t('sidebar.title')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
              {t('sidebar.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-2.5 text-sm font-medium text-zinc-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 active:scale-[0.98]"
          >
            <span className="text-lg leading-none">+</span>
            {t('sidebar.addConnection')}
          </button>
          <div className="mt-2 flex gap-2 text-[10px]">
            <button
              type="button"
              onClick={async () => {
                if (connections.length === 0) return
                try {
                  const path = await save({
                    defaultPath: 'mq-browser-connections.json',
                    filters: [{ name: 'JSON', extensions: ['json'] }],
                  })
                  if (!path) return
                  // Don't strip the password — but warn the user via a toast
                  // before they share the file.
                  await invoke('write_text_file', {
                    path,
                    contents: JSON.stringify(connections, null, 2),
                  })
                  toast.warning(t('sidebar.exportWarn'), t('sidebar.exported'))
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e))
                }
              }}
              className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-zinc-600 hover:border-cyan-400/40 hover:text-cyan-700 dark:border-white/10 dark:text-zinc-300"
            >
              {t('sidebar.export')}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  const path = await openDialog({
                    multiple: false,
                    filters: [{ name: 'JSON', extensions: ['json'] }],
                  })
                  if (typeof path !== 'string') return
                  const text = await invoke<string>('read_text_file', { path })
                  const list = JSON.parse(text) as RabbitConnection[]
                  if (!Array.isArray(list)) throw new Error('not an array')
                  await replaceAll(list)
                  toast.success(t('sidebar.imported', { count: list.length }))
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e))
                }
              }}
              className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-zinc-600 hover:border-cyan-400/40 hover:text-cyan-700 dark:border-white/10 dark:text-zinc-300"
            >
              {t('sidebar.import')}
            </button>
          </div>
        </div>

        <div className="px-3 pt-2 pb-0.5">
          <div className="px-1 text-[11px] font-medium normal-case tracking-wide text-zinc-500 dark:text-zinc-600">
            {t('sidebar.listHeading')}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-0">
          {!ready ? (
            <div className="mx-1 select-none rounded-xl border border-dashed border-zinc-300 bg-zinc-100/80 px-3 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-500">
              {t('sidebar.loading')}
            </div>
          ) : connections.length === 0 ? (
            <div className="mx-1 select-none rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('sidebar.empty')}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-600">
                {t('sidebar.emptyHint')}
              </p>
            </div>
          ) : (
            <ul className="flex min-h-0 flex-1 list-none flex-col overflow-y-auto pb-1 pt-0">
              {connections.map((c, index) => {
                const active = c.id === selectedId
                const showGap = dropBefore === index
                return (
                  <Fragment key={c.id}>
                    <li
                      className={`relative h-1.5 shrink-0 ${showGap ? 'bg-cyan-500/10 dark:bg-cyan-400/8' : ''}`}
                      onDragOver={(e) => onRowDragOver(index, e)}
                      onDrop={(e) => onRowDrop(index, e)}
                    >
                      {showGap ? (
                        <div
                          className="pointer-events-none absolute left-2 right-2 top-1/2 z-10 h-1.5 -translate-y-1/2 rounded-full bg-cyan-500/55 shadow-[0_0_8px_rgba(6,182,212,0.35)] dark:bg-cyan-400/45"
                          aria-hidden
                        />
                      ) : null}
                    </li>
                    <li
                      className="relative list-none"
                      onDragOver={(e) => onRowDragOver(index, e)}
                      onDrop={(e) => onRowDrop(index, e)}
                    >
                      <div
                        className={`group relative overflow-hidden rounded-xl border transition-all ${
                          active
                            ? 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/15 to-teal-500/10 shadow-sm dark:border-cyan-500/40 dark:from-cyan-500/10 dark:to-teal-500/5 dark:shadow-panel'
                            : 'border-transparent bg-zinc-100/90 hover:border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:hover:border-zinc-700/80 dark:hover:bg-zinc-900/70'
                        }`}
                      >
                        {active ? (
                          <div
                            className="absolute left-0 top-0 h-full w-0.5 bg-gradient-to-b from-cyan-400 to-teal-500"
                            aria-hidden
                          />
                        ) : null}
                        <div className="flex min-w-0">
                          <button
                            type="button"
                            draggable
                            title={t('sidebar.dragHandleTitle')}
                            onClick={() => select(c.id)}
                            onDragStart={(e) => onRowDragStart(index, e)}
                            onDragEnd={onRowDragEnd}
                            className="min-w-0 flex-1 cursor-pointer touch-none select-none px-3 py-2.5 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                title={t(`sidebar.health.${pickHealth(topologyByKey, c.id)}`)}
                                className={`h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT[pickHealth(topologyByKey, c.id)]}`}
                                aria-hidden
                              />
                              <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {c.name}
                              </div>
                            </div>
                            <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                              {c.tls ? 'https' : 'http'}://{c.username}@{c.host}:{c.mgmtPort}
                              {c.vhost === '/' ? '/' : `/${c.vhost.replace(/^\//, '')}`}
                            </div>
                          </button>
                          <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-zinc-200/90 py-1 pr-1 pl-0.5 dark:border-white/[0.04]">
                            <button
                              type="button"
                              title={t('sidebar.edit')}
                              onClick={(e) => {
                                e.stopPropagation()
                                onEdit(c)
                              }}
                              className="rounded-md px-2 py-1 text-[11px] text-zinc-600 transition hover:bg-zinc-200/80 hover:text-cyan-600 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-cyan-400"
                            >
                              {t('sidebar.edit')}
                            </button>
                            <button
                              type="button"
                              title={t('sidebar.delete')}
                              onClick={(e) => {
                                e.stopPropagation()
                                setPendingDeleteId(c.id)
                              }}
                              className="rounded-md px-2 py-1 text-[11px] text-zinc-600 transition hover:bg-red-500/10 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                            >
                              {t('sidebar.delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  </Fragment>
                )
              })}
              <li
                className="relative flex min-h-8 flex-1 list-none flex-col rounded-lg"
                onDragOver={(e) => onRowDragOver(endDropBefore, e)}
                onDrop={(e) => onRowDrop(endDropBefore, e)}
              />
            </ul>
          )}
        </div>
        {/* Drag handle to resize the sidebar */}
        <div
          onMouseDown={onResizerDown}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-cyan-400/30"
          aria-hidden
        />
      </aside>

      <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />

      <Modal
        open={pendingDeleteId !== null}
        title={t('sidebar.deleteConfirmTitle')}
        cancelText={t('sidebar.deleteConfirmCancel')}
        okText={t('sidebar.deleteConfirmAction')}
        onCancel={() => setPendingDeleteId(null)}
        onOk={() => {
          const id = pendingDeleteId
          setPendingDeleteId(null)
          if (id) void removeConnection(id)
        }}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {t('sidebar.deleteConfirmDetail', {
            name: pendingDelete?.name ?? '',
            host: pendingDelete?.host ?? '',
          })}
        </p>
      </Modal>
    </>
  )
}
