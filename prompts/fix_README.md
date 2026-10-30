# Re:Echo 修正指示（修正01・修正02）

backend/ と frontend/ を、それぞれのリポジトリに重ねて置いてください。

## 進める順番
| 順 | リポジトリ | ステップ | 内容 |
| --- | --- | --- | --- |
| 1 | backend | F2-1 | 永続化の確認（調査だけ） |
| 2 | backend | F2-2 | DB・写真をホストのディレクトリへ |
| 3 | backend | F1-1〜F1-5 | 修正01（マイグレーション、合言葉、写真タイトル、コメント） |
| 4 | frontend | FF1-1〜FF1-3 | 修正01 の画面 |
| 5 | backend | F2-3 | Cloudflare Turnstile |
| 6 | frontend | FF2-1 | Turnstile ウィジェット |

各リポジトリの docs/spec-fix01.md・spec-fix02.md を docs/spec.md の末尾に追記してから始めます。
backend の「フロントへの連絡事項」は、frontend の spec.md に写してから frontend のステップへ進みます。
