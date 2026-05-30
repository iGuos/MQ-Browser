import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import type { PeekedMessage, QueueInfo, RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/tauri'
import { toast } from '@/stores/toastStore'
import { MessageBodyViewer } from './MessageBodyViewer'

export function MessageViewer({
  open,
  connection,
  queue,
  onClose,
}: {
  open: boolean
  connection: RabbitConnection
  queue: QueueInfo | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [count, setCount] = useState(1)
  const [requeue, setRequeue] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<PeekedMessage[]>([])
  const [tail, setTail] = useState(false)
  const [tailIntervalMs, setTailIntervalMs] = useState(2000)
  const tailRef = useRef({ tail: false, tailIntervalMs: 2000, queue: null as QueueInfo | null })

  useEffect(() => {
    if (open) {
      setMessages([])
      setError(null)
      setTail(false)
    }
  }, [open, queue?.name])

  useEffect(() => {
    tailRef.current = { tail, tailIntervalMs, queue }
  }, [tail, tailIntervalMs, queue])

  const fetchMessages = async () => {
    if (!queue) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.peekMessages(connection, queue.vhost, queue.name, count, requeue)
      setMessages(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // Live tail: peek the queue every tick with requeue=true so messages stay.
  useEffect(() => {
    if (!tail) return
    let cancelled = false
    const tick = async () => {
      const cur = tailRef.current
      if (cancelled || !cur.queue) return
      try {
        const res = await api.peekMessages(connection, cur.queue.vhost, cur.queue.name, count, true)
        if (!cancelled) {
          setMessages(res)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), tailIntervalMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [tail, tailIntervalMs, connection, count])

  const exportMessages = async () => {
    if (messages.length === 0) return
    try {
      const path = await save({
        defaultPath: `${queue?.name ?? 'messages'}.ndjson`,
        filters: [
          { name: 'NDJSON', extensions: ['ndjson'] },
          { name: 'JSON', extensions: ['json'] },
        ],
      })
      if (!path) return
      const ext = path.toLowerCase().endsWith('.json') ? 'json' : 'ndjson'
      const content =
        ext === 'json'
          ? JSON.stringify(messages, null, 2)
          : messages.map((m) => JSON.stringify(m)).join('\n')
      await invoke('write_text_file', { path, contents: content })
      toast.success(t('messages.exported', { count: messages.length }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Modal
      open={open}
      size="lg"
      title={queue ? t('messages.title', { name: queue.name }) : ''}
      cancelText={t('messages.close')}
      onCancel={onClose}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs">
            {t('messages.count')}
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="ml-2 w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-900"
            />
          </label>
          <label className="inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={requeue}
              onChange={(e) => setRequeue(e.target.checked)}
              disabled={tail}
            />
            {t('messages.requeue')}
          </label>
          <label className="inline-flex items-center gap-1 text-xs">
            <input type="checkbox" checked={tail} onChange={(e) => setTail(e.target.checked)} />
            {t('messages.tail')}
          </label>
          {tail ? (
            <label className="text-[11px] text-zinc-500">
              <select
                value={tailIntervalMs}
                onChange={(e) => setTailIntervalMs(Number(e.target.value))}
                className="ml-1 rounded border border-zinc-300 bg-white px-1 py-0.5 dark:border-white/10 dark:bg-zinc-900"
              >
                <option value={1000}>1s</option>
                <option value={2000}>2s</option>
                <option value={5000}>5s</option>
              </select>
            </label>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={exportMessages}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:border-cyan-400/50 hover:text-cyan-700 dark:border-white/10 dark:text-zinc-300"
              >
                {t('messages.export')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={fetchMessages}
              disabled={loading || tail}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-50"
            >
              {loading ? t('messages.loading') : t('messages.fetch')}
            </button>
          </div>
        </div>
        {!requeue && !tail ? (
          <div className="rounded-lg border border-amber-400/50 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-300">
            {t('messages.requeueOffWarning')}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-2 text-[11px] text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 px-3 py-6 text-center text-xs text-zinc-500 dark:border-white/[0.06]">
              {t('messages.empty')}
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-white/[0.06]"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <span className="rounded bg-zinc-200/80 px-1 py-0 dark:bg-zinc-800">
                    #{idx + 1}
                  </span>
                  <span>
                    {t('messages.exchange')}: <code>{m.exchange || '(default)'}</code>
                  </span>
                  <span>
                    {t('messages.routingKey')}: <code>{m.routingKey || '—'}</code>
                  </span>
                  {m.redelivered ? (
                    <span className="rounded bg-amber-500/20 px-1 py-0 text-amber-700 dark:text-amber-300">
                      redelivered
                    </span>
                  ) : null}
                </div>
                <PropertiesView properties={m.properties} />
                <MessageBodyViewer bodyText={m.bodyText} bodyBase64={m.bodyBase64} />
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

function PropertiesView({ properties }: { properties: Record<string, unknown> }) {
  const { t } = useTranslation()
  if (!properties || typeof properties !== 'object') return null
  const { headers, ...rest } = properties as { headers?: unknown } & Record<string, unknown>
  const restEntries = Object.entries(rest).filter(([, v]) => v !== null && v !== undefined && v !== '')
  const headerEntries =
    headers && typeof headers === 'object' && !Array.isArray(headers)
      ? Object.entries(headers as Record<string, unknown>)
      : []
  const hasHeadersField = headers !== undefined
  if (restEntries.length === 0 && !hasHeadersField) return null

  return (
    <div className="mb-2 space-y-1 rounded-md border border-zinc-200/80 bg-zinc-50/60 px-2 py-1.5 text-[11px] dark:border-white/[0.06] dark:bg-zinc-900/40">
      {restEntries.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="font-medium text-zinc-500 dark:text-zinc-400">
            {t('messages.properties')}:
          </span>
          {restEntries.map(([k, v]) => (
            <span key={k} className="text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-500 dark:text-zinc-400">{k}=</span>
              <code className="text-zinc-800 dark:text-zinc-200">{formatPropValue(v)}</code>
            </span>
          ))}
        </div>
      ) : null}
      <div>
        <span className="mr-2 font-medium text-zinc-500 dark:text-zinc-400">
          {t('messages.headers')}:
        </span>
        {headerEntries.length === 0 ? (
          <span className="text-zinc-400 dark:text-zinc-500">{t('messages.noHeaders')}</span>
        ) : (
          <span className="inline-flex flex-wrap gap-x-3 gap-y-0.5 align-top">
            {headerEntries.map(([k, v]) => (
              <span key={k} className="text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-500 dark:text-zinc-400">{k}=</span>
                <code className="text-zinc-800 dark:text-zinc-200">{formatPropValue(v)}</code>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

function formatPropValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
