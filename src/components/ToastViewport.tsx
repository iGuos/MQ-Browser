import { createPortal } from 'react-dom'
import { useToastStore, type ToastKind } from '@/stores/toastStore'

const KIND_STYLES: Record<ToastKind, string> = {
  success:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  error: 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200',
  info: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200',
  warning:
    'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
}

const KIND_ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '⚠',
  info: 'ⓘ',
  warning: '⚠',
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[2000] flex w-80 flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur-md',
            KIND_STYLES[t.kind],
          ].join(' ')}
        >
          <span className="mt-0.5 shrink-0 text-base leading-none">{KIND_ICON[t.kind]}</span>
          <div className="min-w-0 flex-1">
            {t.title ? <div className="font-medium">{t.title}</div> : null}
            <div className="whitespace-pre-wrap break-words">{t.message}</div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="shrink-0 rounded-md px-1 text-current opacity-50 transition hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
