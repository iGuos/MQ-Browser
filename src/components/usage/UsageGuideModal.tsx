import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/Modal'

export function UsageGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      size="md"
      title={t('usage.title')}
      cancelText={t('usage.close')}
      onCancel={onClose}
    >
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>{t('usage.step1')}</li>
        <li>{t('usage.step2')}</li>
        <li>{t('usage.step3')}</li>
        <li>{t('usage.step4')}</li>
        <li>{t('usage.step5')}</li>
      </ol>
      <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-500">{t('usage.note')}</p>
    </Modal>
  )
}
