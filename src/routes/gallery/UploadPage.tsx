import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Page, PageTitle } from '../../components/Page'
import { ApiError, upload } from '../../lib/api'
import { useGateGuard } from '../../lib/participant'
import { GALLERY_TILTS, photoKeys, usePhotos } from '../../lib/photos'
import { storage } from '../../lib/storage'
import { useTitle } from '../../lib/title'
import {
  Button,
  CameraIcon,
  DeleteIcon,
  EmptyState,
  ErrorNotice,
  Notice,
  PageSkeleton,
  PhotoBox,
  Polaroid,
  TextInput,
  TopBar,
} from '../../ui'

type Item = {
  key: string
  file: File
  preview: string
  caption: string
  progress: number // 0〜1
  state: 'ready' | 'sending' | 'done' | 'error'
  error?: string
}

const MAX_BYTES = 15 * 1024 * 1024

/** 写真投稿（design.md 4章）。1枚ずつ送って、それぞれの進捗を出す。 */
export default function UploadPage() {
  const { slug = '' } = useParams()
  if (!storage.getGate(slug)) return <Navigate to={`/e/${slug}`} replace />
  return <Upload slug={slug} />
}

function Upload({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const guard = useGateGuard(slug)
  const photos = usePhotos(slug)
  useTitle('写真を投稿')
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // プレビュー用の blob URL を片付ける
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), [])

  if (photos.isPending) {
    return (
      <Page>
        <PageSkeleton />
      </Page>
    )
  }
  const remaining = photos.data?.limits?.remaining ?? 0

  if (!photos.data?.answered) {
    return (
      <Page className="flex flex-col gap-section">
        <TopBar backTo={`/e/${slug}/gallery`} />
        <PageTitle>写真を投稿</PageTitle>
        <EmptyState title="回答すると写真を投稿できます" note="先に出欠を書いてください" />
        <Link to={`/e/${slug}/answer`} className="mx-auto text-label text-navy underline underline-offset-4">
          出欠を書く
        </Link>
      </Page>
    )
  }

  const pick = (files: FileList | null) => {
    if (!files) return
    setError(null)
    const room = remaining - items.length
    const picked = Array.from(files).slice(0, Math.max(0, room))
    if (files.length > room) setError(`投稿できるのはあと${remaining}枚です`)
    setItems((s) => [
      ...s,
      ...picked.map((file, i) => ({
        key: `${Date.now()}-${i}-${file.name}`,
        file,
        preview: URL.createObjectURL(file),
        caption: '',
        progress: 0,
        state: file.size > MAX_BYTES ? ('error' as const) : ('ready' as const),
        error: file.size > MAX_BYTES ? '15MBまでの写真にしてください' : undefined,
      })),
    ])
  }

  const patch = (key: string, p: Partial<Item>) =>
    setItems((s) => s.map((i) => (i.key === key ? { ...i, ...p } : i)))

  const send = async () => {
    setBusy(true)
    setError(null)
    let failed = false
    for (const it of items) {
      if (it.state !== 'ready') continue
      patch(it.key, { state: 'sending', progress: 0 })
      const form = new FormData()
      form.append('photo', it.file)
      form.append('caption', it.caption)
      try {
        await upload(`/events/${slug}/photos`, form, { gate: slug, edit: slug }, (r) =>
          patch(it.key, { progress: r }),
        )
        patch(it.key, { state: 'done', progress: 1 })
      } catch (e) {
        failed = true
        if (guard(e)) return
        patch(it.key, { state: 'error', error: e instanceof ApiError ? e.message : '送れませんでした' })
        if (e instanceof ApiError && ['photo_limit', 'quota_exceeded'].includes(e.code)) break
      }
    }
    setBusy(false)
    await qc.invalidateQueries({ queryKey: photoKeys.list(slug) })
    if (!failed) navigate(`/e/${slug}/gallery`)
  }

  const ready = items.filter((i) => i.state === 'ready').length
  return (
    <Page className="flex flex-col gap-section pb-10">
      <TopBar backTo={`/e/${slug}/gallery`} />
      <PageTitle aside={<span className="text-note text-muted">あと{remaining}枚</span>}>
        写真を投稿
      </PageTitle>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="写真をえらぶ"
        onChange={(e) => {
          pick(e.target.files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={busy || remaining - items.length <= 0}
        onClick={() => inputRef.current?.click()}
        className="flex h-40 flex-col items-center justify-center gap-2 rounded-card border-strong border-dashed border-navy text-navy hover:bg-card disabled:opacity-50"
      >
        <CameraIcon size={32} />
        <span className="text-input font-bold">写真をえらぶ</span>
        <span className="text-note text-muted">いくつでも選べます（1枚15MBまで）</span>
      </button>
      <Notice>位置情報は自動で消えます。幹事が確認してから、クラスのみんなに公開されます</Notice>
      {error && <ErrorNotice message={error} />}

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5">
          {items.map((it, i) => (
            <li key={it.key} className="flex flex-col gap-2">
              <div className="relative">
                <Polaroid tilt={GALLERY_TILTS[i % GALLERY_TILTS.length]} bottom="pb-3">
                  {/* HEIC は Safari 以外では表示できないので、下地の色だけになる */}
                  <PhotoBox src={it.preview} alt={it.file.name} index={i} loading="eager" />
                  {it.state === 'sending' && (
                    <div className="absolute inset-x-2.5 bottom-3 h-1.5 overflow-hidden rounded-full bg-card/80">
                      <div
                        className="h-full bg-yes transition-[width]"
                        style={{ width: `${Math.round(it.progress * 100)}%` }}
                      />
                    </div>
                  )}
                </Polaroid>
                {it.state !== 'sending' && it.state !== 'done' && (
                  <button
                    type="button"
                    aria-label="この写真をやめる"
                    onClick={() => {
                      URL.revokeObjectURL(it.preview)
                      setItems((s) => s.filter((x) => x.key !== it.key))
                    }}
                    className="absolute -right-2 -top-2 inline-flex h-tap w-tap items-center justify-center rounded-full border border-line bg-card text-muted"
                  >
                    <DeleteIcon size={18} />
                  </button>
                )}
              </div>
              <TextInput
                aria-label={`${i + 1}枚目のキャプション`}
                placeholder="キャプション（任意）"
                value={it.caption}
                maxLength={40}
                disabled={it.state !== 'ready'}
                className="h-tap px-3"
                onChange={(e) => patch(it.key, { caption: e.target.value })}
              />
              <p className="text-tiny text-muted" aria-live="polite">
                {it.state === 'sending' && `送信中… ${Math.round(it.progress * 100)}%`}
                {it.state === 'done' && '送信しました'}
                {it.state === 'error' && <span className="text-maybe-ink">{it.error}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Button onClick={() => void send()} disabled={busy || ready === 0}>
        {busy ? '送信しています…' : ready > 0 ? `${ready}枚を投稿する` : '投稿する'}
      </Button>
    </Page>
  )
}
