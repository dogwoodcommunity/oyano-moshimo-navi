# 親のもしもナビ v0.3 コードレビュー観点チェックリスト

## セキュリティ

- [ ] `SUPABASE_SERVICE_ROLE_KEY` を使うAPIが個別に認可している。
- [ ] `ADMIN_ACCESS_TOKEN` fallbackの残存リスクが許容できる。
- [ ] app_admin Bearer認証が `app_admins` 専用テーブルだけを見ており、他familyの通常adminと混同されない。
- [ ] handoff tokenが推測困難、短命、使い捨てになっている。
- [ ] handoff consumeが途中失敗で再試行不能にならない。
- [ ] `/api/stripe/checkout` が `caseId` だけでは進まず、結果画面由来の短命 `checkoutToken` を検証している。
- [ ] Magic Link / deep linkにオープンリダイレクト余地がない。
- [ ] Storageの写真アップロードが家族権限確認後のsigned URL経由になっている。
- [ ] アカウント削除依頼とaudit logに漏れがない。

## Supabase / RLS

- [ ] family境界を越えて `people`, `tasks`, `homes`, `home_photos` が読めない。
- [ ] `family_invites` / `family_members` の直接INSERTが制限され、RPC経由の上限判定が効く。
- [ ] Freeプランの「オーナー以外2名まで」制限がDB側で破れない。
- [ ] app_admin policyが必要な管理テーブルだけに効いている。
- [ ] `verify_compact.sql` のチェック項目が不足していない。

## 通知

- [ ] 法定期限/高優先度/通常タスクの通知段数が設計通り。
- [ ] 同日ダイジェストで通知スパムになりにくい。
- [ ] `claim_due_scheduled_notifications` と `reset_stale_sending_notifications` で二重送信/送信詰まりが起きにくい。
- [ ] due_date変更、担当者変更、タスク完了、タスク削除時にpending通知が残らない。
- [ ] push payloadに通知ID配列が入り、opened_at一括更新ができる。

## Web導線

- [ ] `/home` から入口が分かりやすい。
- [ ] `/start -> /diagnosis -> /result/[caseId]` が未ログインで完走できる。
- [ ] 要配慮個人情報の同意なしに診断送信できない。
- [ ] 結果画面からアプリ引き継ぎリンクが生成される。
- [ ] 結果画面から発動サポートパック申込に進む場合、`checkoutToken` が付与される。
- [ ] Stripe未設定時にサイトが壊れない。

## Expoアプリ

- [ ] 初回起動でいきなりメール入力を強制しすぎていない。
- [ ] 会員登録/ログイン前にアプリの価値が伝わる。
- [ ] dashboardが「今日・期限超過」「7日以内」「担当未定」を中心に見える。
- [ ] tasksの担当者変更はDBトリガーに通知再生成を任せている。
- [ ] アプリ内にWeb決済/Stripe誘導文言が残っていない。

## 法務・運用

- [ ] 入院、認知症、危篤、死亡など要配慮個人情報の取得同意設計が現実的。
- [ ] 親本人同意が取りにくい場面の説明と利用目的限定が十分。
- [ ] プライバシーポリシー、特商法、削除依頼SLAが本番運用に耐える。
- [ ] 実家写真が空き家特定リスクを高めないようUIで注意喚起している。
- [ ] オーナー本人死亡時の承継設計が運用可能。

## 事業検証

- [ ] 発動サポートパック9,800円の支払意思をWebで測れる。
- [ ] 家族共有2名無料が拡散導線として成立している。
- [ ] KPIがDAUではなく通知開封率、90日生存率、タスク完了に寄っている。
- [ ] 家族3組テストで見るべき項目が明確。
