import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/tauri'

interface Props {
  open: boolean
  connection: RabbitConnection
  vhost: string
  onClose: () => void
  onCreated?: () => void
}

const ARG_PRESETS: Array<{ key: string; hint: string }> = [
  { key: 'x-message-ttl', hint: 'ms' },
  { key: 'x-expires', hint: 'ms' },
  { key: 'x-max-length', hint: 'int' },
  { key: 'x-max-length-bytes', hint: 'int' },
  { key: 'x-dead-letter-exchange', hint: 'exchange name' },
  { key: 'x-dead-letter-routing-key', hint: 'routing key' },
  { key: 'x-queue-type', hint: 'classic | quorum | stream' },
]

export function CreateQueueDialog({ open, connection, vhost, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [durable, setDurable] = useState(true)
  const [autoDelete, setAutoDelete] = useState(false)
  const [argRows, setArgRows] = useState<Array<{ key: string; value: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setDurable(true)
    setAutoDelete(false)
    setArgRows([])
    setError(null)
  }, [open])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const args: Record<string, unknown> = {}
      for (const r of argRows) {
        const k = r.key.trim()
        if (!k) continue
        args[k] = coerce(r.value)
      }
      await api.createQueue(connection, {
        name: name.trim(),
        vhost,
        durable,
        autoDelete,
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

  return (
    <Modal
      open={open}
      title={t('create.queue.title')}
      size="md"
      cancelText={t('dialog.cancel')}
      okText={saving ? t('dialog.saving') : t('create.submit')}
      okDisabled={!name.trim() || saving}
      onCancel={onClose}
      onOk={submit}
    >
      <div className="space-y-3">
        <Field label={t('create.queue.name')}>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my.queue"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="vhost">
            <input className={`${inputCls} font-mono`} value={vhost} disabled />
          </Field>
          <div className="flex gap-4 pt-5">
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={durable} onChange={(e) => setDurable(e.target.checked)} />
              {t('create.queue.durable')}
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={autoDelete}
                onChange={(e) => setAutoDelete(e.target.checked)}
              />
              {t('create.queue.autoDelete')}
            </label>
          </div>
        </div>

        <ArgumentRows
          rows={argRows}
          onChange={setArgRows}
          presets={ARG_PRESETS}
          label={t('create.queue.arguments')}
        />

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

export function ArgumentRows({
  rows,
  onChange,
  presets,
  label,
}: {
  rows: Array<{ key: string; value: string }>
  onChange: (rows: Array<{ key: string; value: string }>) => void
  presets?: Array<{ key: string; hint: string }>
  label: string
}) {
  const { t } = useTranslation()
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...rows, { key: '', value: '' }])}
          className="text-[11px] text-cyan-700 hover:underline dark:text-cyan-300"
        >
          + {t('create.addArgument')}
        </button>
      </div>
      <div className="space-y-1">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-[11px] text-zinc-500 dark:border-white/10">
            {t('create.noArguments')}
          </div>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                list={presets ? `argpresets-${label}` : undefined}
                className={`${inputCls} flex-1`}
                placeholder="key"
                value={r.key}
                onChange={(e) => {
                  const copy = [...rows]
                  copy[i] = { ...copy[i]!, key: e.target.value }
                  onChange(copy)
                }}
              />
              <input
                className={`${inputCls} flex-1`}
                placeholder="value"
                value={r.value}
                onChange={(e) => {
                  const copy = [...rows]
                  copy[i] = { ...copy[i]!, value: e.target.value }
                  onChange(copy)
                }}
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] text-zinc-500 hover:border-red-400/60 hover:text-red-600 dark:border-white/10"
              >
                ✕
              </button>
            </div>
          ))
        )}
        {presets ? (
          <datalist id={`argpresets-${label}`}>
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.hint}
              </option>
            ))}
          </datalist>
        ) : null}
      </div>
    </div>
  )
}

/** Best-effort coercion: numeric strings → numbers; "true"/"false" → bool; else string. */
function coerce(s: string): unknown {
  const t = s.trim()
  if (t === '') return ''
  if (t === 'true') return true
  if (t === 'false') return false
  if (/^-?\d+$/.test(t)) return Number(t)
  if (/^-?\d*\.\d+$/.test(t)) return Number(t)
  return s
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 disabled:opacity-50'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
