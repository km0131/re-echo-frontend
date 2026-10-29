# フロントエンドの動作チェック用 Docker 環境

フロントの本番は Cloudflare Pages なので Docker は使いません。この Docker 環境は**ローカルでの動作チェック専用**です。

## 1. ゴール

- `make up` だけで `http://localhost:5173` に開発サーバーが立ち上がり、保存すると自動で画面が更新される
- 同じ Wi-Fi のスマホから `http://<PCのIP>:5173` で開いて、実機で確認できる（iPhone からの写真投稿も試せる）
- `make preview` で、本番と同じビルド＋Pages Functions（OGP差し込み）を手元で確認できる
- ローカルのPCに Node を入れていなくても動く
- Mac（Apple Silicon）、Windows（WSL2）、Linux で動く

## 2. API との接続

API は **backend リポジトリの Docker**（`http://localhost:8080`）を使います。リポジトリが別なので、2つのコンテナはホストのポート経由でつなぎます。

| モード | `VITE_API_BASE_URL` | 経路 | 用途 |
| --- | --- | --- | --- |
| **proxy（既定）** | `/api/v1` | ブラウザ → Vite（5173）→ `VITE_PROXY_TARGET` → backend（8080） | 普段の開発。スマホ実機でも同じURLで API に届く |
| **direct** | `http://localhost:8080/api/v1` | ブラウザ → backend（8080）を直接 | 本番と同じ「別オリジン」の状態で CORS を確認する |

- `VITE_PROXY_TARGET` の既定値は `http://host.docker.internal:8080`。Linux でも名前が引けるよう、compose に `extra_hosts: ["host.docker.internal:host-gateway"]` を付ける。
- proxy の対象は `/api`、`/media`、`/og`。SSE（`/api/v1/events/{slug}/stream`）がプロキシ経由で途切れないことを確認する。
- backend が起動していないときは、画面に「API に接続できません。backend で make up してください」と分かるように出す（開発時のみ）。

## 3. 作るファイル

| ファイル | 内容 |
| --- | --- |
| `Dockerfile` | `dev` ステージ（`node:22-bookworm-slim`）。preview も同じイメージを使う |
| `compose.yaml` | 4章 |
| `.dockerignore` | `node_modules/`、`dist/`、`.wrangler/`、`.env*`、`.git/` |
| `vite.config.ts` | `server` の設定（5章） |
| `.env.example` | `VITE_API_BASE_URL`、`VITE_PROXY_TARGET`、`VITE_USE_POLLING` の見本 |
| `Makefile` | 6章 |
| `README.md` | 「Dockerでの動作チェック」の節（backend を先に起動すること、スマホ確認、ファイアウォールの注意） |

## 4. compose.yaml

プロジェクト名 `chosei-front`。

| サービス | 起動条件 | ポート | 内容 |
| --- | --- | --- | --- |
| `web` | 常に | 5173 | `npm install` → `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort` |
| `preview` | `--profile preview` | 8788 | `npm install` → `npm run build` → `npx wrangler pages dev dist --ip 0.0.0.0 --port 8788 --binding API_ORIGIN=$VITE_PROXY_TARGET`。本番と同じビルドと Pages Functions を確認する |

- ソースは `.:/app` でマウントし、`node_modules` は名前付きボリューム（ホスト側と混ざらないように）。
- `preview` では `VITE_API_BASE_URL=http://localhost:8080/api/v1`（direct モード）でビルドする。
- 環境変数は `.env` で上書きできる。`VITE_USE_POLLING=true` でファイル監視をポーリングに切り替えられる（Windows 向け）。
- wrangler は `devDependencies` に入れる（`npx` が毎回ダウンロードしないように）。

## 5. vite.config.ts の server 設定

- `host: true`
- `watch.usePolling` を `VITE_USE_POLLING` で切り替え
- `proxy`：`/api`、`/media`、`/og` を `VITE_PROXY_TARGET`（未設定なら `http://localhost:8080`）へ。`changeOrigin: true`

## 6. Makefile

| コマンド | 内容 |
| --- | --- |
| `make up` | 動作チェック用に起動（proxy モード） |
| `make up-direct` | direct モードで起動（CORS の確認用） |
| `make down` | 停止 |
| `make logs` | ログを追う |
| `make check` | コンテナ内で `npm run build` と `npm run lint` |
| `make preview` | 本番と同じビルド＋Pages Functions（http://localhost:8788） |
| `make ip` | スマホから開くためのPCのIPアドレスとURLを表示 |
| `make clean` | コンテナと `node_modules` ボリュームを削除 |

`make` が使えない環境のために、README には同じ操作の `docker compose` コマンドも併記する。

> スマホから proxy モードで開く場合、backend の `CHOSEI_ALLOWED_ORIGIN` を変える必要はありません（同一オリジンになるため）。direct モードをスマホで試すときだけ、backend の `.env` に `http://<PCのIP>:5173` を足します。

## 7. 完了条件（ステップ F1-2 で確認すること）

1. backend を `make up` した状態で、まっさらな状態から `make up` で `http://localhost:5173` に見本ページが出る
2. `curl http://localhost:5173/api/v1/public/events/xxx`（プロキシ経由）が backend に届く。存在しない slug なので 404 だが、backend のエラー形式（`{ "error": … }`）で返ればよい
3. React のファイルを保存するとブラウザが自動更新される
4. `make up-direct` で、ブラウザから直接 `http://localhost:8080` を呼べる（CORS エラーが出ない）
5. backend を止めた状態で開くと、接続できない旨が画面に出る
6. `make check` が通る
