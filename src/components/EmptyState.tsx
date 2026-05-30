interface Props {
  icon?: React.ReactNode
  title: string
  hint?: string
  cta?: {
    label: string
    onClick: () => void
  }
  /** When the list isn't empty but filter hides everything, render a softer variant. */
  variant?: 'none' | 'filtered'
}

/** Consistent empty-state card: icon + title + hint + optional CTA. */
export function EmptyState({ icon, title, hint, cta, variant = 'none' }: Props) {
  const tone =
    variant === 'filtered'
      ? 'border-dashed border-zinc-300 bg-transparent dark:border-white/10'
      : 'border-dashed border-zinc-300 bg-zinc-50/60 dark:border-white/10 dark:bg-zinc-900/30'
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border px-6 py-10 text-center ${tone}`}
    >
      <div className="text-3xl opacity-70">{icon ?? '✦'}</div>
      <div>
        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{title}</div>
        {hint ? (
          <div className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
            {hint}
          </div>
        ) : null}
      </div>
      {cta ? (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-1 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1.5 text-xs font-medium text-zinc-950 shadow-sm hover:brightness-110"
        >
          {cta.label}
        </button>
      ) : null}
    </div>
  )
}
