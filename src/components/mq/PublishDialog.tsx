import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ExchangeInfo,
  PublishTemplate,
  QueueInfo,
  RabbitConnection,
} from '@shared/types'
import { api } from '@/lib/tauri'
import { Combobox, Select } from '@/components/Select'
import { Modal } from '@/components/Modal'
import { usePublishTemplatesStore } from '@/stores/publishTemplatesStore'
import { rkAdviceFor } from '@/lib/exchangeRk'

type Slice = {
  exchanges: ExchangeInfo[]
  queues?: QueueInfo[]
} | null

type Target = 'queue' | 'exchange'

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
  const templates = usePublishTemplatesStore((s) => s.templates)
  const saveTemplate = usePublishTemplatesStore((s) => s.save)
  const removeTemplate = usePublishTemplatesStore((s) => s.remove)
  const [target, setTarget] = useState<Target>('queue')
  /** Used in queue mode: the destination queue name. */
  const [queueName, setQueueName] = useState('')
  const [exchange, setExchange] = useState('')
  const [routingKey, setRoutingKey] = useState('')
  const [body, setBody] = useState('{\n  "hello": "world"\n}')
  const [persistent, setPersistent] = useState(true)
  const [contentType, setContentType] = useState('application/json')
  /** Stored as string so the input can be empty (= no TTL). */
  const [expirationMs, setExpirationMs] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [activeTemplateId, setActiveTemplateId] = useState<string>('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const exchanges = useMemo(() => slice?.exchanges ?? [], [slice])
  const queues = useMemo(() => slice?.queues ?? [], [slice])

  // Look up the selected exchange's type so we can advise about routing key.
  // Default exchange "" is direct, but per-queue auto-bindings make it behave
  // like "rk = queue name".
  const selectedExchange = useMemo(
    () => exchanges.find((x) => x.name === exchange.trim()),
    [exchanges, exchange],
  )
  const rkAdvice = rkAdviceFor(exchange.trim() === '' ? 'direct' : selectedExchange?.type)

  const applyTemplate = (id: string) => {
    setActiveTemplateId(id)
    if (!id) return
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setTarget(t.target ?? 'exchange')
    setQueueName(t.queueName ?? '')
    setExchange(t.exchange)
    setRoutingKey(t.routingKey)
    setBody(t.body)
    setPersistent(t.persistent)
    setContentType(t.contentType ?? '')
    setExpirationMs(t.expirationMs ? String(t.expirationMs) : '')
  }

  const onSaveTemplate = async () => {
    const name = templateName.trim()
    if (!name) return
    const id =
      activeTemplateId && templates.find((x) => x.id === activeTemplateId && x.name === name)
        ? activeTemplateId
        : crypto.randomUUID()
    const tpl: PublishTemplate = {
      id,
      name,
      target,
      queueName,
      exchange,
      routingKey,
      body,
      persistent,
      contentType: contentType || undefined,
      headers: {},
      expirationMs: parseTtl(expirationMs),
    }
    await saveTemplate(tpl)
    setActiveTemplateId(id)
    setShowSaveDialog(false)
  }

  const onDeleteTemplate = async () => {
    if (!activeTemplateId) return
    await removeTemplate(activeTemplateId)
    setActiveTemplateId('')
  }

  const send = async () => {
    setSending(true)
    setResult(null)
    try {
      const targetVhost = vhost ?? connection.vhost
      // Queue mode: send via default exchange "", routing key = queue name.
      // This is the AMQP-standard way to address a queue directly — broker
      // auto-binds every queue to "" with rk = queue name.
      const effExchange = target === 'queue' ? '' : exchange
      const effRoutingKey = target === 'queue' ? queueName.trim() : routingKey
      const routed = await api.publishMessage(connection, targetVhost, {
        exchange: effExchange,
        routingKey: effRoutingKey,
        body,
        persistent,
        contentType: contentType || undefined,
        headers: {},
        expirationMs: parseTtl(expirationMs),
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

  const currentTemplate = templates.find((x) => x.id === activeTemplateId) ?? null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 dark:border-white/[0.06] dark:bg-zinc-900/40">
        <div className="flex-1">
          <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
            {t('publish.templates.label')}
          </span>
          <Select
            value={activeTemplateId}
            onChange={applyTemplate}
            options={[
              { value: '', label: t('publish.templates.none') },
              ...templates.map((tpl) => ({
                value: tpl.id,
                label: tpl.name,
                hint: tpl.exchange ? `${tpl.exchange} · ${tpl.routingKey}` : tpl.routingKey,
              })),
            ]}
            size="md"
            className="min-w-[220px]"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setTemplateName(currentTemplate?.name ?? '')
            setShowSaveDialog(true)
          }}
          className="rounded-md border border-cyan-400/60 px-2.5 py-1.5 text-[11px] font-medium text-cyan-700 hover:bg-cyan-500/10 dark:border-cyan-400/40 dark:text-cyan-300"
        >
          {currentTemplate ? t('publish.templates.update') : t('publish.templates.save')}
        </button>
        {currentTemplate ? (
          <button
            type="button"
            onClick={onDeleteTemplate}
            className="rounded-md border border-red-400/50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            {t('publish.templates.delete')}
          </button>
        ) : null}
      </div>

      {/* Target type switch — Queue (default) sends via the default exchange
          with rk=queue name; Exchange exposes the raw exchange+rk fields. */}
      <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50/60 p-1 text-xs dark:border-white/[0.06] dark:bg-zinc-900/40">
        <TargetTab active={target === 'queue'} onClick={() => setTarget('queue')}>
          {t('publish.target.queue')}
        </TargetTab>
        <TargetTab active={target === 'exchange'} onClick={() => setTarget('exchange')}>
          {t('publish.target.exchange')}
        </TargetTab>
        <span className="ml-2 text-[10px] text-zinc-500">
          {target === 'queue' ? t('publish.target.queueHint') : t('publish.target.exchangeHint')}
        </span>
      </div>

      {target === 'queue' ? (
        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {t('publish.targetQueue')}
          </span>
          <Combobox
            value={queueName}
            onChange={setQueueName}
            placeholder="my.queue"
            options={queues.map((q) => ({
              value: q.name,
              label: q.name,
              hint: `${q.vhost} · ready ${q.messagesReady}`,
            }))}
            inputClassName={inputCls}
          />
          <p className="mt-1 text-[10px] text-zinc-500">{t('publish.targetQueueHint')}</p>
        </label>
      ) : (
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
            {selectedExchange ? (
              <span className="ml-1 rounded bg-zinc-200/70 px-1 py-0 text-[9px] font-normal uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {selectedExchange.type}
              </span>
            ) : null}
          </span>
          <input
            className={`${inputCls} ${rkAdvice.disabled ? 'opacity-50' : ''}`}
            value={routingKey}
            placeholder={t(rkAdvice.placeholderKey)}
            disabled={rkAdvice.disabled}
            onChange={(e) => setRoutingKey(e.target.value)}
          />
          <p className="mt-1 text-[10px] text-zinc-500">{t(rkAdvice.hintKey)}</p>
        </label>
      </div>
      )}

      <div className="grid grid-cols-2 gap-3">
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
        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {t('publish.expiration')}
          </span>
          <input
            className={inputCls}
            type="number"
            min={0}
            placeholder={t('publish.expirationPlaceholder')}
            value={expirationMs}
            onChange={(e) => setExpirationMs(e.target.value)}
          />
          {expirationMs.trim() !== '' && parseTtl(expirationMs) !== undefined ? (
            <p className="mt-1 text-[10px] text-zinc-500">
              {t('publish.expirationHumanized', { human: humanizeMs(parseTtl(expirationMs)!) })}
            </p>
          ) : null}
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

      <Modal
        open={showSaveDialog}
        title={t('publish.templates.saveTitle')}
        size="sm"
        cancelText={t('dialog.cancel')}
        okText={t('publish.templates.confirmSave')}
        okDisabled={!templateName.trim()}
        onCancel={() => setShowSaveDialog(false)}
        onOk={onSaveTemplate}
      >
        <label className="block">
          <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {t('publish.templates.nameLabel')}
          </span>
          <input
            className={inputCls}
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="my publish preset"
            autoFocus
          />
        </label>
      </Modal>
    </div>
  )
}

function TargetTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
        active
          ? 'bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300'
          : 'text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  )
}

const inputCls =
  'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900'

/** Convert the TTL input box value into a positive integer ms, or undefined
 *  if the input is empty / invalid (= no TTL on this message). */
function parseTtl(raw: string): number | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return undefined
  return n
}

/** "60000" → "60s", "3600000" → "1h", etc. */
function humanizeMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(ms % 60_000 === 0 ? 0 : 1)}min`
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(ms % 3_600_000 === 0 ? 0 : 1)}h`
  return `${(ms / 86_400_000).toFixed(ms % 86_400_000 === 0 ? 0 : 1)}d`
}

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
