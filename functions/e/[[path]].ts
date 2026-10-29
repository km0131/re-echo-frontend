// Cloudflare Pages Functions：/e/* へのリクエストで index.html に OGP のメタタグを差し込む。
// LINE などのクローラーは JavaScript を動かさないため、ここでサーバー側で入れる。
// 入れるのは公開情報（イベント名と OGP 画像）だけ。参加者の名前やコメントは扱わない。

type Env = { API_ORIGIN?: string }

type PagesContext = {
  request: Request
  env: Env
  params: { path?: string | string[] }
  next: () => Promise<Response>
  waitUntil: (p: Promise<unknown>) => void
}

type PublicEvent = { slug: string; title: string; ogImageUrl?: string | null }

// Workers ランタイムにある HTMLRewriter の最小限の型
type Element = {
  append: (content: string, options?: { html?: boolean }) => void
  setInnerContent: (content: string, options?: { html?: boolean }) => void
}
declare class HTMLRewriter {
  on(selector: string, handlers: { element: (el: Element) => void }): HTMLRewriter
  transform(res: Response): Response
}

const DESCRIPTION = 'クラスのみんなで日程を決めています。合言葉を入れて回答してね'
const SLUG = /^[A-Za-z0-9]{10,32}$/

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function fetchEvent(origin: string, slug: string): Promise<PublicEvent | null> {
  try {
    const res = await fetch(`${origin}/api/v1/public/events/${slug}`, {
      headers: { Accept: 'application/json' },
      // Cloudflare のキャッシュを使う（API への問い合わせを減らす）
      cf: { cacheTtl: 300, cacheEverything: true },
      signal: AbortSignal.timeout(3000),
    } as RequestInit)
    if (!res.ok) return null
    return (await res.json()) as PublicEvent
  } catch {
    return null
  }
}

export const onRequest = async (ctx: PagesContext): Promise<Response> => {
  const page = await ctx.next()
  const contentType = page.headers.get('Content-Type') ?? ''
  const raw = ctx.params.path
  const slug = Array.isArray(raw) ? raw[0] : raw
  const origin = (ctx.env.API_ORIGIN ?? '').replace(/\/$/, '')
  // HTML 以外（画像など）や slug の形でないもの、API の場所がわからないときは、そのまま返す
  if (!contentType.includes('text/html') || !slug || !SLUG.test(slug) || !origin) return page

  const ev = await fetchEvent(origin, slug)
  if (!ev) return page // API に届かなくてもページ表示は止めない

  const url = new URL(ctx.request.url)
  const pageUrl = `${url.origin}/e/${slug}`
  const image = ev.ogImageUrl ? new URL(ev.ogImageUrl, origin).toString() : ''
  const title = `出欠帳｜${ev.title}`
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="出欠帳" />`,
    `<meta property="og:title" content="${escapeAttr(ev.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(DESCRIPTION)}" />`,
    `<meta property="og:url" content="${escapeAttr(pageUrl)}" />`,
    image ? `<meta property="og:image" content="${escapeAttr(image)}" />` : '',
    image ? `<meta property="og:image:width" content="1200" />` : '',
    image ? `<meta property="og:image:height" content="630" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="description" content="${escapeAttr(DESCRIPTION)}" />`,
  ]
    .filter(Boolean)
    .join('\n    ')

  return new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title, { html: false }) })
    .on('head', { element: (el) => el.append(`\n    ${tags}\n`, { html: true }) })
    .transform(page)
}
