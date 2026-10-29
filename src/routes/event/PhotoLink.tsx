import { Link } from 'react-router'
import { NextIcon } from '../../ui'

/** 写真へのリンク（design.md 3.2 の 7）。点線枠（sepia）のカード。 */
export function PhotoLink({ slug }: { slug: string }) {
  return (
    <Link
      to={`/e/${slug}/gallery`}
      className="flex min-h-[56px] items-center justify-between rounded-card border-strong border-dashed border-sepia bg-card/60 px-4 py-3 text-sepia hover:bg-card"
    >
      <span className="font-hand text-lead">あの頃の写真を見る</span>
      <NextIcon size={20} />
    </Link>
  )
}
