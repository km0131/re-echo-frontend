import { useState } from 'react'
import { memberMediaUrl } from '../../lib/api'
import { usePhotos } from '../../lib/photos'
import { pickRandom } from '../../lib/random'
import { PHOTO_BG } from '../../ui'

/**
 * イベントトップのヘッダー（高さ230px）。members 写真からアクセスごとにランダムで1枚。
 * セピア調とうっすらフィルムノイズを重ねる。写真がなければ photo 色の下地。
 */
export function EventHeader({ slug, title, year }: { slug: string; title: string; year: number }) {
  const photos = usePhotos(slug)
  const [seed] = useState(() => Math.random())
  const approved = (photos.data?.photos ?? []).filter((p) => p.status === 'approved' && p.largeUrl)
  const pick = pickRandom(approved, 1, seed)[0]
  return (
    <header className={`relative h-[230px] w-full overflow-hidden ${PHOTO_BG[1]}`}>
      {pick?.largeUrl && (
        <img
          key={pick.id}
          src={memberMediaUrl(pick.largeUrl, slug)}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="high"
          className="sepia-photo absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 motion-reduce:transition-none"
          onLoad={(e) => e.currentTarget.classList.replace('opacity-0', 'opacity-100')}
        />
      )}
      <div aria-hidden="true" className="film-noise absolute inset-0" />
      <div className="absolute inset-0 bg-overlay" />
      <div className="absolute inset-x-gutter bottom-5">
        <p className="text-tiny tracking-catch text-on-photo">CLASS REUNION {year}</p>
        <h1 className="mt-1 font-hand text-[30px] leading-tight text-on-photo">{title}</h1>
      </div>
    </header>
  )
}
