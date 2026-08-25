# Claude 作業引き継ぎメモ（2026-08-24）

この文書は、Claudeで次の作業を始めるための最短の入口です。古いレビュー資料や古い
`SESSION_HANDOFF.md` の記述と食い違う場合は、**現行コード、本書、
`docs/SESSION_HANDOFF.md` の追記211以降、`docs/MONETIZATION.md` の現行ルール**を優先してください。

## 1. 最初に行うこと

```bash
git pull origin main
git status --short
```

- リポジトリ: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`
- ブランチ: `main`
- 本書作成直前の基準コミット: `1a885bd267d1639ec70dcc1e8359068d414572be`
- 未追跡の `review_exports/` はレビュー成果物です。**追加・変更・commitしないでください。**
- ユーザーの既存変更を勝手に戻さないでください。

## 2. 現在の公開先

- 本番PWA: `https://oyano-moshimo-navi.vercel.app`
- 利用者用手帳: `https://oyano-moshimo-navi.vercel.app/home`
- 運営管理画面: `https://oyano-moshimo-navi.vercel.app/admin`
- AI利用量・原価: `https://oyano-moshimo-navi.vercel.app/admin/ai-usage`
- 最新確認済みVercel deployment: `dpl_AhLFVoVMEayM3CCrnu4JbwELvHc3`

利用者向けPWAと運営管理画面は分離されています。管理APIは未認証で401になることを確認済みです。

## 3. プロダクトの現在地

現在の主軸は **Web/PWAだけで完結する「親・親族の記録手帳」** です。Expoアプリは将来の通知・
ストア配布に備えてリポジトリに残していますが、現時点の主導線ではありません。削除しないでください。

中心となる利用体験:

1. 管理する人を1人登録する
2. 今日の出来事・変化を記録する
3. 保存完了を明確に確認する
4. その記録をもとにAIへ相談する
5. AI回答を手帳へ残し、次回は過去の文脈を引き継ぐ

対象は主に40〜70代の家族です。スマホに不慣れな人でも迷わないよう、画面ごとの主操作は原則1つ、
本文・ボタンは最低16pxを維持してください。機能を増やすより、記録→保存→AI相談の一本道を優先します。

## 4. 料金とAI相談の確定仕様

プランは2段だけです。

- 無料
- Family Plus: 月980円 / 年9,800円（税込、家族単位）

無料とPlusの境界:

- 1人目の手帳は無料、2人目からPlus
- オーナー以外の家族1人まで無料招待（世帯合計2人）。追加招待はPlus
- 同じPlus家族へ招待された人に、重複した課金CTAを出さない
- 急なとき・危機導線は常に無料
- 解約後も過去の記録は読める方針

AI相談:

- 無料家族・未ログイン端末は、日本時間で**1日1回**無料
- 同じ日の2回答目は、翌日0時まで待つかFamily Plusが必要
- 失敗・拒否・無効回答ではその日の無料枠を消費しない
- Plusは家族単位で1日5回答、月30回答まで
- サービス全体の既定上限は1日50回答
- 1回答の出力上限は1,600token
- 会話文脈は直近4ターン
- 利用量・token・概算原価は `audit_logs.action = ai_consult_usage` に保存
- 運営画面には相談本文を表示しない

原価の一元管理は `apps/web/lib/consultLimits.ts` です。制限や単価を変える場合は、画面文言・環境変数資料・
管理画面集計も同時に更新してください。

## 5. データと安全上の境界

- 記録、急なとき、AI回答の中にスポンサーを混ぜない
- AI相談コードから `partners` / `sponsors` を参照しない。これは恒久レビュー項目
- 利用者に掲載を見せる場合は必ず「協賛」または「PR」と明示
- 広告主へ個人データを渡さず、集計値だけを扱う
- 銀行暗証番号、パスワード、マイナンバー画像などを保存しない
- 法律・税務・医療判断を断定しない
- 外部AIへ送る生年月日は年代へ丸める
- 氏名、連絡先、写真/PDF、書類の保管場所、スポンサー情報をAIへ送らない
- AIへ送る最近の記録は最大12件
- センシティブ情報の同意と、外部AI処理の説明を維持する

写真はSupabase Storageへ保存し、成功後はlocalStorageのdata URLを破棄します。同期競合時は日記を
ID単位でマージし、409復元で未送信の日記を消さない設計になっています。

## 6. スポンサー基盤

スポンサー基盤は実装していますが、会員密度ができるまでは本格営業を始めない方針です。

- 販売単位は市区町村 × 分野
- Web/PWAの初回手帳登録で、親の都道府県と市区町村を両方必須取得する。番地以下は取得しない
- 記録画面・急なとき・AI相談には掲載しない
- `special` / `prime` / `light` の3掲載tier
- 公開会員数は閾値制、掲載料判定は世帯数基準
- 会員数表記は「利用者○人（○世帯）」で統一
- 月次確定値は `prefecture_usage_snapshots` を使う
- 月次snapshotは毎月1日00:10 UTC（09:10 JST）に1回。訂正時以外は手動再実行しない

スポンサー仕様と禁止事項は `docs/MONETIZATION.md` を正としてください。

## 7. 主なコードと資料

- `apps/web/app/home/page.tsx`: 利用者用手帳の本体
- `apps/web/components/ConsultPanel.tsx`: AI相談チャット
- `apps/web/app/api/consult/route.ts`: AI相談API、無料権・日/月上限・原価ログ
- `apps/web/lib/consultLimits.ts`: AI制限と原価単価
- `apps/web/app/admin/page.tsx`: 運営管理入口
- `apps/web/app/admin/ai-usage/page.tsx`: AI利用量・原価画面
- `apps/web/app/api/admin/ai-usage/route.ts`: AI運営集計API
- `packages/shared/src/plan.ts`: 無料/Plusの人数・手帳数境界
- `docs/MONETIZATION.md`: 課金・掲載モデルの正本
- `docs/PRIVACY_AND_REVIEW_GUARDRAILS.md`: 安全・審査境界
- `docs/ENVIRONMENT_MATRIX.md`: 環境変数
- `docs/SESSION_HANDOFF.md`: 実装台帳
- `supabase/regional_sponsor_data.sql`: 地域・スポンサーDB
- `supabase/prefecture_usage_snapshot_cron.sql`: 月次snapshot cron

`packages/shared/src/plan.ts` の現行値:

- `FREE_PLAN_NOTEBOOK_LIMIT = 1`
- `FREE_PLAN_MEMBER_LIMIT = 1`（オーナーを除く無料招待人数）

## 8. 未完了・外部確認が必要な項目

本番Supabaseへの適用が未確認:

1. `supabase/regional_sponsor_data.sql`
2. `supabase/verify_setup.sql` または `supabase/verify_compact.sql`
3. `supabase/prefecture_usage_snapshot_cron.sql`

有料テスト前に必要:

1. 本物のconsult APIを5ターン実行し、品質・token・原価を実測
2. Stripe checkout → plan反映 → 解約後の既存記録閲覧をE2E確認
3. 期限通知と月1確認のメール通知はコード実装済み。本番で
   `supabase/notification_email_delivery.sql` を適用し、Resend環境変数を設定して実受信を確認

3家族テストはコード上GOです。ただし、実機で写真・別端末復元・意図的409時の日記保持を確認し、
利用者がどこで迷うかを観察してください。

## 9. 作業完了時の確認

```bash
corepack pnpm --filter web exec tsc --noEmit
corepack pnpm --filter mobile exec tsc --noEmit
corepack pnpm --filter web build
git diff --check
```

作業後は必ず:

1. `docs/SESSION_HANDOFF.md` の末尾へ、変更・判断・確認結果・残課題を追記
2. 関係するファイルだけをcommit
3. `main` へpush
4. `git status --short` で意図しないファイルがないことを確認
5. 本番deployを行った場合はdeployment IDとURLも台帳へ記録

秘密情報や実値のAPI key、SMTP password、service role keyは文書やcommitへ書かないでください。
