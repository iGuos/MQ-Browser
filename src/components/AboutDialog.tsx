import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getVersion, getName, getTauriVersion } from '@tauri-apps/api/app'
import { Modal } from '@/components/Modal'

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [info, setInfo] = useState<{
    name: string
    version: string
    tauri: string
  } | null>(null)

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const [name, version, tauri] = await Promise.all([
          getName(),
          getVersion(),
          getTauriVersion(),
        ])
        setInfo({ name, version, tauri })
      } catch {
        setInfo({ name: 'MQ Browser', version: '?', tauri: '?' })
      }
    })()
  }, [open])

  return (
    <Modal open={open} title={t('about.title')} cancelText={t('about.close')} onCancel={onClose}>
      <div className="space-y-3 text-xs">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/[0.06] dark:bg-zinc-900">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {info?.name ?? 'MQ Browser'}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span>{t('about.version')}</span>
            <span className="font-mono">{info?.version ?? '—'}</span>
            <span>{t('about.tauri')}</span>
            <span className="font-mono">{info?.tauri ?? '—'}</span>
          </div>
        </div>
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">{t('about.description')}</p>
        <p className="text-[11px] text-zinc-500">{t('about.license')}</p>
      </div>
    </Modal>
  )
}
