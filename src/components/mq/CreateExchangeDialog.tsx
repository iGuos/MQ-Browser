import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { api } from '@/lib/tauri'
import { ArgumentRows } from './CreateQueueDialog'

interface Props {
  open: boolean
  connection: RabbitConnection
  vhost: string
  onClose: () => void
  onCreated?: () => void
}

const TYPES = ['direct', 'fanout', 'topic', 'headers']

export function CreateExchangeDialog({ open, connection, vhost, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [kind, setKind] = useState('direct')
  const [durable, setDurable] = useState(true)
  const [autoDelete, setAutoDelete] = useState(false)
  const [internal, setInternal] = useState(false)
  const [argRows, setArgRows] = useState<Array<{ key: string; value: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setKind('direct')
    setDurable(true)
    setAutoDelete(false)
    setInternal(false)
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
        args[k] = coerceVal(r.value)
      }
      await api.createExchange(connection, {
        name: name.trim(),
        vhost,
        kind,
        durable,
        autoDelete,
        internal,
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
      title={t('create.exchange.title')}
      size="md"
      cancelText={t('dialog.cancel')}
      okText={saving ? t('dialog.saving') : t('create.submit')}
      okDisabled={!name.trim() || saving}
      onCancel={onClose}
      onOk={submit}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('create.exchange.name')}>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my.exchange"
              autoFocus
            />
          </Field>
          <Field label={t('create.exchange.type')}>
            <Select
              value={kind}
              onChange={(v) => setKind(v)}
              options={TYPES.map((k) => ({ value: k, label: k }))}
              size="md"
            />
          </Field>
          <Field label="vhost">
            <input className={`${inputCls} font-mono`} value={vhost} disabled />
          </Field>
          <div className="flex flex-wrap gap-3 pt-5">
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={durable} onChange={(e) => setDurable(e.target.checked)} />
              {t('create.exchange.durable')}
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={autoDelete}
                onChange={(e) => setAutoDelete(e.target.checked)}
              />
              {t('create.exchange.autoDelete')}
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              {t('create.exchange.internal')}
            </label>
          </div>
        </div>

        <ArgumentRows
          rows={argRows}
          onChange={setArgRows}
          label={t('create.exchange.arguments')}
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
  'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 disabled:opacity-50'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
