import type { SurveyQuestionInput } from './types'

/** ワンタップで足せるアンケートのテンプレート */
export const SURVEY_TEMPLATES: { key: string; label: string; question: SurveyQuestionInput }[] = [
  {
    key: 'budget',
    label: '予算',
    question: {
      text: '予算はどれくらい？',
      type: 'single',
      options: [{ text: '〜3,000円' }, { text: '〜5,000円' }, { text: '〜8,000円' }, { text: 'おまかせ' }],
    },
  },
  {
    key: 'afterparty',
    label: '二次会',
    question: {
      text: '二次会は？',
      type: 'single',
      options: [{ text: '行きたい' }, { text: 'その場で決める' }, { text: '一次会だけ' }],
    },
  },
]
