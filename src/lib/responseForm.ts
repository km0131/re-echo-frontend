// 回答フォームの値の変換（参加者の回答フォームと、幹事の編集シートで共有する）
import type { Choice } from '../ui/styles'
import type { SurveyAnswer, SurveyQuestion } from './types'

export type CandidateRow = { id: string; label: string }

/** まだ ◯△✕ がついていない候補日のID */
export function missingCandidates(candidates: CandidateRow[], choices: Record<string, Choice>): string[] {
  return candidates.filter((c) => !choices[c.id]).map((c) => c.id)
}

/** 今ある候補日の選択だけを残す（消えた候補日の選択は送らない） */
export function choicesToSend(
  candidates: CandidateRow[],
  choices: Record<string, Choice>,
): Record<string, Choice> {
  const sent: Record<string, Choice> = {}
  for (const c of candidates) sent[c.id] = choices[c.id]
  return sent
}

/** 今ある設問・選択肢への回答だけを送る形にする（アンケートは任意） */
export function surveyToSend(
  questions: SurveyQuestion[],
  answers: Record<string, SurveyAnswer>,
): SurveyAnswer[] {
  return questions.flatMap((q): SurveyAnswer[] => {
    const a = answers[q.id]
    if (!a) return []
    return q.type === 'text'
      ? [{ questionId: q.id, text: a.text ?? '' }]
      : [
          {
            questionId: q.id,
            optionIds: (a.optionIds ?? []).filter((id) => q.options.some((o) => o.id === id)),
          },
        ]
  })
}

/** API の回答（配列）をフォームの状態（設問ID → 回答）にする */
export function surveyToState(answers: SurveyAnswer[] | undefined): Record<string, SurveyAnswer> {
  return Object.fromEntries((answers ?? []).map((a) => [a.questionId, a]))
}
