/** 配列から重ならないように n 個をランダムに選ぶ */
export function pickRandom<T>(items: T[], n: number, seed = Math.random()): T[] {
  // seed から作る簡単な擬似乱数（再描画で選び直さないように seed を固定して使う）
  let x = Math.floor(seed * 2 ** 31) || 1
  const rand = () => {
    x = (x * 48271) % 2147483647
    return x / 2147483647
  }
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

/** CSS変数のトークン（「R G B」）を #RRGGBB にする（canvas など CSS が使えない所の色用） */
export function tokenHex(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim()
  const [r, g, b] = v.split(/\s+/).map(Number)
  return '#' + [r, g, b].map((n) => (n || 0).toString(16).padStart(2, '0')).join('')
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
