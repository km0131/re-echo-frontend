// 合言葉の答えの入力（修正01：spec.md 14.1）
import { passphraseLength } from './text'

export const MAX_ANSWERS = 5
export const MAX_ANSWER_LEN = 50
export const MAX_QUESTION_LEN = 100

/** 答え1つ。行を消しても入力中の欄がずれないよう、行ごとに変わらないキーを持つ */
export type AnswerRow = { key: number; value: string }

let nextKey = 0
export const newAnswer = (value = ''): AnswerRow => ({ key: nextKey++, value })

/** 合言葉の答えを確かめる。問題なければ null、あれば画面に出す文。サーバーと同じ決まり（spec.md 14.1） */
export function checkAnswers(answers: AnswerRow[]): string | null {
  const filled = answers.filter((a) => a.value.trim() !== '')
  if (filled.length === 0) return '合言葉の答えを入れてください'
  if (filled.some((a) => passphraseLength(a.value) > MAX_ANSWER_LEN))
    return `答えは${MAX_ANSWER_LEN}文字までです`
  return null
}

/** 送る答え（空欄は除き、前後の空白だけ取る。正規化はサーバーでやる） */
export const answersToSend = (answers: AnswerRow[]) =>
  answers.map((a) => a.value.trim()).filter((a) => a !== '')
