import type { ResponseItem } from '../../lib/types'
import { StickyNote } from '../../ui'

/** ひとこと。コメントがある人だけ、新しい順に付箋で並べる。 */
export function Comments({ responses }: { responses: ResponseItem[] }) {
  const withComment = responses
    .filter((r) => r.comment.trim() !== '')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  if (withComment.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-hand text-h2 text-navy">ひとこと</h2>
      <div className="flex flex-col gap-3.5">
        {withComment.map((r, i) => (
          <StickyNote key={r.id} text={r.comment} name={r.name} index={i} />
        ))}
      </div>
    </section>
  )
}
