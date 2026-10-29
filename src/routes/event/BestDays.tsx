import { cx } from '../../lib/cx'
import type { CandidateSummary } from '../../lib/types'
import { ChoiceCounts } from '../../ui'

/** いい感じの日（design.md 3.2 の 4）。1位は枠 navy・番号丸が塗り、2・3位は枠 line・番号丸が線のみ。 */
export function BestDays({ best, candidates }: { best: string[]; candidates: CandidateSummary[] }) {
  const rows = best.map((id) => candidates.find((c) => c.id === id)).filter((c): c is CandidateSummary => !!c)
  if (rows.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-hand text-h2 text-navy">いい感じの日</h2>
      <ol className="flex flex-col gap-2">
        {rows.map((c, i) => (
          <li
            key={c.id}
            className={cx(
              'flex items-center gap-3 rounded-btn bg-card px-3.5 py-3',
              i === 0 ? 'border-strong border-navy' : 'border border-line',
            )}
          >
            <span
              aria-label={`${i + 1}位`}
              className={cx(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label font-bold',
                i === 0 ? 'bg-navy text-paper' : 'border-strong border-navy text-navy',
              )}
            >
              {i + 1}
            </span>
            <span className={cx('min-w-0 flex-1 text-body', i === 0 && 'font-bold')}>{c.label}</span>
            <ChoiceCounts counts={c.counts} className="text-label" />
          </li>
        ))}
      </ol>
    </section>
  )
}
