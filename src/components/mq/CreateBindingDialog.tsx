import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BindingInfo, ExchangeInfo, QueueInfo, RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { Select, Combobox } from '@/components/Select'
import { api } from '@/lib/tauri'
import { ArgumentRows } from './CreateQueueDialog'

interface Props {
  open: boolean
  connection: RabbitConnection
  vhost: string
  exchanges: ExchangeInfo[]
  queues: QueueInfo[]
  /** If set, the dialog opens prefilled and performs delete-then-create
   *  (RabbitMQ doesn't support in-place binding edits). */
  editing?: BindingInfo | null
  onClose: () => void
  onCreated?: () => void
}

export function CreateBindingDialog({
  open,
  connection,
  vhost,
  exchanges,
  queues,
  editing,
  onClose,
  onCreated,
}: Props) {
  const { t } = useTranslation()
  const [destType, setDestType] = useState<'queue' | 'exchange'>('queue')
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [routingKey, setRoutingKey] = useState('')
  const [argRows, setArgRows] = useState<Array<{ key: string; value: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setDestType(editing.destinationType === 'exchange' ? 'exchange' : 'queue')
      setSource(editing.source)
      setDestination(editing.destination)
      setRoutingKey(editing.routingKey)
      setArgRows([])
    } else {
      setDestType('queue')
      setSource('')
      setDestination('')
      setRoutingKey('')
      setArgRows([])
    }
    setError(null)
  }, [open, editing])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const args: Record<string, unknown> = {}
      for (const r of argRows) {
        const k = r.key.trim()
        if (!k) continue
        args[k] = coerceVal(r.value)
      }
      // RabbitMQ has no in-place binding edit — drop the old one first if
      // we're in edit mode, then create the new one.
      if (editing) {
        await api.deleteBinding(connection, {
          vhost: editing.vhost,
          source: editing.source,
          destination: editing.destination,
          destinationType: editing.destinationType,
          propertiesKey: editing.propertiesKey,
        })
      }
      await api.createBinding(connection, {
        vhost,
        source: source.trim(),
        destination: destination.trim(),
        destinationType: destType,
        routingKey,
        arguments: args,
      })
      onCreated?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const sourceExchanges = exchanges.filter((x) => x.vhost === vhost)
  const destOptions =
    destType === 'queue'
      ? queues.filter((q) => q.vhost === vhost).map((q) => ({ value: q.name, label: q.name }))
      : sourceExchanges
          .filter((x) => x.name !== source)
          .map((x) => ({ value: x.name, label: x.name || '(default)', hint: x.type }))

  return (
    <Modal
      open={open}
      title={editing ? t('create.binding.editTitle') : t('create.binding.title')}
      size="md"
      cancelText={t('dialog.cancel')}
      okText={
        saving
          ? t('dialog.saving')
          : editing
            ? t('create.binding.replace')
            : t('create.submit')
      }
      okDisabled={!source.trim() || !destination.trim() || saving}
      onCancel={onClose}
      onOk={submit}
    >
      <div className="space-y-3">
        {editing ? (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            {t('create.binding.editNote')}
          </div>
        ) : null}
        <Field label={t('create.binding.source')}>
          <Combobox
            value={source}
            onChange={setSource}
            options={sourceExchanges.map((x) => ({
              value: x.name,
              label: x.name || '(default)',
              hint: x.type,
            }))}
            placeholder="exchange name"
            inputClassName={inputCls}
          />
        </Field>
        <Field label={t('create.binding.destinationType')}>
          <Select
            value={destType}
            onChange={(v) => setDestType(v as 'queue' | 'exchange')}
            options={[
              { value: 'queue', label: t('create.binding.destQueue') },
              { value: 'exchange', label: t('create.binding.destExchange') },
            ]}
            size="md"
          />
        </Field>
        <Field label={t('create.binding.destination')}>
          <Combobox
            value={destination}
            onChange={setDestination}
            options={destOptions}
            placeholder={destType === 'queue' ? 'queue name' : 'exchange name'}
            inputClassName={inputCls}
          />
        </Field>
        <Field label={t('create.binding.routingKey')}>
          <input
            className={inputCls}
            value={routingKey}
            onChange={(e) => setRoutingKey(e.target.value)}
            placeholder=""
          />
        </Field>

        <ArgumentRows rows={argRows} onChange={setArgRows} label={t('create.binding.arguments')} />

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function coerceVal(s: string): unknown {
  const t = s.trim()
  if (t === '') return ''
  if (t === 'true') return true
  if (t === 'false') return false
  if (/^-?\d+$/.test(t)) return Number(t)
  if (/^-?\d*\.\d+$/.test(t)) return Number(t)
  return s
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
