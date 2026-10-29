import { useRef, type KeyboardEvent } from 'react'
import { cx } from '../lib/cx'

export type TabItem<K extends string> = { key: K; label: string; badge?: number }

/** タブ。地 highlight、選択中は card 地・navy・700。件数バッジは maybe 地の小さな丸。 */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem<K>[]
  value: K
  onChange: (k: K) => void
  label: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (i + d + items.length) % items.length
    onChange(items[n].key)
    refs.current[n]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-btn bg-highlight p-1">
      {items.map((t, i) => {
        const on = t.key === value
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'inline-flex h-tap flex-1 items-center justify-center gap-1.5 rounded-field text-label transition-colors',
              on ? 'bg-card font-bold text-navy' : 'text-muted hover:text-navy',
            )}
          >
            {t.label}
            {!!t.badge && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-maybe px-1 text-tiny font-bold text-card">
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
