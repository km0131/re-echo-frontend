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
| GET・POST | `/events/{slug}/admin/responses` | A | 全員の回答の一覧・代理で回答を追加（16章） | 修正03 |
| PUT・DELETE | `/events/{slug}/admin/responses/{id}` | A | 回答の編集・削除（16章） | 修正03 |
| PUT | `/events/{slug}/admin/responses/{id}/pin` | A | PIN の再設定・削除（16章） | 修正03 |

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
| PUT | `/events/{slug}/responses/me/pin` | G＋E | 自分の PIN の設定・変更（16章） | 修正03 |
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
| DELETE | `/events/{slug}/admin/photos/{id}` | A | 幹事による削除。公開範囲・状態に関係なく消せる（17章。修正04） |
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
| `responses` | id, event_id, name（イベント内で一意）, comment, pin_hash, edit_token_hash, pin_failed_count, pin_locked_until, created_at, updated_at, updated_by（self／admin。修正03） |
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
//   photo: ファイル（複数可、1回10枚まで）／ caption: photo と同じ順番（任意、200文字。修正01 で 40→200）
//   meta: [{ title, caption }]（修正01。14.4・14.6）
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

// PATCH /events/{slug}/photos/{id}（A。修正01 から title・caption は投稿者本人の E でも可。14.6）
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
// event: changed / data: {"kind":"responses"|"confirm"|"photos"|"photo_comment"}   … 何が変わったかだけ。中身は取り直す
//   photo_comment のときだけ photoId と commentCount も付く（修正01。14.6）
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
| 回答の管理一覧 | `GET /events/{slug}/admin/responses` | 200 | 200 | 401 | 401 |
| 幹事による回答の代理追加 | `POST /events/{slug}/admin/responses` | 201 | 201 | 401 | 401 |
| 幹事による回答の編集 | `PUT /events/{slug}/admin/responses/{id}` | 200 | 200 | 401 | 401 |
| 幹事による回答の削除 | `DELETE /events/{slug}/admin/responses/{id}` | 204 | 204 | 401 | 401 |
| 幹事による PIN の再設定 | `PUT /events/{slug}/admin/responses/{id}/pin` | 204 | 204 | 401 | 401 |
| 写真の承認など（状態・公開範囲・並び順） | `PATCH /events/{slug}/photos/{id}` | 200 | 200 | 403 | 401 |
| 写真のタイトル・キャプション変更（投稿者本人の写真） | `PATCH /events/{slug}/photos/{id}` | 200 | 200 | 200 | 401 |
| コメントの非表示・戻す | `PATCH /events/{slug}/photos/{id}/comments/{commentId}` | 204 | 204 | 401 | 401 |
| 管理URLの再発行 | `POST /events/{slug}/admin-key/rotate` | 200 | 403 | 401 | 401 |
| イベント削除 | `DELETE /events/{slug}` | 204 | 403 | 401 | 401 |
| 公開情報 | `GET /public/events/{slug}` | 200 | 200 | 200 | 200 |
| 合言葉ゲート | `POST /events/{slug}/gate` | 200 | 200 | 200 | 200 |
| イベント詳細 | `GET /events/{slug}` | 401 | 401 | 200 | 401 |
| 回答の作成 | `POST /events/{slug}/responses` | 401 | 401 | 201 | 401 |
| PINで再発行 | `POST /events/{slug}/responses/recover` | 401 | 401 | 200 | 401 |
| 自分の回答の取得・更新・削除 | `GET・PUT・DELETE /events/{slug}/responses/{id}` | 401 | 401 | 2xx | 401 |
| 自分の PIN の変更 | `PUT /events/{slug}/responses/me/pin` | 401 | 401 | 204 | 401 |
| 写真の一覧 | `GET /events/{slug}/photos` | 401 | 401 | 200 | 401 |
| 写真の非表示依頼 | `POST /events/{slug}/photos/{id}/hide-request` | 401 | 401 | 204 | 401 |
| 写真の投稿 | `POST /events/{slug}/photos` | 201 | 201 | 201 | 401 |
| 写真の削除（投稿者本人の写真） | `DELETE /events/{slug}/photos/{id}` | 204 | 204 | 204 | 401 |
| 写真の削除（幹事。公開範囲に関係なく） | `DELETE /events/{slug}/admin/photos/{id}` | 204 | 204 | 401 | 401 |
| コメントの一覧 | `GET /events/{slug}/photos/{id}/comments` | 200 | 200 | 200 | 401 |
| コメントの投稿 | `POST /events/{slug}/photos/{id}/comments` | 401 | 401 | 201 | 401 |
| コメントの削除（書いた本人のトークン） | `DELETE /events/{slug}/photos/{id}/comments/{commentId}` | 204 | 204 | 204 | 403 |
| 更新の通知（SSE） | `GET /events/{slug}/stream?gate=` | 401 | 401 | 200 | 401 |

- 幹事も参加者の画面を見るときは合言葉を通る（幹事の資格だけでは参加者APIは使えない）。
- 回数制限：ログインは ID ごとに5回失敗で15分（429 `too_many_attempts`）、合言葉は IP ごとに10回失敗で10分（429）、PIN は回答ごとに5回失敗で15分（429 `pin_locked`）。
- 他人の編集トークンでの回答の操作は 403 `edit_forbidden`、他人の写真の削除・変更は 403 `photo_forbidden`、別の幹事のイベントは 403 `forbidden`。
- 修正01：コメントの削除は「書いた本人の `X-Comment-Token`」か幹事。どちらもなければ 403 `comment_forbidden`。参加者の表では、参加者が自分で書いたコメントのトークンを持っている状態。


## 14. 修正01（合言葉・写真タイトル・写真コメント）

> spec-fix01.md の内容。既存の 11〜13 章と番号が重なるため 11 章を 14 章に付け替えた（手順書の「11.x」はこの章の「14.x」）。


---

### 14.1 合言葉

#### 何が変わるか
| 項目 | 変更前 | 変更後 |
| --- | --- | --- |
| 使える文字 | 実質、英数字のみ | 日本語（ひらがな・カタカナ・漢字）、記号、絵文字も可 |
| 長さ | （未定義） | 正規化後に 1〜50 文字（バイト数ではなく文字数で数える） |
| 質問 | なし | 任意で1つ設定できる（例：「担任の先生の名前は？」） |
| 答えの数 | 1つ | 1〜5個（表記ゆれを別解として登録できる） |

#### 正規化（判定の前に、入力と登録値の両方に同じ処理をかける）
1. Unicode NFKC（全角英数→半角、半角カナ→全角カナ など）
2. 空白をすべて除去（半角・全角スペース、タブ、改行）
3. 英字を小文字に
4. カタカナをひらがなに（ァ〜ヶ → ぁ〜ゖ。長音「ー」はそのまま）

例：`タナカ　先生` → `たなか先生`、`ＤＥＭＯ` → `demo`

漢字とかなの読みの違い（「田中」と「たなか」）は正規化では吸収しない。必要なら幹事が別解として登録する。

#### 画面での扱い
- 合言葉の入力欄は `type="text"`（`type="password"` は日本語入力を使えないブラウザがあるため使わない）。
- 合言葉はクラス全員で共有するものなので、パスワードほど隠す必要はない。

### 14.2 写真のタイトル
- 投稿時に1枚ごとに任意で設定できる。最大 40 文字。
- 後から編集できるのは、投稿した本人（E）と幹事（A）。
- `caption`（説明文、最大 200 文字）は従来どおり残す。

### 14.3 写真のコメント
- 合言葉を通過した人なら誰でも書ける（回答していなくてもよい）。
- 名前は任意（最大 20 文字）。空なら画面では「だれか」と表示する。
  - 回答済みの端末では、名前欄に自分の回答名を初期値として入れる（消して匿名にもできる）。
- 本文は 1〜200 文字。改行は可（連続する改行は2つまでに詰める）。
- コメントできるのは、その人が見られる写真（承認済みの members / public）だけ。
- 削除できるのは、書いた本人（コメント削除トークン）と幹事。
- 幹事は管理画面でコメントを非表示にできる。
- 連投対策：IP ごとに 1 分あたり 10 件まで。
- 写真を削除すると、その写真のコメントも消える。

---

### 14.4 API の変更

#### 変更
| メソッド | パス | 認証 | 変更内容 |
| --- | --- | --- | --- |
| GET | `/public/events/{slug}` | － | `passphraseQuestion`（string か null）を追加 |
| POST | `/events` | S | `passphraseQuestion`（任意）、`passphrases`（1〜5個の配列）を受け取る。従来の `passphrase`（文字列1つ）も当面は受け付ける |
| GET・PATCH | `/events/{slug}/admin` | A | `passphraseQuestion` の取得・変更（質問だけの変更では通過トークンは失効しない）。`passphraseCount`（登録されている答えの数）を返す。答えそのものは返さない |
| PUT | `/events/{slug}/passphrase` | A | 本文を `{ "passphrases": ["田中先生", "たなかせんせい"] }` に変更（1〜5個）。全件置き換え。`passphrase_version` を +1 して通過トークンを全失効 |
| POST | `/events/{slug}/gate` | － | 本文は従来どおり `{ "passphrase": "..." }`。正規化してから、登録された全ての答えと照合 |
| POST | `/events/{slug}/photos` | G＋E、または A | multipart に `meta` を追加（後述） |
| GET | `/events/{slug}/photos` | G | 各写真に `title`（string か null）と `commentCount` を追加 |
| PATCH | `/events/{slug}/photos/{id}` | A、または投稿者の E | `title` と `caption` は投稿者本人も変更できる。承認・公開範囲・並び順は従来どおり A のみ |

`POST /events/{slug}/photos` の `meta`：
```json
// multipart の "meta" フィールド（JSON文字列）。files と同じ順番、同じ数
[ { "title": "修学旅行の朝", "caption": "" }, { "title": null } ]
```
`meta` が無い場合は、全てタイトルなしとして扱う。

#### 追加
| メソッド | パス | 認証 | 内容 |
| --- | --- | --- | --- |
| GET | `/events/{slug}/photos/{id}/comments` | G（幹事は A でも可） | コメント一覧（古い順） |
| POST | `/events/{slug}/photos/{id}/comments` | G | コメント投稿。`X-Edit-Token` があれば回答と紐づける |
| DELETE | `/events/{slug}/photos/{id}/comments/{commentId}` | `X-Comment-Token`、または A | コメント削除 |
| PATCH | `/events/{slug}/photos/{id}/comments/{commentId}` | A | `{ "status": "hidden" \| "visible" }` |

コメント投稿：
```json
// リクエスト
{ "authorName": "たなか", "body": "この日めっちゃ寒かったよね" }   // authorName は省略・null 可

// レスポンス 201
{
  "comment": { "id": "01J…", "authorName": "たなか", "body": "この日めっちゃ寒かったよね",
               "createdAt": "2026-10-29T01:23:45Z", "mine": true },
  "deleteToken": "…"   // この1回だけ返す
}
```

コメント一覧：
```json
{ "comments": [ { "id": "01J…", "authorName": null, "body": "なつかしい", "createdAt": "…", "mine": false } ] }
```
- `mine` は、リクエストの `X-Comment-Tokens`（カンマ区切り、最大50個）に一致するトークンがあれば true。
- 参加者には `status = hidden` のコメントを返さない。幹事（A）には `status` 付きで全件返す。

エラーコード（追加）：
| code | HTTP | message |
| --- | --- | --- |
| `passphrase_invalid_format` | 400 | 合言葉は1〜50文字で入力してください |
| `passphrase_too_many` | 400 | 合言葉の答えは5つまでです |
| `passphrase_duplicate` | 400 | 同じ答えが重なっています |
| `photo_title_too_long` | 400 | タイトルは40文字までです |
| `comment_invalid` | 400 | コメントは1〜200文字で入力してください |
| `comment_name_too_long` | 400 | 名前は20文字までです |
| `comment_rate_limited` | 429 | 少し時間をおいてから書きこんでください |
| `comment_forbidden` | 403 | このコメントは消せません |

#### LocalStorage（フロント）
- `chosei:comments:{slug}` … `{ [commentId]: deleteToken }`

### 14.5 テーブル
マイグレーション `0004_fix01.sql` を参照。
- `events.passphrase_question` を追加、`events.passphrase_hash` を削除
- `event_passphrases`（答え。1イベント1〜5行）を追加
- `photos.title` を追加
- `photo_comments` を追加


### 14.6 実装に合わせた補足（修正01）

spec-fix01.md に書かれていないことで、実装で決めたことです。

#### 合言葉
- 正規化後に同じになる答えのほか、答えが0個（空の配列・空文字）は 400 `passphrase_required`「合言葉を入れてください」。
- 質問は前後の空白を除き、空なら `null`（質問なし）。100文字まで（400 `passphrase_question_too_long`「質問は100文字以内にしてください」）。
- `PUT /events/{slug}/passphrase` は旧い形の `{ "passphrase": "…" }` も当面は受け付ける（配列1件として扱う）。
- 旧ハッシュ（`norm_version = 0`）は、0004 より前の登録時と同じく前後の空白だけ除いた入力で照合する。一致したらその場で正規化した値で作り直し、`norm_version = 1` にする。
- 旧エラー `passphrase_too_long`（64文字）は使わなくなった。代わりに `passphrase_invalid_format`（正規化後に1〜50文字）。
- 合言葉ゲートは、登録された答えをすべて照合してから結果を返す（何番目の答えで一致したかで応答時間を変えないため）。

#### 写真のタイトル
- `POST /events/{slug}/photos` の `meta` が JSON として読めない、または数が `photo` と合わないときは 400 `photo_meta_invalid`。
- `meta` の各要素の `caption` を省くと、従来の `caption` フィールド（同じ順番）を使う。
- 投稿の結果にも `title` を返す：`201 { "photos": [ { "id", "status", "title", "caption" } ] }`。
- `caption`（説明文）は最大200文字に広げた（前は40文字）。従来どおり、超えた分は切り詰める（エラーにはしない）。
- `PATCH /events/{slug}/photos/{id}`：
  - `{ "title": null }` か空文字でタイトルを消す。
  - 投稿者本人は `X-Edit-Token` だけで変えられる（合言葉の通過トークンは要らない）。
  - 本人が `status`・`visibility`・`sortOrder` を送ると 403 `photo_forbidden`。他人の写真も 403 `photo_forbidden`。
  - レスポンスは写真1件で、本人なら `mine: true`。
- 管理用の一覧（`GET /events/{slug}/admin/photos`）にも `title` と `commentCount` が入る。

#### 写真のコメント
- 投稿は 201、削除は 204、非表示・戻す（PATCH）は 204。
- 見つからないコメントは 404 `comment_not_found`。PATCH の `status` がちがうと 400 `status_invalid`。
- コメント削除は `X-Comment-Token` か A だけで、合言葉の通過トークンは要らない。
- 幹事向けの一覧（A）だけ、各コメントに `"status": "visible" | "hidden"` が付く。参加者向けには付かない。
- SSE：コメントが増減・非表示になると `event: changed` / `data: {"kind":"photo_comment","photoId":"…","commentCount":3}`（`commentCount` は表示中の数）。
- 連投の上限（IP ごとに1分10件）は、受け付けた投稿の数で数える。

## 15. 修正02（データの置き場所・永続化／Cloudflare Turnstile）

> spec-fix02.md の内容。既存の 11〜13 章と番号が重なるため 12 章を 15 章に付け替えた（手順書の「12.x」はこの章の「15.x」）。


---

### 15.1 データの置き場所（Docker の外に出す）

DB と写真は、名前付きボリュームではなく**ホストのディレクトリをそのままマウント（bind mount）**する。
フォルダごとコピーすれば別のマシンへ移せるようにするため。

#### ディレクトリ構成（ホスト側）
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

#### 移行手順（README に書く）
1. `make down`（本番は `make prod-down`）
2. `rsync -aH --info=progress2 /srv/chosei/data/ 新しいマシン:/srv/chosei/data/`
3. 新しいマシンで `chown -R 10001:10001 /srv/chosei/data`（UID を変えた場合はその値）
4. `make deploy`

---

#### 実装に合わせた補足（15.1）
- 起動時に `db/`・`photos/originals`・`photos/media`・`og/` を作り、書き込めるかを確かめる。書き込めなければ「/data/db に書き込めません。ホストの持ち主を CHOSEI_UID:CHOSEI_GID（このコンテナは 10001:10001）に合わせてください」と出して止まる。
- 修正02 より前の置き場所（`/data/chosei.db`）に DB があり、新しい置き場所に無いときは、空の DB を作らずに止まる（`make migrate-volume` を促す）。
- OGP 画像のファイル名は slug から イベントID に変えた（`og/{eventId}.png`）。URL は従来どおり `/og/{slug}.png`。
- DB のバックアップ名は `chosei-YYYYMMDD.db`（gzip しない）。同じ日に2回取ると新しいほうで上書きする。
- 開発用コンテナはホストのユーザー（`DEV_UID`・`DEV_GID`、`make` が自分の値を渡す）で動く。`./data` の写真をホストからそのまま開けるようにするため。

### 15.2 Cloudflare Turnstile（ボット対策）

#### 対象
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

#### 送り方
- フロントはウィジェットで得たトークンを **`X-Turnstile-Token` ヘッダー**で送る（multipart の写真投稿もヘッダーで送る）。
- トークンは1回しか使えず、発行から5分で切れる。送信が終わったら成功・失敗にかかわらずウィジェットをリセットする。

#### サーバー側の検証
- `https://challenges.cloudflare.com/turnstile/v0/siteverify` に `secret`、`response`、`remoteip`（`CF-Connecting-IP`）を POST する。タイムアウト 5 秒。
- `success` が true で、`action` が上の表の値と一致し、`hostname` が許可したホスト（`CHOSEI_TURNSTILE_HOSTNAMES`）に含まれるときだけ通す。
- 検証に失敗したリクエストは、レート制限の失敗回数にも数える。

#### エラー
| code | HTTP | message |
| --- | --- | --- |
| `turnstile_required` | 400 | ページを読みこみ直してから、もう一度お試しください |
| `turnstile_failed` | 403 | 確認がうまくいきませんでした。もう一度お試しください |
| `turnstile_unavailable` | 503 | 確認サービスにつながりません。少し時間をおいてお試しください |

#### 環境変数
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

#### CSP・CORS
- フロントの CSP に `script-src https://challenges.cloudflare.com` と `frame-src https://challenges.cloudflare.com` を追加する（外部スクリプト禁止の唯一の例外）。
- API の CORS 許可ヘッダーに `X-Turnstile-Token` を追加する。

#### 見せ方
- ウィジェットは `appearance: "interaction-only"`（ふだんは何も出ず、怪しいときだけチェックボックスが出る）。
- 出たときは、送信ボタンのすぐ上に置く。テーマは `light`／`dark` をサイトのテーマに合わせる。

#### 実装に合わせた補足（15.2）
- テスト用キーの siteverify の応答は `hostname` が `example.com`、`action` が空。そのため開発（`CHOSEI_ENV=dev`）では hostname を確かめず、action は応答に入っているときだけ確かめる。本番は success・action・hostname をすべて確かめる。
- 開発でシークレットを空にすると Turnstile を確かめない（起動時に警告を出す）。本番では空なら起動しない。
- レート制限への数え方：
  - 合言葉は IP ごと、ログインは ID ごと（本文の `loginId`）、コメントは IP ごとの回数に、Turnstile の失敗（403）も数える。
  - 回答の新規作成・PIN での再発行・写真の投稿には IP ごとの制限が無いので、数えない。
- 幹事（A）として認証できる写真投稿だけ、Turnstile を確かめない。
- PIN での再発行（`recover`）は回答者の PIN の失敗回数とは別。Turnstile の失敗では PIN のロックは進まない。
- ログには結果・action・error-codes・hostname だけを出し、トークンは出さない。

## 16. 修正03（幹事による回答の編集と PIN 再設定）

### 16.1 目的
- 幹事が全員の回答を代わりに直せるようにする（電話で聞いた回答の入力、名前の打ち間違いの修正など）。
- PIN を忘れた参加者の PIN を幹事が再設定できるようにする。参加者本人も、自分の端末から PIN を変えられるようにする。
- 幹事は PIN を「確認」できない（ハッシュしか持たないため）。できるのは再設定と削除だけ。

### 16.2 テーブル
- `responses.updated_by`：最後に回答の中身を書き換えた人。`self`（本人）／`admin`（幹事）。初期値 `self`（マイグレーション `0005_response_updated_by`。既存の回答は `self`）。
- 本人の作成・編集で `self`、幹事の代理追加・編集で `admin` にする。PIN の再設定・変更では変えない（回答の中身は変わらないため）。
- 編集履歴（差分）は保存しない。

### 16.3 幹事用の回答 API（A）
```jsonc
// GET /events/{slug}/admin/responses
← { "responses": [ { "id", "name", "comment", "choices": { "<candidateId>": "yes" | "maybe" | "no" },
                     "hasPin": true, "createdAt", "updatedAt", "updatedBy": "self" | "admin",
                     "survey": [ { "questionId", "optionIds": [ … ], "text"? } ] } ] }   // 古い順。PIN のハッシュは返さない

// POST /events/{slug}/admin/responses   代理で回答を追加
→ { "name", "comment", "choices", "pin"?: "1234", "survey"?: [ … ] }   // 参加者の POST と同じ入力。PIN は任意
← 201 { 一覧の1件と同じ形 }   // updatedBy は "admin"。編集トークンは返さない（本人は名前＋PINで引き継ぐ）

// PUT /events/{slug}/admin/responses/{id}
→ { "name", "comment", "choices", "survey"?: [ … ] }   // survey を省略したら変えない。pin は送れない（400）
← 200 { 一覧の1件と同じ形 }   // updatedBy は "admin"。PIN と編集トークンは変わらない

// DELETE /events/{slug}/admin/responses/{id}   → 204（◯△✕・アンケートの回答も消える）

// PUT /events/{slug}/admin/responses/{id}/pin
→ { "pin": "1234" | null, "revokeEditTokens": false }
← 204
// pin が null（または省略）なら PIN を削除。設定・削除のどちらでも失敗回数とロックを解除する
// revokeEditTokens が true なら、その回答の編集トークンを作り直す（今までの端末からは 403 edit_forbidden）
```
- エラー：400 `pin_invalid`（半角数字ちょうど4桁でない）、409 `name_taken`（同じイベントに同じ名前。文言は幹事向け）、404 `response_not_found`（無い回答・別イベントの回答）、入力の検証は参加者の POST・PUT と同じ（`choices_incomplete` など）。
- 認証：A がなければ 401 `admin_required`、別の幹事のセッションは 403 `forbidden`。

### 16.4 参加者の PIN 変更（G＋E）
```jsonc
// PUT /events/{slug}/responses/me/pin   （X-Gate-Token と X-Edit-Token）
→ { "pin": "1234" }
← 204
// 編集トークンで本人と分かっているので、今の PIN は聞かない。失敗回数とロックも解除する
// 400 pin_invalid / 401 gate_required / 403 edit_forbidden（編集トークンが無い・ちがう）
```
- 画面：`/e/:slug/pin`（PINを変更。回答フォームの編集中と回答完了画面からリンク）。幹事の操作は管理画面の「回答」タブ（`/e/:slug/admin?tab=responses`）。
- PIN は今までどおり argon2id のハッシュだけを保存し、ログにも出さない。
- 更新・削除・PIN の変更のあとは、SSE で `responses` の更新を流す（`hasPin` も変わるため）。

### 16.5 実装に合わせた補足（修正03）
- 指示では JSON のキーが `has_pin`・`updated_by`・`revoke_edit_tokens` だったが、CLAUDE.md の規約（camelCase）と既存の `hasPin` に合わせて `hasPin`・`updatedBy`・`revokeEditTokens` にした。
- 指示では PIN の形式エラーが `invalid_pin` だったが、既存の参加者 API と同じ `pin_invalid` にした（同じ意味のコードを2つにしないため）。
- 指示では「revoke 後の古い E トークンは 401」だったが、既存の参加者 API（変更しない約束）は E が合わないとき 403 `edit_forbidden` を返すので、それに合わせた。
- パスは既存の API と同じく `/api/v1` の下（指示の `/api/events/…` ではない）。

## 17. 修正04（公開中の写真を管理画面から直接削除する）

### 17.1 目的
- 管理画面の「公開中」（public／members）の写真を、非公開に戻す手順を踏まずにその場で消せるようにする（間違えて公開した写真、本人から消してほしいと言われた写真）。
- ゴミ箱・論理削除（復元）・一括削除は作らない。参加者が自分の写真を消す `DELETE /events/{slug}/photos/{id}` の仕様は変えない。

### 17.2 API
```jsonc
// DELETE /events/{slug}/admin/photos/{id}   （A：オーナーのセッション、または X-Admin-Key）
← 204
// 401 admin_required（A なし）/ 403 forbidden（別の幹事のセッション）
// 404 photo_not_found（無い写真・別イベントの写真）
```
- 公開範囲（public／members／draft）と状態（承認待ち・非表示なども）に関係なく消せる。

### 17.3 削除の処理
1. 1つのトランザクションで `photos` の行を消す（コメント・非表示依頼は外部キーで一緒に消える）。並び順（`sort_order`）に欠番ができるときは、後ろの写真を1つずつ詰める。同じ並び順の写真が他にあれば欠番にならないので詰めない。
2. コミットしてから、ファイル（原本、表示用 1600px、サムネイル 400px）を消す。消せなかったファイルがあっても API は 204 を返し、警告ログ「写真のファイルを消せませんでした」を残す（行が無いので、残ったファイルが配信されることはない）。
3. 操作ログ「幹事が写真を削除しました」を INFO で残す：`role`（owner／coadmin）、オーナーなら `userId`、`eventId`、`photoId`、`visibility`、`status`、`at`（UTC）。
4. 写真の変更として知らせる（`photos`）。これで次がそのまま反映される。
   - OGP 画像の作り直し（消した写真を使っていれば次の public 写真に、public 写真が無くなれば写真なしの画像に）。`ogImageUrl` の `?v=` も変わる。
   - SSE の `photos`（ギャラリー・イベントトップのヘッダー・回答完了画面のミニギャラリーが読み直す）。
- ゲートのヘッダー（`publicPhotoUrl`）、イベントトップのヘッダー、ミニギャラリーは、どれも DB の写真一覧から選ぶので、消した写真は候補に出ない。

### 17.4 実装に合わせた補足（修正04）
- パスは既存の API と同じく `/api/v1` の下（指示の `/api/events/…` ではない）。
- 共同幹事の管理キーで投稿した写真は、もともと承認待ちになる（オーナーの投稿だけすぐ承認）。削除はどちらの権限でもできる。

### 17.5 トーストの使い方（画面。frontend の docs/design.md 5章と同じ）
- トーストは原則使わない。使ってよいのは次の2つだけ。
  - シートやダイアログを開いているときの通信エラー
  - 管理画面での削除操作の結果（成功・失敗）
- 参加者向けの画面では、通信エラー以外に使わない。
- 表示場所は、いちばん手前の開いている dialog の中。なければページ本体。色はエラー（maybe-ink）と結果（セピア）の2種類。
- 既知の課題：読み上げ用の領域を文言と同時に作っているため、読み上げソフトによっては読まれない。
