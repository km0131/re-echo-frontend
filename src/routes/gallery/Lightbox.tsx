import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api, memberMediaUrl } from '../../lib/api'
import { photoKeys } from '../../lib/photos'
import type { PhotoItem } from '../../lib/types'
import { BackIcon, DeleteIcon, Dialog, ErrorNotice, Field, NextIcon, TextButton, TextInput } from '../../ui'

/**
 * 写真の拡大表示（design.md 3.5）。ページ全体を覆うモーダル。
 * 表示用サイズ（large）はここで初めて読み込む。左右スワイプ・矢印キーで前後へ、Esc とブラウザの戻るで閉じる。
 */
export function Lightbox({
  slug,
  photos,
  index,
  onIndex,
  onClose,
}: {
  slug: string
  photos: PhotoItem[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const p = photos[index]
  const [dialog, setDialog] = useState<'hide' | 'delete' | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const touchX = useRef<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const go = (d: number) => {
    const n = index + d
    if (n >= 0 && n < photos.length) onIndex(n)
  }

  useEffect(() => {
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const done = () => {
    setDialog(null)
    setReason('')
    void qc.invalidateQueries({ queryKey: photoKeys.list(slug) })
    onClose()
  }
  const hide = useMutation({
    mutationFn: () =>
      api(`/events/${slug}/photos/${p.id}/hide-request`, {
        method: 'POST',
        body: { reason },
        auth: { gate: slug },
      }),
    onSuccess: done,
    onError: (e) => {
      setDialog(null)
      setError(e.message)
    },
  })
  const remove = useMutation({
    mutationFn: () =>
      api(`/events/${slug}/photos/${p.id}`, { method: 'DELETE', auth: { gate: slug, edit: slug } }),
    onSuccess: done,
    onError: (e) => {
      setDialog(null)
      setError(e.message)
    },
  })

  if (!p) return null
  const src = p.largeUrl ? memberMediaUrl(p.largeUrl, slug) : null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="写真の拡大"
      className="fixed inset-0 z-50 flex flex-col bg-scrim text-on-scrim backdrop-blur-md"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
      }}
    >
      <div className="flex h-14 items-center justify-between px-2">
        <span className="px-2 text-note text-on-scrim-muted">
          {index + 1} / {photos.length}
        </span>
        <button
          ref={closeRef}
          type="button"
          aria-label="閉じる"
          onClick={onClose}
          className="inline-flex h-tap w-tap items-center justify-center rounded-field text-on-scrim hover:bg-scrim"
        >
          <DeleteIcon />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {p.thumbUrl && (
          // 大きい画像が来るまではサムネイルを引き伸ばして出しておく
          <img
            src={memberMediaUrl(p.thumbUrl, slug)}
            alt=""
            aria-hidden="true"
            className={`absolute max-h-full max-w-full object-contain blur-sm ${loaded === p.id ? 'hidden' : ''}`}
          />
        )}
        {src && (
          <img
            key={p.id}
            src={src}
            alt={p.caption || `${p.uploaderName}さんの写真`}
            onLoad={() => setLoaded(p.id)}
            className="relative max-h-full max-w-full object-contain"
          />
        )}
        {index > 0 && (
          <button
            type="button"
            aria-label="前の写真"
            onClick={() => go(-1)}
            className="absolute left-1 top-1/2 hidden h-tap w-tap -translate-y-1/2 items-center justify-center rounded-full bg-scrim sm:inline-flex"
          >
            <BackIcon />
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            type="button"
            aria-label="次の写真"
            onClick={() => go(1)}
            className="absolute right-1 top-1/2 hidden h-tap w-tap -translate-y-1/2 items-center justify-center rounded-full bg-scrim sm:inline-flex"
          >
            <NextIcon />
          </button>
        )}
      </div>

      <div className="mx-auto w-full px-gutter pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 sm:max-w-content">
        {p.caption && <p className="break-words font-hand text-lead">{p.caption}</p>}
        <p className="text-note text-on-scrim-muted">{p.uploaderName}さんの投稿</p>
        {error && <ErrorNotice message={error} />}
        <div className="mt-1 flex flex-wrap gap-x-4">
          <TextButton className="text-on-scrim-muted hover:text-on-scrim" onClick={() => setDialog('hide')}>
            非表示にしてほしい
          </TextButton>
          {p.mine && (
            <TextButton
              className="text-on-scrim-muted hover:text-on-scrim"
              onClick={() => setDialog('delete')}
            >
              削除
            </TextButton>
          )}
        </div>
      </div>

      <Dialog
        open={dialog === 'hide'}
        title="この写真を非表示にしますか？"
        confirmLabel="非表示にしてほしい"
        busy={hide.isPending}
        onClose={() => setDialog(null)}
        onConfirm={() => hide.mutate()}
      >
        <p>すぐにみんなから見えなくなり、幹事が確認します。</p>
        <Field label="理由（任意）">
          {(id) => (
            <TextInput
              id={id}
              value={reason}
              maxLength={200}
              placeholder="例）自分が写っているので"
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
      </Dialog>
      <Dialog
        open={dialog === 'delete'}
        title="この写真を削除しますか？"
        confirmLabel="削除する"
        caution
        busy={remove.isPending}
        onClose={() => setDialog(null)}
        onConfirm={() => remove.mutate()}
      >
        <p>元には戻せません。</p>
      </Dialog>
    </div>
  )
}
