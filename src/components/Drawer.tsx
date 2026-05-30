import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  /** Width in pixels. Default 520. */
  width?: number
}

/** Right-side slide-in drawer. Used for queue/exchange detail views. */
export function Drawer({ open, title, onClose, children, width = 520 }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex">
      <div
        className="flex-1 bg-black/30 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />
      <aside
        className="flex h-full flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950"
        style={{ width }}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-xs">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}
