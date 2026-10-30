import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useSessionGuard } from '../../lib/admin'
import { api, fetchBlobUrl, upload } from '../../lib/api'
import { cx } from '../../lib/cx'
import { formatDateTime } from '../../lib/date'
import { GALLERY_TILTS, photoKeys, useAdminPhotos } from '../../lib/photos'
import type { AdminEvent, AdminPhoto, Visibility } from '../../lib/types'
import {
  Card,
  CardTitle,
  ChipRow,
  Dialog,
  DragIcon,
  EmptyState,
  ErrorNotice,
  FilterChip,
  Notice,
  PhotoBox,
  Pill,
  PillGroup,
  Polaroid,
  Skeleton,
  SmallButton,
  UploadIcon,
} from '../../ui'
import { PhotoDetailDialog } from './PhotoDetailDialog'

type Filter = 'pending' | 'approved' | 'hidden' | 'draft'

const FILTERS: [Filter, string][] = [
  ['pending', '承認待ち'],
  ['approved', '公開中'],
  ['hidden', '非表示依頼'],
  ['draft', '下書き'],
]

const VIS_LABEL: Record<Visibility, string> = { public: '誰でも', members: 'クラス', draft: '下書き' }

function matches(p: AdminPhoto, f: Filter) {
  switch (f) {
    case 'pending':
      return p.status === 'pending' || p.status === 'processing' || p.status === 'failed'
    case 'approved':
      return p.status === 'approved' && p.visibility !== 'draft'
    case 'hidden':
      return p.status === 'hidden'
    case 'draft':
      return p.visibility === 'draft' && p.status !== 'hidden'
  }
}

/** 写真管理（design.md 4章「写真管理」）。 */
export function PhotosTab({ event: d }: { event: AdminEvent }) {
  const qc = useQueryClient()
  const guard = useSessionGuard()
  const photos = useAdminPhotos(d.slug)
  const [filter, setFilter] = useState<Filter>('pending')
  const [error, setError] = useState<string | null>(null)
  const [publicTarget, setPublicTarget] = useState<AdminPhoto | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [order, setOrder] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  useEffect(() => {
    if (photos.error) guard(photos.error)
  }, [photos.error, guard])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: photoKeys.admin(d.slug) })
    void qc.invalidateQueries({ queryKey: photoKeys.list(d.slug) })
  }
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/events/${d.slug}/photos/${id}`, {
        method: 'PATCH',
        body,
        auth: { session: true, admin: d.slug },
      }),
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: (e) => {
      if (!guard(e)) setError(e.message)
    },
  })

  const all = photos.data ?? []
  let list = all.filter((p) => matches(p, filter))
  if (filter === 'approved' && order) {
    const byId = new Map(list.map((p) => [p.id, p]))
    list = order.map((id) => byId.get(id)).filter((p): p is AdminPhoto => !!p)
  }

  // --- ドラッグで並べ替え（公開中のとき） ---
  const onDragStart = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setOrder(list.map((p) => p.id))
    setDragId(id)
  }
  const onDragMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!dragId || !order) return
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-photo-id]')
    const over = el?.dataset.photoId
    if (!over || over === dragId) return
    const next = order.filter((id) => id !== dragId)
    next.splice(next.indexOf(over) + (order.indexOf(over) > order.indexOf(dragId) ? 1 : 0), 0, dragId)
    setOrder(next)
  }
  const onDragEnd = async () => {
    if (!dragId || !order) return
    setDragId(null)
    const before = all.filter((p) => matches(p, 'approved'))
    const changed = order
      .map((id, i) => ({ id, sortOrder: i + 1 }))
      .filter(({ id, sortOrder }) => before.find((p) => p.id === id)?.sortOrder !== sortOrder)
    try {
      for (const c of changed) {
        await api(`/events/${d.slug}/photos/${c.id}`, {
          method: 'PATCH',
          body: { sortOrder: c.sortOrder },
          auth: { session: true, admin: d.slug },
        })
      }
    } catch (e) {
      if (!guard(e)) setError(e instanceof Error ? e.message : '並べ替えられませんでした')
    }
    await qc.invalidateQueries({ queryKey: photoKeys.admin(d.slug) })
    void qc.invalidateQueries({ queryKey: photoKeys.list(d.slug) })
    setOrder(null)
  }

  const setVisibility = (p: AdminPhoto, v: Visibility) => {
    if (v === p.visibility) return
    if (v === 'public') {
      setPublicTarget(p)
      return
    }
    patch.mutate({ id: p.id, body: { visibility: v } })
  }

  return (
    <>
      <AdminUpload slug={d.slug} onDone={refresh} />
      <Card>
        <CardTitle aside={<span className="text-note text-muted">{all.length}枚</span>}>写真</CardTitle>
        <ChipRow>
          {FILTERS.map(([k, label]) => {
            const n = all.filter((p) => matches(p, k)).length
            return (
              <FilterChip key={k} selected={filter === k} onClick={() => setFilter(k)}>
                {label}
                {n > 0 && <span className="ml-1 tabular-nums">{n}</span>}
              </FilterChip>
            )
          })}
        </ChipRow>
        {filter === 'approved' && list.length > 1 && (
          <p className="text-note text-muted">
            左上のつまみをドラッグすると、ギャラリーの並び順を変えられます
          </p>
        )}
        {error && <ErrorNotice message={error} />}
        {photos.isPending && <Skeleton className="h-48" />}
        {!photos.isPending && list.length === 0 && <EmptyState title="ここに出る写真はありません" />}
      </Card>

      {/* ポラロイドの白枠が見えるよう、カードの外（方眼の上）に並べる */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 pt-1">
        {list.map((p, i) => (
          <li
            key={p.id}
            data-photo-id={p.id}
            className={cx('flex flex-col gap-2', dragId === p.id && 'opacity-60')}
          >
            <div className="relative">
              <Polaroid
                tilt={GALLERY_TILTS[i % GALLERY_TILTS.length]}
                caption={p.title || ' '}
                captionClass="text-[13px]"
              >
                <AdminImage slug={d.slug} photo={p} index={i} />
              </Polaroid>
              {filter === 'approved' && (
                <button
                  type="button"
                  aria-label="ドラッグして並べ替える"
                  onPointerDown={(e) => onDragStart(e, p.id)}
                  onPointerMove={onDragMove}
                  onPointerUp={() => void onDragEnd()}
                  onPointerCancel={() => void onDragEnd()}
                  className="absolute -left-2 -top-2 inline-flex h-tap w-tap cursor-grab touch-none items-center justify-center rounded-full border border-line bg-card text-off"
                >
                  <DragIcon size={18} />
                </button>
              )}
            </div>
            <p className="text-tiny text-muted">
              {p.uploaderName} ・ {formatDateTime(p.createdAt)}
            </p>
            {p.status !== 'processing' && p.status !== 'failed' && (
              <SmallButton className="px-2 text-tiny" onClick={() => setDetailId(p.id)}>
                タイトル・コメント{p.commentCount > 0 ? `（${p.commentCount}）` : ''}
              </SmallButton>
            )}

            {p.status === 'processing' && <p className="text-note text-muted">変換中…</p>}
            {p.status === 'failed' && <p className="text-note text-maybe-ink">変換できませんでした</p>}

            {p.status === 'pending' && (
              <div className="flex gap-1.5">
                <SmallButton
                  variant="primary"
                  className="flex-1 px-2"
                  onClick={() => patch.mutate({ id: p.id, body: { status: 'approved' } })}
                >
                  承認
                </SmallButton>
                <SmallButton
                  variant="caution"
                  className="flex-1 px-2"
                  onClick={() => patch.mutate({ id: p.id, body: { status: 'rejected' } })}
                >
                  却下
                </SmallButton>
              </div>
            )}

            {p.status === 'hidden' && (
              <div className="flex flex-col gap-1.5">
                {p.hideRequests
                  .filter((h) => !h.resolvedAt)
                  .map((h, j) => (
                    <p key={j} className="rounded-tag bg-highlight px-2 py-1 text-tiny text-sepia-ink">
                      非表示依頼：{h.reason || '（理由なし）'}
                    </p>
                  ))}
                <SmallButton
                  className="px-2"
                  onClick={() => patch.mutate({ id: p.id, body: { status: 'hidden' } })}
                >
                  非表示のままにする
                </SmallButton>
                <SmallButton
                  className="px-2"
                  onClick={() => patch.mutate({ id: p.id, body: { status: 'approved' } })}
                >
                  元に戻す
                </SmallButton>
              </div>
            )}

            {(p.status === 'approved' || p.status === 'pending') && (
              <div role="radiogroup" aria-label="公開範囲" className="flex rounded-field bg-highlight p-0.5">
                {(['public', 'members', 'draft'] as Visibility[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={p.visibility === v}
                    disabled={v === 'public' && p.byParticipant}
                    title={
                      v === 'public' && p.byParticipant ? '参加者の写真は「誰でも」にできません' : undefined
                    }
                    onClick={() => setVisibility(p, v)}
                    className={cx(
                      'min-h-tap flex-1 rounded-[8px] px-1 text-tiny',
                      p.visibility === v ? 'bg-card font-bold text-navy' : 'text-muted',
                      'disabled:opacity-40',
                    )}
                  >
                    {VIS_LABEL[v]}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <PhotoDetailDialog
        slug={d.slug}
        photo={all.find((p) => p.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
      />
      <Dialog
        open={!!publicTarget}
        title="誰でも見られるようにしますか？"
        confirmLabel="誰でも見られるようにする"
        caution
        onClose={() => setPublicTarget(null)}
        onConfirm={() => {
          if (publicTarget) patch.mutate({ id: publicTarget.id, body: { visibility: 'public' } })
          setPublicTarget(null)
        }}
      >
        <p>
          合言葉の画面や LINE のカードに使われ、URL を知っている人なら誰でも見られます。
          <strong className="font-bold">顔が写っていない写真だけにしてください。</strong>
        </p>
      </Dialog>
    </>
  )
}

/** 幹事の画像は認証つきで取って blob URL で出す（承認待ち・下書きも見られるように）。 */
function AdminImage({ slug, photo: p, index }: { slug: string; photo: AdminPhoto; index: number }) {
  const blob = useQuery({
    queryKey: ['admin-media', p.id],
    queryFn: ({ signal }) => fetchBlobUrl(p.thumbUrl!, { session: true, admin: slug }, signal),
    enabled: !!p.thumbUrl,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  })
  return <PhotoBox src={blob.data} alt={p.caption || `${p.uploaderName}さんの写真`} index={index} />
}

/** 幹事の写真投稿（ゲートや OGP に使う「誰でも」の写真はここから）。 */
function AdminUpload({ slug, onDone }: { slug: string; onDone: () => void }) {
  const guard = useSessionGuard()
  const input = useRef<HTMLInputElement>(null)
  const [visibility, setVisibility] = useState<Visibility>('members')
  const [state, setState] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    const list = Array.from(files)
    try {
      for (let i = 0; i < list.length; i++) {
        const form = new FormData()
        form.append('photo', list[i])
        form.append('visibility', visibility)
        await upload(`/events/${slug}/photos`, form, { session: true, admin: slug }, (r) =>
          setState(`${i + 1} / ${list.length} 枚目を送信中… ${Math.round(r * 100)}%`),
        )
      }
      setState(`${list.length}枚を投稿しました。変換が終わると表示されます`)
      onDone()
    } catch (e) {
      setState(null)
      if (!guard(e)) setError(e instanceof Error ? e.message : '送れませんでした')
    }
  }

  return (
    <Card>
      <CardTitle>幹事の写真を追加</CardTitle>
      <p className="text-note text-muted">
        「誰でも」にした写真は、合言葉の画面と LINE のカードに使われます。
      </p>
      <PillGroup label="公開範囲">
        {(['public', 'members', 'draft'] as Visibility[]).map((v) => (
          <Pill key={v} selected={visibility === v} onClick={() => setVisibility(v)}>
            {VIS_LABEL[v]}
          </Pill>
        ))}
      </PillGroup>
      {visibility === 'public' && <Notice>顔が写っていない写真だけにしてください</Notice>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="追加する写真"
        onChange={(e) => {
          void send(e.target.files)
          e.target.value = ''
        }}
      />
      <div>
        <SmallButton variant="dashed" onClick={() => input.current?.click()}>
          <UploadIcon size={16} /> 写真をえらぶ
        </SmallButton>
      </div>
      {state && <p className="text-note text-muted">{state}</p>}
      {error && <ErrorNotice message={error} />}
    </Card>
  )
}
