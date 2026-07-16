# 親のもしもナビ v0.3 エンジニアレビュー・チェックリスト

作成日: 2026-07-16  
対象commit: `b00fdb2`

## 1. セキュリティ

- [ ] `SUPABASE_SERVICE_ROLE_KEY` を使うAPIがRLS任せになっていない。
- [ ] service roleを使うAPIに、ユーザー/管理者/cronの認可境界が明示されている。
- [ ] `ADMIN_ACCESS_TOKEN` fallbackの残存リスクが本番運用上許容できる。
- [ ] app_admin Bearer認証が `app_admins` 専用テーブルだけを見ている。
- [ ] 管理APIで通常family adminとapp adminが混同されない。
- [ ] handoff tokenが推測困難、短命、使い捨てになっている。
- [ ] handoff consumeが途中失敗で再試行不能にならない。
- [ ] `/api/stripe/checkout` が `caseId` だけでは進まず、短命 `checkoutToken` を検証している。
- [ ] Magic Link / deep linkのredirectにオープンリダイレクト余地がない。
- [ ] Storageの写真アップロードが家族権限確認後のsigned URL経由になっている。
- [ ] アカウント削除依頼とaudit logに漏れがない。

## 2. Supabase / RLS

- [ ] family境界を越えて `people`, `tasks`, `homes`, `home_photos` が読めない。
- [ ] `family_invites` / `family_members` の直接INSERTが制限され、RPC経由の上限判定が効く。
- [ ] Freeプランの「オーナー以外2名まで」制限がDB側で破れない。
- [ ] pending inviteを上限カウントに含めている。
- [ ] invite受諾時にも上限を再チェックしている。
- [ ] app_admin policyが必要な管理テーブルだけに効いている。
- [ ] `verify_compact.sql` のチェック項目に不足がない。
- [ ] `storage.objects` のポリシーがhome photoのfamily境界を守っている。

## 3. 通知

- [ ] 法定期限/高優先度/通常タスクの通知段数が設計通り。
- [ ] 同日ダイジェストで通知スパムになりにくい。
- [ ] ダイジェスト本文に先頭2件程度の内容が入り、タップする理由がある。
- [ ] `claim_due_scheduled_notifications` で二重送信が起きにくい。
- [ ] `reset_stale_sending_notifications` で送信詰まりを復旧できる。
- [ ] due_date変更、担当者変更、タスク完了、タスク削除時にpending通知が残らない。
- [ ] push payloadに通知ID配列が入り、opened_at一括更新ができる。
- [ ] `/api/notifications/opened` が `ids`、`user_id`、`opened_at is null` で絞っている。
- [ ] monthly check-inは低頻度・高重要度方針と矛盾していない。

## 4. Web導線 / PWA

- [ ] `/home` または `/` から入口が分かりやすい。
- [ ] `/start -> /diagnosis -> /result/[caseId]` が未ログインで完走できる。
- [ ] `/start` の選択カードが「押せる」ことを高齢者/家族が理解できる。
- [ ] 診断ページがGoogle Formっぽく見えすぎない。
- [ ] 要配慮個人情報の同意なしに診断送信できない。
- [ ] 結果画面からアプリ/PWA引き継ぎリンクが生成される。
- [ ] 結果画面から発動サポートパック申込に進む場合、`checkoutToken` が付与される。
- [ ] Stripe未設定時にサイトが壊れない。
- [ ] PWA manifest / service worker / iconが本番で配信されている。

## 5. Expo / モバイル

- [ ] 初回起動でいきなりメール入力を強制しすぎていない。
- [ ] 会員登録/ログイン前にアプリの価値が伝わる。
- [ ] dashboardが「今日・期限超過」「7日以内」「担当未定」を中心に見える。
- [ ] tasksの担当者変更はDBトリガーに通知再生成を任せている。
- [ ] tasksの「担当未定」が明示的に見える。
- [ ] 写真アップロード導線で空き家特定リスクに注意喚起できている。
- [ ] アプリ内にWeb決済/Stripe誘導文言が残っていない。
- [ ] Android実機とiOS/TestFlightでdeep link挙動に差がないか。

## 6. 法務・プライバシー

- [ ] 入院、認知症、危篤、死亡など要配慮個人情報の取得同意設計が現実的。
- [ ] 親本人同意が取りにくい場面の説明と利用目的限定が十分。
- [ ] プライバシーポリシーに要配慮情報、保存場所、削除、第三者提供が書かれている。
- [ ] 特商法表記が発動サポートパック販売に耐える。
- [ ] 削除依頼SLAと実削除処理が運用可能。
- [ ] 実家写真が空き家特定リスクを高めないよう注意喚起している。
- [ ] オーナー本人死亡時の承継設計が運用可能。

## 7. Stripe / 課金境界

- [ ] 発動サポートパックはWeb/Stripe前提で、アプリ内購入導線と混ざっていない。
- [ ] App Store審査上、アプリ内に「Webで申し込めます」等の外部決済誘導がない。
- [ ] Stripe webhookが署名検証している。
- [ ] Webhookの冪等性がある。
- [ ] `purchases` / `support_packs` の状態更新が失敗時に破綻しない。
- [ ] Family Plusを将来IAP化する余地が残っている。

## 8. 事業検証

- [ ] 発動サポートパック9,800円の支払意思をWebで測れる。
- [ ] 家族共有2名無料が拡散導線として成立している。
- [ ] KPIがDAUではなく通知開封率、90日生存率、タスク完了に寄っている。
- [ ] 家族3組テストで見るべき項目が明確。
- [ ] PMF前にネイティブアプリ維持コストを増やしすぎていない。

## 9. レビューで結論を出してほしいこと

- [ ] v0.3を家族3組テストに出してよいか。
- [ ] Stripe本番接続前に必ず直すべき箇所はあるか。
- [ ] Supabase RLS/Service role/Admin認可にリリースブロッカーがあるか。
- [ ] handoff/deep linkにリリースブロッカーがあるか。
- [ ] 法務レビュー前提で、技術側から追加すべき同意/削除/監査実装があるか。
