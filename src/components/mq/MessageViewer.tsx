import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PeekedMessage, QueueInfo, RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/tauri'

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
  const [count, setCount] = useState(5)
  const [requeue, setRequeue] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<PeekedMessage[]>([])

  useEffect(() => {
    if (open) {
      setMessages([])
      setError(null)
    }
  }, [open, queue?.name])

  const fetchMessages = async () => {
    if (!queue) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.peekMessages(connection, queue.name, count, requeue)
      setMessages(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} size="lg" title={queue ? t('messages.title', { name: queue.name }) : ''} cancelText={t('messages.close')} onCancel={onClose}>
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
            />
            {t('messages.requeue')}
          </label>
          <button
            type="button"
            onClick={fetchMessages}
            disabled={loading}
            className="ml-auto rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-50"
          >
            {loading ? t('messages.loading') : t('messages.fetch')}
          </button>
        </div>
        {!requeue ? (
          <div className="rounded-lg border border-amber-400/50 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-300">
            {t('messages.requeueOffWarning')}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-2 text-[11px] text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
        <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-white/[0.06]">
          {messages.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-zinc-500">
              {t('messages.empty')}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-white/[0.04]">
              {messages.map((m, idx) => (
                <li key={idx} className="px-3 py-2">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
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
                  <pre className="mq-json-preview overflow-x-auto rounded bg-zinc-50 p-2 text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
{m.bodyText ?? `(binary, base64: ${m.bodyBase64.slice(0, 120)}…)`}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
