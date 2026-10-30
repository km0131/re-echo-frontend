import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, memberMediaUrl } from '../../lib/api'
import { photoKeys } from '../../lib/photos'
import { charCount } from '../../lib/text'
import type { PhotoItem } from '../../lib/types'
import {
  BackIcon,
  DeleteIcon,
  Dialog,
  ErrorNotice,
  Field,
  NextIcon,
  SmallButton,
  TextButton,
  TextInput,
} from '../../ui'
import { PhotoComments } from './PhotoComments'

const MAX_TITLE = 40 // spec.md 14.2

/**
 * 写真の拡大表示（design.md 3.5）。ページ全体を覆うモーダル。
 * 表示用サイズ（large）はここで初めて読み込む。写真の左右スワイプ・矢印キーで前後へ、Esc とブラウザの戻るで閉じる。
 * 修正01：スマホは写真の下、幅768px以上は写真の右にコメント欄（欄の中だけスクロール）。
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
      // コメントやタイトルを入力しているあいだは、矢印キーで写真を動かさない
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
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
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-2">
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

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* 写真（スワイプはここだけ。コメント欄のスクロールで写真が切り替わらないように） */}
        <div
          className="relative flex min-h-0 flex-[1.15] items-center justify-center px-2 pb-3 md:flex-1 md:pb-6"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            touchX.current = null
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
          }}
        >
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
              alt={p.title || p.caption || `${p.uploaderName}さんの写真`}
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

        {/* 写真の情報とコメント。方眼ノートの紙を1枚敷いて、その上に付箋を貼る */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-t-card bg-paper text-ink md:w-[380px] md:flex-none md:rounded-none">
          <div className="mx-auto flex w-full max-w-content flex-col gap-section-sm px-gutter pb-[calc(24px+env(safe-area-inset-bottom))] pt-4">
            <div className="flex flex-col gap-1">
              <PhotoTitle key={p.id} slug={slug} photo={p} />
              {p.caption && <p className="whitespace-pre-wrap break-words text-body text-ink">{p.caption}</p>}
              <p className="text-note text-muted">{p.uploaderName}さんの投稿</p>
              {error && <ErrorNotice message={error} />}
              <div className="flex flex-wrap gap-x-4">
                <TextButton onClick={() => setDialog('hide')}>非表示にしてほしい</TextButton>
                {p.mine && <TextButton onClick={() => setDialog('delete')}>削除</TextButton>}
              </div>
            </div>
            {/* 写真を切り替えたら、入力中の本文も含めてその写真のコメント欄に切り替える */}
            <PhotoComments key={p.id} slug={slug} photoId={p.id} />
          </div>
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

/** タイトル（拡大表示では全文）。自分が投稿した写真なら、その場で「なおす」 */
function PhotoTitle({ slug, photo: p }: { slug: string; photo: PhotoItem }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(p.title ?? '')
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      api<PhotoItem>(`/events/${slug}/photos/${p.id}`, {
        method: 'PATCH',
        body: { title: value.trim() || null },
        auth: { edit: slug },
      }),
    onSuccess: () => {
      setEditing(false)
      setError(null)
      void qc.invalidateQueries({ queryKey: photoKeys.list(slug) })
    },
    onError: (e) => setError(e.message),
  })
  const left = MAX_TITLE - charCount(value.trim())

  if (editing) {
    const submit = (e: FormEvent) => {
      e.preventDefault()
      if (left < 0) return setError(`タイトルは${MAX_TITLE}文字までです`)
      save.mutate()
    }
    return (
      <form onSubmit={submit} noValidate className="flex flex-col gap-2">
        <TextInput
          aria-label="タイトル"
          placeholder="タイトル（なくてもOK）"
          value={value}
          invalid={left < 0}
          autoComplete="off"
          autoFocus
          onChange={(e) => setValue(e.target.value)}
        />
        {left < 10 && (
          <p className={left < 0 ? 'text-tiny text-maybe-ink' : 'text-tiny text-muted'}>
            {left < 0 ? `${-left}文字多いです` : `あと${left}文字`}
          </p>
        )}
        {error && (
          <p className="text-note text-maybe-ink" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <SmallButton type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? '保存しています…' : '保存'}
          </SmallButton>
          <SmallButton
            onClick={() => {
              setEditing(false)
              setValue(p.title ?? '')
              setError(null)
            }}
          >
            やめる
          </SmallButton>
        </div>
      </form>
    )
  }

  if (!p.title && !p.mine) return null
  return (
    <div className="flex items-start justify-between gap-2">
      <h2 className={p.title ? 'break-words font-hand text-h2 text-navy' : 'pt-2.5 text-note text-muted'}>
        {p.title ?? 'タイトルはまだありません'}
      </h2>
      {p.mine && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="タイトルをなおす"
          className="inline-flex h-tap shrink-0 items-center px-2 text-tiny text-muted underline underline-offset-4 hover:text-navy"
        >
          なおす
        </button>
      )}
    </div>
  )
}
