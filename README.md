# 出欠帳 フロントエンド（frontend）

高校のクラス同窓会の日程を決める「調整さん」型Webアプリ **出欠帳** の画面です（React + TypeScript + Vite + Tailwind CSS）。
API は別リポジトリ `backend` にあります。見た目は `docs/design.md`、仕様は `docs/spec.md` が正です。

本番は Cloudflare Pages です。Docker は**ローカルの動作チェック専用**です。

## Docker での動作チェック

必要なものは Docker（Docker Desktop、Windows は WSL2 版）だけです。ローカルに Node を入れる必要はありません。

### 1. 先に backend を起動する

```bash
cd ../backend
make up        # http://localhost:8080
make seed      # サンプルのイベント（共有URL・管理URLが表示される）
```

### 2. フロントを起動する

```bash
cp .env.example .env   # 必要なら値を変える（なくても既定値で動く）
make up                # http://localhost:5173
```

ファイルを保存すると、ブラウザが自動で更新されます。backend が起動していないと、画面上部に「API に接続できません。backend で make up してください」と出ます。

| コマンド | 内容 | make を使わない場合 |
| --- | --- | --- |
| `make up` | 起動（proxy モード） | `docker compose up --build web` |
| `make up-direct` | 起動（direct モード） | `VITE_API_BASE_URL=http://localhost:8080/api/v1 docker compose up --build web` |
| `make down` | 停止 | `docker compose --profile preview down` |
| `make logs` | ログを追う | `docker compose logs -f web` |
| `make check` | ビルド・リント・テスト | `docker compose run --rm --no-deps web sh -c "npm install && npm run build -- --outDir /tmp/check-dist && npm run lint && npm test"` |
| `make preview` | 本番と同じビルド＋Pages Functions（http://localhost:8788） | `docker compose --profile preview up --build preview` |
| `make ip` | スマホで開く URL を表示 | `hostname -I` などで PC の IP を調べる |
| `make clean` | コンテナと `node_modules` ボリュームを削除 | `docker compose --profile preview down -v` |

### proxy モードと direct モード

| モード | `VITE_API_BASE_URL` | 経路 | 用途 |
| --- | --- | --- | --- |
| proxy（既定） | `/api/v1` | ブラウザ → Vite（5173）→ backend（8080） | 普段の開発。スマホ実機でも同じ URL で API に届く |
| direct | `http://localhost:8080/api/v1` | ブラウザ → backend（8080） | 本番と同じ「別オリジン」の状態で CORS を確認する |

- proxy の対象は `/api`（SSE を含む）、`/media`、`/og` です。プロキシ先は `VITE_PROXY_TARGET`（既定 `http://host.docker.internal:8080`）。
- ファイルの変更が拾われないとき（Windows のフォルダをマウントしている場合など）は `.env` に `VITE_USE_POLLING=true`。

### スマホ実機での確認

1. PC とスマホを同じ Wi-Fi につなぐ
2. `make ip` で出た `http://<PCのIP>:5173` をスマホで開く
3. proxy モードなら backend の設定を変える必要はありません。direct モードをスマホで試すときだけ、backend の `.env` の `CHOSEI_ALLOWED_ORIGIN` に `http://<PCのIP>:5173` を足します

注意：
- **ファイアウォール**：PC 側で 5173 番ポートへの受信を許可してください（Windows はダイアログで「プライベートネットワーク」を許可）。
- **WSL2**：WSL の IP はスマホから見えません。Windows の PowerShell（管理者）で次を実行してポートを転送します。
  ```powershell
  netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=<WSLのIP>
  ```
  WSL の IP は WSL 内で `hostname -I` で分かります。

## ディレクトリ

```
src/routes/      画面（URLごと）
src/components/  画面固有でない部品
src/ui/          デザインの基本部品（Button, Card, Polaroid…）
src/lib/         API クライアント、LocalStorage、日付整形
src/styles/      デザイントークン（CSS変数）
functions/       Cloudflare Pages Functions（OGP 差し込み）
```

## Cloudflare Pages へのデプロイ

### 初回の設定（Cloudflare のダッシュボード）

1. Workers & Pages → 作成 → Pages → 「Git に接続」でこのリポジトリを選ぶ
2. ビルドの設定

| 項目 | 値 |
| --- | --- |
| フレームワーク プリセット | なし（None） |
| ビルドコマンド | `npm run build` |
| ビルド出力ディレクトリ | `dist` |
| ルートディレクトリ | （空欄） |

3. 環境変数（「本番」と「プレビュー」の両方）

| 変数 | 値 | 用途 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://chosei-api.example.com/api/v1` | 画面から呼ぶ API。CSP の `connect-src` にもビルド時に入る |
| `NODE_VERSION` | `22` | ビルドに使う Node |
| `API_ORIGIN` | `https://chosei-api.example.com` | Pages Functions（OGP 差し込み、フェーズ3）が使う |

4. カスタムドメイン：プロジェクト → カスタムドメイン → `chosei.example.com` を追加
5. backend の `.env.prod` の `CHOSEI_ALLOWED_ORIGIN` と `CHOSEI_PUBLIC_BASE_URL` が `https://chosei.example.com` になっていることを確認

`main` に push するたびに自動でデプロイされます。

### 仕組み

- **SPA のルーティング**：`404.html` を置いていないので、Pages は知らないパス（`/e/xxx/answer` など）にも `index.html` を返します。リロードしても 404 になりません。
- **ヘッダー**：`public/_headers` で CSP（スクリプトは自ドメインのみ、`connect-src` は自ドメインと API、フォントは Google Fonts のみ）、`X-Content-Type-Options`、`Referrer-Policy`、`X-Robots-Tag: noindex` を付けます。`__API_ORIGIN__` はビルド時に `VITE_API_BASE_URL` の origin に置き換わります（`vite.config.ts`）。

### 本番での動作確認（デプロイ後に行う）

1. `https://chosei.example.com/login` を開き、幹事アカウントでログインできる
2. イベントを作り、共有URLをスマホのブラウザ（シークレット）で開く → 合言葉 → 回答できる
3. 回答フォームのURLでリロードしても画面が出る（404 にならない）
4. PC のブラウザの開発者ツールのコンソールに CSP 違反（`Refused to …`）や CORS エラーが出ていない
5. `curl -sI https://chosei.example.com/e/xxxx | grep -i -E 'content-security|x-robots'` でヘッダーが付いている

## 画面の一覧

| パス | 画面 |
| --- | --- |
| `/e/:slug` | 合言葉ゲート（未通過）／イベントトップ（通過後。いい感じの日・確定カード・回答表・ひとこと・写真へのリンク。SSE で自動更新） |
| `/e/:slug/answer` | 回答フォーム（◯△✕・アンケート・ひとこと・PIN。前回の回答を自動で復元） |
| `/e/:slug/answer/done` | 回答完了（紙吹雪・思い出ミニギャラリー） |
| `/e/:slug/edit` | 別のスマホから編集（名前＋PIN） |
| `/e/:slug/gallery` | 写真ギャラリー（拡大・非表示依頼・自分の写真の削除） |
| `/e/:slug/gallery/upload` | 写真投稿 |
| `/login` `/dashboard` `/settings` | 幹事のログイン・イベント一覧・アカウント |
| `/events/new` | イベント作成 |
| `/e/:slug/admin` `/e/:slug/admin/photos` | イベント管理（設定・アンケート・写真） |
| `/dev/ui` | 部品の見本（開発時だけ。本番ビルドには入らない） |

## 黒板ダークモード

OS がダークモードなら、自動で黒板テーマになります。色は `src/styles/tokens.css` の CSS変数（`--c-…`）を `prefers-color-scheme: dark` で差し替えているだけで、部品側は何も変えていません。ポラロイドの白枠・キャプション、写真の上の文字、拡大表示の暗幕は、どちらのテーマでも同じ色のトークン（`frame`、`on-photo`、`on-scrim`）を使います。

## 写真まわりの確認手順（スマホ実機）

1. backend と frontend を `make up` し、`make ip` で出た URL をスマホで開く
2. 合言葉を入れて回答する → 完了画面の「写真をもっと見る」→「写真を投稿する」
3. iPhone の写真（HEIC）を複数選び、キャプションを入れて「◯枚を投稿する」→ 各サムネイルの下に進捗が出る
4. ギャラリーに「処理中…」→ 数秒で「幹事の確認待ち」に変わる
5. PC で管理画面の「写真」タブを開く → 承認待ちの件数バッジが出ている → 「承認」
6. スマホのギャラリーを開き直すと写真が並ぶ。タップで拡大、左右スワイプで前後、「非表示にしてほしい」を押すとすぐ一覧から消え、管理画面の「非表示依頼」に理由つきで出る

## OGP（LINE に貼ったときのカード）

`functions/e/[[path]].ts`（Pages Functions）が、`/e/*` の HTML に `og:title`・`og:description`・`og:image`・`og:url`・`twitter:card` を差し込みます。イベント情報は環境変数 `API_ORIGIN` の `/api/v1/public/events/{slug}` から取り（Cloudflare のキャッシュ5分）、API に届かないときは差し込まずにそのまま返します。参加者の名前やコメントは HTML に一切入りません。

```bash
make preview
curl -s http://localhost:8788/e/<slug> | grep -E 'og:|twitter:'
```

本番で LINE に貼ったときの確認：

1. LINE の自分だけのトーク（Keep メモなど）に `https://chosei.example.com/e/<slug>` を貼る
2. イベント名・「クラスのみんなで日程を決めています…」・方眼のポラロイド画像のカードが出る
3. 日程を確定してから、URL の末尾に `?v=2` などを付けて貼り直すと「◯/◯ に決定！」の画像になる（LINE はカードを長くキャッシュするため）
4. カードが古いままのときは [LINE の Page Poker](https://poker.line.naver.jp/) で URL のキャッシュを消す

## リアルタイム更新

イベントトップを開いているあいだ、`EventSource` で `/api/v1/events/{slug}/stream?gate=…` をつなぎ、誰かが回答・日程確定・写真の承認をすると数秒以内に画面が更新されます（新しい回答の列はふわっと強調）。タブを隠すと切断し、戻ると取り直してつなぎ直します。backend を再起動しても自動でつなぎ直します。proxy・direct のどちらのモードでも動きます。
