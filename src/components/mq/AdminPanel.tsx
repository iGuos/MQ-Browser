import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  PermissionInfo,
  RabbitConnection,
  UserInfo,
  VhostInfo,
} from '@shared/types'
import { Modal } from '@/components/Modal'
import { Combobox } from '@/components/Select'
import { api } from '@/lib/tauri'
import { useTopologyStore } from '@/stores/topologyStore'
import { useWorkspaceId } from '@/context/WorkspaceContext'
import { useWorkspaceUiStore } from '@/stores/workspaceUiStore'
import { toast } from '@/stores/toastStore'

type Slice =
  | {
      users: UserInfo[]
      permissions: PermissionInfo[]
      vhosts: VhostInfo[]
      status: 'idle' | 'loading' | 'ok' | 'error'
    }
  | null

type Section = 'users' | 'permissions' | 'vhosts'

export function AdminPanel({
  connection,
  slice,
}: {
  connection: RabbitConnection
  slice: Slice
}) {
  const { t } = useTranslation()
  const [section, setSection] = useState<Section>('users')

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-zinc-200 dark:border-white/[0.06]">
        {(['users', 'permissions', 'vhosts'] as Section[]).map((s) => {
          const active = section === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={`relative px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'text-cyan-700 dark:text-cyan-300'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {t(`admin.tab.${s}`)}
              {active ? (
                <span className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-teal-500" />
              ) : null}
            </button>
          )
        })}
      </div>

      {section === 'users' ? (
        <UsersSection connection={connection} slice={slice} />
      ) : section === 'permissions' ? (
        <PermissionsSection connection={connection} slice={slice} />
      ) : (
        <VhostsSection connection={connection} slice={slice} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function UsersSection({
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
  const [editing, setEditing] = useState<UserInfo | null | 'new'>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserInfo | null>(null)

  const users = slice?.users ?? []
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.tags.some((tag) => tag.toLowerCase().includes(q)),
    )
  }, [users, filter])

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('admin.users.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('admin.users.count', { count: filtered.length })}
        </span>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 px-2.5 py-1.5 text-[11px] font-medium text-zinc-950"
        >
          + {t('admin.users.add')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <Th>{t('admin.users.col.name')}</Th>
              <Th>{t('admin.users.col.tags')}</Th>
              <Th>{t('admin.users.col.hash')}</Th>
              <Th align="right">{t('queues.col.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.name}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <Td>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">{u.name}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {u.tags.length === 0 ? (
                      <span className="text-[10px] text-zinc-500">—</span>
                    ) : (
                      u.tags.map((tag) => <TagBadge key={tag} tag={tag} />)
                    )}
                  </div>
                </Td>
                <Td>
                  <code className="text-[10px] text-zinc-500">
                    {u.hashingAlgorithm ? u.hashingAlgorithm.replace('rabbit_password_hashing_', '') : '—'}
                  </code>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(u)}
                      className="rounded-md border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 hover:border-cyan-400/50 hover:text-cyan-700 dark:border-white/10 dark:text-zinc-300"
                    >
                      {t('bindings.action.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(u)}
                      className="rounded-md border border-red-400/50 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    >
                      {t('queues.action.delete')}
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                  {t('admin.users.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <UserDialog
        open={editing !== null}
        connection={connection}
        editing={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => void fetchTopology(workspaceId, connection, activeVhost)}
      />

      <Modal
        open={confirmDelete !== null}
        title={t('admin.users.deleteConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('queues.action.delete')}
        onCancel={() => setConfirmDelete(null)}
        onOk={async () => {
          const target = confirmDelete
          setConfirmDelete(null)
          if (!target) return
          try {
            await api.deleteUser(connection, target.name)
            toast.success(t('admin.users.deleted', { name: target.name }))
            void fetchTopology(workspaceId, connection, activeVhost)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        {t('admin.users.deleteConfirmDetail', { name: confirmDelete?.name ?? '' })}
      </Modal>
    </div>
  )
}

function UserDialog({
  open,
  connection,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean
  connection: RabbitConnection
  editing: UserInfo | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state on open
  useMemo(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setPassword('')
    setTags(editing?.tags ?? [])
    setError(null)
  }, [open, editing])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.createOrUpdateUser(connection, {
        name: name.trim(),
        password,
        tags,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tag: string) =>
    setTags((s) => (s.includes(tag) ? s.filter((x) => x !== tag) : [...s, tag]))

  const STANDARD_TAGS = ['administrator', 'monitoring', 'policymaker', 'management', 'impersonator']

  return (
    <Modal
      open={open}
      title={editing ? t('admin.users.editTitle') : t('admin.users.addTitle')}
      cancelText={t('dialog.cancel')}
      okText={saving ? t('dialog.saving') : t('create.submit')}
      okDisabled={!name.trim() || saving || (!editing && !password)}
      onCancel={onClose}
      onOk={submit}
    >
      <div className="space-y-3">
        <Field label={t('admin.users.fieldName')}>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={editing !== null}
            placeholder="alice"
            autoFocus={!editing}
          />
        </Field>
        <Field label={editing ? t('admin.users.fieldPasswordChange') : t('admin.users.fieldPassword')}>
          <input
            className={inputCls}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={editing ? t('admin.users.passwordKeep') : ''}
          />
        </Field>
        <Field label={t('admin.users.fieldTags')}>
          <div className="flex flex-wrap gap-2">
            {STANDARD_TAGS.map((tag) => (
              <label key={tag} className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={tags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                />
                <TagBadge tag={tag} />
              </label>
            ))}
          </div>
        </Field>
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

function PermissionsSection({
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
  const permissions = slice?.permissions ?? []
  const users = slice?.users ?? []
  const vhosts = slice?.vhosts ?? []
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<PermissionInfo | null | 'new'>(null)
  const [confirmClear, setConfirmClear] = useState<PermissionInfo | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return permissions
    return permissions.filter(
      (p) => p.user.toLowerCase().includes(q) || p.vhost.toLowerCase().includes(q),
    )
  }, [permissions, filter])

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('admin.permissions.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-[11px] text-zinc-500">
          {t('admin.permissions.count', { count: filtered.length })}
        </span>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 px-2.5 py-1.5 text-[11px] font-medium text-zinc-950"
        >
          + {t('admin.permissions.add')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <Th>{t('admin.permissions.col.user')}</Th>
              <Th>{t('admin.permissions.col.vhost')}</Th>
              <Th>{t('admin.permissions.col.configure')}</Th>
              <Th>{t('admin.permissions.col.write')}</Th>
              <Th>{t('admin.permissions.col.read')}</Th>
              <Th align="right">{t('queues.col.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={`${p.user}::${p.vhost}`}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <Td>
                  <span className="font-mono">{p.user}</span>
                </Td>
                <Td>
                  <span className="font-mono">{p.vhost}</span>
                </Td>
                <RegexCell value={p.configure} />
                <RegexCell value={p.write} />
                <RegexCell value={p.read} />
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      className="rounded-md border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 hover:border-cyan-400/50 hover:text-cyan-700 dark:border-white/10 dark:text-zinc-300"
                    >
                      {t('bindings.action.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(p)}
                      className="rounded-md border border-red-400/50 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    >
                      {t('admin.permissions.revoke')}
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  {t('admin.permissions.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PermissionDialog
        open={editing !== null}
        connection={connection}
        editing={editing === 'new' ? null : editing}
        users={users}
        vhosts={vhosts}
        onClose={() => setEditing(null)}
        onSaved={() => void fetchTopology(workspaceId, connection, activeVhost)}
      />

      <Modal
        open={confirmClear !== null}
        title={t('admin.permissions.revokeConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('admin.permissions.revoke')}
        onCancel={() => setConfirmClear(null)}
        onOk={async () => {
          const target = confirmClear
          setConfirmClear(null)
          if (!target) return
          try {
            await api.clearPermissions(connection, target.user, target.vhost)
            toast.success(t('admin.permissions.revoked'))
            void fetchTopology(workspaceId, connection, activeVhost)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        {t('admin.permissions.revokeConfirmDetail', {
          user: confirmClear?.user ?? '',
          vhost: confirmClear?.vhost ?? '',
        })}
      </Modal>
    </div>
  )
}

function PermissionDialog({
  open,
  connection,
  editing,
  users,
  vhosts,
  onClose,
  onSaved,
}: {
  open: boolean
  connection: RabbitConnection
  editing: PermissionInfo | null
  users: UserInfo[]
  vhosts: VhostInfo[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [user, setUser] = useState('')
  const [vhost, setVhost] = useState('/')
  const [configure, setConfigure] = useState('.*')
  const [write, setWrite] = useState('.*')
  const [read, setRead] = useState('.*')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useMemo(() => {
    if (!open) return
    setUser(editing?.user ?? '')
    setVhost(editing?.vhost ?? '/')
    setConfigure(editing?.configure ?? '.*')
    setWrite(editing?.write ?? '.*')
    setRead(editing?.read ?? '.*')
    setError(null)
  }, [open, editing])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.setPermissions(connection, { user, vhost, configure, write, read })
      onSaved()
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
      title={editing ? t('admin.permissions.editTitle') : t('admin.permissions.addTitle')}
      cancelText={t('dialog.cancel')}
      okText={saving ? t('dialog.saving') : t('create.submit')}
      okDisabled={!user.trim() || !vhost.trim() || saving}
      onCancel={onClose}
      onOk={submit}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('admin.permissions.fieldUser')}>
            <Combobox
              value={user}
              onChange={setUser}
              options={users.map((u) => ({ value: u.name, label: u.name }))}
              placeholder="user"
              inputClassName={inputCls}
            />
          </Field>
          <Field label="vhost">
            <Combobox
              value={vhost}
              onChange={setVhost}
              options={vhosts.map((v) => ({ value: v.name, label: v.name }))}
              placeholder="/"
              inputClassName={inputCls}
            />
          </Field>
        </div>
        <p className="text-[11px] text-zinc-500">{t('admin.permissions.regexHint')}</p>
        <Field label={t('admin.permissions.col.configure')}>
          <RegexInput value={configure} onChange={setConfigure} />
        </Field>
        <Field label={t('admin.permissions.col.write')}>
          <RegexInput value={write} onChange={setWrite} />
        </Field>
        <Field label={t('admin.permissions.col.read')}>
          <RegexInput value={read} onChange={setRead} />
        </Field>
        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function RegexInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        className={`${inputCls} flex-1 font-mono`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=".*"
      />
      <button
        type="button"
        onClick={() => onChange('.*')}
        className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] text-zinc-600 dark:border-white/10 dark:text-zinc-300"
      >
        all
      </button>
      <button
        type="button"
        onClick={() => onChange('')}
        className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] text-zinc-600 dark:border-white/10 dark:text-zinc-300"
      >
        none
      </button>
    </div>
  )
}

function RegexCell({ value }: { value: string }) {
  const isAll = value === '.*'
  const isNone = value === ''
  return (
    <Td>
      <code
        className={
          isAll
            ? 'text-emerald-700 dark:text-emerald-300'
            : isNone
              ? 'text-zinc-500'
              : 'text-amber-700 dark:text-amber-300'
        }
      >
        {isAll ? 'all' : isNone ? 'none' : value}
      </code>
    </Td>
  )
}

// ---------------------------------------------------------------------------
// Vhosts
// ---------------------------------------------------------------------------

function VhostsSection({
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
  const vhosts = slice?.vhosts ?? []
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<VhostInfo | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          placeholder={t('admin.vhosts.namePlaceholder')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="button"
          disabled={!newName.trim()}
          onClick={async () => {
            try {
              await api.createVhost(connection, newName.trim())
              toast.success(t('admin.vhosts.created', { name: newName.trim() }))
              setNewName('')
              void fetchTopology(workspaceId, connection, activeVhost)
            } catch (e) {
              toast.error(e instanceof Error ? e.message : String(e))
            }
          }}
          className="rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 px-2.5 py-1.5 text-[11px] font-medium text-zinc-950 disabled:opacity-50"
        >
          + {t('admin.vhosts.add')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/[0.06]">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <Th>{t('admin.vhosts.col.name')}</Th>
              <Th>{t('admin.vhosts.col.tracing')}</Th>
              <Th align="right">{t('queues.col.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {vhosts.map((v) => (
              <tr
                key={v.name}
                className="border-t border-zinc-200/80 odd:bg-white even:bg-zinc-50/60 dark:border-white/[0.04] dark:odd:bg-zinc-900/40 dark:even:bg-zinc-950/40"
              >
                <Td>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">{v.name}</span>
                </Td>
                <Td>
                  <span className={v.tracing ? 'text-amber-600' : 'text-zinc-500'}>
                    {v.tracing ? 'on' : 'off'}
                  </span>
                </Td>
                <Td align="right">
                  {v.name === '/' ? (
                    <span className="text-[10px] text-zinc-500">(default)</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(v)}
                      className="rounded-md border border-red-400/50 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    >
                      {t('queues.action.delete')}
                    </button>
                  )}
                </Td>
              </tr>
            ))}
            {vhosts.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
                  {t('admin.vhosts.none')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={confirmDelete !== null}
        title={t('admin.vhosts.deleteConfirmTitle')}
        cancelText={t('queues.cancel')}
        okText={t('queues.action.delete')}
        onCancel={() => setConfirmDelete(null)}
        onOk={async () => {
          const target = confirmDelete
          setConfirmDelete(null)
          if (!target) return
          try {
            await api.deleteVhost(connection, target.name)
            toast.success(t('admin.vhosts.deleted', { name: target.name }))
            void fetchTopology(workspaceId, connection, activeVhost)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        {t('admin.vhosts.deleteConfirmDetail', { name: confirmDelete?.name ?? '' })}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TAG_STYLES: Record<string, string> = {
  administrator: 'bg-red-500/10 text-red-700 dark:text-red-300',
  monitoring: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  policymaker: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  management: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  impersonator: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
}

function TagBadge({ tag }: { tag: string }) {
  const cls = TAG_STYLES[tag] ?? 'bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>
      {tag}
    </span>
  )
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 disabled:opacity-50'

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

