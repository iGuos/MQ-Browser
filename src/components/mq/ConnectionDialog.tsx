import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { useConnectionsStore } from '@/stores/connectionsStore'
import { api } from '@/lib/tauri'

type Mode = 'add' | 'edit'

interface ConnectionDialogProps {
  open: boolean
  mode: Mode
  source: RabbitConnection | null
  onClose: () => void
}

interface FormState {
  name: string
  host: string
  amqpPort: number
  mgmtPort: number
  username: string
  password: string
  vhost: string
  tls: boolean
}

function defaults(): FormState {
  return {
    name: '',
    host: 'localhost',
    amqpPort: 5672,
    mgmtPort: 15672,
    username: 'guest',
    password: 'guest',
    vhost: '/',
    tls: false,
  }
}

function fromConn(c: RabbitConnection): FormState {
  return {
    name: c.name,
    host: c.host,
    amqpPort: c.amqpPort,
    mgmtPort: c.mgmtPort,
    username: c.username,
    password: c.password,
    vhost: c.vhost,
    tls: c.tls,
  }
}

export function ConnectionDialog({ open, mode, source, onClose }: ConnectionDialogProps) {
  const { t } = useTranslation()
  const addConnection = useConnectionsStore((s) => s.addConnection)
  const updateConnection = useConnectionsStore((s) => s.updateConnection)
  const [form, setForm] = useState<FormState>(defaults)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(source ? fromConn(source) : defaults())
    setTestResult(null)
  }, [open, source])

  const canSave = useMemo(
    () => form.host.trim().length > 0 && form.username.trim().length > 0,
    [form.host, form.username],
  )

  const onTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const probe: RabbitConnection = {
        id: source?.id ?? 'tmp',
        createdAt: Date.now(),
        ...form,
        vhost: form.vhost || '/',
      }
      const overview = (await api.testConnection(probe)) as Record<string, unknown>
      const ver = overview.rabbitmq_version ?? overview.product_version ?? '?'
      setTestResult({ ok: true, msg: t('dialog.testOk', { version: String(ver) }) })
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  const onSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const payload = { ...form, vhost: form.vhost || '/' }
      if (mode === 'edit' && source) {
        await updateConnection(source.id, payload)
      } else {
        await addConnection(payload)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      size="md"
      title={mode === 'edit' ? t('dialog.editTitle') : t('dialog.addTitle')}
      cancelText={t('dialog.cancel')}
      okText={saving ? t('dialog.saving') : t('dialog.save')}
      okDisabled={!canSave || saving}
      onCancel={onClose}
      onOk={onSave}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('dialog.labelName')} span={2}>
          <input
            className={inputCls}
            placeholder={t('dialog.placeholderName')}
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          />
        </Field>
        <Field label={t('dialog.labelHost')} span={2}>
          <input
            className={inputCls}
            placeholder="localhost"
            value={form.host}
            onChange={(e) => setForm((s) => ({ ...s, host: e.target.value }))}
          />
        </Field>
        <Field label={t('dialog.labelAmqpPort')}>
          <input
            className={inputCls}
            type="number"
            value={form.amqpPort}
            onChange={(e) => setForm((s) => ({ ...s, amqpPort: Number(e.target.value) || 0 }))}
          />
        </Field>
        <Field label={t('dialog.labelMgmtPort')}>
          <input
            className={inputCls}
            type="number"
            value={form.mgmtPort}
            onChange={(e) => setForm((s) => ({ ...s, mgmtPort: Number(e.target.value) || 0 }))}
          />
        </Field>
        <Field label={t('dialog.labelUsername')}>
          <input
            className={inputCls}
            value={form.username}
            onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
          />
        </Field>
        <Field label={t('dialog.labelPassword')}>
          <input
            className={inputCls}
            type="password"
            value={form.password}
            onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          />
        </Field>
        <Field label={t('dialog.labelVhost')}>
          <input
            className={inputCls}
            value={form.vhost}
            onChange={(e) => setForm((s) => ({ ...s, vhost: e.target.value }))}
          />
        </Field>
        <Field label={t('dialog.labelTls')}>
          <label className="mt-1 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.tls}
              onChange={(e) => setForm((s) => ({ ...s, tls: e.target.checked }))}
            />
            {t('dialog.labelTlsHint')}
          </label>
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!canSave || testing}
          onClick={onTest}
          className="rounded-lg border border-cyan-400/60 px-3 py-1.5 text-xs font-medium text-cyan-700 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-400/40 dark:text-cyan-300"
        >
          {testing ? t('dialog.testing') : t('dialog.testConnection')}
        </button>
        {testResult ? (
          <span
            className={`text-xs ${testResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {testResult.msg}
          </span>
        ) : (
          <span className="text-xs text-zinc-500 dark:text-zinc-500">{t('dialog.testHint')}</span>
        )}
      </div>
    </Modal>
  )
}

const inputCls =
  'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100'

function Field({
  label,
  children,
  span = 1,
}: {
  label: string
  children: React.ReactNode
  span?: 1 | 2
}) {
  return (
    <label className={span === 2 ? 'col-span-2 block' : 'block'}>
      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  )
}
