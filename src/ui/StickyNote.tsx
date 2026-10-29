import { cx } from '../lib/cx'

/** ひとことコメントの付箋。傾きは index で交互にする。文字は必ずテキストとして描画する。 */
export function StickyNote({ text, name, index = 0 }: { text: string; name: string; index?: number }) {
  return (
    <figure
      className={cx(
        'rounded-tag bg-card px-3.5 py-3 shadow-note',
        index % 2 === 0 ? 'rotate-[-.8deg]' : 'rotate-[.6deg]',
      )}
    >
      <blockquote className="whitespace-pre-wrap break-words font-hand text-input leading-relaxed text-ink">
        {text}
      </blockquote>
      <figcaption className="mt-1.5 text-tiny text-muted">― {name}</figcaption>
    </figure>
  )
}
