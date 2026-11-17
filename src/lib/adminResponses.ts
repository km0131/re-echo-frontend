// 幹事による回答の一覧・編集・代理追加・削除・PIN の再設定（修正03。spec.md 16章）
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from './api'
import { adminKeys } from './admin'
import { participantKeys } from './participant'
import type { AdminResponseInput, AdminResponseItem } from './types'

export const adminResponseKeys = {
  list: (slug: string) => ['admin-responses', slug] as const,
}

const auth = (slug: string) => ({ session: true, admin: slug })

export function useAdminResponses(slug: string) {
  return useQuery({
    queryKey: adminResponseKeys.list(slug),
    queryFn: ({ signal }) =>
      api<{ responses: AdminResponseItem[] }>(`/events/${slug}/admin/responses`, {
        auth: auth(slug),
        signal,
      }),
    select: (d) => d.responses,
  })
}

/** 回答が変わったら、回答一覧・管理用の集計・参加者画面の集計を読み直す */
export function useRefreshAfterResponseChange(slug: string) {
  const qc = useQueryClient()
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: adminResponseKeys.list(slug) })
    void qc.invalidateQueries({ queryKey: adminKeys.event(slug) })
    void qc.invalidateQueries({ queryKey: participantKeys.detail(slug) })
  }, [qc, slug])
}

export const adminResponsesApi = {
  create: (slug: string, input: AdminResponseInput & { pin?: string }) =>
    api<AdminResponseItem>(`/events/${slug}/admin/responses`, {
      method: 'POST',
      body: input,
      auth: auth(slug),
    }),
  update: (slug: string, id: string, input: AdminResponseInput) =>
    api<AdminResponseItem>(`/events/${slug}/admin/responses/${id}`, {
      method: 'PUT',
      body: input,
      auth: auth(slug),
    }),
  remove: (slug: string, id: string) =>
    api<void>(`/events/${slug}/admin/responses/${id}`, { method: 'DELETE', auth: auth(slug) }),
  /** pin が null なら PIN を消す */
  setPin: (slug: string, id: string, pin: string | null, revokeEditTokens: boolean) =>
    api<void>(`/events/${slug}/admin/responses/${id}/pin`, {
      method: 'PUT',
      body: { pin, revokeEditTokens },
      auth: auth(slug),
    }),
}

/** 推測されにくい4桁の PIN（同じ数字4つ・連番は避ける） */
export function randomPin(): string {
  for (;;) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const pin = String(buf[0] % 10000).padStart(4, '0')
    if (!/^(\d)\1{3}$/.test(pin) && !'0123456789'.includes(pin) && !'9876543210'.includes(pin)) return pin
  }
}
