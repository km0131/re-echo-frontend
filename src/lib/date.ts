// 日時の表示はすべて Asia/Tokyo。ブラウザのタイムゾーンに頼らず Intl に timeZone を渡す。

const TZ = 'Asia/Tokyo'
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
})

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** 日本時間での年月日・時分・曜日 */
export function tokyoParts(input: string | Date) {
  const d = typeof input === 'string' ? new Date(input) : input
  const p: Record<string, string> = {}
  for (const x of partsFormatter.formatToParts(d)) p[x.type] = x.value
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAY_INDEX[p.weekday],
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 「12/29（火）19:00〜」 */
export function formatCandidate(iso: string): string {
  const p = tokyoParts(iso)
  return `${p.month}/${p.day}（${WEEKDAYS[p.weekday]}）${pad(p.hour)}:${pad(p.minute)}〜`
}

/** 「10/26 22:14」 */
export function formatDateTime(iso: string): string {
  const p = tokyoParts(iso)
  return `${p.month}/${p.day} ${pad(p.hour)}:${pad(p.minute)}`
}

/** 「2026/10/26 22:14」（年が要るとき） */
export function formatFullDateTime(iso: string): string {
  const p = tokyoParts(iso)
  return `${p.year}/${p.month}/${p.day} ${pad(p.hour)}:${pad(p.minute)}`
}

/** 日本時間の日付を通し番号（UTC 0時のエポック日数）にする */
function tokyoDayNumber(input: string | Date): number {
  const p = tokyoParts(input)
  return Date.UTC(p.year, p.month - 1, p.day) / 86400000
}

/** YYYY-MM-DD を通し番号にする */
function dateDayNumber(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

/** 開催日まであと何日か（日本時間の日付で数える。当日は0） */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return tokyoDayNumber(iso) - tokyoDayNumber(now)
}

/** 終了日（YYYY-MM-DD）から何か月たったか（日本時間。終了前は0） */
export function monthsSince(endsOn: string, now: Date = new Date()): number {
  const days = tokyoDayNumber(now) - dateDayNumber(endsOn)
  if (days <= 0) return 0
  const [y, m, d] = endsOn.split('-').map(Number)
  const p = tokyoParts(now)
  let months = (p.year - y) * 12 + (p.month - m)
  if (p.day < d) months--
  return Math.max(0, months)
}

/** 今日（日本時間）の YYYY-MM-DD */
export function tokyoToday(now: Date = new Date()): string {
  const p = tokyoParts(now)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** ISO を日付・時刻の入力欄の値（日本時間）にする */
export function toTokyoInputs(iso: string): { date: string; time: string } {
  const p = tokyoParts(iso)
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` }
}

/** 日付・時刻の入力欄の値（日本時間）を UTC の ISO にする。不正なら null */
export function fromTokyoInputs(date: string, time: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const tm = /^(\d{2}):(\d{2})$/.exec(time)
  if (!dm || !tm) return null
  const ms = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +tm[1] - 9, +tm[2])
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().replace('.000Z', 'Z')
}
