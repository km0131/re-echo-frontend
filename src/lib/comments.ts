// 写真のコメント（修正01：spec.md 14.3・14.4）
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { PhotoComment } from './types'

export const commentKeys = {
  list: (slug: string, photoId: string) => ['photo-comments', slug, photoId] as const,
  all: (slug: string) => ['photo-comments', slug] as const,
  admin: (slug: string, photoId: string) => ['admin-photo-comments', slug, photoId] as const,
}

/** 参加者向けの一覧（古い順）。自分のトークンを送って mine を付けてもらう */
export function useComments(slug: string, photoId: string) {
  return useQuery({
    queryKey: commentKeys.list(slug, photoId),
    queryFn: ({ signal }) =>
      api<{ comments: PhotoComment[] }>(`/events/${slug}/photos/${photoId}/comments`, {
        auth: { gate: slug, commentTokens: slug },
        signal,
      }),
    select: (d) => d.comments,
  })
}

/** 幹事向けの一覧（非表示も含む） */
export function useAdminComments(slug: string, photoId: string, enabled: boolean) {
  return useQuery({
    queryKey: commentKeys.admin(slug, photoId),
    queryFn: ({ signal }) =>
      api<{ comments: PhotoComment[] }>(`/events/${slug}/photos/${photoId}/comments`, {
        auth: { session: true, admin: slug },
        signal,
      }),
    select: (d) => d.comments,
    enabled,
  })
}

/** 名前が無いコメントの表示名 */
export const ANONYMOUS = 'だれか'

/** 付箋の色。コメントIDから決めるので、描き直しても変わらない */
const NOTE_COLORS = ['bg-card', 'bg-highlight', 'bg-line-soft'] as const
const NOTE_TILTS = ['rotate-[-1.5deg]', 'rotate-[1deg]', 'rotate-[-.5deg]', 'rotate-[1.5deg]'] as const

function hash(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}
export const noteColor = (id: string) => NOTE_COLORS[hash(id) % NOTE_COLORS.length]
export const noteTilt = (id: string) => NOTE_TILTS[(hash(id) >> 3) % NOTE_TILTS.length]
