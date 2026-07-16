# 親のもしもナビ v0.3 エンジニアレビュー依頼

作成日: 2026-07-16  
対象実装commit: `b00fdb2 Clarify start card selection affordance`  
本番Web: https://oyano-moshimo-navi.vercel.app  
GitHub: https://github.com/dogwoodcommunity/oyano-moshimo-navi  
Supabase Project ref: `ypnuxyfirlvbsqujocuy`

## レビューの前提

このプロダクトは「親のもしも」に備える家族向けサービスです。

- Web入口: QR/URLからDLなしで状況選択、診断、結果表示まで完了
- PWA/Web: 入口、診断、結果、発動サポートパック申込、管理画面
- Expoアプリ: 家族ボード、担当者、期限通知、写真管理、タイムライン、実家カルテ
- Supabase: Web/App共通DB、Auth、Storage、RLS、RPC
- Stripe: 発動サポートパックはWeb決済前提
- アプリ内: 外部決済CTAを置かない方針

低頻度・高重要度型のサービスとして設計しています。DAUを追うのではなく、通知開封率、90日後にアカウントが生きている率、期限タスク完了を重視します。

## 今回レビューで特に見てほしいこと

### 1. 要配慮個人情報と同意設計

入院、認知症、危篤、死亡などは要配慮個人情報に該当し得ます。

確認対象:

- `apps/web/app/diagnosis/DiagnosisForm.tsx`
- `apps/web/app/api/cases/[caseId]/diagnosis/route.ts`
- `supabase/sensitive_info_consent_hardening.sql`
- `docs/PRIVACY_AND_REVIEW_GUARDRAILS.md`
- `docs/PRODUCTION_CHECKLIST.md`

見てほしい観点:

- 同意なしで診断送信できないか
- 同意ログが保存されるか
- 親本人同意が取りにくい場面の説明が足りているか
- 削除依頼と実削除運用のSLAが実務に耐えるか

### 2. Web診断からアプリ引き継ぎ

Web診断結果をアプリ/PWA側の家族ボードへ引き継ぐ導線です。

確認対象:

- `apps/web/app/result/[caseId]/page.tsx`
- `apps/web/app/result/[caseId]/share/page.tsx`
- `apps/web/app/api/handoff/consume/route.ts`
- `apps/mobile/app/handoff.tsx`
- `apps/mobile/lib/handoff.ts`
- `supabase/handoff_consume_rpc.sql`
- `supabase/handoff_security_hardening.sql`

見てほしい観点:

- handoff tokenが短命、推測困難、使い捨てになっているか
- token消費が途中失敗で再試行不能にならないか
- Magic Link / deep link redirectにオープンリダイレクト余地がないか
- Supabase Auth Redirect URL設定とアプリscheme設定が整合しているか

### 3. Supabase RLS / service role / admin認可

service roleはRLSをバイパスするため、API側認可が重要です。

確認対象:

- `apps/web/lib/serverSupabase.ts`
- `apps/web/lib/adminAuth.ts`
- `apps/web/lib/adminClientAuth.ts`
- `apps/web/app/api/admin/**`
- `supabase/schema.sql`
- `supabase/production_rls.sql`
- `supabase/admin_auth_hardening.sql`
- `supabase/api_grants.sql`
- `scripts/smoke-admin-bearer.mjs`

見てほしい観点:

- `SUPABASE_SERVICE_ROLE_KEY` を使うAPIが個別に認可しているか
- `ADMIN_ACCESS_TOKEN` fallbackの扱いは本番運用上許容できるか
- `app_admins` と通常family adminが混同されないか
- 管理画面/APIの監査ログや操作追跡が足りるか

### 4. 通知エンジン

通知はこのアプリの生命線ですが、通知スパムは避ける設計です。

確認対象:

- `supabase/notification_delivery_hardening.sql`
- `supabase/task_notification_generation.sql`
- `supabase/monthly_checkin_notifications.sql`
- `apps/web/app/api/cron/send-due-notifications/route.ts`
- `apps/web/app/api/notifications/opened/route.ts`
- `apps/mobile/lib/notifications.ts`
- `apps/mobile/app/notifications.tsx`

見てほしい観点:

- 法定期限系、高優先度、通常タスクで通知段数が分かれているか
- 同日ダイジェストが通知スパムを抑えているか
- 送信claim、stale reset、opened_atが二重送信/計測欠損を防げているか
- due_date変更、担当者変更、タスク完了、タスク削除時にpending通知が残らないか

### 5. 家族共有 / 担当者 / Free制限

家族招待は課金壁ではなく拡散装置として、オーナー以外2名まで無料です。

確認対象:

- `apps/mobile/app/people/[id]/family.tsx`
- `apps/mobile/app/people/[id]/tasks.tsx`
- `apps/mobile/lib/mobileData.ts`
- `supabase/family_invite_rpc.sql`
- `supabase/production_rls.sql`

見てほしい観点:

- Freeプランの「オーナー以外2名まで」がDB側で破れないか
- pending inviteも上限に含まれているか
- tasksの担当者変更がfamily境界を越えないか
- 担当者変更時の通知再生成がDB側で成立しているか

### 6. Stripe / 発動サポートパック

発動サポートパックはWeb/Stripe前提です。アプリ内に購入導線は置きません。

確認対象:

- `apps/web/app/support-pack/page.tsx`
- `apps/web/app/support-pack/SupportPackClient.tsx`
- `apps/web/app/api/stripe/checkout/route.ts`
- `apps/web/app/api/stripe/webhook/route.ts`
- `apps/web/app/api/support-packs/route.ts`
- `supabase/product_seed.sql`
- `docs/PAYMENT_POLICY.md`
- `docs/STRIPE_SETUP.md`

見てほしい観点:

- `caseId` だけで申込/連絡先更新ができないか
- `checkoutToken` の24時間照合が妥当か
- Stripe webhookの冪等性、署名検証、状態更新が十分か
- App Store審査上、Expoアプリ内に外部決済誘導が残っていないか

### 7. PWA / Web入口デザインと操作理解

直近でスマホ入口と選択画面を大きく改善しました。

確認対象:

- `apps/web/app/page.tsx`
- `apps/web/app/start/page.tsx`
- `apps/web/app/diagnosis/DiagnosisForm.tsx`
- `apps/web/app/globals.css`
- `apps/web/components/PwaRegister.tsx`
- `apps/web/public/manifest.webmanifest`
- `apps/web/public/sw.js`

見てほしい観点:

- 高齢者/家族が「どこを押すか」を迷わないか
- `/start` のカードが押せることが十分伝わるか
- 診断ページがGoogle Formっぽく見えすぎないか
- PWAインストール導線が押し付けになっていないか

## 現在の本番確認状況

完了:

- GitHub push済み。
- Vercel本番デプロイ済み。
- 本番URL: https://oyano-moshimo-navi.vercel.app
- Supabase本番DB構築済み。
- `verify_compact.sql` は全項目true確認済み。
- Supabase Auth Redirect URLにWeb URLとアプリschemeを設定済み。
- SMTP送信設定を実施済み。
- Android実機でWeb入口から結果表示、handoff後のタスク画面表示まで確認済み。
- PWA対応済み。
- Web/mobile typecheck OK。
- `node scripts/local-doctor.mjs` OK。
- `next build` OK。

未完了/要確認:

- Stripe本番決済の実接続。
- iOS/TestFlight配布。
- push通知の実配信確認。
- 家族3組テスト。
- 弁護士によるプライバシーポリシー/特商法/要配慮個人情報レビュー。
- 本番運用でのadmin個別アカウント化、監査運用の最終化。

## レビュー用ZIP

最新版レビューZIPは、この資料を含めてcommitした後に `scripts/create-review-zip.mjs` で生成します。

```text
review_exports/oyano-moshimo-navi-code-review-2026-07-16-<commit>.zip
```

注:

- ZIPは `git archive` 由来です。
- `.env.local` は含みません。
- ZIP内に入る環境変数ファイルは `.env.example` のみです。
- ローカル作業ディレクトリに `.env.local` はありますが、Git管理外なのでレビューZIPには含まれません。

## レビュー時の推奨コマンド

```bash
pnpm install
pnpm run doctor:local
pnpm --filter web run typecheck
pnpm --filter mobile run typecheck
pnpm --filter web run build
```

Web smoke:

```bash
node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app
```

同意ログ保存smoke:

```bash
node scripts/smoke-production-consent.mjs https://oyano-moshimo-navi.vercel.app
```

Admin Bearer認証smoke:

```bash
node scripts/smoke-admin-bearer.mjs https://oyano-moshimo-navi.vercel.app
```

## 注意

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー環境変数専用です。`NEXT_PUBLIC_` / `EXPO_PUBLIC_` に入れないでください。
- アプリ内にWeb決済/Stripe誘導文言を置かない方針です。
- このアプリは「毎日使わせる」アプリではありません。期限通知、家族更新、月1確認で必要な瞬間に戻る設計です。
- セキュリティと法務はMVPでも軽視できません。特に要配慮個人情報、handoff token、admin認可、service role利用を重点確認してください。
