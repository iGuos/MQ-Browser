import { useEffect, type ReactNode } from 'react'

/** Lightweight modal mirroring the visual treatment used in MCP-Browser. */
export function Modal({
  open,
  title,
  children,
  okText,
  cancelText,
  okDisabled,
  onOk,
  onCancel,
  size = 'sm',
}: {
  open: boolean
  title: ReactNode
  children: ReactNode
  okText?: string
  cancelText?: string
  okDisabled?: boolean
  onOk?: () => void
  onCancel?: () => void
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  const widthCls = size === 'lg' ? 'w-[44rem]' : size === 'md' ? 'w-[32rem]' : 'w-[26rem]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm dark:bg-zinc-950/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.()
      }}
    >
      <div
        className={`${widthCls} max-w-[92vw] rounded-2xl border border-zinc-200 bg-white p-5 shadow-dialog dark:border-white/[0.06] dark:bg-zinc-900`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
        <div className="text-sm text-zinc-700 dark:text-zinc-300">{children}</div>
        {(okText || cancelText) && (
          <div className="mt-5 flex justify-end gap-2">
            {cancelText ? (
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                onClick={onCancel}
              >
                {cancelText}
              </button>
            ) : null}
            {okText ? (
              <button
                type="button"
                disabled={okDisabled}
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1.5 text-sm font-medium text-zinc-950 shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onOk}
              >
                {okText}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
