import { useId } from 'react'
import type { SurveyAnswer, SurveyQuestion } from '../../lib/types'
import { Pill, PillGroup, TextInput } from '../../ui'

/** アンケートの設問1つ。single と multi はピル、text は1行入力（design.md 3.3 の 6）。任意回答。 */
export function SurveyQuestionField({
  question: q,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: SurveyAnswer | undefined
  onChange: (a: SurveyAnswer) => void
}) {
  const id = useId()
  const picked = value?.optionIds ?? []
  const toggle = (oid: string) => {
    if (q.type === 'single') {
      onChange({ questionId: q.id, optionIds: picked.includes(oid) ? [] : [oid] })
      return
    }
    onChange({
      questionId: q.id,
      optionIds: picked.includes(oid) ? picked.filter((x) => x !== oid) : [...picked, oid],
    })
  }
  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="text-label font-medium">
        {q.text}
        <span className="ml-1.5 text-note font-normal text-muted">
          {q.type === 'multi' ? '（いくつでも・任意）' : '（任意）'}
        </span>
      </p>
      {q.type === 'text' ? (
        <TextInput
          aria-labelledby={id}
          value={value?.text ?? ''}
          maxLength={200}
          onChange={(e) => onChange({ questionId: q.id, text: e.target.value })}
        />
      ) : (
        <PillGroup label={q.text}>
          {q.options.map((o) => (
            <Pill key={o.id} selected={picked.includes(o.id)} onClick={() => toggle(o.id)}>
              {o.text}
            </Pill>
          ))}
        </PillGroup>
      )}
    </div>
  )
}
