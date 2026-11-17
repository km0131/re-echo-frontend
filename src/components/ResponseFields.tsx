// 回答フォームの部品（参加者の回答フォームと、幹事の編集シートで共有する）
import type { RefObject } from 'react'
import { cx } from '../lib/cx'
import type { CandidateRow } from '../lib/responseForm'
import { Card, ChoiceButtons, type Choice } from '../ui'

/** 候補日ごとの ◯△✕。missing に入っている未回答の行は枠を maybe にする。 */
export function CandidateChoices({
  candidates,
  choices,
  missing,
  onChange,
  rowRefs,
  title = '都合のいい日',
}: {
  candidates: CandidateRow[]
  choices: Record<string, Choice>
  missing: Set<string>
  onChange: (candidateId: string, v: Choice) => void
  /** 未回答の行へスクロールするための参照 */
  rowRefs?: RefObject<Record<string, HTMLDivElement | null>>
  title?: string
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-label font-medium">{title}</h2>
      <Card className="gap-0 py-1">
        {candidates.map((c) => {
          const bad = missing.has(c.id) && !choices[c.id]
          return (
            <div
              key={c.id}
              ref={(el) => {
                if (rowRefs?.current) rowRefs.current[c.id] = el
              }}
              className={cx(
                'flex items-center justify-between gap-2 border-b border-line-soft py-3 last:border-0',
                bad && '-mx-2 rounded-field border-strong border-maybe px-2 last:border-strong',
              )}
            >
              <span className="whitespace-nowrap text-label font-medium min-[380px]:text-body">
                {c.label}
              </span>
              <ChoiceButtons
                label={c.label}
                value={choices[c.id]}
                invalid={bad}
                onChange={(v) => onChange(c.id, v)}
              />
            </div>
          )
        })}
      </Card>
    </section>
  )
}
