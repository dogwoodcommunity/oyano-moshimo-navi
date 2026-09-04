# 無料Web正式版 Stage A 運用手順書

最終更新: 2026-09-04

対象: 親のもしもナビ 無料Web版（Next.js / Vercel / Supabase / 任意のResend）

## 1. この文書の位置づけ

この文書は、無料Web版を正式運用する担当者が、障害、問い合わせ、削除依頼、復旧、リリースを同じ判断基準で扱うための手順書である。[正式公開計画](COMMERCIAL_RELEASE_PLAN_2026-09-03.md)、[デプロイ手順](DEPLOYMENT.md)、[本番チェックリスト](PRODUCTION_CHECKLIST.md)、[Supabaseセットアップ](../supabase/README.md)を補完する。

ここに書かれた「目標」は内部運用目標であり、利用者への保証またはSLAではない。外部サービスの管理画面をこの文書作成時には確認していないため、Vercel・Supabase・Resendの契約プラン、バックアップ、アラート、ドメイン認証、環境変数の実設定状態はすべて本番管理画面で再確認する。

### 1.1 判定ラベル

- **実装あり**: 現在のリポジトリにコードまたは設定がある。
- **外部要確認**: コードだけでは本番設定・稼働を確認できない。
- **公開前必須**: 未確認のままStage Aを正式公開しない。
- **本番変更**: DB、Storage、Auth、環境変数、デプロイ、外部送信を変更する。担当者と対象を復唱し、承認を得てから実行する。

### 1.2 最初に埋める担当欄

以下が未記入なら、障害対応と削除依頼の正式運用は開始しない。

| 役割 | 氏名・連絡手段 | 代行者 |
| --- | --- | --- |
| 運用責任者 / Incident Commander | **要指定** | **要指定** |
| リリース担当 | **要指定** | **要指定** |
| Supabase・個人情報削除担当 | **要指定** | **要指定** |
| 問い合わせ一次受付 | **要指定** | **要指定** |
| セキュリティ・法務連絡先 | **要指定** | **要指定** |

正式な利用者向け問い合わせ先は `info@bee-ch.co.jp`、対応目安は「メール受付：24時間／原則3営業日以内に返信」と確定した。ただし、`LEGAL_CONTACT` と `LEGAL_CONTACT_RESPONSE_TARGET` の本番設定、実際の受信・返信、公開画面の表示は未確認である。通知メール用の `NOTIFICATION_EMAIL_REPLY_TO` は別用途のため未確定のままとする。[環境変数マトリクス](ENVIRONMENT_MATRIX.md)と公開画面を照合する。

## 2. 現行構成と、言ってよいこと

| 領域 | 現行の根拠 | 現時点の扱い |
| --- | --- | --- |
| Web | `apps/web` のNext.js、`vercel.json`、GitHub ActionsのVercel deploy | 実装あり。本番の現行deployment、Git連携、Actions secretsは外部要確認 |
| DB / Auth | Supabase PostgreSQL、Auth、RLS、server-only service role | 実装あり。本番migration適用状態とAuth設定は外部要確認 |
| 写真 | Supabase Storage `home-photos` | 実装あり。独立バックアップ・versioning・復元実績は未確認 |
| メール | Resendを使う期限・月1確認メール | 任意機能。`RESEND_API_KEY` と認証済み送信元が不足するとメールだけ停止する。設定済みとは扱わない |
| Cron | Vercel Cronから通知、匿名データ削除、日記・対象者Storage cleanup | 設定ファイルあり。本番での登録、直近成功、失敗通知は外部要確認 |
| アカウント削除 | 本人確認済み受付、管理一覧、app_admin限定実行API、再開可能なDB証跡RPC | 実装あり。実行スイッチは既定OFF。本番migration、管理者ログイン、単独テストアカウントでの完走は外部要確認 |
| 監視 | `/api/health`、Vercel/Supabase/Resendのログ | `/api/health` はWebプロセスだけの浅い確認。外部uptime・error alertは確認できず、未設定扱い |

`/api/health` の200だけでDB、Auth、Storage、Cron、Resendの正常を宣言してはいけない。`/admin/env` も環境変数の「存在」だけを確認し、値の正しさや外部疎通は確認しない。

## 3. 公開可否の運用ゲート

次をすべて満たした時だけStage Aの運用GOを記録する。

- [ ] 上記5役割と連絡手段、問い合わせ窓口を指定した。
- [ ] 本番URL、Vercel project、Supabase project refを二人で照合した。
- [ ] Vercelの自動deploy経路を「Git連携」または「GitHub Actions」の一方に決め、二重deployでないことを確認した。
- [ ] 本番環境変数を `/admin/env` と各外部サービスで照合した。値そのものは議事録やチャットに貼らない。
- [ ] 本番DBへ必要なmigrationを適用し、権限を含むread-only検証が通った。
- [ ] Supabase DB/AuthとStorageそれぞれのバックアップ方式・保持期間・直近成功を記録した。
- [ ] 隔離環境で復旧演習を行い、実測RPO/RTOを記録した。
- [ ] Vercel、Supabase、Cron失敗の通知先を設定した。未設定なら、後述の毎日手動確認を担当シフトへ割り当てた。
- [ ] 2アカウント×2端末で保存、復元、viewer拒否、写真、単一日記削除、アカウント削除依頼を確認した。
- [ ] 有料受付スイッチはStage Aでは `false` のままである。
- [ ] 未設定のResendを、通知可能と表示していない。
- [ ] 問い合わせ先とプライバシー表示を正式情報で確認した。
- [ ] 利用規約の施行日に、正式公開日と同じ実日付が表示されることを確認した。

1つでも未完了なら、運用GOではなく `NO-GO: <未完了項目>` と記録する。

## 4. バックアップ方針

### 4.1 保護対象

| 対象 | 正本 | 最低限必要な保護 |
| --- | --- | --- |
| アプリコード・設定 | Gitの承認済みcommit | remote repository、release SHA、Vercel deployment ID |
| PostgreSQLデータ | Supabase DB（`public` とAuth関連） | provider backupまたはPITR、保持期間、復元可能な時点 |
| 写真 | Supabase Storage `home-photos` | DBとは別にobject本体を戻せる仕組みとmanifest |
| 削除証跡 | `account_delete_requests`、`account_erasure_jobs`、`audit_logs` | 個人情報を増やさず、改変権限を限定したDB backup |
| 日記写真cleanup | `notebook_storage_deletion_jobs` | 未完了jobが親レコード削除後も残るDB backup |
| 対象者写真cleanup | `person_notebook_storage_deletion_jobs` | 未完了jobが対象者削除後も残るDB backup |
| メール配信状態 | `scheduled_notifications` のreceipt | DB backup。Resendログだけを正本にしない |

利用者がダウンロードできるJSON控えは補助的な可搬コピーであり、サービス側のバックアップではない。写真本体はbucket/path参照なので、JSONだけでは復元できない。[クラウド控え確認手順](CLOUD_BACKUP_VERIFICATION.md)も参照する。

Supabaseの[公式バックアップ案内](https://supabase.com/docs/guides/platform/backups)でも、DB backupにはStorage object本体が含まれないとされている。Free planを使う場合は公式案内に従ってDBを外部へ定期dumpし、Storageは[公式のobject download API](https://supabase.com/docs/guides/storage/management/download-objects)等でobject本体と復元に必要なmetadataを別に保護する。実際のplan・利用可能機能・保持期間は公開前に管理画面で確認する。

### 4.2 現時点のRPO/RTO

リポジトリには、Supabaseの本番backup設定、Storageの独立backup、復元演習の実測証跡がない。したがって、現時点で保証できるRPO/RTOは**なし**である。次は正式公開に向けた暫定目標で、外部設定と演習で達成を確認するまで「目標」のまま扱う。

| 障害範囲 | 暫定RPO目標 | 暫定RTO目標 | 現在の確証 |
| --- | --- | --- | --- |
| Web code / Vercelのみ | 承認済みrelease SHAまで（実質0） | 1時間 | Gitとrollback可能なdeploymentの外部確認が必要 |
| Supabase DB / Auth | 24時間以内 | 8時間 | backup/PITR契約・保持・Auth復元範囲・演習が未確認 |
| Supabase Storage | 24時間以内 | 24時間 | 独立backup方式と復元演習が未確認。公開前必須 |
| 通知処理 | DBのRPOに従う | 24時間 | 送信receipt migration、Cron、Resend設定が未確認 |

目標を達成できないプランまたは構成なら、プラン・方式を変更するか、目標を書き換えて運用責任者がNO-GO/GOを判断する。推測で「自動バックアップ済み」と記載しない。

### 4.3 日次・週次確認

毎日、担当者は外部管理画面をread-onlyで確認し、秘密値や利用者本文を含めず次を運用台帳へ記録する。

- Supabase: 最新backup時刻、結果、保持期限、DB health。
- Storage: object backupまたは複製jobの最新成功、対象件数、失敗件数。仕組みがない場合は `未実装` と記録しStage AをNO-GOにする。
- Vercel: production deployment ID、commit SHA、直近失敗、Function/Cron error。
- Resend: 有効化済みの場合だけdomain状態、失敗率、bounce。未設定なら `無効` と記録する。

週1回、次を確認する。

- backupの保持期間内に複数の復旧点が見える。
- Storage manifestとobject件数の増減に説明が付く。
- 削除済み利用者のデータを通常backupから不用意に個別復元しない復旧手順になっている。
- 復旧後に再削除すべき対象を判定できるよう、最小限の削除receiptが保持されている。

## 5. 定常監視

### 5.1 Cron時刻

`vercel.json` の式はUTCである。本番登録と実行履歴はVercel側で別途確認する。

| JST | endpoint | 副作用 | 成功時の目安 |
| --- | --- | --- | --- |
| 09:00 | `/api/cron/send-due-notifications` | push・設定済み時のみResend送信 | HTTP 200、`sent` / `pushSent` / `emailSent` |
| 12:30 | `/api/cron/purge-anonymous-cases` | 匿名データ・期限切れモニター情報の削除 | HTTP 200、各purge件数、errors空 |
| 13:00 | `/api/cron/cleanup-notebook-storage` | 削除予約済み日記写真の物理削除 | HTTP 200、`retained=0`、errors空 |
| 13:15 | `/api/cron/cleanup-person-notebook-storage` | 削除予約済み対象者写真の物理削除 | HTTP 200、`retained=0`、errors空 |

4 endpointとも `CRON_SECRET` をAuthorization headerで検証し、secret未設定なら503、誤りなら401で停止する。URL、ログ、チケットへsecretを入れない。Vercelの[公式Cron仕様](https://vercel.com/docs/cron-jobs/usage-and-pricing)ではHobby planは1日1回の頻度までで、指定時刻は同じ1時間内でずれる可能性がある。13:15ちょうどの実行を利用者へ約束せず、当日中のcleanupと未完了job監視を運用基準にする。

### 5.2 毎日の確認順

1. Webの浅い生存確認を行う。

   ```bash
   curl --fail-with-body "https://<web-domain>/api/health"
   ```

2. 主要画面と副作用前の認証拒否を確認する。

   ```bash
   node scripts/smoke-web.mjs "https://<web-domain>"
   ```

3. Vercelで直近24時間のFunction error、5xx、timeoutと4つのCron実行結果を確認する。
4. SupabaseでDB/Auth/Storageのerror、容量、接続、backup結果を確認する。
5. 以下をSupabase SQL Editorのread-only確認として実行する。テーブル不存在は「0件」ではなくmigration未適用である。

   ```sql
   select status, count(*) as jobs, min(created_at) as oldest,
          max(last_attempt_at) as latest_attempt
   from public.notebook_storage_deletion_jobs
   group by status
   order by status;

   select status, count(*) as jobs, min(created_at) as oldest,
          max(last_attempt_at) as latest_attempt
   from public.person_notebook_storage_deletion_jobs
   group by status
   order by status;

   select id, status, due_at, last_status_changed_at
   from public.account_delete_requests
   where status <> 'completed'
   order by due_at
   limit 100;
   ```

6. Resendを有効にした場合だけ、前日の送信・bounce・complaintを確認する。未設定時は通知メール0件が正常である。
7. 異常があれば時刻、環境、deployment ID、request/job ID、HTTP status、error codeだけを台帳へ記録する。本文、メール、token、写真pathは貼らない。

外部alertが設定されていない間は、この手動確認を省略できない。

## 6. 障害レベルと一次対応

| レベル | 例 | 内部ack目標 | 最初の判断 |
| --- | --- | --- | --- |
| SEV-1 | 誤った家族への開示、削除済みデータ復活、大量誤送信、全利用不能 | 30分 | Incident Commander招集、変更停止、証拠保全 |
| SEV-2 | 保存・復元・削除・Auth・Storageが一部利用不能、Cron連続失敗 | 2時間 | 担当割当、影響範囲特定、回避策判断 |
| SEV-3 | 単一問い合わせ、表示崩れ、再試行で回復する失敗 | 1営業日 | 通常チケットで再現・回答 |

これらは担当体制確定後の内部目標であり、現時点では保証ではない。

### 6.1 共通の最初の15分

1. 本番・preview・localのどこか、発生開始時刻（JST/UTC）、影響機能、最初に確認したdeployment SHAを記録する。
2. 新規releaseと手動Cron再実行を止める。証拠を消す再deploy、DB修正、ログ削除をしない。
3. `/api/health`、Vercel logs、Supabase logsをread-onlyで確認する。
4. 利用者のfamily ID、本文、写真、access tokenをチャットへ貼らない。必要なら内部の制限付き台帳にrequest IDだけを記録する。
5. 直前releaseとの相関を確認する。相関があっても、DB migration済みならWebだけを無条件に戻さない。
6. 復旧、rollback、secret rotation、外部送信停止など本番変更はIncident Commanderの承認後に行う。

### 6.2 症状別

**Webだけが5xx / build不良**

- Vercelの失敗時刻、deployment ID、commit SHA、Function logを確認する。
- DB schemaとの後方互換を確認してから、直前の正常deploymentをVercelでrollback/promoteする。
- rollback後に `/api/health` と `scripts/smoke-web.mjs` を再実行する。

**Supabase DB / Auth / Storage障害**

- Webの200だけで回復扱いにしない。該当サービスのstatusとproject logsを確認する。
- 現在はmaintenance modeや全書込停止スイッチが実装されていない。完全なwrite freezeをしたと記録しない。
- データ破損が疑われる場合は書込を増やすsmoke、同期、cleanup再試行を止め、復旧点とbackupを先に確保する。
- 復旧は隔離環境での検証を先に行い、復元元より新しい削除receiptを再適用する計画を作る。

**通知 / Resend異常**

- `notification_email_delivery.sql`、delivery receipt、Resend設定の有無を確認する。
- 重複送信の疑いがある時はCronを手動再実行しない。
- Resend未設定によるemail 0件は設計どおりであり、pushまで成功したとは限らない。
- 緊急停止にはVercel設定変更が必要である。変更の影響（push/email停止）を明示して承認を得る。

**日記・対象者写真cleanup失敗**

- `notebook_storage_deletion_jobs` と `person_notebook_storage_deletion_jobs` の `status`、`attempt_count`、`last_error` を確認する。
- `storage_path_still_referenced` は共有参照を守る安全停止である。jobを強制完了にしない。
- 定時再試行を待てない場合のみ、対象・件数を承認後、secretをshell historyへ残さない方法で該当endpointだけを実行する。この操作はStorage削除という本番変更である。

  ```bash
  curl --fail-with-body \
    -H "Authorization: Bearer <CRON_SECRET>" \
    "https://<web-domain>/api/cron/cleanup-notebook-storage"
  ```

  対象者全体の写真jobの場合はendpointを `/api/cron/cleanup-person-notebook-storage` に置き換える。両方を理由なく連続実行しない。

- `completed` とStorage不在を確認するまで、利用者へ写真削除完了と回答しない。

**単一日記・対象者の手帳削除**

- 利用者画面で対象の日付・記録内容、または対象者名を再確認し、明示確認後だけ削除する。
- APIが409を返した場合は、別端末の更新との競合である。再読込して削除対象を再確認し、古い版数を手作業で上書きしない。
- 日記または対象者本体が消えても写真jobがpendingなら、画面どおり「記録削除済み・写真後片付け待ち」であり、写真削除完了とは回答しない。
- 削除receiptを手作業で消さない。古い端末から同じlocal IDが再送された時の復活防止に使う。
- 対象者削除はowner/adminだけが実行できる。member/viewerの依頼を管理者が本人確認なしに代行しない。

## 7. 問い合わせ受付

### 7.1 公開前の必須設定

- 確定した受付メール `info@bee-ch.co.jp` を本番環境へ設定する。
- 確定した対応目安「メール受付：24時間／原則3営業日以内に返信」を本番環境と公開画面へ設定する。
- [プライバシー表示](../apps/web/app/legal/privacy/page.tsx)とフッターに同じ窓口を表示する。
- 担当者だけが見られる問い合わせ台帳を用意する。リポジトリ、GitHub issue、一般チャットを個人情報台帳にしない。
- 受付不能時の代替連絡手段と、担当不在時の引継ぎ先を決める。

本番環境への設定、公開表示、テストメールの受信・返信を確認するまでは受付準備完了としない。

### 7.2 受付項目と分類

記録するのは必要最小限にする。

- 受付日時、返信先、本人確認状態。
- 種別: 利用方法 / 保存・復元 / 家族権限 / 課金表示 / 個人情報 / 削除依頼 / 障害。
- 発生環境: browser、OS、時刻、画面、request ID。手帳本文や写真は原則受け取らない。
- 希望対応と期限。
- 担当、次回連絡日、完了根拠。

パスワード、Magic Link、access token、service role key、マイナンバー、銀行・医療書類画像を送らないよう案内する。誤送信された場合は転載せず、アクセスを絞ってセキュリティ担当へ連絡する。

### 7.3 応答目標

- 通常問い合わせ: 公開上は原則3営業日以内。余裕を持って守るため、2営業日以内の一次返信を内部目標とする。
- 保存不能・権限誤り: SEV-2判定を検討する。
- 別家族への開示、削除済みデータ復活: 即時SEV-1。
- アカウント削除: 受付状態を当日または翌営業日に確認し、DBの `due_at`（既定30日）を超えない。確認待ちは `needs_followup` にして連絡日を残す。

Resendの期限通知は問い合わせ返信用ではない。指定したサポート窓口から返信する。

## 8. アカウント削除の処理と証跡

### 8.1 現行境界

- 利用者は `/account/delete` でMagic Link本人確認後に依頼し、GETで最新状態を確認できる。
- 端末localStorageの削除は同画面の別の2段階操作であり、クラウド依頼だけでは端末データは消えない。
- 管理者は `/admin/delete-requests` で `reviewing` / `needs_followup` を更新できる。
- 管理画面のstatus PATCHは `completed` を拒否する。完了は `account_deletion_pipeline.sql` の検証済み処理だけで記録する。
- `/api/admin/delete-requests/execute` は、登録済み `app_admin` のSupabase Bearer認証だけを受け付ける。静的な緊急用管理キーでは完全削除できない。
- 削除前確認は実行スイッチOFFでも行える。実削除は `ACCOUNT_ERASURE_EXECUTION_ENABLED=true`、完全なrequest ID・user ID、確認文 `完全削除 <REQUEST_ID>` が揃った時だけ開始する。
- 実行APIは、DB削除RPC、Supabase Auth userのhard delete、許可された `home-photos` objectの削除と不在確認、最終化RPCの順に進む。途中失敗では `completed` にせず、同じ依頼を再実行できる。
- これはリポジトリ上の実装境界であり、本番migration・環境変数・deployment・実アカウント完走を確認するまで「削除運用開始済み」と扱わない。

### 8.2 事前条件

- [ ] `supabase/notebook_diary_delete.sql`、`supabase/notebook_person_delete.sql`、`supabase/account_deletion_pipeline.sql` が本番へ正しい順で適用済み。
- [ ] migration直後は `ACCOUNT_ERASURE_EXECUTION_ENABLED=false` を維持した。
- [ ] 操作者は `app_admins` に登録され、削除対象本人とは別人。
- [ ] 最後のapp adminを削除しない。
- [ ] familyに他メンバーがいるownerは、Webの家族管理で所有権移管を完了した。
- [ ] 最新backup、削除後に古いbackupを復元する場合の再削除手順、障害連絡先を確認した。
- [ ] 破棄可能なPostgreSQLで次が成功した。

  ```bash
  pnpm run test:web-account-deletion
  pnpm run test:account-erasure:sql
  ```

- [ ] 単独テストアカウントでAuth・DB・Storage削除、途中再実行、完了証跡を確認した。
- [ ] request ID、target user ID、operator user IDを二人で照合した。メールアドレスだけで対象を決めない。
- [ ] 上記確認後に限り、運用責任者が本番の `ACCOUNT_ERASURE_EXECUTION_ENABLED=true` を承認し、反映deploymentを記録した。

### 8.3 手順

以下の `<REQUEST_ID>`、`<TARGET_USER_ID>` は、画面の実値を別担当が復唱してから入力する。APIによる削除、環境変数変更、deployは本番変更である。運用上の二者確認はコードが自動強制するものではないため、確認者を台帳へ残す。

1. 依頼を確認し、管理画面で `reviewing` にする。期限、本人確認、family所有権、問い合わせ履歴を確認する。
2. 登録済みapp_adminのメールで管理画面へ再ログインする。緊急用管理キーのsessionでは実行しない。
3. `/admin/delete-requests` の「検証済みの完全削除」を開き、画面に表示された対象user IDを省略せず入力して「削除前の安全確認」を押す。
4. `result=ready` の時だけ進む。`blockedDetails`、`jobId`、`ownedFamilyCount`、`storageObjectCount`、Auth状態を台帳へ記録する。`blocked`、`target_mismatch`、`last_app_admin`、`ownership_transfer_required`、`shared_photo_transfer_required`、Auth未確認は解消まで停止する。共有familyに対象user名義の写真pathが残る場合は、写真引継ぎ機能が整うまで `needs_followup` とし、手動で完了にしない。
5. 削除対象のmanifest件数とhashをread-onlyで確認する。Storage pathそのものは一般台帳へ転記しない。

   ```sql
   select id, status, storage_manifest_hash,
          jsonb_array_length(storage_objects) as storage_object_count,
          blocked_details, last_error_code
   from public.account_erasure_jobs
   where request_id = '<REQUEST_ID>'::uuid;
   ```

6. 単一日記削除と対象者全体削除の未完了写真jobを確認し、該当job IDと件数だけを制限付き台帳へ記録する。アカウント削除pipelineがこれらをStorage manifestへ含めていることを、手順5の件数と照合する。

   ```sql
   select id, status, attempt_count, last_error
   from public.notebook_storage_deletion_jobs
   where status = 'pending'
     and (
       created_by = '<TARGET_USER_ID>'::uuid
       or family_id in (
         select unnest(owned_family_ids)
         from public.account_erasure_jobs
         where request_id = '<REQUEST_ID>'::uuid
       )
     )
   order by created_at;

   select id, status, attempt_count, last_error
   from public.person_notebook_storage_deletion_jobs
   where status = 'pending'
     and (
       created_by = '<TARGET_USER_ID>'::uuid
       or family_id in (
         select unnest(owned_family_ids)
         from public.account_erasure_jobs
         where request_id = '<REQUEST_ID>'::uuid
       )
     )
   order by created_at;
   ```

7. 別担当がrequest ID、target user ID、manifest件数、blockなし、実行スイッチの承認を復唱する。
8. 画面どおり `完全削除 <REQUEST_ID>` を入力し、「Auth・DB・写真を検証して完全削除」を1回押す。APIはmanifestの完全一致pathだけを扱う。prefixや手作業でStorageを一括削除しない。
9. 成功応答の `completed=true` と `verified.authUserAbsent`、`databaseReferencesAbsent`、`storageObjectsAbsent`、`storageObjectCount` を記録する。途中で失敗した場合、手書きで完了にせず、error codeとjob状態を保全する。原因を解消後、同じrequest ID・user IDでpreflightから再実行する。
10. 管理画面で依頼が `completed` になったこと、および次のread-only検査を別担当が確認する。

    ```sql
    select request.id, request.status,
           request.user_id is null as request_user_redacted,
           request.contact_email is null as contact_redacted,
           request.reason is null as reason_redacted,
           job.status as job_status,
           job.target_user_id is null as target_redacted,
           job.owned_family_ids = '{}'::uuid[] as family_ids_redacted,
           job.storage_objects = '[]'::jsonb as paths_redacted,
           job.storage_manifest_hash,
           job.auth_verified_erased_at,
           job.storage_verified_erased_at,
           job.completed_at
    from public.account_delete_requests request
    join public.account_erasure_jobs job on job.request_id = request.id
    where request.id = '<REQUEST_ID>'::uuid;

    select count(*) as raw_uploader_reference_count
    from public.notebook_storage_deletion_jobs
    where created_by = '<TARGET_USER_ID>'::uuid;

    select count(*) as raw_person_cleanup_reference_count
    from public.person_notebook_storage_deletion_jobs
    where created_by = '<TARGET_USER_ID>'::uuid;

    select count(*) as raw_person_receipt_reference_count
    from public.person_notebook_deletion_receipts
    where deleted_by = '<TARGET_USER_ID>'::uuid;

    -- 手順6で記録したjobがない場合、この検査は省略する。
    -- 複数ある場合はjob IDごとに繰り返す。
    select count(*) as retained_cleanup_identity_count
    from public.notebook_storage_deletion_jobs
    where id = '<CLEANUP_JOB_ID>'::uuid;
    ```

    全redaction列がtrue、両statusが `completed`、hashと3時刻が存在し、すべてのraw identity countとretained cleanup countが0でなければ完了扱いにしない。
11. 削除運用を常時開放する承認がない場合は、処理窓口を閉じた後に `ACCOUNT_ERASURE_EXECUTION_ENABLED=false` へ戻し、反映deploymentを記録する。
12. 指定した問い合わせ窓口から、クラウド削除完了と「各端末のローカル手帳は利用者側で別途削除が必要」を連絡する。

### 8.4 残す証跡

残す: request ID、job ID、operator、確認者、各工程時刻、result code、manifest hash、object件数、DB/Auth/Storage確認結果、完了連絡時刻。

残さない: 生の本文、写真、access token、service role key、削除後のメールアドレス、Storage path一覧。

`account_delete_requests.due_at` と管理画面を毎日確認する。手書きメモだけで `completed` にしてはいけない。

### 8.5 個別削除cleanupとの統合境界

`account_deletion_pipeline.sql` は、対象利用者または単独所有familyのpending日記・対象者写真cleanupをStorage manifestへ統合する。DB削除時はpending jobを再試行用に残しつつ `created_by` をNULL化し、対象利用者または単独所有familyの個別削除receiptからraw identityを消す。最終化前の残存検査でも対象user IDが残っていないことを数え、APIがStorage不在を確認したmanifestと一致するpending jobを削除する。永続証跡は `account_erasure_jobs` のmanifest hash・件数と監査ログへ最小化する。これらは破棄DB回帰試験の対象である。

共有familyに対象利用者名義のnotebook写真pathが残る場合は、退会後の署名・表示不能と他familyの写真削除を避けるため `shared_photo_transfer_required` で停止する。現時点では自動引継ぎが実装済みとは扱わず、所有権移管だけでblockを解消したと判断しない。

一方、本番にこのmigrationが適用済みか、実行APIがdeploy済みか、外部Auth/Storageを含む単独テストアカウントの完走は、このリポジトリだけでは確認できない。実行スイッチはそれらを確認するまでOFFとし、コードがあることだけで「検証済み消去を運用中」と宣伝しない。

## 9. 復旧演習

### 9.1 頻度

- Stage A公開前に1回。
- 以後は四半期ごと、およびbackup方式・Supabase plan・主要schema変更後。
- 本番復元そのものではなく、隔離された使い捨てproject/DBで行う。本番データを扱う場合は権限、目的、削除期限を事前承認する。

### 9.2 演習手順

1. 演習責任者、開始時刻、復元対象時点、期待RPO/RTOを決める。
2. 本番の最新backup時刻、DB識別子、Storage manifest、release SHAを記録する。
3. 隔離環境を作り、Resend、push、Stripe、Anthropic、全Cronを無効にする。production URLや本番service roleを流用しない。
4. providerの正式手順でDB/Authを隔離環境へ復元する。どのschemaが戻ったかを確認する。
5. Storage objectを独立backupから戻し、manifest件数と無作為sampleのhash/表示を確認する。DBだけ戻って写真がない状態を成功にしない。
6. 復元先に対応するWeb previewまたはlocal Webを接続し、次を確認する。
   - family境界とviewer read-only。
   - 手帳・日記・写真の読取。
   - 削除済み記録が復活していないこと。
   - pending削除jobと削除receiptを、復元時点より新しい運用記録と突合できること。
7. repository rootで関連回帰を実行する。

   ```bash
   pnpm run test:notebook-sync-runtime
   pnpm run test:diary-deletion
   pnpm run test:diary-deletion:sql
   pnpm run test:person-deletion
   pnpm run test:person-deletion:sql
   pnpm run test:web-account-deletion
   pnpm run test:account-erasure:sql
   ```

8. 実測RPOを「障害想定時刻－最新復元データ時刻」、RTOを「開始承認時刻－利用確認完了時刻」で記録する。
9. 欠落、権限逸脱、外部送信が1件でもあれば失敗とし、目標を達成したと記録しない。
10. 隔離環境の削除対象を列挙し、承認後に削除する。production projectが対象に含まれないことを二人で確認する。

### 9.3 演習記録

```text
実施日:
責任者 / 確認者:
復元元と復元先（秘密値なし）:
release SHA:
想定障害時刻:
最新復元データ時刻:
利用確認完了時刻:
実測RPO / RTO:
DB/Auth結果:
Storage件数・sample結果:
削除receipt再適用結果:
外部送信が無効だった証拠:
残課題 / 次回期限:
隔離環境削除確認:
```

## 10. リリース手順

### 10.1 release前

- [ ] release SHAと差分、担当、実施時間、rollback候補SHAを記録した。
- [ ] 本番DB migration一覧を作り、適用順、再実行可否、lock影響、Webとの互換を確認した。
- [ ] 最新backupとStorage backupの成功を確認した。
- [ ] 有料gate、Resend、Cronなど今回変更しない外部機能の状態を記録した。
- [ ] PR上のCI成功を確認した。`main` push後のCIとdeployは並行し得るため、push後CIを事前gateの代わりにしない。

ローカルまたはCIで、最低限次を実行する。

```bash
pnpm install --frozen-lockfile
pnpm --filter web run typecheck
pnpm run test:cron-auth
pnpm run test:notebook-sync-safety
pnpm run test:notebook-sync-runtime
pnpm run test:commercial-release-gates
pnpm run test:web-account-deletion
pnpm run test:diary-deletion
pnpm run test:diary-deletion:sql
pnpm run test:person-deletion
pnpm run test:person-deletion:sql
pnpm run test:account-erasure:sql
pnpm --filter web run build
git diff --check
```

`next lint` は現在、設定がない環境で対話プロンプトを出すため、非対話CI gateとして確認できていない。lint済みと記録しない。

### 10.2 migrationとdeploy

1. [Supabaseセットアップ](../supabase/README.md)を基に、そのreleaseだけのmigration manifestを作る。回帰用 `*_regression.sql` は本番で実行しない。
2. 単一日記削除は `notebook_atomic_sync_v2.sql` と `ai_consult_memory.sql` の後に `notebook_diary_delete.sql` を適用する。
3. 対象者全体削除は `notebook_diary_delete.sql` と `consult_daily_claim.sql` の後に `notebook_person_delete.sql` を適用する。
4. アカウント削除は上記と `admin_auth_hardening.sql` 等の前提後に `account_deletion_pipeline.sql` を適用する。
5. `verify_compact.sql` でaccount erasure、単一日記削除、対象者全体削除のtable、service-only RPC、再作成・Storage race guard、internal helper非公開、完了証跡の最小化を確認する。念のため次もread-onlyで存在を確認する。

   ```sql
   select to_regclass('public.account_erasure_jobs') is not null as account_erasure_jobs,
          to_regclass('public.notebook_storage_deletion_jobs') is not null as notebook_delete_jobs,
          to_regclass('public.notebook_diary_deletion_receipts') is not null as diary_delete_receipts,
          to_regclass('public.person_notebook_deletion_receipts') is not null as person_delete_receipts,
          to_regclass('public.person_notebook_storage_deletion_jobs') is not null as person_delete_jobs,
          to_regprocedure('public.prepare_account_erasure_v1(uuid,uuid,uuid)') is not null as erasure_prepare,
          to_regprocedure('public.execute_account_erasure_database_v1(uuid,uuid,uuid)') is not null as erasure_execute,
          to_regprocedure('public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)') is not null as erasure_finalize,
          to_regprocedure('public.delete_notebook_diary_v1(uuid,uuid,uuid,text,text,bigint,text)') is not null as diary_delete,
          to_regprocedure('public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)') is not null as person_delete;
   ```

6. すべてtrue、migration errorなしを確認してからWebをdeployする。DB migrationに失敗したままWebだけ進めない。
7. [デプロイ手順](DEPLOYMENT.md)に従い、選択済みの1経路だけでdeployする。
8. deployment ID、URL、commit SHAを記録し、次を実行する。

   ```bash
   curl --fail-with-body "https://<web-domain>/api/health"
   node scripts/smoke-web.mjs "https://<web-domain>"
   WEB_BASE_URL="https://<web-domain>" pnpm run smoke:notebook-sync
   ```

9. 認証済み試験アカウントで2端末の保存・復元、viewer拒否、写真、単一日記削除、対象者全体削除を確認する。本番の書込smokeは対象と後片付けを事前承認する。
10. 30分はVercel/Supabase logs、5xx、Auth、Cron、問い合わせを重点監視する。

## 11. ロールバック

1. Incident Commanderが影響、現行deployment、DB migration有無、戻すSHAを確認する。
2. DBが後方互換なら、Vercelで直前の正常deploymentをrollback/promoteする。完了後のdeployment IDを記録する。
3. DB migrationを自動でdownしない。データ変更後のschema rollbackはデータ消失を起こし得るため、原則forward fixとし、backup復元は別の承認された障害対応にする。
4. Web rollbackで新schemaに書かれたデータを読めない場合は、過去版へ戻さず、互換patchを先に作る。
5. rollback後にhealth、smoke、認証、保存・読取を再確認する。
6. 原因、判断、開始・復旧時刻、失敗release SHA、復旧deployment ID、データ影響、再発防止ownerを24時間以内に記録する。

## 12. 担当チェックリスト

### 毎日

- [ ] health、Vercel 5xx/Function errorを確認。
- [ ] 4つのCron結果を確認。
- [ ] Supabase DB/Auth/Storage errorとbackup成功を確認。
- [ ] pending Storage cleanupと期限が近い削除依頼を確認。
- [ ] 問い合わせをtriageし、SEV判定と担当を付けた。
- [ ] Resend有効時だけdelivery/bounceを確認。

### 毎週

- [ ] backup保持とStorage独立backupを確認。
- [ ] production deployment SHAと想定SHAが一致。
- [ ] 管理者とservice roleの権限棚卸し。
- [ ] 期限超過の削除依頼、失敗を繰り返すcleanup jobがない。
- [ ] 有料gateが意図せず開いていない。

### releaseごと

- [ ] PR CI、対象test、build、migration manifest、backupを確認。
- [ ] DBを先に適用・検証し、選択した1経路でWebをdeploy。
- [ ] smoke、2端末、権限、削除を確認。
- [ ] release SHA、deployment ID、migration、確認者を台帳へ記録。

### 四半期

- [ ] 隔離復旧演習を実施しRPO/RTOを実測。
- [ ] Incident / 問い合わせ / 削除receiptの保持方針を見直す。
- [ ] 外部サービスplan、backup、alert、domain認証を再確認。
- [ ] このrunbookのリンク、コマンド、担当、目標を更新。

## 13. 運用記録テンプレート

```text
種別: daily / incident / release / deletion / restore-drill
開始・終了（JST/UTC）:
担当 / 確認者:
環境・project識別子（秘密値なし）:
release SHA / deployment ID:
request ID / job ID（必要時のみ）:
観測したstatus / error code:
実行前承認:
実行した操作:
確認結果:
利用者データへの影響:
外部送信の有無:
残課題 / owner / 期限:
```

## 14. 既知の未確認・NO-GO候補

- Supabase本番backup/PITRのplan、保持期間、直近成功、Auth復元範囲。
- Storage object本体の独立backupと復元方法。
- 隔離復旧演習と実測RPO/RTO。
- Vercel/Supabase/Cronの外部alertと当番通知先。
- Resend domain、API key、送信元、実受信。未設定ならメール通知は無効のままにする。
- 正式な問い合わせ先と担当シフト。
- account erasure migration・app_admin実行API・ `notebook_storage_deletion_jobs` 統合の本番適用と、単独テストアカウントによる外部Auth/Storage完走。
- 二者確認は運用手順であり、実行APIが技術的に二人の承認を強制するものではない点。
- 個別削除migration・cleanup Cron・復活防止receiptの本番適用と、2端末による完走。
- 非対話lint gateが未設定である点。

これらは「後で確認」ではなく、Stage A GO判定時に担当者が結果と根拠を記録する。
