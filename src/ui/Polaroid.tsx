import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import { PHOTO_BG, type Tilt } from './styles'

/**
 * ポラロイド風の写真。白枠・影・わずかな傾き。下の余白にキャプション（手書き風）。
 * 白枠はダークモードでも白のまま（--c-polaroid）。
 */
export function Polaroid({
  children,
  caption,
  tilt = '-rotate-2',
  tape,
  className,
  bottom = 'pb-9',
  captionClass = 'text-[15px]',
}: {
  children: ReactNode
  caption?: ReactNode
  tilt?: Tilt
  tape?: boolean
  className?: string
  /** 下の余白（キャプションの入るところ） */
  bottom?: string
  captionClass?: string
}) {
  return (
    <figure
      className={cx(
        'relative bg-frame px-2.5 pt-2.5 shadow-polaroid motion-safe:transition-transform',
        tilt,
        bottom,
        className,
      )}
    >
      {tape && <Tape className="absolute -top-3 left-1/2 -translate-x-1/2" />}
      {children}
      {caption && (
        <figcaption
          className={cx(
            'absolute inset-x-2 bottom-0 flex h-9 items-center justify-center truncate font-hand text-frame-ink',
            captionClass,
          )}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

/** 写真の部分。src がなければ photo 色の下地だけを出す。読み込めたらふわっと表示。 */
export function PhotoBox({
  src,
  alt,
  index = 0,
  className = 'aspect-square',
  loading = 'lazy',
}: {
  src?: string | null
  alt: string
  index?: number
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  return (
    <div className={cx('relative overflow-hidden', PHOTO_BG[index % PHOTO_BG.length], className)}>
      {src && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 motion-reduce:transition-none"
          onLoad={(e) => e.currentTarget.classList.replace('opacity-0', 'opacity-100')}
        />
      )}
    </div>
  )
}

/** マスキングテープ。 */
export function Tape({ className, width = 'w-[76px]' }: { className?: string; width?: string }) {
  return <span aria-hidden="true" className={cx('block h-[22px] -rotate-2 bg-tape', width, className)} />
}
