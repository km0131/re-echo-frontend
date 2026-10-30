import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Page, PageTitle } from '../../components/Page'
import { ApiError, upload } from '../../lib/api'
import { useGateGuard } from '../../lib/participant'
import { GALLERY_TILTS, photoKeys, usePhotos } from '../../lib/photos'
import { storage } from '../../lib/storage'
import { charCount } from '../../lib/text'
import { useTitle } from '../../lib/title'
import { useTurnstileToken } from '../../lib/useTurnstileToken'
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
  TopBar,
} from '../../ui'

type Item = {
  key: string
  file: File
  preview: string
  title: string
  progress: number // 0〜1
  state: 'ready' | 'sending' | 'done' | 'error'
  error?: string
}

const MAX_BYTES = 15 * 1024 * 1024
const MAX_TITLE = 40 // spec.md 14.2
const titleOver = (it: Item) => charCount(it.title.trim()) > MAX_TITLE

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
  // 1枚ずつ送るので、1枚ごとに新しいトークンを使う（トークンは1回きり）
  const ts = useTurnstileToken('upload')
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
        title: '',
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
      // タイトルは meta（photo と同じ順番・同じ数の JSON 配列）で送る。空ならタイトルなし
      form.append('meta', JSON.stringify([{ title: it.title.trim() || null }]))
      try {
        const turnstile = await ts.nextToken()
        await upload(`/events/${slug}/photos`, form, { gate: slug, edit: slug, turnstile }, (r) =>
          patch(it.key, { progress: r }),
        )
        patch(it.key, { state: 'done', progress: 1 })
      } catch (e) {
        failed = true
        if (guard(e)) return
        patch(it.key, { state: 'error', error: e instanceof ApiError ? e.message : '送れませんでした' })
        if (e instanceof ApiError && ['photo_limit', 'quota_exceeded'].includes(e.code)) break
      } finally {
        ts.reset()
      }
    }
    setBusy(false)
    await qc.invalidateQueries({ queryKey: photoKeys.list(slug) })
    if (!failed) navigate(`/e/${slug}/gallery`)
  }

  const ready = items.filter((i) => i.state === 'ready').length
  const anyOver = items.some((i) => i.state === 'ready' && titleOver(i))
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
          {items.map((it, i) => {
            const left = MAX_TITLE - charCount(it.title.trim())
            return (
              <li key={it.key} className="flex flex-col gap-2">
                <div className="relative">
                  <Polaroid tilt={GALLERY_TILTS[i % GALLERY_TILTS.length]} bottom="pb-1.5">
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
                    {/* タイトルはポラロイドの下の余白に書きこむ（白枠の上なので色は固定） */}
                    <input
                      aria-label={`${i + 1}枚目のタイトル`}
                      placeholder="タイトル（なくてもOK）"
                      value={it.title}
                      disabled={it.state !== 'ready'}
                      autoComplete="off"
                      enterKeyHint="done"
                      onChange={(e) => patch(it.key, { title: e.target.value })}
                      className="mt-1 h-tap w-full border-0 border-b border-dashed border-frame-ink/40 bg-transparent px-1 text-input text-frame-ink placeholder:text-frame-ink/70 focus:border-solid focus:border-frame-ink focus:outline-none disabled:opacity-70"
                    />
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
                {left < 10 && it.state === 'ready' && (
                  <p className={left < 0 ? 'text-tiny text-maybe-ink' : 'text-tiny text-muted'}>
                    {left < 0 ? `タイトルが${-left}文字多いです` : `タイトルはあと${left}文字`}
                  </p>
                )}
                <p className="text-tiny text-muted" aria-live="polite">
                  {it.state === 'sending' && `送信中… ${Math.round(it.progress * 100)}%`}
                  {it.state === 'done' && '送信しました'}
                  {it.state === 'error' && <span className="text-maybe-ink">{it.error}</span>}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {anyOver && <p className="text-note text-maybe-ink">タイトルは{MAX_TITLE}文字までにしてください</p>}
      {ts.element}
      <Button onClick={() => void send()} disabled={busy || ready === 0 || anyOver || !ts.ready}>
        {busy ? '送信しています…' : ready > 0 ? `${ready}枚を投稿する` : '投稿する'}
      </Button>
    </Page>
  )
}
