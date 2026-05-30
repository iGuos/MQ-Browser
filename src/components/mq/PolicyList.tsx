import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PolicyInfo, RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { api } from '@/lib/tauri'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { toast } from '@/stores/toastStore'
import { validateRegex } from '@/lib/validation'
import { ArgumentRows } from './CreateQueueDialog'

type Slice =
  | { policies: PolicyInfo[]; status: 'idle' | 'loading' | 'ok' | 'error' }
  | null

const APPLY_TO_OPTIONS = [
  { value: 'all', label: 'all (queues + exchanges)' },
  { value: 'queues', label: 'queues' },
  { value: 'exchanges', label: 'exchanges' },
  { value: 'classic_queues', label: 'classic_queues' },
  { value: 'quorum_queues', label: 'quorum_queues' },
  { value: 'streams', label: 'streams' },
]

const POLICY_KEY_PRESETS = [
  { key: 'max-length', hint: 'int' },
  { key: 'max-length-bytes', hint: 'int' },
  { key: 'message-ttl', hint: 'ms' },
  { key: 'expires', hint: 'ms' },
  { key: 'dead-letter-exchange', hint: 'exchange' },
  { key: 'dead-letter-routing-key', hint: 'routing key' },
  { key: 'overflow', hint: 'drop-head | reject-publish' },
  { key: 'queue-mode', hint: 'default | lazy' },
  { key: 'ha-mode', hint: 'all | exactly | nodes' },
]

export function PolicyList({
  connection,
  slice,
}: {
  connection: RabbitConnection
  slice: Slice
}) {
  const { t } = useTranslation()
  const workspaceId = useWorkspaceId()
  const activeVhost = useWorkspaceUiStore((s) => s.activeVhostByWs[workspaceId] ?? null)
  const fetchTopology = useTopologyStore((s) => s.fetch)
  const [filter, setFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<PolicyInfo | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = slice?.policies ?? []
    if (!q) return list
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.pattern.toLowerCase().includes(q),
    )
  }, [slice, filter])

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('policies.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('policies.count', { count: filtered.length })}
        </span>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 px-2.5 py-1.5 text-[11px] font-medium text-zinc-950"
        >
          + {t('policies.button')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <Th>{t('policies.col.name')}</Th>
              <Th>{t('policies.col.vhost')}</Th>
              <Th>{t('policies.col.pattern')}</Th>
              <Th>{t('policies.col.applyTo')}</Th>
              <Th align="right">{t('policies.col.priority')}</Th>
              <Th>{t('policies.col.definition')}</Th>
              <Th align="right">{t('queues.col.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={`${p.vhost}::${p.name}`}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <Td>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">{p.name}</span>
                </Td>
                <Td>
                  <span className="font-mono">{p.vhost}</span>
                </Td>
                <Td>
                  <span className="font-mono text-[10px]">{p.pattern}</span>
                </Td>
                <Td>{p.applyTo}</Td>
                <Td align="right">{p.priority}</Td>
                <Td>
                  <code className="block max-w-[20rem] truncate text-[10px] text-zinc-600 dark:text-zinc-400">
                    {JSON.stringify(p.definition)}
                  </code>
                </Td>
                <Td align="right">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(p)}
                    className="rounded-md border border-red-400/50 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
                  >
                    {t('queues.action.delete')}
                  </button>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  {t('policies.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <CreatePolicyDialog
        open={showCreate}
        connection={connection}
        vhost={activeVhost ?? connection.vhost}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          toast.success(t('policies.created'))
          void fetchTopology(workspaceId, connection, activeVhost)
        }}
      />

      <Modal
        open={confirmDelete !== null}
        title={t('policies.deleteConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('queues.action.delete')}
        onCancel={() => setConfirmDelete(null)}
        onOk={async () => {
          const target = confirmDelete
          setConfirmDelete(null)
          if (!target) return
          try {
            await api.deletePolicy(connection, target.vhost, target.name)
            toast.success(t('policies.deleted', { name: target.name }))
            void fetchTopology(workspaceId, connection, activeVhost)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        {t('policies.deleteConfirmDetail', { name: confirmDelete?.name ?? '' })}
      </Modal>
    </div>
  )
}

function CreatePolicyDialog({
  open,
  connection,
  vhost,
  onClose,
  onCreated,
}: {
  open: boolean
  connection: RabbitConnection
  vhost: string
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [pattern, setPattern] = useState('')
  const [applyTo, setApplyTo] = useState('all')
  const [priority, setPriority] = useState(0)
  const [defRows, setDefRows] = useState<Array<{ key: string; value: string }>>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const patternError = pattern ? validateRegex(pattern) : null

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const def: Record<string, unknown> = {}
      for (const r of defRows) {
        const k = r.key.trim()
        if (!k) continue
        def[k] = coerceVal(r.value)
      }
      await api.createPolicy(connection, {
        vhost,
        name: name.trim(),
        pattern,
        applyTo,
        priority,
        definition: def,
      })
      onCreated()
      onClose()
      setName('')
      setPattern('')
      setApplyTo('all')
      setPriority(0)
      setDefRows([])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={t('policies.createTitle')}
      size="md"
      cancelText={t('dialog.cancel')}
      okText={saving ? t('dialog.saving') : t('create.submit')}
      okDisabled={!name.trim() || !pattern.trim() || saving || patternError !== null}
      onCancel={onClose}
      onOk={submit}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('policies.createName')}>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-ttl-policy"
              autoFocus
            />
          </Field>
          <Field label={t('policies.createPattern')}>
            <input
              className={`${inputCls} font-mono ${patternError ? 'border-red-400' : ''}`}
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="^logs\\."
            />
            {patternError ? (
              <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">{patternError}</p>
            ) : null}
          </Field>
          <Field label={t('policies.createApplyTo')}>
            <Select value={applyTo} onChange={setApplyTo} options={APPLY_TO_OPTIONS} size="md" />
          </Field>
          <Field label={t('policies.createPriority')}>
            <input
              className={inputCls}
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
            />
          </Field>
        </div>

        <ArgumentRows
          rows={defRows}
          onChange={setDefRows}
          presets={POLICY_KEY_PRESETS}
          label={t('policies.createDefinition')}
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
  'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100'

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th className={`px-3 py-2 text-[11px] font-semibold uppercase ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </th>
  )
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <td className={`px-3 py-2 align-top ${align === 'right' ? 'text-right tabular-nums' : ''}`}>
      {children}
    </td>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
