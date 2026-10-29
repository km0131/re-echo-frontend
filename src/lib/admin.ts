// 幹事側の API 呼び出しと、セッション切れのときにログインへ戻す処理
import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { api, ApiError } from './api'
import { storage } from './storage'
import type { AdminEvent, EventListItem, LoginEvent, Me } from './types'

export const adminKeys = {
  me: ['me'] as const,
  events: ['events'] as const,
  loginEvents: ['login-events'] as const,
  event: (slug: string) => ['admin-event', slug] as const,
}

/** 401（セッション切れ）ならトークンを消して /login へ */
export function useSessionGuard() {
  const navigate = useNavigate()
  return useCallback(
    (err: unknown): boolean => {
      if (err instanceof ApiError && err.code === 'unauthorized') {
        storage.setSession(null)
        navigate('/login', { replace: true })
        return true
      }
      return false
    },
    [navigate],
  )
}

export function useMe() {
  return useQuery({
    queryKey: adminKeys.me,
    queryFn: ({ signal }) => api<Me>('/auth/me', { auth: { session: true }, signal }),
    enabled: !!storage.getSession(),
  })
}

export function useMyEvents() {
  return useQuery({
    queryKey: adminKeys.events,
    queryFn: ({ signal }) => api<{ events: EventListItem[] }>('/events', { auth: { session: true }, signal }),
    enabled: !!storage.getSession(),
    select: (d) => d.events,
  })
}

export function useLoginEvents() {
  return useQuery({
    queryKey: adminKeys.loginEvents,
    queryFn: ({ signal }) =>
      api<{ events: LoginEvent[] }>('/me/login-events', { auth: { session: true }, signal }),
    select: (d) => d.events,
  })
}

/** 管理画面の詳細。オーナーのセッションと管理キーの両方を送る（どちらかで通る）。 */
export function useAdminEvent(slug: string) {
  return useQuery({
    queryKey: adminKeys.event(slug),
    queryFn: ({ signal }) =>
      api<AdminEvent>(`/events/${slug}/admin`, { auth: { session: true, admin: slug }, signal }),
  })
}

export const METHOD_LABEL: Record<string, string> = { password: 'パスワード' }
