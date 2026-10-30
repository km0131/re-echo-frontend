import type { KeyboardEvent } from 'react'

/** 文字数（UTF-16 のコード単位ではなくコードポイントで数える。絵文字も1文字） */
export const charCount = (s: string) => [...s].length

/** 合言葉の長さ。サーバーは空白をすべて除いて数えるので、ここでも除いてから数える（spec.md 14.1） */
export const passphraseLength = (s: string) => charCount(s.replace(/\s/g, ''))

/**
 * 日本語入力の変換を確定するための Enter かどうか。
 * このときに送信やフォームの送信をしてはいけない（Safari は isComposing が false で keyCode 229 を出す）。
 */
export const isImeEnter = (e: KeyboardEvent) => e.nativeEvent.isComposing || e.keyCode === 229
