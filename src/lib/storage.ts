// LocalStorage の読み書き。キーは CLAUDE.md 4章で統一する。
// プライベートブラウズなどで例外が出ても画面が止まらないよう、すべて try/catch で包む。

export type EditInfo = { responseId: string; token: string }

const keys = {
  session: () => 'chosei:session',
  gate: (slug: string) => `chosei:gate:${slug}`,
  edit: (slug: string) => `chosei:edit:${slug}`,
  admin: (slug: string) => `chosei:admin:${slug}`,
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 保存できなくても続ける（次回また合言葉を聞くだけ）
  }
}

export const storage = {
  getSession: () => read(keys.session()),
  setSession: (token: string | null) => write(keys.session(), token),

  getGate: (slug: string) => read(keys.gate(slug)),
  setGate: (slug: string, token: string | null) => write(keys.gate(slug), token),

  getEdit: (slug: string): EditInfo | null => {
    const raw = read(keys.edit(slug))
    if (!raw) return null
    try {
      const v = JSON.parse(raw) as Partial<EditInfo>
      return typeof v.responseId === 'string' && typeof v.token === 'string'
        ? { responseId: v.responseId, token: v.token }
        : null
    } catch {
      return null
    }
  },
  setEdit: (slug: string, info: EditInfo | null) =>
    write(keys.edit(slug), info ? JSON.stringify(info) : null),

  getAdmin: (slug: string) => read(keys.admin(slug)),
  setAdmin: (slug: string, key: string | null) => write(keys.admin(slug), key),
}
