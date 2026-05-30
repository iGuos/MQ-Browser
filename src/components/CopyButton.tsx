import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  value: string
  /** Optional title override; defaults to translated "Copy". */
  title?: string
  className?: string
}

/**
 * Tiny clipboard-icon button. On click, copies `value`, flashes a check icon
 * for ~1.2s, then reverts. Falls back to a toast-friendly no-op if the
 * clipboard API is unavailable.
 */
export function CopyButton({ value, title, className }: Props) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Silent fallback — modern browsers / Tauri WebView always support this.
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? t('copyButton.title')}
      aria-label={title ?? t('copyButton.title')}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-400 opacity-40 transition hover:bg-zinc-200/80 hover:text-zinc-700 hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${
        copied ? 'opacity-100 text-emerald-600 dark:text-emerald-400' : ''
      } ${className ?? ''}`}
    >
      {copied ? (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <rect x="2.5" y="2.5" width="5" height="6" rx="0.8" stroke="currentColor" strokeWidth="1" fill="none" />
          <rect x="3.5" y="1" width="3" height="1" rx="0.3" fill="currentColor" />
        </svg>
      )}
    </button>
  )
}
