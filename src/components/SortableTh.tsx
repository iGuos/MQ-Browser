import type { SortState } from '@/lib/sort'
import { InfoIcon } from '@/components/InfoIcon'

interface Props<K extends string> {
  sortKey: K | null
  sortState: SortState<K>
  onSort: (key: K) => void
  /** Display label. */
  children: React.ReactNode
  align?: 'right'
  hint?: string
  /** Set true to disable sorting on this column. */
  disabled?: boolean
}

/**
 * Table header cell with click-to-sort. Three-state: none → asc → desc → none.
 * Pass `sortKey` for sortable columns or `null` for non-sortable ones
 * (renders the same styling minus the click handler + arrow).
 */
export function SortableTh<K extends string>({
  sortKey,
  sortState,
  onSort,
  children,
  align,
  hint,
  disabled,
}: Props<K>) {
  const active = sortKey !== null && sortState.key === sortKey
  const clickable = sortKey !== null && !disabled
  // Per design: header labels are always left-aligned, independent of the
  // cell-alignment hint (the `align` prop still flows down so callers can
  // semantically tag numeric columns).
  void align
  return (
    <th
      onClick={clickable ? () => onSort(sortKey) : undefined}
      className={[
        'whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide',
        clickable ? 'cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100' : '',
        active ? 'text-cyan-700 dark:text-cyan-300' : '',
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {children}
        {hint ? <InfoIcon hint={hint} /> : null}
        {clickable ? <SortIndicator active={active} dir={sortState.dir} /> : null}
      </span>
    </th>
  )
}

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) {
    return (
      <span className="opacity-30" aria-hidden>
        <svg width="8" height="10" viewBox="0 0 8 10">
          <path d="M4 0L7 4H1z" fill="currentColor" />
          <path d="M4 10L1 6H7z" fill="currentColor" />
        </svg>
      </span>
    )
  }
  return (
    <span aria-hidden>
      <svg width="8" height="10" viewBox="0 0 8 10">
        {dir === 'asc' ? (
          <path d="M4 0L7 6H1z" fill="currentColor" />
        ) : (
          <path d="M4 10L1 4H7z" fill="currentColor" />
        )}
      </svg>
    </span>
  )
}
