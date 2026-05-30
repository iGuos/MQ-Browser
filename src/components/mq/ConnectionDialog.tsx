import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { useConnectionsStore } from '@/stores/connectionsStore'
import { api } from '@/lib/tauri'
import { validateHost, passwordStrength } from '@/lib/validation'
import { InfoIcon } from '@/components/InfoIcon'

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
  /** Optional — kept as metadata only. Empty string = unset. */
  amqpPort: string
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
    amqpPort: '',
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
    amqpPort: c.amqpPort ? String(c.amqpPort) : '',
    mgmtPort: c.mgmtPort,
    username: c.username,
    password: c.password,
    vhost: c.vhost,
    tls: c.tls,
  }
}

function toConnPayload(form: FormState) {
  const trimmed = form.amqpPort.trim()
  const amqpPort = trimmed ? Number(trimmed) : undefined
  return {
    ...form,
    amqpPort: Number.isFinite(amqpPort) ? amqpPort : undefined,
    vhost: form.vhost || '/',
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

  const hostError = useMemo(() => validateHost(form.host.trim()), [form.host])
  const pwStrength = useMemo(() => passwordStrength(form.password), [form.password])
  const canSave = useMemo(
    () =>
      form.host.trim().length > 0 &&
      form.username.trim().length > 0 &&
      hostError === null,
    [form.host, form.username, hostError],
  )

  const onTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const probe: RabbitConnection = {
        id: source?.id ?? 'tmp',
        createdAt: Date.now(),
        ...toConnPayload(form),
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
      const payload = toConnPayload(form)
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
            className={`${inputCls} ${hostError ? 'border-red-400 focus:border-red-500 focus:ring-red-300' : ''}`}
            placeholder="localhost"
            value={form.host}
            onChange={(e) => setForm((s) => ({ ...s, host: e.target.value }))}
          />
          {hostError ? (
            <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
              {t(`validation.host.${hostError}`)}
            </p>
          ) : null}
        </Field>
        <Field label={t('dialog.labelMgmtPort')} hint={t('dialog.mgmtPortHint')}>
          <input
            className={inputCls}
            type="number"
            value={form.mgmtPort}
            onChange={(e) => setForm((s) => ({ ...s, mgmtPort: Number(e.target.value) || 0 }))}
          />
        </Field>
        <Field label={t('dialog.labelAmqpPort')} hint={t('dialog.amqpPortHint')}>
          <input
            className={inputCls}
            type="number"
            placeholder={t('dialog.amqpPortPlaceholder')}
            value={form.amqpPort}
            onChange={(e) => setForm((s) => ({ ...s, amqpPort: e.target.value }))}
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
          {form.password ? <PasswordMeter strength={pwStrength} /> : null}
        </Field>
        <Field label={t('dialog.labelVhost')}>
          <input
            className={inputCls}
            value={form.vhost}
            onChange={(e) => setForm((s) => ({ ...s, vhost: e.target.value }))}
          />
        </Field>
        <Field label={t('dialog.labelTls')}>
          <label className="mt-1 flex h-[34px] items-center gap-2 text-sm">
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

function PasswordMeter({ strength }: { strength: 'empty' | 'weak' | 'fair' | 'strong' }) {
  const { t } = useTranslation()
  const cls =
    strength === 'strong'
      ? 'bg-emerald-500'
      : strength === 'fair'
        ? 'bg-amber-500'
        : 'bg-red-500'
  const w = strength === 'strong' ? '100%' : strength === 'fair' ? '60%' : '25%'
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full ${cls}`} style={{ width: w }} />
      </div>
      <span className="text-[9px] uppercase tracking-wide text-zinc-500">
        {t(`validation.password.${strength}`)}
      </span>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
  span = 1,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  span?: 1 | 2
}) {
  return (
    <label className={span === 2 ? 'col-span-2 block' : 'block'}>
      <span className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
        {hint ? <InfoIcon hint={hint} /> : null}
      </span>
      {children}
    </label>
  )
}
