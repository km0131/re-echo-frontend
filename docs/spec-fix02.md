# 仕様追記：修正02（データの置き場所・永続化／Cloudflare Turnstile）

この章は `docs/spec.md` の末尾に「12. 修正02」として追記する。backend と frontend の両方に同じ内容を置く。食い違ったら backend 側が正。

---

## 12.1 データの置き場所（Docker の外に出す）

DB と写真は、名前付きボリュームではなく**ホストのディレクトリをそのままマウント（bind mount）**する。
フォルダごとコピーすれば別のマシンへ移せるようにするため。

### ディレクトリ構成（ホスト側）
```
<DATA_ROOT>/
├── db/
│   ├── chosei.db          # SQLite 本体
│   ├── chosei.db-wal      # WAL（本体と同じディレクトリに必ず置く）
│   └── chosei.db-shm
├── photos/
│   ├── originals/{eventId}/{photoId}     # 原本（拡張子なし。形式は中身で判定）
│   └── media/{eventId}/{photoId}_400.webp
│                       {photoId}_1600.webp
└── og/{eventId}.png                      # OGP画像
<BACKUP_ROOT>/                             # バックアップは DATA_ROOT の外に置く
├── db/chosei-YYYYMMDD.db                 # 7世代
└── photos/                               # 週1回の rsync 先
```

| 環境 | DATA_ROOT | BACKUP_ROOT |
| --- | --- | --- |
| 開発（compose.yaml） | リポジトリ直下の `./data`（.gitignore 済み） | `./backups` |
| 本番（compose.prod.yaml） | `/srv/chosei/data` | `/srv/chosei/backups` |

- コンテナ内では常に `/data` にマウントする。アプリは環境変数 `CHOSEI_DATA_DIR=/data` だけを見て、その下のパスを組み立てる。
- SQLite はファイル単体ではなく **`db/` ディレクトリごと**マウントする（ファイル単体のマウントだと WAL・SHM がコンテナ内に作られて消える）。
- コンテナは非rootで動かす。ホストのディレクトリの持ち主とコンテナの UID/GID を `CHOSEI_UID` / `CHOSEI_GID`（既定 10001）でそろえる。
- 写真ファイルはアプリ以外（rsync、エクスプローラー）から見ても、どのイベントのものか分かるよう `{eventId}` ごとのフォルダに分ける。

### 移行手順（README に書く）
1. `make down`（本番は `make prod-down`）
2. `rsync -aH --info=progress2 /srv/chosei/data/ 新しいマシン:/srv/chosei/data/`
3. 新しいマシンで `chown -R 10001:10001 /srv/chosei/data`（UID を変えた場合はその値）
4. `make deploy`

---

## 12.2 Cloudflare Turnstile（ボット対策）

### 対象
| 操作 | API | action 名 |
| --- | --- | --- |
| 幹事ログイン | POST `/auth/login` | `login` |
| 合言葉の入力 | POST `/events/{slug}/gate` | `gate` |
| 回答の新規作成 | POST `/events/{slug}/responses` | `answer` |
| 名前＋PINで編集トークン再発行 | POST `/events/{slug}/responses/recover` | `recover` |
| 写真の投稿 | POST `/events/{slug}/photos` | `upload` |
| 写真へのコメント | POST `/events/{slug}/photos/{id}/comments` | `comment` |

- 幹事権限（A）のリクエストと、回答の更新（PUT。編集トークン必須）には要求しない。
- 既存のレート制限はそのまま残す（Turnstile と二重に守る）。

### 送り方
- フロントはウィジェットで得たトークンを **`X-Turnstile-Token` ヘッダー**で送る（multipart の写真投稿もヘッダーで送る）。
- トークンは1回しか使えず、発行から5分で切れる。送信が終わったら成功・失敗にかかわらずウィジェットをリセットする。

### サーバー側の検証
- `https://challenges.cloudflare.com/turnstile/v0/siteverify` に `secret`、`response`、`remoteip`（`CF-Connecting-IP`）を POST する。タイムアウト 5 秒。
- `success` が true で、`action` が上の表の値と一致し、`hostname` が許可したホスト（`CHOSEI_TURNSTILE_HOSTNAMES`）に含まれるときだけ通す。
- 検証に失敗したリクエストは、レート制限の失敗回数にも数える。

### エラー
| code | HTTP | message |
| --- | --- | --- |
| `turnstile_required` | 400 | ページを読みこみ直してから、もう一度お試しください |
| `turnstile_failed` | 403 | 確認がうまくいきませんでした。もう一度お試しください |
| `turnstile_unavailable` | 503 | 確認サービスにつながりません。少し時間をおいてお試しください |

### 環境変数
```dotenv
# backend
CHOSEI_TURNSTILE_SECRET_KEY=          # 本番は Cloudflare ダッシュボードで発行したもの
CHOSEI_TURNSTILE_HOSTNAMES=chosei.ドメイン,localhost

# frontend
VITE_TURNSTILE_SITE_KEY=
```

開発では Cloudflare のテスト用キーを使う（どのドメインでも、localhost でも動く）。
| 用途 | サイトキー（frontend） | シークレットキー（backend） |
| --- | --- | --- |
| 常に成功 | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| 常に失敗 | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |
| 必ずチェックボックスを出す | `3x00000000000000000000FF` | （成功用と組み合わせる） |

- 本番で `CHOSEI_TURNSTILE_SECRET_KEY` が空、またはテスト用キーのままなら、API は起動しない。
- テスト用キーを使うと siteverify の応答の `hostname` は `example.com` になるため、開発では hostname チェックを `CHOSEI_ENV=dev` のときだけ緩める。

### CSP・CORS
- フロントの CSP に `script-src https://challenges.cloudflare.com` と `frame-src https://challenges.cloudflare.com` を追加する（外部スクリプト禁止の唯一の例外）。
- API の CORS 許可ヘッダーに `X-Turnstile-Token` を追加する。

### 見せ方
- ウィジェットは `appearance: "interaction-only"`（ふだんは何も出ず、怪しいときだけチェックボックスが出る）。
- 出たときは、送信ボタンのすぐ上に置く。テーマは `light`／`dark` をサイトのテーマに合わせる。
