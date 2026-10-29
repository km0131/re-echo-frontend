import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { Page, PageTitle } from '../../components/Page'
import { ApiError, memberMediaUrl } from '../../lib/api'
import { useEventDetail, useGateGuard } from '../../lib/participant'
import { GALLERY_TILTS, usePhotos } from '../../lib/photos'
import { storage } from '../../lib/storage'
import { useTitle } from '../../lib/title'
import type { PhotoItem } from '../../lib/types'
import {
  BottomBar,
  ButtonLink,
  ChipRow,
  EmptyState,
  ErrorNotice,
  FilterChip,
  PageSkeleton,
  PhotoBox,
  Polaroid,
  SpinIcon,
  TopBar,
  UploadIcon,
} from '../../ui'
import { Lightbox } from './Lightbox'

type Filter = 'all' | 'new' | 'mine'

/** 写真ギャラリー（design.md 3.5） */
export default function GalleryPage() {
  const { slug = '' } = useParams()
  if (!storage.getGate(slug)) return <Navigate to={`/e/${slug}`} replace />
  return <Gallery slug={slug} />
}

function Gallery({ slug }: { slug: string }) {
  const guard = useGateGuard(slug)
  const detail = useEventDetail(slug)
  useTitle(detail.data ? `あの頃のアルバム（${detail.data.title}）` : undefined)
  const photos = usePhotos(slug)
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    if (photos.error) guard(photos.error)
  }, [photos.error, guard])

  const list = useMemo(() => {
    const all = photos.data?.photos ?? []
    if (filter === 'mine') return all.filter((p) => p.mine)
    if (filter === 'new') return [...all].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return all
  }, [photos.data, filter])
  const viewable = useMemo(() => list.filter((p) => p.status === 'approved'), [list])

  // 拡大表示はブラウザの戻るで閉じられるよう、履歴を1つ積む
  const openAt = (p: PhotoItem) => {
    const i = viewable.findIndex((x) => x.id === p.id)
    if (i < 0) return
    window.history.pushState({ lightbox: true }, '')
    setOpen(i)
  }
  const close = useCallback(() => {
    if (window.history.state?.lightbox) window.history.back()
    else setOpen(null)
  }, [])
  useEffect(() => {
    const onPop = () => setOpen(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  if (photos.isPending) {
    return (
      <Page>
        <PageSkeleton />
      </Page>
    )
  }
  const data = photos.data
  const approvedCount = data?.photos.filter((p) => p.status === 'approved').length ?? 0

  return (
    <Page className="flex flex-col gap-section-sm">
      <TopBar title={detail.data?.title} backTo={`/e/${slug}`} />
      <PageTitle aside={<span className="text-note text-muted">{approvedCount}枚</span>}>
        あの頃のアルバム
      </PageTitle>
      {photos.error && !(photos.error instanceof ApiError && photos.error.code === 'gate_required') && (
        <ErrorNotice message={photos.error.message} onRetry={() => void photos.refetch()} />
      )}

      <ChipRow>
        {(
          [
            ['all', 'すべて'],
            ['new', '新しい順'],
            ['mine', '自分の投稿'],
          ] as const
        ).map(([k, label]) => (
          <FilterChip key={k} selected={filter === k} onClick={() => setFilter(k)}>
            {label}
          </FilterChip>
        ))}
      </ChipRow>

      {list.length === 0 ? (
        <EmptyState
          title={filter === 'mine' ? 'まだ投稿していません' : 'まだ写真がありません'}
          note="昔の写真があったら、ぜひ投稿してください"
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 pt-2">
          {list.map((p, i) => (
            <li key={p.id}>
              <GalleryItem
                slug={slug}
                photo={p}
                tilt={GALLERY_TILTS[i % GALLERY_TILTS.length]}
                onOpen={() => openAt(p)}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-note text-muted">
        写真をタップで拡大。写っていて困る写真は拡大画面の「非表示にしてほしい」から伝えられます
      </p>

      <BottomBar>
        {data?.answered ? (
          <ButtonLink
            to={`/e/${slug}/gallery/upload`}
            aria-disabled={data.limits?.remaining === 0}
            className={data.limits?.remaining === 0 ? 'pointer-events-none opacity-60' : ''}
          >
            <UploadIcon size={20} />
            写真を投稿する（あと{data.limits?.remaining ?? 0}枚）
          </ButtonLink>
        ) : (
          <ButtonLink to={`/e/${slug}/answer`} variant="secondary">
            回答すると写真を投稿できます
          </ButtonLink>
        )}
      </BottomBar>

      {open !== null && viewable[open] && (
        <Lightbox slug={slug} photos={viewable} index={open} onIndex={setOpen} onClose={close} />
      )}
    </Page>
  )
}

function GalleryItem({
  slug,
  photo: p,
  tilt,
  onOpen,
}: {
  slug: string
  photo: PhotoItem
  tilt: string
  onOpen: () => void
}) {
  if (p.status === 'pending') {
    // 承認待ちの画像は幹事しか読めないので、下地と文言だけ出す
    return (
      <Polaroid tilt={tilt} caption="あなたの投稿" captionClass="text-[14px]">
        <div className="flex aspect-square items-center justify-center bg-highlight px-2 text-center text-note text-sepia-ink">
          幹事の確認待ち
        </div>
      </Polaroid>
    )
  }
  if (p.status === 'processing' || p.status === 'failed') {
    return (
      <Polaroid tilt={tilt} caption="あなたの投稿" captionClass="text-[14px]">
        <div className="flex aspect-square flex-col items-center justify-center gap-1.5 bg-line text-muted">
          {p.status === 'processing' ? (
            <>
              <SpinIcon size={22} className="motion-safe:animate-spin" />
              <span className="text-note">処理中…</span>
            </>
          ) : (
            <span className="px-2 text-center text-note">変換できませんでした</span>
          )}
        </div>
      </Polaroid>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left"
      aria-label={`${p.caption || '写真'}を拡大`}
    >
      <Polaroid tilt={tilt} caption={p.caption || ' '} captionClass="text-[14px]">
        <PhotoBox
          src={p.thumbUrl ? memberMediaUrl(p.thumbUrl, slug) : null}
          alt={p.caption}
          index={p.id.charCodeAt(25)}
        />
      </Polaroid>
    </button>
  )
}
