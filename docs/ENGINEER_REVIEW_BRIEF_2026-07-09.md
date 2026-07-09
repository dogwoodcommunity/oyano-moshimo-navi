# 親のもしもナビ v0.3 エンジニアレビュー依頼

作成日: 2026-07-09  
対象commit: `main` latest as of 2026-07-09  
監査対応本体commit: `0dfbc07 Harden admin auth and notification delivery`  
本番Web: https://oyano-moshimo-navi.vercel.app  
Supabase Project ref: `ypnuxyfirlvbsqujocuy`  

## 依頼したいレビュー範囲

このレビューは、UI感想ではなくコード、設計、セキュリティ、本番運用リスクの確認を目的にしています。

特に見てほしい点:

1. Web診断からアプリ引き継ぎまでの安全性
   - `/api/cases/[caseId]/diagnosis`
   - `/api/handoff/consume`
   - `supabase/handoff_consume_rpc.sql`
   - handoff tokenが短命、使い捨て、推測困難、トランザクション安全になっているか。

2. Supabase RLSとservice role利用
   - `supabase/schema.sql`
   - `supabase/production_rls.sql`
   - `supabase/production_pending_hardening.sql`
   - `apps/web/lib/serverSupabase.ts`
   - service roleを使うAPIがRLS任せになっていないか。

3. Admin認可
   - `apps/web/lib/adminAuth.ts`
   - `apps/web/lib/adminClientAuth.ts`
   - `scripts/smoke-admin-bearer.mjs`
   - `ADMIN_ACCESS_TOKEN` fallbackを残している状態のリスク。
   - app_admin Bearer認証の判定条件が十分か。

4. 通知エンジン
   - `supabase/notification_delivery_hardening.sql`
   - `supabase/task_notification_generation.sql`
   - `apps/web/app/api/cron/send-due-notifications/route.ts`
   - 同日ダイジェスト、冪等性、二重送信、opened_at計測の妥当性。

5. 要配慮個人情報
   - `apps/web/app/diagnosis/DiagnosisForm.tsx`
   - `apps/web/app/api/cases/[caseId]/diagnosis/route.ts`
   - `supabase/sensitive_info_consent_hardening.sql`
   - 同意ログ、保存項目、削除依頼導線が最低限成立しているか。

6. App Store審査リスク
   - Expoアプリ内に外部決済CTAやStripe誘導が残っていないか。
   - Web/Stripeとアプリ内機能の課金境界が崩れていないか。

7. Stripe未接続部分
   - `apps/web/app/api/stripe/checkout/route.ts`
   - `apps/web/app/api/stripe/webhook/route.ts`
   - 本番Stripe設定前に直すべき実装・検証漏れ。

## 現在の本番確認状況

完了:

- GitHub push済み。
- Vercel本番デプロイ済み。
- Supabase本番DB構築済み。
- `production_pending_hardening.sql` 投入済み。
- `verify_compact.sql` は全項目true確認済み。
- 本番同意ログsmoke成功。
- 本番Web smoke成功。
- Admin APIのapp_admin Bearer認証は監査指摘を受け、`family_members` ではなく `app_admins` 専用テーブルへ分離済み。`admin_auth_hardening.sql` 投入後にBearer smokeを再実行する。

未完了:

- Stripe本番設定。
- Expo実機でMagic Link、dashboard/person/tasks、push token保存確認。
- iOS preview build。
- 事業者正式情報、弁護士レビュー、家族3組テスト。

## 本番確認コマンド

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

ローカル確認:

```bash
pnpm run doctor:local
pnpm --filter web run typecheck
pnpm --filter mobile run typecheck
pnpm --filter web run build
```

## 注意

- `.env.local` などsecretはZIPに含めないこと。
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー環境変数専用。`NEXT_PUBLIC_` / `EXPO_PUBLIC_` に入れない。
- アプリ内には外部決済CTAを置かない方針。
- このプロダクトは低頻度・高重要度型。DAU向け通知やゲーミフィケーションは意図していない。
