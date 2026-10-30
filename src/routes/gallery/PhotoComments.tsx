import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { ANONYMOUS, commentKeys, noteColor, noteTilt, useComments } from '../../lib/comments'
import { cx } from '../../lib/cx'
import { formatDateTime } from '../../lib/date'
import { useMyResponse } from '../../lib/participant'
import { photoKeys } from '../../lib/photos'
import { storage } from '../../lib/storage'
import { charCount, isImeEnter } from '../../lib/text'
import type { CreateCommentResult, PhotoComment } from '../../lib/types'
import { useTurnstileToken } from '../../lib/useTurnstileToken'
import { Dialog, ErrorNotice, SmallButton, TextArea, TextInput } from '../../ui'

const MAX_BODY = 200
const MAX_NAME = 20

/**
 * 写真のコメント（修正01：spec.md 14.3）。コメントは「写真の横に貼られた付箋」。
 * 写真を切り替えると photoId が変わり、その写真のコメントに切り替わる。
 */
export function PhotoComments({ slug, photoId }: { slug: string; photoId: string }) {
  const comments = useComments(slug, photoId)
  const qc = useQueryClient()
  const [target, setTarget] = useState<PhotoComment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: commentKeys.list(slug, photoId) })
    void qc.invalidateQueries({ queryKey: photoKeys.list(slug) })
  }
  const peel = useMutation({
    mutationFn: (c: PhotoComment) =>
      api(`/events/${slug}/photos/${photoId}/comments/${c.id}`, {
        method: 'DELETE',
        auth: { commentToken: storage.getCommentTokens(slug)[c.id] },
      }),
    onSuccess: (_, c) => {
      storage.removeCommentToken(slug, c.id)
      setTarget(null)
      setError(null)
      refresh()
    },
    onError: (e) => {
      setTarget(null)
      setError(e.message)
    },
  })

  return (
    <section aria-label="コメント" className="flex flex-col gap-4">
      <h3 className="font-hand text-h2-admin text-navy">
        コメント
        {comments.data && comments.data.length > 0 && (
          <span className="ml-2 font-sans text-note text-muted">{comments.data.length}件</span>
        )}
      </h3>
      {comments.error && (
        <ErrorNotice message={comments.error.message} onRetry={() => void comments.refetch()} />
      )}
      {error && <ErrorNotice message={error} />}
      {comments.data?.length === 0 && <p className="text-note text-muted">まだコメントはありません</p>}
      {comments.data && comments.data.length > 0 && (
        <ul className="flex flex-col gap-3 px-1">
          {comments.data.map((c) => (
            <li key={c.id}>
              <Note comment={c} onPeel={() => setTarget(c)} />
            </li>
          ))}
        </ul>
      )}

      <CommentForm slug={slug} photoId={photoId} onPosted={refresh} />

      <Dialog
        open={!!target}
        title="このコメントをはがしますか？"
        confirmLabel="はがす"
        caution
        busy={peel.isPending}
        onClose={() => setTarget(null)}
        onConfirm={() => target && peel.mutate(target)}
      >
        <p>元には戻せません。</p>
      </Dialog>
    </section>
  )
}

/** 付箋1枚。色と傾きはコメントIDで決まるので、描き直しても変わらない */
function Note({ comment: c, onPeel }: { comment: PhotoComment; onPeel: () => void }) {
  return (
    <figure
      className={cx(
        'rounded-tag px-3.5 pb-1.5 pt-3 shadow-note motion-safe:animate-note-in',
        noteColor(c.id),
        noteTilt(c.id),
      )}
    >
      {/* 本文はかならずテキストとして描画する（改行はそのまま） */}
      <blockquote className="whitespace-pre-wrap break-words font-hand text-input leading-relaxed text-ink">
        {c.body}
      </blockquote>
      <figcaption className="mt-1 flex min-h-tap items-center justify-between gap-2 text-tiny text-muted">
        <span className="min-w-0 truncate">
          ― {c.authorName ?? ANONYMOUS}
          <span className="ml-2 tabular-nums">{formatDateTime(c.createdAt)}</span>
        </span>
        {c.mine && (
          <button
            type="button"
            onClick={onPeel}
            className="-mr-2 inline-flex h-tap shrink-0 items-center px-2 text-tiny text-muted underline underline-offset-4 hover:text-navy"
          >
            はがす
          </button>
        )}
      </figcaption>
    </figure>
  )
}

function CommentForm({ slug, photoId, onPosted }: { slug: string; photoId: string; onPosted: () => void }) {
  // 回答済みの端末なら、名前の初期値は自分の回答名（消して空にもできる）
  const mine = useMyResponse(slug)
  const [name, setName] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameValue = name ?? mine.data?.name ?? ''
  const ts = useTurnstileToken('comment')

  const post = useMutation({
    mutationFn: () =>
      api<CreateCommentResult>(`/events/${slug}/photos/${photoId}/comments`, {
        method: 'POST',
        body: { authorName: nameValue.trim() || null, body },
        auth: { gate: slug, edit: storage.getEdit(slug) ? slug : undefined, turnstile: ts.token },
      }),
    onSettled: ts.reset,
    onSuccess: (res) => {
      storage.addCommentToken(slug, res.comment.id, res.deleteToken)
      setBody('') // 名前は残す
      setError(null)
      onPosted()
    },
    onError: (e) => setError(e.message),
  })

  const bodyLeft = MAX_BODY - charCount(body.trim())
  const nameOver = charCount(nameValue.trim()) > MAX_NAME
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (post.isPending || !ts.ready) return
    if (!body.trim()) return setError('コメントを入れてください')
    if (bodyLeft < 0) return setError(`コメントは${MAX_BODY}文字までです`)
    if (nameOver) return setError(`名前は${MAX_NAME}文字までです`)
    setError(null)
    post.mutate()
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-2 border-t border-dashed border-dash pt-4"
    >
      <TextInput
        aria-label="名前（なくてもOK）"
        placeholder="名前（なくてもOK）"
        value={nameValue}
        invalid={nameOver}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
      />
      <TextArea
        hand
        rows={3}
        aria-label="コメントを書く"
        placeholder="この写真のこと、ひとこと"
        value={body}
        invalid={bodyLeft < 0}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // Enter は改行。Ctrl／⌘＋Enter で送る（日本語の変換を確定する Enter では送らない）
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isImeEnter(e)) {
            e.preventDefault()
            submit()
          }
        }}
      />
      {error && (
        <p className="text-note text-maybe-ink" role="alert">
          {error}
        </p>
      )}
      {ts.element}
      <div className="flex items-center justify-between gap-3">
        <span
          className={cx('text-tiny tabular-nums', bodyLeft < 0 ? 'text-maybe-ink' : 'text-muted')}
          aria-live="polite"
        >
          {bodyLeft < 20 ? (bodyLeft < 0 ? `${-bodyLeft}文字多いです` : `あと${bodyLeft}文字`) : ''}
        </span>
        <SmallButton type="submit" variant="primary" disabled={post.isPending || !ts.ready} className="px-6">
          {post.isPending ? '貼っています…' : ts.ready ? '貼る' : '確認中…'}
        </SmallButton>
      </div>
    </form>
  )
}
