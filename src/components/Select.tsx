import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  /** Optional secondary line shown beneath the label. */
  hint?: string
}

interface PanelPos {
  top: number
  left: number
  width: number
}

function usePanelPos(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement>,
): PanelPos | null {
  const [pos, setPos] = useState<PanelPos | null>(null)

  const recompute = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [triggerRef])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    recompute()
  }, [open, recompute])

  useEffect(() => {
    if (!open) return
    const onResize = () => recompute()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, recompute])

  return pos
}

function useOutsideClose(
  open: boolean,
  refs: React.RefObject<HTMLElement>[],
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return
    const handler = (e: Event) => {
      const t = e.target as Node | null
      if (!t) return
      for (const r of refs) {
        if (r.current?.contains(t)) return
      }
      onClose()
    }
    // mousedown closes the panel before any new focus / click target is
    // processed — more reliable in WKWebView than listening on click.
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose])
}

interface SelectProps<T extends string = string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

/**
 * Cross-platform select. Renders the popover via portal so the OS-native
 * dropdown styling (different on macOS / Windows / Linux) doesn't apply.
 */
export function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder,
  className,
  size = 'sm',
  disabled,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const pos = usePanelPos(open, triggerRef)

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])
  const triggerLabel = selected?.label ?? placeholder ?? ''

  useEffect(() => {
    if (!open) return
    const idx = options.findIndex((o) => o.value === value)
    setHighlight(idx >= 0 ? idx : 0)
  }, [open, options, value])

  useOutsideClose(open, [triggerRef, panelRef], () => setOpen(false))

  const commit = (idx: number) => {
    const opt = options[idx]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(options.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setHighlight(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setHighlight(options.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commit(highlight)
    }
  }

  const sizeCls = size === 'md' ? 'h-8 px-2.5 text-sm' : 'h-[26px] px-2 text-xs'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={[
          'inline-flex items-center justify-between gap-2 rounded-md border bg-white text-zinc-900',
          'border-zinc-300 hover:border-cyan-400/60',
          'dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-cyan-400/40',
          'transition disabled:cursor-not-allowed disabled:opacity-50',
          sizeCls,
          className ?? '',
        ].join(' ')}
      >
        <span className="truncate">{triggerLabel}</span>
        <Caret />
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                minWidth: pos.width,
                maxHeight: 280,
                zIndex: 1000,
              }}
              className="overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 text-xs shadow-xl ring-1 ring-black/5 dark:border-white/10 dark:bg-zinc-900 dark:ring-white/5"
              onKeyDown={onKeyDown}
            >
              {options.length === 0 ? (
                <div className="px-3 py-2 text-zinc-500">—</div>
              ) : (
                options.map((opt, i) => (
                  <OptionRow
                    key={opt.value}
                    option={opt}
                    selected={opt.value === value}
                    highlighted={i === highlight}
                    onHover={() => setHighlight(i)}
                    onSelect={() => commit(i)}
                  />
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function Caret() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      className="shrink-0 text-zinc-500 dark:text-zinc-400"
    >
      <path
        d="M1 3.5L5 7.5L9 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OptionRow({
  option,
  selected,
  highlighted,
  onHover,
  onSelect,
}: {
  option: SelectOption<string>
  selected: boolean
  highlighted: boolean
  onHover: () => void
  onSelect: () => void
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      onPointerEnter={onHover}
      onMouseDown={(e) => {
        // Prevent the trigger from losing focus before the click commits.
        e.preventDefault()
      }}
      onClick={onSelect}
      className={[
        'cursor-pointer px-2.5 py-1.5',
        highlighted
          ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
          : 'text-zinc-800 dark:text-zinc-200',
        selected ? 'font-medium' : '',
      ].join(' ')}
    >
      <div className="truncate">{option.label}</div>
      {option.hint ? (
        <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-500">{option.hint}</div>
      ) : null}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Combobox: editable text input with a filtered popover of suggestions.
// Same look + cross-platform behavior as Select; replaces <input list> +
// <datalist> which is OS-rendered.
// -----------------------------------------------------------------------------

interface ComboboxProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
}

export function Combobox({
  value,
  options,
  onChange,
  placeholder,
  className,
  inputClassName,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const pos = usePanelPos(open, inputRef)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
    )
  }, [options, value])

  useEffect(() => {
    setHighlight(0)
  }, [filtered.length])

  useOutsideClose(open, [inputRef, panelRef], () => setOpen(false))

  const commit = (idx: number) => {
    const opt = filtered[idx]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault()
        commit(highlight)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
      }
    }
  }

  return (
    <div className={['relative inline-block w-full', className ?? ''].join(' ')}>
      <input
        ref={inputRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={inputClassName}
      />

      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                minWidth: pos.width,
                maxHeight: 280,
                zIndex: 1000,
              }}
              className="overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 text-xs shadow-xl ring-1 ring-black/5 dark:border-white/10 dark:bg-zinc-900 dark:ring-white/5"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-zinc-500">—</div>
              ) : (
                filtered.map((opt, i) => (
                  <OptionRow
                    key={`${opt.value}-${i}`}
                    option={opt}
                    selected={opt.value === value}
                    highlighted={i === highlight}
                    onHover={() => setHighlight(i)}
                    onSelect={() => commit(i)}
                  />
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
