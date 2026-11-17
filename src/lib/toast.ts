// 通信エラーを画面の下に一時的に出す（修正03。docs/design.md 5章の例外：通信エラーだけトーストで出す）
import { createContext, useContext } from 'react'
import { ApiError } from './api'

export type ToastApi = { show: (message: string) => void }

export const ToastContext = createContext<ToastApi>({ show: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

/** 通信できなかった（サーバーに届かない・サーバーの不具合）エラーか。入力のまちがいなどは含めない。 */
export function isNetworkError(e: unknown): boolean {
  return e instanceof ApiError && (e.code === 'network' || e.code === 'internal' || e.status >= 500)
}
