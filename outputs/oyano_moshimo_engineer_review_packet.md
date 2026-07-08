# 親のもしもナビ v0.3 エンジニアレビュー資料

作成日: 2026年7月8日

## 目的

この資料は、エンジニアに現在の開発内容をレビューしてもらうためのものです。

見てほしいのは、画面デザインだけではなく、以下の全体です。

- Web入口とExpoアプリの役割分担
- Supabaseスキーマ、RLS、RPC、通知設計
- Web APIとモバイルアプリの接続
- 本番化に向けた残タスクとリスク
- セキュリティ、個人情報、App Store審査観点

## リポジトリ

GitHub:

https://github.com/dogwoodcommunity/oyano-moshimo-navi

主な構成:

```txt
apps/web        Next.js Web入口、診断、結果、Admin、Web API
apps/mobile     Expoアプリ、家族ボード、通知、タスク、家族招待
packages/shared 診断ロジック、ステータス、共通型
supabase        schema、RLS、RPC、通知生成SQL、storage設定
docs            設計・運用・本番化メモ
scripts         doctor、smoke、EAS補助
```

## 現在の本番・プレビューURL

Web production:

https://oyano-moshimo-navi.vercel.app

Web入口:

https://oyano-moshimo-navi.vercel.app/start

Android preview build:

https://expo.dev/accounts/oyanomosimonavi/projects/oyano-moshimo-navi/builds/7dfe2597-b3e3-43ba-b17f-7ef0bc71879f

APK:

https://expo.dev/artifacts/eas/t0-PSSFAHIxnpk3oSQn4e9R5wexVAcco-E2ksvpzlHk.apk

Supabase:

```txt
Project URL: https://ypnuxyfirlvbsqujocuy.supabase.co
Region: Northeast Asia (Tokyo)
```

秘密情報はこの資料に含めていません。

## プロダクト設計

### 基本方針

「親のもしもナビ」は、Web入口 + Expo継続アプリの二段構えです。

Webは、アプリ不要で状況整理を完了する場所です。

```txt
/start -> /diagnosis -> /result/[caseId]
```

Expoアプリは、継続利用の場所です。

```txt
login/onboarding -> dashboard -> person -> tasks
```

### アプリの定義

アプリはDAU型ではありません。

```txt
保管庫
通知係
家族ボード
```

毎日使わせるのではなく、必要な瞬間に戻ってこられる設計です。

重要KPI:

- 通知開封率
- 90日後のアカウント生存率
- 家族招待率
- 発動サポートパックの支払意思

## 実装済みの主な導線

### Web

- `/home`
- `/start`
- `/diagnosis`
- `/result/[caseId]`
- `/support-pack`
- `/admin`
- `/guides`
- `/checklists`
- `/safety`
- `/plans`
- `/providers`

主なWeb API:

```txt
/api/cases
/api/handoff/consume
/api/notifications/opened
/api/notification-preferences
/api/push-tokens/register
/api/cron/send-due-notifications
/api/stripe/*
/api/admin/*
```

### Mobile

- 初回オンボーディング
- Magic Linkログイン導線
- Web診断結果のhandoff
- Dashboard
- Person detail
- Tasks
- 担当者表示・変更
- 通知設定
- 家族招待
- 写真アップロード
- アカウント削除依頼
- プラン表示

最新の初回画面では、いきなりメール入力を出さず、内容説明後に会員登録へ進む形に変更しています。

## 最新の重要修正

### 1. 初回オンボーディング改善

対象:

```txt
apps/mobile/app/(auth)/welcome.tsx
apps/mobile/assets/onboarding-family-home.png
```

変更内容:

- 起動直後にメール入力を出さない
- 写真ヒーローを表示
- アプリの価値を先に説明
- 主CTAを「新規会員登録はこちら」に変更
- 登録/ログインCTA押下後だけメール入力を表示

### 2. 未ログイン時のTabsガード

対象:

```txt
apps/mobile/app/(tabs)/_layout.tsx
apps/mobile/lib/demoSession.ts
```

背景:

Androidが前回のDashboardルートを復元し、アプリ起動直後に家族ボードへ行く事象がありました。

対応:

- Supabase sessionありならTabs表示
- 「まず見本を見る」を押した同一起動中だけDemo sessionとしてTabs表示
- 未ログインでTabsが復元された場合は `/(auth)/welcome` へRedirect

レビュー観点:

- このガードの粒度でよいか
- Demo sessionをメモリだけで持つ設計でよいか
- ログイン済みユーザーの復帰体験を損ねていないか

## Supabase設計

SQL投入順:

```txt
1. schema.sql
2. task_template_seed.sql
3. task_generation.sql
4. notification_delivery_hardening.sql
5. task_notification_generation.sql
6. monthly_checkin_notifications.sql
7. product_seed.sql
8. indexes.sql
9. api_grants.sql
10. production_rls.sql
11. family_invite_rpc.sql
12. storage_setup.sql
13. verify_setup.sql
14. verify_compact.sql
```

主要テーブル:

```txt
families
family_members
family_invites
people
cases
case_results
tasks
task_templates
person_status_events
push_tokens
notification_preferences
scheduled_notifications
support_packs
purchases
home_photos
account_delete_requests
audit_logs
products
```

### RLS

`production_rls.sql` で主要テーブルのRLSを有効化済みです。

基本方針:

- family所属ユーザーだけが family/person/tasks を読める
- 同じfamilyのメンバーならタスク担当変更可
- admin readは `is_app_admin()` 経由
- client直INSERTを避けるべき箇所はRPC経由

レビュー観点:

- family boundaryを越えたSELECT/UPDATEがないか
- service role前提APIでクライアント露出がないか
- storage policyが `home-photos` bucketで適切か

## 通知設計

通知は「低頻度・高重要度」方針です。

### due通知

タスク種別・priorityで通知段数を変えます。

```txt
法定期限系: 14d / 7d / 1d / 当日
priority high: 7d / 1d
その他: 1d
```

同日複数通知はdigest化します。

### scheduled_notifications

重要な設計:

- `task_id` nullable
- `monthly_checkin` は `task_id = null`
- `UNIQUE(user_id, task_id, notification_type)`
- due_date/status/assigned_member_id変更時にpending削除・再生成
- task削除時はFK cascade
- payloadに `scheduled_notification_ids` を配列で積む
- notification tap時に該当行まとめて `opened_at` 更新

### opened_at

実装済み:

```txt
apps/mobile/app/_layout.tsx
apps/mobile/lib/notifications.ts
apps/web/app/api/notifications/opened/route.ts
```

所有権チェック:

```txt
id in ids
user_id = auth user
opened_at is null
```

レビュー観点:

- digest tap時に複数行へopened_atを打つ仕様の妥当性
- Expo push receiptと開封KPIの分離
- cron/send batchの冪等性

## 家族招待設計

対象SQL:

```txt
supabase/family_invite_rpc.sql
```

Freeプラン:

```txt
オーナー以外2名まで無料
family_membersのowner以外 + pending invitesをカウント
pending inviteは7日以内だけ有効
```

RPC:

```txt
create_family_invite(p_family_id, p_invited_email, p_role, p_relationship)
accept_family_invite(p_token)
```

レビュー観点:

- pending inviteを含めた上限判定
- accept時の二重チェック
- direct INSERTをRLSで塞げているか
- invite tokenの扱い

## 決済・課金設計

### Web

発動サポートパックはWeb/Stripe前提です。

未完了:

```txt
STRIPE_SECRET_KEY
STRIPE_SUPPORT_PACK_PRICE_ID
STRIPE_WEBHOOK_SECRET
```

### App

アプリ内に外部決済CTAは置きません。

App Store審査対策:

- アプリ内では購入導線を出さない
- 発動パックは申込済み/状態表示に寄せる
- 将来のアプリ内デジタル継続課金はIAP余地を残す

レビュー観点:

- App Store Guideline上の危険文言がないか
- Web決済とIAPの将来分岐
- Plus機能の境界

## セキュリティ・個人情報

扱う情報:

- 入院
- 認知症
- 危篤
- 死亡
- 家族構成
- 実家写真
- 手続き状況

要配慮個人情報に該当し得るため、リリース前に法務レビューが必要です。

保存しない方針:

- 銀行暗証番号
- パスワード
- マイナンバー画像
- 法律/税務判断の断定

レビュー観点:

- 本人同意導線
- プライバシーポリシー表現
- Supabaseリージョンと保管場所表記
- service role keyの露出
- Admin token運用

## 環境変数

Web:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_ACCESS_TOKEN
STRIPE_SECRET_KEY
STRIPE_SUPPORT_PACK_PRICE_ID
STRIPE_WEBHOOK_SECRET
```

Mobile:

```txt
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_APP_SCHEME
EXPO_PUBLIC_WEB_BASE_URL
EXPO_PUBLIC_EAS_PROJECT_ID
```

重要:

```txt
SUPABASE_SERVICE_ROLE_KEY は Expo / NEXT_PUBLIC / EXPO_PUBLIC に入れない
```

## ビルド・確認コマンド

```bash
pnpm install
pnpm run doctor:local
pnpm run typecheck
pnpm --filter web run build
pnpm run doctor:mobile-build
pnpm --dir apps/mobile exec expo export --platform android --output-dir /tmp/oyano-mobile-export
node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app
```

EAS:

```bash
pnpm run eas:whoami
pnpm run eas:mobile:build:android
```

## 現在分かっている未完了

### 必須

- Stripe本番/テスト決済接続
- Auth Magic Link Redirect URLの本番最終確認
- Magic Link実機確認
- Web診断結果からMobile handoff実機確認
- Push token保存確認
- iOS preview/TestFlight
- 法務文書の正式情報反映
- 弁護士レビュー

### 重要

- Android実機は一時 `unauthorized` になり、USBデバッグ許可待ち
- 最新APKはEAS build済みだが、実機への再インストール確認は許可後に再開
- Family Plus/IAPは未実装
- Stripe支払い後のsupport pack状態確認は未完了

## エンジニアに特に見てほしいレビュー項目

1. Supabase RLSに家族境界漏れがないか
2. `scheduled_notifications` の冪等性とdigest設計
3. `/api/notifications/opened` の所有権チェック
4. family invite RPCの無料2名制限
5. service role keyの利用箇所と露出リスク
6. Expo Magic Link redirectの安定性
7. 未ログイン時Tabs guardの設計
8. App Store審査上の外部決済CTA混入リスク
9. 個人情報・要配慮個人情報の保存範囲
10. 本番運用で必要なcron/Edge Function/ログ監視

## 読む順番

まず以下を読んでください。

```txt
README.md
docs/SCREEN_STRUCTURE.md
docs/SUPABASE_TABLES.md
docs/PAYMENT_POLICY.md
docs/PRIVACY_AND_REVIEW_GUARDRAILS.md
docs/PRODUCTION_CHECKLIST.md
supabase/README.md
supabase/schema.sql
supabase/production_rls.sql
supabase/family_invite_rpc.sql
supabase/task_notification_generation.sql
supabase/notification_delivery_hardening.sql
```

次に実装を見る場合:

```txt
apps/web/app/start/page.tsx
apps/web/app/diagnosis/DiagnosisForm.tsx
apps/web/app/result/[caseId]/page.tsx
apps/web/app/api/handoff/consume/route.ts
apps/web/app/api/cron/send-due-notifications/route.ts
apps/web/app/api/notifications/opened/route.ts
apps/mobile/app/(auth)/welcome.tsx
apps/mobile/app/(tabs)/_layout.tsx
apps/mobile/app/(tabs)/dashboard.tsx
apps/mobile/app/people/[id]/tasks.tsx
apps/mobile/lib/mobileData.ts
apps/mobile/lib/notifications.ts
apps/mobile/lib/handoff.ts
packages/shared/src
```

## 補足

開発経緯と作業ログは `docs/SESSION_HANDOFF.md` に継続記録しています。

チャットが切れても再開できるよう、実装変更・EAS build・実機確認の履歴をここに残しています。
