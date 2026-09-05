# 環境変数マトリクス

## Web / Vercel

| Key | Required | Public | 用途 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | no | Next.js APIからDB/Storageへ安全に書き込む |
| `ADMIN_ACCESS_TOKEN` | yes | no | Admin API簡易保護 |
| `ACCOUNT_ERASURE_EXECUTION_ENABLED` | 1件ごとの実行時間帯だけ | no | Web側の粗い完全削除スイッチ。通常は `false`。この値だけでは実行できず、DB ownerだけが開ける最大15分・one-shot control、削除専用実行者のAAL2、当該実行者の有効化を承認した別のAAL2 app admin、確定済みrequest/target/job/hash/operatorとcontrol epochに固定した最大10分・1回限りのgrantがすべて必要 |
| `COMMERCIAL_SUPPORT_PACK_SALES_ENABLED` | 有料提供時 | no | `true` の場合だけ発動サポートパック受付を開く最終スイッチ。通常は `false` |
| `COMMERCIAL_PLUS_SALES_ENABLED` | Plus提供時 | no | `true` の場合だけPlus受付を開く最終スイッチ。通常は `false` |
| `STRIPE_SECRET_KEY` | support pack時 | no | Stripe Checkout作成 |
| `STRIPE_SUPPORT_PACK_PRICE_ID` | support pack時 | no | 発動サポートパックPrice |
| `STRIPE_WEBHOOK_SECRET` | support pack時 | no | Stripe Webhook署名検証 |
| `CRON_SECRET` | notification時 | no | Cron手動実行保護 |
| `RESEND_API_KEY` | メール通知時 | no | 期限・月1確認メールをResend APIから送信 |
| `NOTIFICATION_EMAIL_FROM` | メール通知時 | no | Resendで認証済みの送信元。表示名つき形式も可 |
| `NOTIFICATION_EMAIL_REPLY_TO` | 任意 | no | 通知メールへの返信を受ける窓口 |
| `ANTHROPIC_API_KEY` | 長期相談時 | no | `/api/consult` からClaude APIを呼ぶ |
| `CONSULT_CLIENT_DAILY_LIMIT` | 任意 | no | 端末/IPごとの原価安全上限。既定5。無料枠の1日1回はDBで家族単位に別途原子的に制御 |
| `CONSULT_FAMILY_MONTHLY_LIMIT` | 任意 | no | Family Plusの相談成功回数/月。既定30。家族単位で判定 |
| `CONSULT_DAILY_LIMIT` | 任意 | no | サービス全体の相談回数/日。既定50。想定外の請求を防ぐ緊急上限 |
| `CONSULT_MAX_OUTPUT_TOKENS` | 任意 | no | AI相談1回答の最大出力。既定1,600、コード側上限2,000 |
| `CONSULT_FAST_MODE` | 任意 | no | `1` で出力を最大2.5倍速に。料金は2倍。使えない環境では通常速度へ自動で落ちる |
| `NEXT_PUBLIC_IOS_APP_URL` | 公開後 | no | Web入口からApp Storeへ送る。未設定なら導線を出さない |
| `NEXT_PUBLIC_ANDROID_APP_URL` | 公開後 | no | 同上（Google Play） |
| `STRIPE_PLUS_PRICE_ID` | Plus提供時 | no | 継続課金のprice。未設定なら `/api/stripe/plus-checkout` は503 |
| `NEXT_PUBLIC_PLUS_PRICE_LABEL` | Plus提供時 | no | `/plans` の価格表示。未設定なら「準備中」 |
| `LEGAL_BUSINESS_NAME` | 無料正式公開時 | no | 確定値は `株式会社BEECH`。無料版の運営主体、有料時は特商法表示の正式な販売事業者名にも使う |
| `LEGAL_RESPONSIBLE_PERSON` | 無料正式公開時 | no | 確定値は `代表取締役 池田哲也`。個人情報管理・運営の責任者、有料時は特商法表示の責任者にも使う |
| `LEGAL_ADDRESS` | 有料提供時 | no | 特商法表示の所在地 |
| `LEGAL_PHONE` | 有料提供時 | no | 特商法表示の電話番号 |
| `LEGAL_PHONE_HOURS` | 有料提供時 | no | 電話の受付時間 |
| `LEGAL_CONTACT` | 無料正式公開時 | no | 確定値は `info@bee-ch.co.jp`。利用者が実際に連絡できる問い合わせメールまたはフォームURL |
| `LEGAL_CONTACT_RESPONSE_TARGET` | 無料正式公開時 | no | 確定値は `メール受付：24時間／原則3営業日以内に返信`。法務ページに表示する受付・返信目安 |
| `LEGAL_TERMS_EFFECTIVE_DATE` | 無料正式公開時 | no | 正式公開日と同じ日本時間の実日付を `YYYY年M月D日` で入力。方針文言や仮日付は不可 |
| `LEGAL_PRIVACY_EFFECTIVE_DATE` | 無料正式公開時 | no | 正式公開日と同じ日本時間の実日付を `YYYY年M月D日` で入力。方針文言や仮日付は不可 |
| `LEGAL_PRICE_DESCRIPTION` | 有料提供時 | no | 税込価格、自動更新周期など実際の販売価格説明 |
| `LEGAL_SERVICE_DELIVERY` | 有料提供時 | no | 決済後に機能・役務を提供する時期 |
| `LEGAL_CANCELLATION_POLICY` | 有料提供時 | no | 解約方法、次回更新停止、返金条件 |
| `REVENUECAT_WEBHOOK_SECRET` | App内課金時 | no | `/api/revenuecat/webhook` の認証。未設定なら501 |
| `NEXT_PUBLIC_APP_SCHEME` | yes | yes | アプリ引き継ぎURL |
| `NEXT_PUBLIC_WEB_BASE_URL` | yes | yes | Web本番URL |

## Mobile / Expo EAS

| Key | Required | Public | 用途 |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | yes | Supabase URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Supabase anon key |
| `EXPO_PUBLIC_APP_SCHEME` | yes | yes | deep link scheme |
| `EXPO_PUBLIC_WEB_BASE_URL` | yes | yes | handoff API呼び出し元Web URL |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | push通知時 | yes | Expo Push Token取得用のEAS projectId |

## Supabase Auth Redirect URLs

Supabase Dashboard > Authentication > URL Configuration に設定する。

開発:

```txt
oyanomoshimo://
exp://127.0.0.1:8081
http://localhost:3000
```

本番:

```txt
oyanomoshimo://
https://<web-domain>
```

## 注意

- `SUPABASE_SERVICE_ROLE_KEY` は絶対に `NEXT_PUBLIC_` / `EXPO_PUBLIC_` にしない。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` は `account_delete_executor_role.sql`、`account_deletion_pipeline.sql`、`account_erasure_execution_gate.sql` のDB-first適用、破棄DB回帰試験、対応Webの本番反映、個別実行者のTOTP/AAL2、当該実行者の有効化を承認した別確認者のAAL2 app admin、単独テストアカウントの完走がすべて終わるまで `false` のままにする。新gateは2026-09-05に本番適用し、読み取り専用12項目でRPC・ACL・private表FORCE RLSを確認済み。controlは1行・active 0件、grant・削除依頼・削除jobは各0件、有効な削除専用実行者は1件だった。同日に対応Web `c1415b3` の本番反映・Ready・smoke・削除API未認証401を確認し、Vercel productionの実行スイッチ未登録（OFF）を確認した。更新後の本人ログインによる200/403・AAL2再確認と完全削除E2Eは未完了である。Webのpreflight/prepareはprivacy-safeな `inspect_account_erasure_v2` / `prepare_account_erasure_v2` だけを使い、blocker応答は正規化codeと数値件数だけとし、`familyId`、`familyName`、Storage object/prefixの生pathをブラウザに返さない。実行時はAAL2 prepareの後、DB ownerが `account_delete_private.open_account_erasure_execution_control_v1` で最大15分のone-shot controlを開く。正確なrequest/target/job ID・operator・manifest hashと現在のcontrol epochに固定され、controlの残り時間を超えない未使用・未失効の最大10分grantを必須とする。DB削除成功時はgrantとcontrolを同じトランザクションで1回だけ消費し、放棄時はDB ownerが `account_delete_private.close_account_erasure_execution_control_v1` で閉じる。緊急用管理キーでは削除依頼の閲覧・状態変更・事前確認・実削除のいずれもできない。
- 通常の新規DB削除はenv ON、live owner control、未使用・未失効grantが必須である。例外はDB削除がcommit済みの `database_erased` の回復だけで、最初のDB削除を実行した本人と同じ削除専用実行者が現在も有効かつAAL2で正確なrequest/target/job/manifest hashを送り、DB v2が同じjobの消費済み・未取消しgrantと現在の実行者hash＝grantの `operator_user_hash` を再検証した場合に限り、env OFF後もAuth/Storage不在確認と最終化を続行できる。DB未削除、値不一致、grant未消費・取消済み、無効な実行者、AAL1、別の有効な削除専用実行者は停止し、この経路を新規削除のenv OFF bypassにしない。
- 削除専用実行者向けの依頼一覧は、SELECT段階で連絡先、自由記載の理由、処理メモ、担当者メール/user IDを除く。依頼状態と処理メモのPATCHは現routeと `update_account_delete_request_status_v2` の双方でAAL2の `app_admin` を確認し、削除専用実行者はAAL2でも更新できない。
- 新gateはservice roleの `account_delete_executors` 生table SELECTを取り上げ、対応Webはservice-only `verify_account_delete_operator_v2(uuid)` が返すrole methodだけで削除認可を行う。生tableを読む旧deploymentは一覧・実行handlerより前の認可でfail closedになる。状態PATCHも対応Webは `update_account_delete_request_status_v2` だけを使い、旧 `update_account_delete_request_status_v1` のservice role EXECUTEを失効させるため、旧AAL1 deploymentはPATCHできない。一覧は `requested` / `reviewing` / `needs_followup` をページ取得で全件含め、`completed` だけを直近100件に限る。gateの本番適用・権限確認と対応Webの本番反映は2026-09-05に完了し、更新後の本人ログインによる権限・AAL2の実機再確認は未完了である。
- Vercelの環境変数はdeploymentごとに固定される。新しいdeploymentで `false` に戻しても、過去の `true` deploymentの直接URLが残る場合があるため、環境変数OFFだけを閉鎖証跡にしない。DB controlは既定closedでWeb/API roleから開けず、旧v1 inspect/prepare/status update/execute RPCはservice roleから失効し、execute v2はlive controlなしで `execution_control_disabled` となる。このため過去のON deploymentが残ってもDB controlなしでは新規DB削除できない。実行後はcontrolが消費済み・closed・期限切れのいずれかでactiveでなく、grantもactive 0件であることを確認し、`false` deploymentへ公開aliasを移し、`true` deploymentを削除または保護する。前項の `database_erased` 回復は、対応済みWebとDB v2がexact job/hash、消費済みgrant、現在の実行者hash＝grantの `operator_user_hash` を再検証する限定的な完了処理であり、別の有効実行者への引継ぎも許さず、この閉鎖境界を緩めない。
- `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` はWebサーバーだけに置く。
- 特商法用の `LEGAL_*` とStripeの必須設定がすべて揃い、対象の `COMMERCIAL_*_SALES_ENABLED=true` を明示するまでは、有料申込ボタンとCheckout APIを開かない。
- `ANTHROPIC_API_KEY` もWebサーバーだけに置く。未設定の場合、長期相談は503を返し、手帳の他の機能は通常どおり動く。
- `RESEND_API_KEY` と `NOTIFICATION_EMAIL_FROM` のどちらかが未設定なら、メール通知だけを停止し、端末通知は継続する。
- メール通知を有効にする前に `supabase/notification_email_delivery.sql` を本番DBへ適用する。未適用なら二重送信防止のためメールだけを停止する。
- Expoアプリ内に外部Web決済CTAを置かない。
