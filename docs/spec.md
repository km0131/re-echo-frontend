# 仕様（基本設計）

仕様書「同窓会日程調整アプリ 仕様書」（2026-10-28版）を、実装に必要な形にまとめたものです。

> このファイルは `backend` と `frontend` の両方のリポジトリに同じものを置きます。**API の正は backend 側**です。backend で API を変えたら、同じ内容を frontend 側にもコピーしてください。

## 1. 利用者と権限

| 主体 | 認証手段 | できること |
| --- | --- | --- |
| 幹事（オーナー） | ID＋パスワードでログイン（セッション） | イベント作成、全設定、日程確定、写真承認、管理URL再発行、イベント削除 |
| 共同幹事 | 管理URL（`/e/{slug}/admin?key=…`）のみ | イベント設定、日程確定、写真承認（削除と管理URL再発行はできない） |
| 参加者 | 合言葉 → 合言葉通過トークン | 閲覧、回答、写真投稿、自分の回答・写真の編集と削除 |
| 未認証の訪問者 | なし | OGP、イベント名、合言葉入力画面のみ |

- 幹事アカウントは自分1人の想定。**登録画面は作らない**。CLI `chosei-admin create-user` で作る。
- 共同幹事は管理URLで入るため、ダッシュボードとアカウント設定は使えない。

## 2. 認証の詳細

### 幹事セッション
| 項目 | 値 |
| --- | --- |
| 有効期限 | 最終利用から30日（使うたびに延長） |
| 絶対期限 | ログインから180日 |
| 延長の書き込み | `last_used_at` が1日以上前のときだけ更新（SSDの書き込み削減） |
| 送り方 | LocalStorage に保存し `Authorization: Bearer <token>` で送る |
| DB保存 | トークンの SHA-256 のみ |

- パスワード変更時は現在のパスワードを確認し、他の全セッションを無効化する。
- 「他の全端末からログアウト」できる。
- ログインの成功・失敗をすべて `login_events` に記録する。ダッシュボードに「前回のログイン：日時／方式／端末」、設定画面に直近20件を出す。IPは90日後に削除する。

### 参加者側のトークン
| トークン | 発行 | 期限・失効 |
| --- | --- | --- |
| 合言葉通過トークン（G） | 合言葉が正しいとき。イベント単位で保存し、2回目以降は入力を省略 | イベント終了日（`ends_on`）の30日後まで。合言葉を変えたら即無効（`passphrase_version` で判定） |
| 回答の編集トークン（E） | 回答を送信したとき。同じ端末なら回答を自動復元 | イベントがある限り有効 |
| 4桁PIN | 回答時に設定（フェーズ2）。別端末で「名前＋PIN」から編集トークンを再発行 | argon2id で保存。5回失敗で15分ロック |
| 管理キー（A） | イベント作成時に発行 | 期限なし。再発行すると旧キーは即無効 |

トークンはすべて `crypto/rand` の32バイトを base64url にしたもの。slug は推測されにくい英数字10文字以上（例：`k7Qm2xPa9r`）。

### 認証の略号（API一覧で使用）
S＝幹事セッション、A＝幹事権限（セッションのオーナー、または管理キー）、G＝合言葉通過トークン、E＝回答の編集トークン、－＝不要。

管理キーとGトークンは同時に送ることがあるため、ヘッダーを分ける。

| トークン | ヘッダー |
| --- | --- |
| S | `Authorization: Bearer <token>` |
| A（管理キー） | `X-Admin-Key: <key>` |
| G | `X-Gate-Token: <token>` |
| E | `X-Edit-Token: <token>` |

## 3. フェーズと機能

各フェーズの終わりに本番へデプロイし、実際に使える状態にする。

### フェーズ1：MVP
- 幹事アカウント（ID＋パスワード）、セッション、ログイン履歴
- イベント作成・編集（イベント名、説明文、候補日時の追加・編集・並べ替え、合言葉、終了日）
- 共有URL `/e/{slug}` と管理URLの発行
- 合言葉ゲート（通過済み端末は省略）
- 回答（名前、候補日ごとの ◯△✕、ひとことコメント）
- 集計表示（◯△✕ のカウントとマトリクス表）
- LocalStorage による回答の自動復元と再編集
- スマホ対応

### フェーズ2：便利機能
- ベスト日程の自動判定（上位3日をハイライト）
- 4桁PINによる別端末からの回答編集
- 追加アンケート（予算、二次会など。設問はイベントごとに定義）
- LINE共有用テキストのコピー
- 日程確定と「開催まであと◯日」のカウントダウン

### フェーズ3：こだわり機能
- 写真アップロード（幹事・参加者）、承認、ギャラリー
- アクセスごとに変わるランダムヘッダー写真
- 回答完了画面の紙吹雪と思い出ミニギャラリー
- OGP画像の動的生成
- リアルタイム更新（SSE）
- レトロUIの作り込み（ダークモードの黒板テーマを含む）

## 4. 画面一覧

| パス | 画面 | フェーズ | 画面デザイン |
| --- | --- | --- | --- |
| `/e/:slug` | 合言葉ゲート（未通過時） | 1 | あり（Main） |
| `/e/:slug` | イベントトップ（通過後） | 1〜3 | あり（Top） |
| `/e/:slug/answer` | 回答フォーム | 1〜2 | あり（Answer） |
| `/e/:slug/answer/done` | 回答完了 | 1（演出は3） | あり（Done） |
| `/e/:slug/edit` | 別端末から編集（名前＋PIN） | 2 | なし |
| `/e/:slug/gallery` | 写真ギャラリー | 3 | あり（Gallery） |
| `/e/:slug/gallery/upload` | 写真投稿 | 3 | なし |
| `/login` | 幹事ログイン | 1 | あり（Login） |
| `/dashboard` | ダッシュボード | 1 | あり（Dashboard） |
| `/events/new` | イベント作成 | 1 | なし |
| `/e/:slug/admin` | イベント管理（タブ：設定／アンケート／写真） | 1〜3 | あり（Admin） |
| `/e/:slug/admin/photos` | 写真管理（Adminの「写真」タブ） | 3 | なし |
| `/settings` | アカウント設定 | 1 | なし |

「画面デザインなし」の画面は、`docs/design.md` の部品ルールで組み立てる。

## 5. API

ベースURL：`https://chosei-api.ドメイン/api/v1`（開発時 `http://localhost:8080/api/v1`）。JSONでやりとりする。

### 5.1 幹事アカウント
| メソッド | パス | 認証 | 内容 | フェーズ |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | － | ID＋パスワードでログイン | 1 |
| POST | `/auth/logout` | S | このセッションを終了 | 1 |
| GET | `/auth/me` | S | 自分の情報と前回のログイン | 1 |
| PUT | `/me/password` | S | パスワード変更（他セッション無効化） | 1 |
| DELETE | `/me/sessions` | S | 他の全端末からログアウト | 1 |
| GET | `/me/login-events` | S | ログイン履歴（直近20件） | 1 |

```jsonc
// POST /auth/login
→ { "loginId": "morimori", "password": "…" }
← { "token": "…", "user": { "id": "01J…", "loginId": "morimori", "displayName": "もりもり" } }

// GET /auth/me
← { "user": {…}, "previousLogin": { "at": "2026-10-26T13:14:00Z", "method": "password", "device": "iPhone Safari" } | null }
```
`device` はUser-Agentから「iPhone Safari」「Windows Chrome」程度に要約する（簡易パーサーでよい）。

### 5.2 イベント（幹事）
| メソッド | パス | 認証 | 内容 | フェーズ |
| --- | --- | --- | --- | --- |
| GET | `/events` | S | 自分のイベント一覧 | 1 |
| POST | `/events` | S | イベント作成（管理キーを返す） | 1 |
| GET・PATCH | `/events/{slug}/admin` | A | 管理用の詳細取得・基本設定の更新 | 1 |
| PUT | `/events/{slug}/candidates` | A | 候補日時の一括更新 | 1 |
| PUT | `/events/{slug}/passphrase` | A | 合言葉の変更（通過トークンを全失効） | 1 |
| POST | `/events/{slug}/admin-key/rotate` | S（オーナー） | 管理URLの再発行 | 1 |
| DELETE | `/events/{slug}` | S（オーナー） | イベント削除 | 1 |
| PUT | `/events/{slug}/survey` | A | アンケート設問の定義 | 2 |
| POST・DELETE | `/events/{slug}/confirm` | A | 日程の確定・取り消し | 2 |
| GET | `/events/{slug}/share-text` | A | LINE共有用テキスト | 2 |

```jsonc
// POST /events
→ { "title": "3年2組 年末同窓会", "description": "…", "passphrase": "…", "endsOn": "2026-12-31",
    "candidates": [ { "startsAt": "2026-12-29T10:00:00Z" } ] }
← { "slug": "k7Qm2xPa9r", "adminKey": "…", "shareUrl": "https://chosei.ドメイン/e/k7Qm2xPa9r",
    "adminUrl": "https://chosei.ドメイン/e/k7Qm2xPa9r/admin?key=…" }
// adminKey は作成時と再発行時にしか返さない（DBにはハッシュのみ）

// GET /events (一覧の1件)
{ "slug": "…", "title": "…", "status": "open" | "confirmed" | "ended",
  "responseCount": 24, "candidateCount": 4, "pendingPhotoCount": 3,
  "confirmed": { "startsAt": "…", "label": "1/3（日）18:00〜" } | null, "endsOn": "…",
  "deletionSuggested": false }   // 終了から1年たったら true（フェーズ3）
// status: confirmed_candidate_id があれば confirmed、ends_on を過ぎていれば ended、それ以外 open
```
`PUT /candidates` は配列の順番を `sort_order` として保存する。既存IDを含む項目は更新、含まない項目は追加、送られなかった既存候補は削除（その候補への回答も削除）。

### 5.3 参加者
| メソッド | パス | 認証 | 内容 | フェーズ |
| --- | --- | --- | --- | --- |
| GET | `/public/events/{slug}` | － | イベント名、ゲート写真のキャプション、年、公開用写真URL、OGP画像URL（フェーズ3） | 1 |
| POST | `/events/{slug}/gate` | － | 合言葉を検証し、通過トークンを発行 | 1 |
| GET | `/events/{slug}` | G | イベント詳細、集計、ベスト日程 | 1 |
| POST | `/events/{slug}/responses` | G | 回答の新規作成（編集トークンを返す） | 1 |
| GET・PUT・DELETE | `/events/{slug}/responses/{id}` | G＋E | 自分の回答の取得・更新・削除 | 1 |
| POST | `/events/{slug}/responses/recover` | G | 名前＋PINで編集トークンを再発行 | 2 |
| GET | `/events/{slug}/stream` | G（クエリ `?gate=`） | 集計更新のSSE | 3 |

```jsonc
// GET /events/{slug}
← {
  "title": "…", "description": "…", "endsOn": "…",
  "candidates": [ { "id": "…", "startsAt": "…", "label": "12/29（火）19:00〜",
                    "counts": { "yes": 18, "maybe": 4, "no": 2 }, "score": 40 } ],
  "responses": [ { "id": "…", "name": "あおい", "comment": "…", "hasPin": true,   // hasPin はフェーズ2
                   "choices": { "<candidateId>": "yes" | "maybe" | "no" } } ],
  "best": [ "<candidateId>", "…" ],          // フェーズ2。上位3件まで
  "confirmed": { "candidateId": "…", "daysLeft": 62 } | null,   // フェーズ2
  "survey": [ … ]                            // フェーズ2
}

// POST /events/{slug}/responses
→ { "name": "あおい", "comment": "…", "choices": { "<candidateId>": "yes" }, "pin": "1234", "survey": [ … ] }
← { "id": "…", "editToken": "…" }
// name がイベント内で重複したら 409 { code: "name_taken", message: "その名前はもう使われています…" }
// 全候補に回答が必須（未回答の候補があれば 400）
```
`label` はサーバー側で Asia/Tokyo に変換して作る（形式：`M/D（曜）HH:MM〜`）。

### 5.4 写真（フェーズ3）
| メソッド | パス | 認証 | 内容 |
| --- | --- | --- | --- |
| GET | `/events/{slug}/photos` | G | 公開済み写真の一覧（サムネイルURL） |
| POST | `/events/{slug}/photos` | G＋E、またはA | アップロード（multipart。変換は非同期） |
| DELETE | `/events/{slug}/photos/{id}` | 投稿者のE、またはA | 削除 |
| POST | `/events/{slug}/photos/{id}/hide-request` | G | 非表示依頼 |
| PATCH | `/events/{slug}/photos/{id}` | A | 承認、公開範囲、並び順、キャプション |
| GET | `/events/{slug}/admin/photos` | A | 管理画面用の全写真（承認待ち・非表示・下書き・非表示依頼を含む） |
| GET | `/media/{photoId}/{size}` | 区分による | 画像配信（public は認証不要でキャッシュ可、members は G が必要）。**`/api/v1` の外（API と同じ origin の直下）** |
| GET | `/og/{slug}.png` | － | OGP画像。**`/api/v1` の外** |

`/media` は `<img>` から読むためヘッダーを付けられない。members 画像は `?gate=<token>` のクエリでも受け付ける。

## 6. ベスト日程の判定（フェーズ2）

1. スコア ＝ ◯×2 ＋ △×1
2. 同点なら ◯ の数が多い方
3. それでも同じなら ✕ の数が少ない方
4. それでも同じなら `sort_order` が小さい方

上位3件を返す。回答が0件のときは空配列。集計は保存せず、リクエストのたびに `response_choices` から計算する。

## 7. テーブル定義

SQLite（WALモード、`foreign_keys=ON`、`busy_timeout=5000`）。IDはULID（TEXT）、日時はUTCのISO 8601文字列。

### アカウント・認証
| テーブル | 主なカラム |
| --- | --- |
| `users` | id, login_id（一意）, password_hash, display_name, created_at |
| `sessions` | id（トークンのSHA-256）, user_id, created_at, last_used_at, expires_at, absolute_expires_at, user_agent, ip, revoked_at |
| `login_events` | id, user_id（失敗時NULL可）, login_id_tried, success, method, ip, user_agent, created_at |

### イベント
| テーブル | 主なカラム |
| --- | --- |
| `events` | id, slug（一意）, title, description, owner_id, passphrase_hash, passphrase_version, admin_key_hash, ends_on, confirmed_candidate_id, photo_approval（manual／auto）, photo_limit_per_person, photo_quota_mb, class_size（任意。回答率バー用）, gate_caption（ゲート写真のキャプション）, created_at, updated_at |
| `candidates` | id, event_id, starts_at, label, sort_order |
| `responses` | id, event_id, name（イベント内で一意）, comment, pin_hash, edit_token_hash, pin_failed_count, pin_locked_until, created_at, updated_at |
| `response_choices` | response_id, candidate_id, choice（yes／maybe／no）。主キーは (response_id, candidate_id) |
| `gate_tokens` | token_hash, event_id, passphrase_version, expires_at, created_at |

### アンケート（フェーズ2）
| テーブル | 主なカラム |
| --- | --- |
| `survey_questions` | id, event_id, text, type（single／multi／text）, sort_order |
| `survey_options` | id, question_id, text, sort_order |
| `survey_answers` | response_id, question_id, option_id（選択式）, text（自由記述） |

### 写真（フェーズ3）
| テーブル | 主なカラム |
| --- | --- |
| `photos` | id, event_id, uploader_response_id（幹事はNULL）, uploader_user_id, uploader_name, visibility（public／members／draft）, status（processing／pending／approved／rejected／hidden／failed）, mime, caption, width, height, bytes, sort_order, created_at, updated_at |
| `photo_hide_requests` | id, photo_id, reason, created_at, resolved_at |
| `photo_jobs` | id, photo_id, state（queued／running／done／failed）, attempts, error, updated_at |

外部キーは `ON DELETE CASCADE`。テーブルはフェーズごとのマイグレーションファイルで追加する（例：`0001_init.sql`、`0002_survey.sql`、`0003_photos.sql`）。

## 8. 写真機能（フェーズ3）

### 公開区分
| 区分 | 見られる人 | 用途 | 設定できる人 |
| --- | --- | --- | --- |
| public | 誰でも（LINEのクローラー含む） | OGP、ゲート背景。顔が写っていない写真に限る | 幹事のみ |
| members | 合言葉を通過した人 | ギャラリー、ランダムヘッダー、回答完了画面 | 幹事、参加者の投稿（承認後） |
| draft | 幹事のみ | 公開前の下書き | 幹事 |

参加者の投稿は members より外に出さない。

### 投稿から公開まで
1. 参加者が投稿（条件：合言葉通過済み、かつ回答済み）
2. `processing` にして変換ジョブを登録
3. ワーカーが EXIF削除（GPS含む）、向き補正、HEIC→WebP変換、サムネイル（400px）と表示用（1600px）を生成。**同時に1件ずつ**処理する
4. 承認制なら `pending`、自動公開なら `approved`
5. 幹事が承認すると members に公開。public に昇格できるのは幹事だけ

### 上限（イベント設定で変更可）
承認制／1人20枚／1枚15MB／イベント全体3GB／JPEG・PNG・HEIC・WebP

- 削除できるのは投稿者本人（E）と幹事。
- 「この写真を非表示にしてほしい」が押されたら即 `hidden` にし、幹事が確認する。
- 一覧はサムネイルだけ返し、拡大時に初めて表示用サイズを読み込む（自宅回線の上り節約）。
- OGP画像（1200×630）は、イベント名か public 写真が変わったときに1枚生成して保存する。

## 9. 非機能要件・運用

- 同時接続は数十人程度。SSEは1イベントにつき1つのブロードキャスト用goroutine。
- public 画像と OGP 画像には `Cache-Control: public, max-age=86400`。members 画像は `private`。
- SQLite は毎日 `.backup` でスナップショット、7世代保持。写真は週1回別ディスクへ同期。復旧手順を README に書く。
- API はラズパイ上の Docker コンテナで常駐し、`restart: unless-stopped` で自動再起動する。ログは `log/slog` で標準出力に出し、Docker の json-file ドライバーでローテーションする（詳細は backend の `docs/docker.md`）。
- `/healthz` を用意し、外部の無料監視サービスから5分ごとに叩く。
- イベント終了から1年たったら、削除を幹事に提案する（自動削除はしない）。

## 10. 仕様書から補ったこと

画面デザインを反映するため、仕様書にない次の点を追加している。

- `events.class_size`（任意）：ダッシュボードの「回答 24 / 38人」と回答率バーに使う
- `events.gate_caption`：ゲート画面のポラロイドのキャプション（初期値「あの頃の放課後」）
- 英字キャッチ `CLASS REUNION {年}` の年は `ends_on` の年を使う
- マトリクス表の向きは画面デザインに合わせ、**行＝候補日（左列固定）、列＝名前（横スクロール）**とする

## 11. 未決事項（実装中に聞いてよい）
- ドメイン名（`chosei` か `reunion` か）。コード上は環境変数で切り替えられるようにしておく
- ラズパイのストレージ容量と、写真の全体上限
- バックアップ先のディスク

## 12. API の詳細（実装に合わせた形）

5章の表を補う、実際のリクエスト・レスポンスの形です。エラーはすべて `{ "error": { "code", "message" } }`。

### 12.1 共通
- 日時はすべて UTC の ISO 8601（例 `2026-12-29T10:00:00Z`）。日付は `YYYY-MM-DD`（日本時間の日付）。
- `204` のときはボディなし。
- 主なエラーコード

| HTTP | code | 意味 |
| --- | --- | --- |
| 400 | `invalid_json` ほか入力ごとのコード | 入力の誤り（`message` をそのまま出してよい） |
| 401 | `unauthorized` | 幹事セッションがない・切れた → `/login` へ |
| 401 | `login_failed` | IDかパスワードがちがう |
| 401 | `admin_required` | 管理キーが無効（再発行された） |
| 401 | `passphrase_invalid` | 合言葉がちがう |
| 401 | `gate_required` | 通過トークンがない・合言葉が変わった・期限切れ → ゲートへ戻す |
| 403 | `owner_only` | 共同幹事にはできない操作 |
| 403 | `forbidden` | 別の幹事のイベント |
| 403 | `edit_forbidden` | 回答の編集トークンがちがう |
| 404 | `event_not_found` / `response_not_found` / `not_found` | 見つからない |
| 409 | `name_taken` | 名前の重複 |
| 429 | `too_many_attempts` | 回数制限（ログイン・合言葉） |

### 12.2 幹事アカウント
```jsonc
// POST /auth/logout → 204
// PUT /me/password
→ { "currentPassword": "…", "newPassword": "…（8文字以上）" }   // → 204。他の全セッションは無効
// 400 password_invalid（現在のパスワード違い）/ password_too_short
// DELETE /me/sessions → { "revoked": 2 }
// GET /me/login-events
← { "events": [ { "at": "…", "method": "password", "device": "iPhone Safari", "success": true, "ip": "203.0.113.1" | null } ] }
```
`method` は現在 `password` のみ（画面では「パスワード」と表示）。

### 12.3 イベント（幹事）
```jsonc
// POST /events（spec 5.2 の項目に加えて任意で）
→ { …, "gateCaption": "あの頃の放課後", "classSize": 38 }
// 201 ← { "slug", "adminKey", "shareUrl", "adminUrl" }

// GET /events
← { "events": [ { "slug", "title", "status", "responseCount", "candidateCount", "pendingPhotoCount",
                  "classSize": 38 | null, "confirmed": { "candidateId", "startsAt", "label" } | null,
                  "endsOn", "createdAt" } ] }   // 新しい順

// GET /events/{slug}/admin、PATCH の結果も同じ形
← { "slug", "title", "description", "endsOn", "gateCaption", "classSize": 38 | null,
    "status": "open" | "confirmed" | "ended", "role": "owner" | "coadmin", "shareUrl",
    "responseCount": 24, "photoApproval": "manual", "photoLimitPerPerson": 20, "photoQuotaMb": 3072,
    "candidates": [ { "id", "startsAt", "label" } ] }

// PATCH /events/{slug}/admin（送った項目だけ変わる。classSize は null で未設定に戻す）
→ { "title"?, "description"?, "endsOn"?, "gateCaption"?, "classSize"? }

// PUT /events/{slug}/candidates
→ { "candidates": [ { "id": "既存のID（省略で追加）", "startsAt": "…" } ] }
← { "candidates": [ { "id", "startsAt", "label" } ] }

// PUT /events/{slug}/passphrase
→ { "passphrase": "…" }   // → 204

// POST /events/{slug}/admin-key/rotate（オーナーのみ）
← { "adminKey": "…", "adminUrl": "…" }

// DELETE /events/{slug}（オーナーのみ）→ 204
```

### 12.4 参加者
```jsonc
// GET /public/events/{slug}
← { "slug", "title", "gateCaption", "year": 2026, "publicPhotoUrl": null }

// POST /events/{slug}/gate
→ { "passphrase": "…" }
← { "gateToken": "…", "expiresAt": "…" }   // 401 passphrase_invalid / 429 too_many_attempts

// GET /events/{slug}（spec 5.3 の形に加えて）
← { "slug", "year", …, "responses": [ { "id", "name", "comment", "choices", "createdAt", "updatedAt" } ] }
// responses は回答の古い順。ひとことを新しい順に出すときは createdAt で並べ替える

// POST /events/{slug}/responses
→ { "name": "あおい", "comment": "…", "choices": { "<candidateId>": "yes" } }
← 201 { "id", "editToken" }
// 400 choices_incomplete（未回答の候補）/ candidate_not_found（候補日が変わった）/ name_required / name_too_long（20文字）/ comment_too_long（200文字）
// 409 name_taken

// GET・PUT /events/{slug}/responses/{id}（X-Gate-Token と X-Edit-Token）
← { "id", "name", "comment", "choices", "createdAt", "updatedAt" }   // PUT の入力は POST と同じ
// DELETE → 204
```

### 12.5 フェーズ2で追加・変わったもの
```jsonc
// GET /events/{slug}（参加者）
← { …,
    "candidates": [ { "id", "startsAt", "label", "counts": { "yes", "maybe", "no" }, "score": 40 } ],
    "responses": [ { …, "hasPin": true } ],
    "best": [ "<candidateId>", … ],     // 上位3件まで。回答0件なら []
    "confirmed": { "candidateId", "startsAt", "label", "daysLeft": 62 } | null,  // daysLeft は日本時間の日付で数える。当日0、過ぎたら負
    "survey": [ { "id", "text", "type": "single" | "multi" | "text",
                  "options": [ { "id", "text", "count": 3 } ],
                  "answers": [ { "name": "あおい", "text": "…" } ],   // text のときだけ
                  "answeredCount": 5 } ] }

// GET /events/{slug}/admin（PATCH・confirm・survey の結果も同じ形）
← { …, "candidates": [ { "id", "startsAt", "label", "counts", "score" } ], "best": [ … ],
       "confirmed": { … } | null, "survey": [ … ] }

// POST /events/{slug}/confirm  → { "candidateId": "…" }   ← 管理用詳細
// DELETE /events/{slug}/confirm                         ← 管理用詳細
// PUT /events/{slug}/candidates で確定した候補日を消そうとすると 409 candidate_confirmed

// PUT /events/{slug}/survey
→ { "questions": [ { "id"?: "既存のID", "text": "予算はどれくらい？", "type": "single",
                     "options": [ { "id"?: "既存のID", "text": "〜3,000円" } ] } ] }   // text のときは options 不要
// 送らなかった設問・選択肢は削除（その回答も消える）。設問は10個、選択肢は2〜10個
// 400 options_required / survey_type_invalid / survey_text_required / question_not_found

// GET /events/{slug}/share-text
← { "text": "【3年2組 年末同窓会】日程調整中です！\n…" }

// POST・PUT /events/{slug}/responses（追加の項目。どちらも任意）
→ { …, "pin": "1234",
       "survey": [ { "questionId": "…", "optionIds": [ "…" ] }, { "questionId": "…", "text": "…" } ] }
// PUT で pin・survey を省略したときは変えない。survey を送ると全部置き換え
// 400 pin_invalid（4桁の数字でない）/ survey_single_choice（single で2つ以上）/ option_not_found

// GET /events/{slug}/responses/{id} は自分の "survey" も返す（回答の復元用）

// POST /events/{slug}/responses/recover（G）
→ { "name": "あおい", "pin": "1234" }
← { "id", "editToken" }   // 旧トークンは無効になる
// 400 pin_not_set / 401 pin_invalid / 404 response_not_found / 429 pin_locked（5回失敗で15分）
```

### 12.6 フェーズ3で追加・変わったもの
```jsonc
// GET /public/events/{slug}
← { …, "publicPhotoUrl": "/media/<photoId>/large" | null, "ogImageUrl": "/og/k7Qm2xPa9r.png?v=1793204690" }
// URL は API と同じ origin のパス。フロントは API の origin を前に付ける

// GET /events（一覧の1件）
{ …, "pendingPhotoCount": 3, "photoCount": 142, "deletionSuggested": false }   // 終了日から1年たったら true

// POST /events/{slug}/photos（multipart/form-data）。G＋E（回答済みの参加者）または A
//   photo: ファイル（複数可、1回10枚まで）／ caption: photo と同じ順番（任意、40文字）
//   visibility: public | members | draft（幹事のみ。参加者は常に members）
← 201 { "photos": [ { "id", "status": "processing", "caption" } ] }
// 403 answer_required（未回答）/ 415 unsupported_type（JPEG・PNG・HEIC・WebP 以外。中身で判定）
// 413 file_too_large（15MB）/ 413 quota_exceeded（イベント全体）/ 400 photo_limit（1人の枚数）

// GET /events/{slug}/photos（G。X-Edit-Token を付けると自分の処理中・承認待ちも入る）
← { "photos": [ { "id", "caption", "width", "height",
                  "thumbUrl": "/media/<id>/thumb" | null, "largeUrl": "/media/<id>/large" | null,   // 処理中は null
                  "uploaderName", "mine": true, "status", "visibility", "createdAt" } ],
    "answered": true,
    "limits": { "perPerson": 20, "used": 3, "remaining": 17 } | null }   // 回答者だけ
// 並び順：sort_order → 新しい順

// GET /events/{slug}/admin/photos（A）
← { "photos": [ { …上と同じ, "byParticipant": true, "sortOrder": 0, "bytes": 123456,
                  "hideRequests": [ { "reason", "createdAt", "resolvedAt": null } ] } ] }

// PATCH /events/{slug}/photos/{id}（A）
→ { "status"?: "approved" | "rejected" | "hidden" | "pending", "visibility"?: "public" | "members" | "draft",
    "sortOrder"?: 3, "caption"?: "…" }
← 写真1件（参加者向けの形）
// 400 public_not_allowed（参加者の写真は public にできない）/ 409 photo_processing（変換中）
// status を変えると、未対応の非表示依頼は対応済みになる（「非表示のままにする」= hidden、「元に戻す」= approved）

// POST /events/{slug}/photos/{id}/hide-request（G）→ { "reason": "…" }  → 204（すぐ hidden になる）
// DELETE /events/{slug}/photos/{id}（投稿者の G＋E、または A）→ 204。403 photo_forbidden

// GET /media/{photoId}/thumb | large
//   public かつ approved：認証不要、Cache-Control: public, max-age=86400
//   members かつ approved：G（X-Gate-Token か ?gate=）または A、Cache-Control: private
//   それ以外（承認待ち・非表示・下書き）：A のみ（<img> ではヘッダーを付けられないので、管理画面は fetch して blob URL で表示する）
// 中身は WebP（thumb は長い辺400px、large は1600px）。EXIF・GPS はすべて削除済み

// GET /events/{slug}/stream?gate=<通過トークン>（SSE）
// event: changed / data: {"kind":"responses"|"confirm"|"photos"}   … 何が変わったかだけ。中身は取り直す
// event: bye … サーバーの停止。EventSource は retry: 3000 で自動的につなぎ直す
// 30秒ごとに ": ping" のコメント行
```

## 13. 権限の表（全API × 4者）

`internal/server/permission_test.go` で同じ表をテストしています。数字は HTTP ステータス（2xx はできる）。参加者は「合言葉通過＋自分の回答の編集トークン」を持っている状態です。

| API | パス | オーナー | 共同幹事 | 参加者 | 未認証 |
| --- | --- | --- | --- | --- | --- |
| 自分の情報 | `GET /auth/me` | 200 | 401 | 401 | 401 |
| ログイン履歴 | `GET /me/login-events` | 200 | 401 | 401 | 401 |
| パスワード変更 | `PUT /me/password` | 204 | 401 | 401 | 401 |
| 他の端末をログアウト | `DELETE /me/sessions` | 200 | 401 | 401 | 401 |
| ログアウト | `POST /auth/logout` | 204 | 401 | 401 | 401 |
| イベント一覧 | `GET /events` | 200 | 401 | 401 | 401 |
| イベント作成 | `POST /events` | 201 | 401 | 401 | 401 |
| 管理用の詳細・更新 | `GET・PATCH /events/{slug}/admin` | 200 | 200 | 401 | 401 |
| 候補日の更新 | `PUT /events/{slug}/candidates` | 200 | 200 | 401 | 401 |
| 合言葉の変更 | `PUT /events/{slug}/passphrase` | 204 | 204 | 401 | 401 |
| アンケートの定義 | `PUT /events/{slug}/survey` | 200 | 200 | 401 | 401 |
| 日程の確定・取り消し | `POST・DELETE /events/{slug}/confirm` | 200 | 200 | 401 | 401 |
| 共有テキスト | `GET /events/{slug}/share-text` | 200 | 200 | 401 | 401 |
| 写真の管理一覧 | `GET /events/{slug}/admin/photos` | 200 | 200 | 401 | 401 |
| 写真の承認など | `PATCH /events/{slug}/photos/{id}` | 200 | 200 | 401 | 401 |
| 管理URLの再発行 | `POST /events/{slug}/admin-key/rotate` | 200 | 403 | 401 | 401 |
| イベント削除 | `DELETE /events/{slug}` | 204 | 403 | 401 | 401 |
| 公開情報 | `GET /public/events/{slug}` | 200 | 200 | 200 | 200 |
| 合言葉ゲート | `POST /events/{slug}/gate` | 200 | 200 | 200 | 200 |
| イベント詳細 | `GET /events/{slug}` | 401 | 401 | 200 | 401 |
| 回答の作成 | `POST /events/{slug}/responses` | 401 | 401 | 201 | 401 |
| PINで再発行 | `POST /events/{slug}/responses/recover` | 401 | 401 | 200 | 401 |
| 自分の回答の取得・更新・削除 | `GET・PUT・DELETE /events/{slug}/responses/{id}` | 401 | 401 | 2xx | 401 |
| 写真の一覧 | `GET /events/{slug}/photos` | 401 | 401 | 200 | 401 |
| 写真の非表示依頼 | `POST /events/{slug}/photos/{id}/hide-request` | 401 | 401 | 204 | 401 |
| 写真の投稿 | `POST /events/{slug}/photos` | 201 | 201 | 201 | 401 |
| 写真の削除（投稿者本人の写真） | `DELETE /events/{slug}/photos/{id}` | 204 | 204 | 204 | 401 |
| 更新の通知（SSE） | `GET /events/{slug}/stream?gate=` | 401 | 401 | 200 | 401 |

- 幹事も参加者の画面を見るときは合言葉を通る（幹事の資格だけでは参加者APIは使えない）。
- 回数制限：ログインは ID ごとに5回失敗で15分（429 `too_many_attempts`）、合言葉は IP ごとに10回失敗で10分（429）、PIN は回答ごとに5回失敗で15分（429 `pin_locked`）。
- 他人の編集トークンでの回答の操作は 403 `edit_forbidden`、他人の写真の削除は 403 `photo_forbidden`、別の幹事のイベントは 403 `forbidden`。
