import { describe, expect, it } from 'vitest'
import {
  daysUntil,
  formatCandidate,
  formatDateTime,
  fromTokyoInputs,
  monthsSince,
  toTokyoInputs,
  tokyoToday,
} from './date'

// npm test は TZ=UTC で動かす（ブラウザのタイムゾーンに頼っていないことの確認）
describe('タイムゾーン', () => {
  it('テストは日本以外のタイムゾーンで動いている', () => {
    expect(new Date('2026-12-29T15:00:00Z').getTimezoneOffset()).not.toBe(-540)
  })
})

describe('formatCandidate', () => {
  it.each([
    ['2026-12-29T10:00:00Z', '12/29（火）19:00〜'],
    ['2026-12-29T15:00:00Z', '12/30（水）00:00〜'], // UTC では29日、日本では30日
    ['2026-12-31T14:59:00Z', '12/31（木）23:59〜'],
    ['2027-01-03T09:00:00Z', '1/3（日）18:00〜'],
  ])('%s → %s', (iso, want) => {
    expect(formatCandidate(iso)).toBe(want)
  })
})

describe('formatDateTime', () => {
  it('日本時間で「10/26 22:14」', () => {
    expect(formatDateTime('2026-10-26T13:14:00Z')).toBe('10/26 22:14')
  })
})

describe('daysUntil', () => {
  const event = '2027-01-03T09:00:00Z' // 1/3 18:00 JST
  it.each([
    ['2026-10-28T03:00:00Z', 67], // 10/28 12:00 JST
    ['2027-01-02T14:59:00Z', 1], // 1/2 23:59 JST
    ['2027-01-02T15:00:00Z', 0], // 1/3 0:00 JST（当日）
    ['2027-01-03T12:00:00Z', 0], // 当日の開催後
  ])('now=%s → あと%i日', (now, want) => {
    expect(daysUntil(event, new Date(now))).toBe(want)
  })
})

describe('monthsSince', () => {
  it.each([
    ['2026-12-31', '2026-12-31T03:00:00Z', 0],
    ['2026-12-31', '2027-01-30T03:00:00Z', 0],
    ['2026-01-31', '2026-10-31T03:00:00Z', 9],
    ['2026-01-15', '2026-10-14T03:00:00Z', 8],
  ])('%s 終了、now=%s → %iか月', (endsOn, now, want) => {
    expect(monthsSince(endsOn, new Date(now))).toBe(want)
  })
})

describe('入力欄との変換', () => {
  it('日本時間の入力を UTC にする', () => {
    expect(fromTokyoInputs('2026-12-29', '19:00')).toBe('2026-12-29T10:00:00Z')
    expect(fromTokyoInputs('2027-01-01', '00:30')).toBe('2026-12-31T15:30:00Z')
    expect(fromTokyoInputs('2026/12/29', '19:00')).toBeNull()
  })
  it('UTC を日本時間の入力にする', () => {
    expect(toTokyoInputs('2026-12-31T15:30:00Z')).toEqual({ date: '2027-01-01', time: '00:30' })
  })
  it('今日の日付は日本時間', () => {
    expect(tokyoToday(new Date('2026-12-31T15:30:00Z'))).toBe('2027-01-01')
  })
})
