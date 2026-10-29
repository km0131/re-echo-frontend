import type { ConfirmedView } from '../../lib/types'

/** 確定カード（design.md 3.2 の 3）。背景 navy、右にカウントダウン。 */
export function ConfirmedCard({ confirmed }: { confirmed: ConfirmedView }) {
  const days = confirmed.daysLeft
  return (
    <section
      className="flex items-center justify-between gap-3 rounded-card bg-navy p-[18px] text-paper"
      aria-label="決定した日程"
    >
      <div className="min-w-0">
        <p className="text-tiny text-sand">決定しました</p>
        <p className="mt-0.5 text-lead font-bold">{confirmed.label}</p>
      </div>
      <div className="shrink-0 text-right">
        {days > 0 ? (
          <>
            <p className="text-tiny text-sand">開催まであと</p>
            <p className="font-hand leading-none">
              <span className="text-countdown">{days}</span>
              <span className="ml-0.5 text-input">日</span>
            </p>
          </>
        ) : days === 0 ? (
          <p className="font-hand text-[28px] leading-none">今日！</p>
        ) : (
          <p className="text-note text-sand">開催しました</p>
        )}
      </div>
    </section>
  )
}
