import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExchangeInfo, RabbitConnection } from '@shared/types'
import { api } from '@/lib/tauri'
import { Combobox } from '@/components/Select'

type Slice = { exchanges: ExchangeInfo[] } | null

export function PublishDialog({
  connection,
  vhost,
  slice,
}: {
  connection: RabbitConnection
  vhost: string | null
  slice: Slice
}) {
  const { t } = useTranslation()
  const [exchange, setExchange] = useState('')
  const [routingKey, setRoutingKey] = useState('')
  const [body, setBody] = useState('{\n  "hello": "world"\n}')
  const [persistent, setPersistent] = useState(true)
  const [contentType, setContentType] = useState('application/json')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const exchanges = useMemo(() => slice?.exchanges ?? [], [slice])

  const send = async () => {
    setSending(true)
    setResult(null)
    try {
      const targetVhost = vhost ?? connection.vhost
      const routed = await api.publishMessage(connection, targetVhost, {
        exchange,
        routingKey,
        body,
        persistent,
        contentType: contentType || undefined,
        headers: {},
      })
      setResult({
        ok: true,
        msg: routed ? t('publish.success') : t('publish.unrouted'),
      })
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : String(e) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {t('publish.exchange')}
          </span>
          <Combobox
            value={exchange}
            onChange={setExchange}
            placeholder={t('publish.exchangePlaceholder')}
            options={exchanges.map((x) => ({
              value: x.name,
              label: x.name || '(default)',
              hint: `${x.type} · ${x.vhost}`,
            }))}
            inputClassName={inputCls}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {t('publish.routingKey')}
          </span>
          <input
            className={inputCls}
            value={routingKey}
            placeholder={t('publish.routingKeyPlaceholder')}
            onChange={(e) => setRoutingKey(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {t('publish.contentType')}
          </span>
          <Combobox
            value={contentType}
            onChange={setContentType}
            options={CONTENT_TYPE_PRESETS}
            inputClassName={inputCls}
          />
        </label>
        <label className="mt-5 inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={persistent}
            onChange={(e) => setPersistent(e.target.checked)}
          />
          {t('publish.persistent')}
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {t('publish.body')}
        </span>
        <textarea
          className="mq-json-preview mt-1 h-64 w-full resize-y rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-white/10 dark:bg-zinc-900"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-50"
        >
          {sending ? t('publish.sending') : t('publish.send')}
        </button>
        {result ? (
          <span
            className={`text-xs ${result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {result.msg}
          </span>
        ) : (
          <span className="text-[11px] text-zinc-500">{t('publish.hint')}</span>
        )}
      </div>
    </div>
  )
}

const inputCls =
  'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900'

// Free-form field; presets are just hints. Broker doesn't validate this.
const CONTENT_TYPE_PRESETS = [
  { value: 'application/json', label: 'application/json', hint: 'JSON text' },
  { value: 'text/plain', label: 'text/plain', hint: 'Plain text' },
  { value: 'application/xml', label: 'application/xml', hint: 'XML' },
  { value: 'application/x-protobuf', label: 'application/x-protobuf', hint: 'Protobuf binary' },
  { value: 'application/msgpack', label: 'application/msgpack', hint: 'MessagePack binary' },
  { value: 'application/octet-stream', label: 'application/octet-stream', hint: 'Generic binary' },
  { value: 'application/x-www-form-urlencoded', label: 'application/x-www-form-urlencoded', hint: 'Form data' },
]
