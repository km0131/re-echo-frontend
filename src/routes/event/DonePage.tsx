import confetti from 'canvas-confetti'
import { useEffect, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { Page } from '../../components/Page'
import { memberMediaUrl } from '../../lib/api'
import { useMyResponse } from '../../lib/participant'
import { usePhotos } from '../../lib/photos'
import { pickRandom, prefersReducedMotion, tokenHex } from '../../lib/random'
import { storage } from '../../lib/storage'
import { useTitle } from '../../lib/title'
import type { PhotoItem } from '../../lib/types'
import { ButtonLink, PhotoBox, Polaroid } from '../../ui'

/** 回答完了（design.md 3.4）。紙吹雪と思い出ミニギャラリー。 */
export default function DonePage() {
  const { slug = '' } = useParams()
  if (!storage.getEdit(slug)) return <Navigate to={`/e/${slug}`} replace />
  return <Done slug={slug} />
}

function Done({ slug }: { slug: string }) {
  const location = useLocation()
  const mine = useMyResponse(slug)
  useTitle('ありがとう！')
  const name = (location.state as { name?: string } | null)?.name ?? mine.data?.name

  // 紙吹雪は1回だけ、控えめに。色は yes・kraft・maybe・navy のみ。視差効果を減らす設定なら出さない
  useEffect(() => {
    if (prefersReducedMotion()) return
    const colors = ['yes', 'kraft', 'maybe', 'navy'].map(tokenHex)
    const t = setTimeout(() => {
      void confetti({
        particleCount: 70,
        spread: 70,
        startVelocity: 32,
        gravity: 0.9,
        ticks: 180,
        origin: { y: 0.28 },
        colors,
        scalar: 0.9,
        disableForReducedMotion: true,
      })
    }, 250)
    return () => {
      clearTimeout(t)
      confetti.reset()
    }
  }, [])

  return (
    <Page className="flex min-h-dvh flex-col pb-10 pt-24 text-center">
      <h1 className="font-hand text-hero text-navy">ありがとう！</h1>
      <p className="mt-4 text-body text-ink">
        {name ? `${name}さんの回答を保存しました。` : '回答を保存しました。'}
        <br />
        この端末なら、いつでも直せます。
      </p>
      <MiniGallery slug={slug} />
      <div className="mt-auto flex flex-col gap-3 pt-10">
        <ButtonLink to={`/e/${slug}/gallery`} variant="secondary">
          写真をもっと見る
        </ButtonLink>
        <ButtonLink to={`/e/${slug}`}>みんなの回答を見る</ButtonLink>
      </div>
    </Page>
  )
}

// 3枚の置き方（design.md 3.4：-7deg・4deg・8deg、中央の1枚にテープ）
const SLOTS = [
  { tilt: '-7deg', className: 'left-0 top-4 z-10', delay: '0.15s' },
  { tilt: '4deg', className: 'left-1/2 top-0 z-20 -translate-x-1/2', delay: '0.3s', tape: true },
  { tilt: '8deg', className: 'right-0 top-6 z-10', delay: '0.45s' },
]

/** 思い出ミニギャラリー：members 写真からランダムに3枚。写真がなければ出さない。 */
function MiniGallery({ slug }: { slug: string }) {
  const photos = usePhotos(slug)
  const [seed] = useState(() => Math.random())
  const approved = (photos.data?.photos ?? []).filter((p) => p.status === 'approved' && p.thumbUrl)
  if (approved.length === 0) return null
  const picks: (PhotoItem | null)[] = pickRandom(approved, 3, seed)
  while (picks.length < 3) picks.push(null)
  return (
    <section aria-label="思い出の写真" className="relative mx-auto mt-10 h-[200px] w-full max-w-[330px]">
      {SLOTS.map((slot, i) => {
        const p = picks[i]
        return (
          <div
            key={i}
            className={`absolute w-[124px] ${slot.className}`}
            style={{ animationDelay: slot.delay }}
          >
            <div
              className="animate-drop-in"
              style={{
                ['--tilt' as string]: slot.tilt,
                transform: `rotate(${slot.tilt})`,
                animationDelay: slot.delay,
              }}
            >
              <Polaroid tilt="rotate-0" tape={slot.tape} bottom="pb-7" className="px-2 pt-2">
                <PhotoBox
                  src={p?.thumbUrl ? memberMediaUrl(p.thumbUrl, slug) : null}
                  alt={p?.caption ?? ''}
                  index={i + 2}
                />
              </Polaroid>
            </div>
          </div>
        )
      })}
    </section>
  )
}
