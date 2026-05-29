import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { save, open as openDialog } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import type { RabbitConnection } from '@shared/types'
import { Modal } from '@/components/Modal'
import { api } from '@/lib/tauri'
import { toast } from '@/stores/toastStore'

interface Props {
  open: boolean
  connection: RabbitConnection
  vhost: string | null
  onClose: () => void
}

/**
 * Wraps RabbitMQ's `/api/definitions` endpoint — same JSON shape as the
 * official "Export / Import definitions" button in the management UI.
 */
export function DefinitionsDialog({ open, connection, vhost, onClose }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)

  const onExport = async () => {
    setBusy('export')
    try {
      const defs = await api.exportDefinitions(connection, vhost)
      const path = await save({
        defaultPath: `rabbitmq-definitions${vhost ? `-${vhost.replace(/\//g, '_')}` : ''}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!path) return
      await invoke('write_text_file', {
        path,
        contents: JSON.stringify(defs, null, 2),
      })
      toast.success(t('definitions.exportSuccess'))
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const onImport = async () => {
    setBusy('import')
    try {
      const path = await openDialog({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (typeof path !== 'string') {
        setBusy(null)
        return
      }
      const text = await invoke<string>('read_text_file', { path })
      const defs = JSON.parse(text) as Record<string, unknown>
      await api.importDefinitions(connection, defs, vhost)
      toast.success(t('definitions.importSuccess'))
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={open}
      title={t('definitions.title')}
      cancelText={t('dialog.cancel')}
      onCancel={onClose}
    >
      <div className="space-y-3 text-xs">
        <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">
          {t('definitions.scope', { scope: vhost ?? 'all' })}
        </p>
        <p className="text-zinc-500 dark:text-zinc-400">{t('definitions.help')}</p>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={onExport}
            className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-2 text-xs font-medium text-zinc-950 disabled:opacity-50"
          >
            {busy === 'export' ? t('definitions.exporting') : t('definitions.export')}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={onImport}
            className="flex-1 rounded-lg border border-amber-400/60 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300"
          >
            {busy === 'import' ? t('definitions.importing') : t('definitions.import')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
