import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSessionGuard } from '../../lib/admin'
import { api } from '../../lib/api'
import { ANONYMOUS, commentKeys, useAdminComments } from '../../lib/comments'
import { cx } from '../../lib/cx'
import { formatDateTime } from '../../lib/date'
import { photoKeys } from '../../lib/photos'
import { charCount } from '../../lib/text'
import type { AdminPhoto, PhotoComment } from '../../lib/types'
import { Dialog, ErrorNotice, Field, Skeleton, SmallButton, Tag, TextInput } from '../../ui'

const MAX_TITLE = 40 // spec.md 14.2

/** 写真1枚のタイトルとコメント（修正01）。コメントは非表示も含めて全部出し、非表示にする・戻す・削除ができる */
export function PhotoDetailDialog({
  slug,
  photo: p,
  onClose,
}: {
  slug: string
  photo: AdminPhoto | null
  onClose: () => void
}) {
  // 写真ごとに作り直す（閉じると消える）
  return p ? <Detail key={p.id} slug={slug} photo={p} onClose={onClose} /> : null
}

function Detail({ slug, photo: p, onClose }: { slug: string; photo: AdminPhoto; onClose: () => void }) {
  const qc = useQueryClient()
  const guard = useSessionGuard()
  const [title, setTitle] = useState(p.title ?? '')
  const [error, setError] = useState<string | null>(null)
  const comments = useAdminComments(slug, p.id, true)
  const left = MAX_TITLE - charCount(title.trim())

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: commentKeys.admin(slug, p.id) })
    void qc.invalidateQueries({ queryKey: commentKeys.list(slug, p.id) })
    void qc.invalidateQueries({ queryKey: photoKeys.admin(slug) })
    void qc.invalidateQueries({ queryKey: photoKeys.list(slug) })
  }
  const onError = (e: Error) => {
    if (!guard(e)) setError(e.message)
  }
  const saveTitle = useMutation({
    mutationFn: () =>
      api(`/events/${slug}/photos/${p.id}`, {
        method: 'PATCH',
        body: { title: title.trim() || null },
        auth: { session: true, admin: slug },
      }),
    onSuccess: () => {
      refresh()
      onClose()
    },
    onError,
  })
  const setStatus = useMutation({
    mutationFn: (c: PhotoComment) =>
      api(`/events/${slug}/photos/${p.id}/comments/${c.id}`, {
        method: 'PATCH',
        body: { status: c.status === 'hidden' ? 'visible' : 'hidden' },
        auth: { session: true, admin: slug },
      }),
    onSuccess: refresh,
    onError,
  })
  const remove = useMutation({
    mutationFn: (c: PhotoComment) =>
      api(`/events/${slug}/photos/${p.id}/comments/${c.id}`, {
        method: 'DELETE',
        auth: { session: true, admin: slug },
      }),
    onSuccess: refresh,
    onError,
  })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <Dialog
      open
      title="タイトルとコメント"
      confirmLabel="タイトルを保存"
      cancelLabel="閉じる"
      busy={saveTitle.isPending}
      onClose={onClose}
      onConfirm={() => (left < 0 ? setError(`タイトルは${MAX_TITLE}文字までです`) : saveTitle.mutate())}
    >
      <Field
        label="タイトル"
        hint={left < 10 ? (left < 0 ? `${-left}文字多いです` : `あと${left}文字`) : undefined}
      >
        {(id, d) => (
          <TextInput
            id={id}
            aria-describedby={d}
            value={title}
            invalid={left < 0}
            placeholder="タイトル（なくてもOK）"
            autoComplete="off"
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
      </Field>
      {error && <ErrorNotice message={error} />}

      <h3 className="mt-2 text-label font-medium">
        コメント
        {comments.data && <span className="ml-1.5 font-normal text-muted">{comments.data.length}件</span>}
      </h3>
      {comments.isPending && <Skeleton className="h-20" />}
      {comments.data?.length === 0 && <p className="text-note text-muted">まだコメントはありません</p>}
      <ul className="flex flex-col">
        {comments.data?.map((c) => {
          const hidden = c.status === 'hidden'
          return (
            <li key={c.id} className="flex flex-col gap-1.5 border-b border-line-soft py-2.5 last:border-0">
              <p
                className={cx(
                  'whitespace-pre-wrap break-words text-body',
                  hidden && 'text-muted line-through',
                )}
              >
                {c.body}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-tiny text-muted">
                <span>{c.authorName ?? ANONYMOUS}</span>
                <span className="tabular-nums">{formatDateTime(c.createdAt)}</span>
                {hidden && <Tag variant="sepia">非表示</Tag>}
              </p>
              <div className="flex gap-2">
                <SmallButton
                  className="px-3"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate(c)}
                >
                  {hidden ? '戻す' : '非表示にする'}
                </SmallButton>
                {confirmDelete === c.id ? (
                  <SmallButton
                    variant="caution"
                    className="px-3"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(c)}
                  >
                    本当に削除
                  </SmallButton>
                ) : (
                  <SmallButton variant="caution" className="px-3" onClick={() => setConfirmDelete(c.id)}>
                    削除
                  </SmallButton>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}
