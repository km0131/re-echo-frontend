// 写真の一覧（参加者・幹事）
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { storage } from './storage'
import type { AdminPhoto, PhotoList } from './types'

export const photoKeys = {
  list: (slug: string) => ['event', slug, 'photos'] as const,
  admin: (slug: string) => ['admin-event', slug, 'photos'] as const,
}

/** 参加者向けの一覧。自分の処理中の写真があるあいだは数秒おきに取り直す。 */
export function usePhotos(slug: string, enabled = true) {
  return useQuery({
    queryKey: photoKeys.list(slug),
    queryFn: ({ signal }) =>
      api<PhotoList>(`/events/${slug}/photos`, {
        auth: { gate: slug, edit: storage.getEdit(slug) ? slug : undefined },
        signal,
      }),
    enabled,
    refetchInterval: (q) =>
      q.state.data?.photos.some((p) => p.mine && p.status === 'processing') ? 3000 : false,
  })
}

/** 管理画面向けの一覧（全状態）。 */
export function useAdminPhotos(slug: string) {
  return useQuery({
    queryKey: photoKeys.admin(slug),
    queryFn: ({ signal }) =>
      api<{ photos: AdminPhoto[] }>(`/events/${slug}/admin/photos`, {
        auth: { session: true, admin: slug },
        signal,
      }),
    select: (d) => d.photos,
    refetchInterval: (q) => (q.state.data?.photos.some((p) => p.status === 'processing') ? 3000 : false),
  })
}

/** ギャラリーの傾き（design.md 3.5：-2／1.5／1／-1.5／-1／2deg を順番に） */
export const GALLERY_TILTS = [
  '-rotate-2',
  'rotate-[1.5deg]',
  'rotate-1',
  '-rotate-[1.5deg]',
  '-rotate-1',
  'rotate-2',
] as const
