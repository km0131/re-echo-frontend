import { describe, expect, it } from 'vitest'
import { charCount, passphraseLength } from './text'
import { answersToSend, checkAnswers, newAnswer } from './passphrase'

describe('charCount', () => {
  it('絵文字もサロゲートペアも1文字に数える', () => {
    expect(charCount('🌸さくら')).toBe(4)
    expect('🌸さくら'.length).toBe(5)
  })
})

describe('passphraseLength', () => {
  it('空白（全角も）を除いて数える', () => {
    expect(passphraseLength('田中　先生 ')).toBe(4)
  })
})

describe('checkAnswers', () => {
  it('空欄だけならエラー、50文字を超えたらエラー', () => {
    expect(checkAnswers([newAnswer(' ')])).toBe('合言葉の答えを入れてください')
    expect(checkAnswers([newAnswer('あ'.repeat(51))])).toBe('答えは50文字までです')
    expect(checkAnswers([newAnswer('あ'.repeat(50)), newAnswer('')])).toBeNull()
  })
  it('送るときは空欄を除き、前後の空白だけ取る', () => {
    expect(answersToSend([newAnswer(' 田中 先生 '), newAnswer(''), newAnswer('たなか')])).toEqual([
      '田中 先生',
      'たなか',
    ])
  })
})
