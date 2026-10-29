import { useEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import type { CandidateSummary, ResponseItem } from '../../lib/types'
import { ChoiceMark, EmptyState } from '../../ui'

/**
 * みんなの回答のマトリクス表。行＝候補日（左列を sticky で固定）、列＝名前（横スクロール）。
 * highlightId の行（ベスト1位・確定日）は背景 highlight・日付を太字にする。
 * 新しく入った・直された回答の列は、少しのあいだふわっと強調する（reduced-motion では無し）。
 */
export function ResponseMatrix({
  candidates,
  responses,
  highlightId,
}: {
  candidates: CandidateSummary[]
  responses: ResponseItem[]
  highlightId?: string
}) {
  const fresh = useFreshColumns(responses)
  if (responses.length === 0) {
    return <EmptyState title="まだ誰も回答していません" note="一番乗りしよう" />
  }
  return (
    <div
      className="-mx-gutter overflow-x-auto border-y border-line bg-card"
      tabIndex={0}
      aria-label="みんなの回答の表（横にスクロールできます）"
    >
      <table className="min-w-full border-collapse text-body">
        <thead>
          <tr className="h-10 border-b border-line">
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-[136px] border-r border-line bg-card pl-gutter pr-2 text-left text-tiny font-normal text-muted"
            >
              日程
            </th>
            {responses.map((r) => (
              <th
                key={r.id}
                scope="col"
                className={cx(
                  'max-w-[72px] truncate whitespace-nowrap px-2 text-center text-tiny font-normal text-muted',
                  fresh.has(r.id) && 'fresh-col',
                )}
              >
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const hi = c.id === highlightId
            return (
              <tr key={c.id} className={cx('h-10 border-b border-line last:border-0', hi && 'bg-highlight')}>
                <th
                  scope="row"
                  className={cx(
                    'sticky left-0 z-10 whitespace-nowrap border-r border-line pl-gutter pr-2 text-left text-label',
                    hi ? 'bg-highlight font-bold' : 'bg-card font-normal',
                  )}
                >
                  {c.label}
                </th>
                {responses.map((r) => (
                  <td key={r.id} className={cx('px-2 text-center', fresh.has(r.id) && 'fresh-col')}>
                    <ChoiceMark choice={r.choices[c.id]} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** 前回の表示から増えた・直された回答の ID を、2.5秒だけ返す。初回の表示では何も強調しない。 */
function useFreshColumns(responses: ResponseItem[]): Set<string> {
  const prev = useRef<Map<string, string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => {
    const now = new Map(responses.map((r) => [r.id, r.updatedAt]))
    const before = prev.current
    prev.current = now
    if (!before) return
    const changed = new Set([...now].filter(([id, at]) => before.get(id) !== at).map(([id]) => id))
    if (changed.size === 0) return
    setFresh(changed)
    const t = setTimeout(() => setFresh(new Set()), 2500)
    return () => clearTimeout(t)
  }, [responses])
  return fresh
}
