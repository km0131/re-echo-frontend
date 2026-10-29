# CLAUDE.md — 出欠帳 フロントエンド（React）

このファイルは、このリポジトリで作業するAI（Claude Code など）が毎回最初に読む共通ルールです。

- `docs/design.md` … 色・フォント・部品・画面ごとのレイアウト（画面設計）。**見た目の正**
- `docs/spec.md` … 機能・認証・API の仕様（backend リポジトリからのコピー。API の正は backend 側）
- `docs/docker.md` … 動作チェック用のローカル Docker 環境

作業は `prompts/` のステップ別指示に沿って、1ステップずつ進めます。指示されていないステップの機能を先回りして作らないでください。

---

## 1. 何を作るか

高校のクラス同窓会の日程を決める「調整さん」型Webアプリ **出欠帳** の画面です。

- 幹事（アカウントあり、実質1人）がイベントを作り、共有URLと合言葉をLINEで流す
- 同級生（アカウントなし、30〜40人）は合言葉で入り、候補日に ◯／△／✕ をつける
- 昔の写真を見られるギャラリーがあり、全体がレトロで懐かしい雰囲気

API（Go）は**別のリポジトリ `backend`** です。このリポジトリでは API を作りません。API に足りないものがあれば、勝手に回避策を作らず「バックエンドへの依頼事項」として報告してください。

**このプロジェクトは機能よりデザインを重視します。** 動けばよいではなく、`docs/design.md` の見た目を再現できて初めて完成です。

## 2. 技術スタック（変更しないこと）

| 項目 | 技術 |
| --- | --- |
| 本体 | React + TypeScript + Vite（Vite のテンプレートの現行版） |
| スタイル | Tailwind CSS（トークンは `docs/design.md` 1章） |
| ルーティング・通信 | React Router、TanStack Query |
| 本番 | Cloudflare Pages（`chosei.ドメイン`）。OGP差し込みは Pages Functions（`functions/`） |
| 動作チェック | ローカルの Docker（本番では Docker を使わない） |
| API | `https://chosei-api.ドメイン/api/v1`（開発時は backend リポジトリの Docker、`http://localhost:8080`） |

新しいライブラリを追加したいときは、追加する前に理由を1行で説明して確認を取ってください。

## 3. リポジトリ構成

```
frontend/
├── CLAUDE.md
├── docs/            # design.md, spec.md, docker.md
├── prompts/         # ステップ別の指示
├── Dockerfile       # 動作チェック用（dev / preview）
├── compose.yaml
├── Makefile
├── functions/       # Cloudflare Pages Functions（OGP差し込み）
├── public/          # _headers など
├── src/
│   ├── routes/      # 画面（URLごと）
│   ├── components/  # 画面固有でない部品
│   ├── ui/          # デザインの基本部品（Button, Input, Card, Polaroid…）
│   ├── lib/         # APIクライアント、トークン保存、日付整形
│   └── styles/
├── tailwind.config.ts
└── vite.config.ts
```

## 4. コーディング規約

- 画面の文言とコメントは**日本語**。識別子は英語。
- 日時は API から UTC の ISO 8601 で届く。画面では **Asia/Tokyo** で表示する（例：`12/29（火）19:00〜`）。表示用の整形は `src/lib/date.ts` に集める。ブラウザのタイムゾーンに頼らず `Intl.DateTimeFormat` に `timeZone: 'Asia/Tokyo'` を渡す。
- 関数コンポーネント＋Hooks。状態管理ライブラリは入れず、サーバーの状態は TanStack Query に任せる。
- 色・フォント・角丸・余白は `tailwind.config.ts` に定義したトークンだけを使う。**色の直書き（`#2E3A55` など）を JSX に書かない。**
- APIクライアントは `src/lib/api.ts` に1つだけ作り、トークンのヘッダー付与とエラー形式の変換をそこで行う。ベースURLは `VITE_API_BASE_URL`（相対パス `/api/v1` と絶対URLの両方で動くこと）。
- API のエラーは `{ error: { code, message } }`。`message` はそのまま画面に出してよい。`code` で分岐する（例：`gate_required` ならゲートへ戻す）。
- LocalStorage のキーは次で統一する（読み書きは try/catch で包む）。
  - `chosei:session` … 幹事セッショントークン
  - `chosei:gate:{slug}` … 合言葉通過トークン
  - `chosei:edit:{slug}` … `{ responseId, token }`（回答の編集トークン）
  - `chosei:admin:{slug}` … 共同幹事の管理キー

## 5. デザインで絶対に守ること（AIっぽさを消す）

`docs/design.md` が正です。特に次は守ってください。

- **やらないこと**：グラデーション背景、紫や青緑のアクセント、絵文字アイコン、Inter・Roboto などの英字デフォルトフォント、どの部品にも同じ大きな影、角丸 16px 以上の多用、「✨」「🎉」のような装飾、ありがちなヒーロー＋3カラムの特徴紹介、スピナー、トースト通知。
- **やること**：方眼ノート風の背景、ポラロイド風カード（白枠・影・わずかな傾き）、マスキングテープ、見出しだけ手書き風フォント（Zen Kurenaido）、色あせたネイビー×オフホワイト×セピア。
- ◯△✕ は**色だけで区別しない**（必ず記号を表示する）。
- スマホ（幅 390px）が基準。押せる部分は最小 44×44px。入力欄の文字は 16px 以上（iOSのズーム防止）。
- 数字・表・フォームの値には手書き風フォントを使わない（例外：カウントダウンの日数とひとことコメント）。
- `prefers-reduced-motion` が有効なら、紙吹雪とカードの傾きアニメーションを止める。

## 6. セキュリティの基本

- `public/_headers` で CSP を設定する（スクリプトは自ドメインのみ、`connect-src` は自ドメインと `chosei-api.ドメイン`、フォントは Google Fonts のみ）。
- 参加者のページには `<meta name="robots" content="noindex">`。
- トークンは LocalStorage に置くため、`dangerouslySetInnerHTML` は使わない。ユーザーが書いた文字列（名前・コメント・キャプション）は必ずテキストとして描画する。

## 7. 作業の進め方

1. ステップの指示を読んだら、まず**変更するファイルの一覧と方針を短く示してから**実装に入る。
2. 仕様に書かれていないことで判断が必要になったら、勝手に決めずに質問する。ただし見た目の細部は `docs/design.md` の部品ルールに合わせて自分で決めてよい。
3. 1ステップの最後に必ず次を行う（ステップ F1-2 以降は Docker で）。
   - `make check`（ビルドとリント）を通す
   - `make up` で起動し、変更した画面を幅390pxと360pxで確認して、`docs/design.md` との違いを報告する
   - そのステップの「完了条件」を1つずつ確認した結果を報告する
   - 変更点を3〜5行で要約し、API に足りないものがあれば「バックエンドへの依頼事項」を付ける
4. 既存のコードを大きく書き換えるときは、先に理由を説明する。

## 8. 起動方法（ステップ F1-2 以降）

先に backend リポジトリで `make up`（必要なら `make seed`）しておきます。

```bash
make up        # 動作チェック用に起動 → http://localhost:5173
make check     # ビルドとリント
make preview   # 本番と同じビルド＋Pages Functions で確認 → http://localhost:8788
```

環境変数：`VITE_API_BASE_URL`（開発中は `/api/v1`、本番は `https://chosei-api.ドメイン/api/v1`）、`VITE_PROXY_TARGET`（開発中のみ）。
