import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Mode = 'raw' | 'tree' | 'hex'

interface Props {
  bodyText: string | null
  bodyBase64: string
}

export function MessageBodyViewer({ bodyText, bodyBase64 }: Props) {
  const { t } = useTranslation()
  const parsed = useMemo<unknown | undefined>(() => {
    if (!bodyText) return undefined
    try {
      return JSON.parse(bodyText) as unknown
    } catch {
      return undefined
    }
  }, [bodyText])
  const isJson = parsed !== undefined
  const [mode, setMode] = useState<Mode>(isJson ? 'tree' : 'raw')

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-white/10">
      <div className="flex items-center gap-1 border-b border-zinc-200 px-2 py-1 dark:border-white/10">
        <Tab active={mode === 'raw'} onClick={() => setMode('raw')}>
          {t('body.raw')}
        </Tab>
        {isJson ? (
          <Tab active={mode === 'tree'} onClick={() => setMode('tree')}>
            {t('body.tree')}
          </Tab>
        ) : null}
        <Tab active={mode === 'hex'} onClick={() => setMode('hex')}>
          {t('body.hex')}
        </Tab>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(bodyText ?? bodyBase64)
          }}
          className="ml-auto rounded-md border border-zinc-300 px-2 py-0.5 text-[10px] text-zinc-600 hover:border-cyan-400/50 hover:text-cyan-700 dark:border-white/10 dark:text-zinc-300"
        >
          {t('body.copy')}
        </button>
      </div>
      <div className="max-h-72 overflow-auto p-2 font-mono text-[11px] leading-snug">
        {mode === 'raw' ? (
          <pre className="whitespace-pre-wrap break-all">{bodyText ?? `(base64) ${bodyBase64}`}</pre>
        ) : mode === 'tree' ? (
          <JsonNode value={parsed} depth={0} path="$" />
        ) : (
          <HexDump base64={bodyBase64} />
        )}
      </div>
    </div>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
        active
          ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}

function JsonNode({
  value,
  depth,
  path,
}: {
  value: unknown
  depth: number
  path: string
}) {
  const [collapsed, setCollapsed] = useState(depth >= 3)
  if (value === null) return <Token kind="null">null</Token>
  if (typeof value === 'boolean') return <Token kind="bool">{String(value)}</Token>
  if (typeof value === 'number') return <Token kind="number">{value}</Token>
  if (typeof value === 'string')
    return <Token kind="string">"{value}"</Token>

  if (Array.isArray(value)) {
    if (value.length === 0) return <Token kind="muted">[ ]</Token>
    return (
      <div className="block">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {collapsed ? '▶' : '▼'} <span className="text-zinc-500">[{value.length}]</span>
        </button>
        {!collapsed ? (
          <div className="ml-4 border-l border-zinc-200 pl-3 dark:border-white/10">
            {value.map((v, i) => (
              <div key={`${path}[${i}]`}>
                <span className="text-zinc-500">{i}</span>
                <span className="text-zinc-400"> : </span>
                <JsonNode value={v} depth={depth + 1} path={`${path}[${i}]`} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <Token kind="muted">{'{ }'}</Token>
    return (
      <div className="block">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {collapsed ? '▶' : '▼'} <span className="text-zinc-500">{`{${entries.length}}`}</span>
        </button>
        {!collapsed ? (
          <div className="ml-4 border-l border-zinc-200 pl-3 dark:border-white/10">
            {entries.map(([k, v]) => (
              <div key={`${path}.${k}`}>
                <span className="text-cyan-700 dark:text-cyan-300">{k}</span>
                <span className="text-zinc-400"> : </span>
                <JsonNode value={v} depth={depth + 1} path={`${path}.${k}`} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }
  return <Token kind="muted">{String(value)}</Token>
}

function Token({
  kind,
  children,
}: {
  kind: 'string' | 'number' | 'bool' | 'null' | 'muted'
  children: React.ReactNode
}) {
  const cls =
    kind === 'string'
      ? 'text-emerald-700 dark:text-emerald-300'
      : kind === 'number'
        ? 'text-amber-700 dark:text-amber-300'
        : kind === 'bool'
          ? 'text-fuchsia-700 dark:text-fuchsia-300'
          : kind === 'null'
            ? 'text-zinc-500'
            : 'text-zinc-500'
  return <span className={cls}>{children}</span>
}

function HexDump({ base64 }: { base64: string }) {
  const bytes = useMemo(() => {
    try {
      const bin = atob(base64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      return arr
    } catch {
      return new Uint8Array()
    }
  }, [base64])

  if (bytes.length === 0) {
    return <span className="text-zinc-500">— empty —</span>
  }

  const rows: string[] = []
  for (let off = 0; off < bytes.length; off += 16) {
    const slice = bytes.slice(off, off + 16)
    const hex = Array.from(slice, (b) => b.toString(16).padStart(2, '0')).join(' ')
    const ascii = Array.from(slice, (b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')).join('')
    rows.push(`${off.toString(16).padStart(8, '0')}  ${hex.padEnd(48, ' ')}  ${ascii}`)
  }
  return <pre className="whitespace-pre">{rows.join('\n')}</pre>
}
