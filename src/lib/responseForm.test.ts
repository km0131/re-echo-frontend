import { describe, expect, it } from 'vitest'
import { randomPin } from './adminResponses'
import { choicesToSend, missingCandidates, surveyToSend, surveyToState } from './responseForm'
import type { SurveyQuestion } from './types'

const cands = [
  { id: 'c1', label: '12/29' },
  { id: 'c2', label: '12/30' },
]

describe('回答フォームの値の変換', () => {
  it('未回答の候補日を返す', () => {
    expect(missingCandidates(cands, { c1: 'yes' })).toEqual(['c2'])
    expect(missingCandidates(cands, { c1: 'yes', c2: 'no' })).toEqual([])
  })

  it('消えた候補日の選択は送らない', () => {
    expect(choicesToSend(cands, { c1: 'yes', c2: 'maybe', gone: 'no' })).toEqual({ c1: 'yes', c2: 'maybe' })
  })

  it('今ある設問・選択肢への回答だけを送る', () => {
    const qs = [
      { id: 'q1', text: '予算', type: 'single', options: [{ id: 'o1', text: 'A' }] },
      { id: 'q2', text: 'ひとこと', type: 'text', options: [] },
    ] as unknown as SurveyQuestion[]
    const state = surveyToState([
      { questionId: 'q1', optionIds: ['o1', 'removed'] },
      { questionId: 'q2', text: 'よろしく' },
      { questionId: 'gone', optionIds: ['x'] },
    ])
    expect(surveyToSend(qs, state)).toEqual([
      { questionId: 'q1', optionIds: ['o1'] },
      { questionId: 'q2', text: 'よろしく' },
    ])
  })
})

describe('randomPin', () => {
  it('半角数字4桁で、同じ数字4つや連番にならない', () => {
    for (let i = 0; i < 500; i++) {
      const pin = randomPin()
      expect(pin).toMatch(/^\d{4}$/)
      expect(pin).not.toMatch(/^(\d)\1{3}$/)
      expect(['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '3210']).not.toContain(
        pin,
      )
    }
  })
})
