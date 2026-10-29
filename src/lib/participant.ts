// 参加者側の API 呼び出しと、合言葉切れのときにゲートへ戻す処理
import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { api, ApiError } from './api'
import { storage } from './storage'
import type { EventDetail, PublicEvent, ResponseItem } from './types'

export const participantKeys = {
  public: (slug: string) => ['public-event', slug] as const,
  detail: (slug: string) => ['event', slug] as const,
  myResponse: (slug: string, id: string) => ['event', slug, 'response', id] as const,
}

export function usePublicEvent(slug: string) {
  return useQuery({
    queryKey: participantKeys.public(slug),
    queryFn: ({ signal }) => api<PublicEvent>(`/public/events/${slug}`, { signal }),
  })
}

export function useEventDetail(slug: string, enabled = true) {
  return useQuery({
    queryKey: participantKeys.detail(slug),
    queryFn: ({ signal }) => api<EventDetail>(`/events/${slug}`, { auth: { gate: slug }, signal }),
    enabled,
  })
}

/** 自分の回答（この端末に編集トークンがあるときだけ） */
export function useMyResponse(slug: string) {
  const edit = storage.getEdit(slug)
  return useQuery({
    queryKey: participantKeys.myResponse(slug, edit?.responseId ?? ''),
    queryFn: async ({ signal }) => {
      try {
        return await api<ResponseItem>(`/events/${slug}/responses/${edit!.responseId}`, {
          auth: { gate: slug, edit: slug },
          signal,
        })
      } catch (e) {
        // 回答が消された・トークンが古い → この端末の記録を消して新規回答にする
        if (e instanceof ApiError && (e.code === 'response_not_found' || e.code === 'edit_forbidden')) {
          storage.setEdit(slug, null)
          return null
        }
        throw e
      }
    },
    enabled: !!edit,
  })
}

/** gate_required を受けたら通過トークンを消してゲートに戻す */
export function useGateGuard(slug: string) {
  const navigate = useNavigate()
  return useCallback(
    (err: unknown): boolean => {
      if (err instanceof ApiError && err.code === 'gate_required') {
        storage.setGate(slug, null)
        navigate(`/e/${slug}`, { replace: true })
        return true
      }
      return false
    },
    [navigate, slug],
  )
}
