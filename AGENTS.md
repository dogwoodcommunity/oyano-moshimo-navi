# 共通の作業ルール（Codex / Claude Code）

## 必要な情報だけ読む

- 再開時は `docs/CURRENT_STATUS.md` とGitのbranch/statusを確認する。小さな継続修正で既読情報を繰り返し取得しない。
- `docs/SESSION_HANDOFF.md` は履歴。見出しを `rg -n` で探し、今回に関係する節だけ読む。
  2026-09-19の本人の省トークン方針により、従来の「毎回全文読了」はこの参照方式へ変更する。
- 変更先に適用される指示と、選んだスキルの必須手順は省略しない。関係のない資料・スキルは読み込まない。
- 構成は `apps/web`（Web）、`apps/mobile`（モバイル）、`packages`（共通）、`supabase`（SQL）、`scripts`（検証）。
  全体設計は `docs/PRODUCTION_ROADMAP.md`、公開は `docs/PRODUCTION_CHECKLIST.md`、
  個人情報保管は `docs/PERSONAL_DATA_PRODUCTION_ARCHITECTURE_2026-09-08.md` を必要な作業時だけ参照する。

## 作業と検証

- 目的・変更範囲・完了条件を短く定め、依頼範囲内の編集と安全なローカル検証は続けて完了させる。
- テストは変更の影響範囲に合わせる。公開・保存/復元・認証/権限・DB変更では必要な回帰確認を省かない。
  `.github/workflows/ci.yml` と関連する `scripts/test-*.mjs` で実行条件・副作用を確かめる。
- 並列化は独立した作業で時間/品質面の効果がある場合に限定し、短い依頼と必要な情報だけを渡す。
  同じファイルを同時編集しない。Claude等の外部レビューへ秘密情報や実利用者データを送らない。
- ログは要点・失敗箇所を取得する。同じ差分の重複レビュー、不要な全件再検証、長い途中報告を避ける。

## 守ること・引き継ぎ

- `review_exports/`、未追跡の `docs/CLAUDE_FULL_REVIEW_{REQUEST,RESULT}_2026-09-03.md`、利用者の既存変更を触らない。
- 本番変更、データ削除、外部送信、契約/課金は現在の依頼で承認された範囲だけ行う。過去の承認を拡張しない。
- ローカルPASS・CI成功・本番反映・実データでの確認を区別する。秘密値をログやGitに残さない。
- 完了時は `CURRENT_STATUS.md` を短く更新し、`SESSION_HANDOFF.md` へ新しい差分・根拠だけ追記する。
  対象差分とブランチ、公開への連動を確認してGitHubへpush。文書のみなら `[skip ci]` を用い、再デプロイしない。
