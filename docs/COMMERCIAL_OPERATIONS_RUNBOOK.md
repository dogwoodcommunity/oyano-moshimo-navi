# 無料Web正式版 Stage A 運用手順書

最終更新: 2026-09-05

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
| 障害対応主責任者 / Incident Commander | **代表取締役 池田哲也**（内部連絡手段は要指定。指定後は制限付き運用台帳に記録） | **システム責任者 池田知也**（責任範囲：主責任者不在時の連絡・初動判断の代行。本番操作は別途権限を持つ担当者が実施。内部連絡手段は要指定） |
| リリース担当 | **要指定** | **要指定** |
| Supabase・個人情報削除担当 | **代表取締役 池田哲也**（メール依頼：`info@bee-ch.co.jp`。アプリ内依頼：`/admin/delete-requests`。両名への通知方針は確定、実際の権限・通知設定・2経路の試験は要確認） | **システム責任者 池田知也**（責任範囲：主担当不在時に削除依頼の受付・本人確認・実行担当への引継ぎを代行。本番削除は登録済み削除実行者と別確認者の二者で実施。受付経路は主担当と同じ。実際の権限・通知設定・2経路の試験は要確認） |
| アカウント完全削除の登録済み実行者 | **システム責任者 池田知也**（本人用個別Supabase Auth、メール確認、本人端末のTOTP・AAL2確認済み。別確認者は代表取締役 池田哲也。private台帳の本人確認eventと別確認者の `activation_approved` eventを分離して記録し、削除専用roleを有効化済み。削除専用ログイン試験は完了し、単独テスト削除は未完了。実行スイッチはOFF） | **代替実行者：要指定** |
| 問い合わせ一次受付 | **要指定** | **要指定** |
| セキュリティ・法務連絡先 | **要指定** | **要指定** |

正式な利用者向け問い合わせ先は `info@bee-ch.co.jp`、対応目安は「メール受付：24時間／原則3営業日以内に返信」と確定した。メールによるアカウント削除依頼は同じ共有受信箱で受け、主担当と代行者の双方へ通知する運用方針とする。アプリ内の `/account/delete` から送られた依頼はDBへ保存され、`/admin/delete-requests` の一覧で確認する。現行実装は、このDBキューへの保存時に自動メール通知を行わない。双方通知の方針を満たすには、共有受信箱の通知に加えてDBキューの監視・通知方法を割り当て、両経路を試験する必要がある。

ただし、`LEGAL_CONTACT` と `LEGAL_CONTACT_RESPONSE_TARGET` の本番設定、両名の共有受信権限、双方通知のメールルール、DBキューの監視・通知方法、外部からの実受信・返信、公開画面の表示は未確認である。共有パスワードを使わず、個別アカウントへの委任または追跡可能な転送を使う。共有受信箱のパスワード、MFA、復旧コードはGitや一般チャットへ記録しない。通知メール用の `NOTIFICATION_EMAIL_REPLY_TO` は別用途のため未確定のままとする。[環境変数マトリクス](ENVIRONMENT_MATRIX.md)と公開画面を照合する。

削除担当への指名だけではAdmin権限を付与しない。代行者の責任範囲「主担当不在時に削除依頼の受付・本人確認・実行担当への引継ぎを代行。本番削除は登録済み実行者と別確認者の二者で実施」は確定した。ここでいう本人確認は、利用者が `/account/delete` のMagic Link認証を完了した状態と、request ID・対象user IDの一致を確認することを指す。身分証画像、パスワード、Magic Link、access tokenは受け取らない。アカウント完全削除の登録済み実行者は `システム責任者 池田知也` とし、本人用の個別Supabase Auth招待受諾・メール確認、本人端末でのverified TOTP 1件・現在のAAL2確認、Auth emailだけの最小profile、private台帳の本人確認eventまで確認した。別確認者は `代表取締役 池田哲也` とし、確認済みAuthと同一UUIDのprofile・メール一致を読み取り確認した後、別の本番操作で `activation_approved` event 1件と同じexecutorの `created_by` が別確認者、`active=true`、`activated_at is not null`、`revoked_at is null`、identity・approval両台帳参照を事後確認した。private台帳総数は2件、executor総数・有効数は各1件で、family所有・所属、一般Admin、削除jobは0件だった。QR、手入力用コード、6桁の数字は運営者へ送らず、正確なuser IDはowner専用SQLと制限付き本番データだけで扱い、一般文書やGitへ記録しない。削除専用roleと削除pipelineの本番migrationは実装・適用済みで、一般Admin APIへは広がらず、緊急用管理キーも受け付けない。最小profileは監査上の本人識別子であり、それだけではfamily所有・所属・一般Admin・削除権限を付与しない。無効なexecutor登録と別確認者による承認event・有効化は分けて実施した。池田知也本人のアカウントを削除する場合は、別の登録済み実行者と別確認者を必要とする。本番の `ACCOUNT_ERASURE_EXECUTION_ENABLED` は未登録のためOFFである。削除専用ログインと一般Admin拒否は確認済みだが、メールとアプリ内DBキューの実際の権限・監視・通知設定・両経路の試験、単独テストアカウント完走が未確認の間は、削除実行の正式運用を開始しない。

障害対応の主責任者・代行者の氏名と役職、代行者の責任範囲「主責任者不在時の連絡・初動判断の代行。本番操作は別途権限を持つ担当者が実施」は確定した。これは全般的な運用責任者の指名や、Vercel・Supabase・GitHub・Resend・DNS等の実行権限付与を意味しない。両名の内部連絡手段、アラート通知先とエスカレーション経路、平日・夜間・休日の当番体制、各サービスの権限とMFA・緊急時アクセス回復方法が未確定の間は、障害対応の正式運用を開始しない。秘密情報、個人電話番号、MFA、復旧コードはGitへ記録せず、制限付き運用台帳または承認済みのパスワード管理基盤で管理する。

## 2. 現行構成と、言ってよいこと

| 領域 | 現行の根拠 | 現時点の扱い |
| --- | --- | --- |
| Web | `apps/web` のNext.js、`vercel.json`、GitHub ActionsのVercel deploy | 実装あり。本番の現行deployment、Git連携、Actions secretsは外部要確認 |
| DB / Auth | Supabase PostgreSQL、Auth、RLS、server-only service role | 実装あり。本番migration適用状態とAuth設定は外部要確認 |
| 写真 | Supabase Storage `home-photos` | 実装あり。独立バックアップ・versioning・復元実績は未確認 |
| メール | Resendを使う期限・月1確認メール | 任意機能。`RESEND_API_KEY` と認証済み送信元が不足するとメールだけ停止する。設定済みとは扱わない |
| Cron | Vercel Cronから通知、匿名データ削除、日記・対象者Storage cleanup | 設定ファイルあり。本番での登録、直近成功、失敗通知は外部要確認 |
| アカウント削除 | 本人確認済み受付、削除専用role、Bearer限定管理一覧、TOTP/AAL2、耐久prepare、DB ownerだけが開く最大15分・one-shot control、別のAAL2 app adminによるcontrol内の最大10分・1回限りgrant、再開可能なDB証跡RPC | 削除role・pipelineとprivate台帳の本番migration、実行者のverified TOTP、別確認者のAuth・profile一致、本人確認event・最小profile、別確認者の承認event、削除専用role有効化、旧Webでの削除専用ログイン・一般Admin拒否は確認済み。2026-09-05にexecution gateを本番適用して読み取り専用12項目を確認し、対応Web `c1415b3` も本番反映してReady・smoke・削除API未認証401を確認した。更新後の本人200/403・AAL2再確認とowner controlを含む単独テストアカウント完走は未確認。本番の実行スイッチはOFF |
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
- [ ] プライバシーポリシーの施行日に、正式公開日と同じ実日付が表示されることを確認した。

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

これらは担当体制確定後の内部目標であり、現時点では保証ではない。主責任者・代行者の氏名と代行責任範囲の確定だけでは30分・2時間等のack目標を実現できる体制とは扱わず、連絡経路、当番、通知先、各サービス権限を設定して演習で確認するまで正式運用は開始しない。

代行者の「初動判断」は、暫定的なSEV分類、変更停止・証拠保全の依頼、権限を持つ担当者の招集までを指す。これだけで本番ログや利用者データの閲覧、release停止、rollback、DB書込み、secret rotation、外部送信、削除の実行・承認権限を持つとは扱わない。

### 6.1 共通の最初の15分

1. 本番・preview・localのどこか、発生開始時刻（JST/UTC）、影響機能、最初に確認したdeployment SHAを記録する。
2. 新規releaseと手動Cron再実行を止める。証拠を消す再deploy、DB修正、ログ削除をしない。
3. `/api/health`、Vercel logs、Supabase logsをread-onlyで確認する。
4. 利用者のfamily ID、本文、写真、access tokenをチャットへ貼らない。必要なら内部の制限付き台帳にrequest IDだけを記録する。
5. 直前releaseとの相関を確認する。相関があっても、DB migration済みならWebだけを無条件に戻さない。
6. 復旧、rollback、secret rotation、外部送信停止など本番変更は、事前に定めた最終承認者の承認後、対象サービスの権限を持つ実行者が行う。主責任者不在時に代行者が最終承認できる範囲は未確定であり、確定するまで代行責任範囲へ含めない。

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
- `info@bee-ch.co.jp` は共有パスワード方式にせず、主担当・代行者の個別アカウントへの委任または追跡可能な転送を設定し、外部テストメールが両名へ届くことを確認する。
- テスト用アカウントからアプリ内削除依頼を作成し、`/admin/delete-requests` のDBキューへ表示され、割り当てた監視・通知方法で両名が認知できることを確認する。
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
- AAL2に上げた登録済み `app_admin` だけが `/admin/delete-requests` で `reviewing` / `needs_followup` と処理メモを更新できる。削除専用実行者はAAL2でも状態・処理メモをPATCHできない。
- 管理画面のstatus PATCHは `completed` を拒否する。完了は `account_deletion_pipeline.sql` の検証済み処理だけで記録する。
- `/api/admin/delete-requests` と `/api/admin/delete-requests/execute` は、登録済み `app_admin` または有効な `account_delete_executors` のSupabase Bearer認証だけを受け付ける。静的な緊急用管理キーでは一覧・状態変更・事前確認・完全削除のすべてを拒否する。削除専用実行者はほかのAdmin APIを利用できない。
- 更新Webの削除専用認可はservice-only `verify_account_delete_operator_v2(uuid)` が返すrole methodだけを使う。`account_erasure_execution_gate.sql` はservice roleの `account_delete_executors` 生table SELECTを失効させるため、生行を直接読む旧deploymentは一覧・実行handlerの前の認可段階でfail closedになる。新gate適用前に対応Webをdeployしない。
- 削除専用実行者向けの依頼一覧は、DBのSELECT列を分け、連絡先、自由記載の理由、処理メモ、担当者メール/user IDを取得しない。処理日時と個人を識別しない認証方式名は運用状態として取得できるが、返却直前のマスクだけに依存しない。
- 一覧は `requested` / `reviewing` / `needs_followup` を期限の古い順にページ取得して未完了を全件含め、`completed` だけを作成日の新しい順の直近100件に限る。大量の完了履歴や新着で未完了依頼が押し出される単一 `limit(100)` に戻さない。
- 登録済み実行者は `システム責任者 池田知也` とし、本人用個別Supabase Authの招待受諾・メール確認、本人端末でのverified TOTP 1件・現在のAAL2、監査用の最小profile、private台帳の本人確認eventを確認した。別確認者 `代表取締役 池田哲也` の確認済みAuthとprofile一致を再照合し、別確認者の `activation_approved` event 1件と、同じexecutorの `created_by` が別確認者、`active=true`、`activated_at is not null`、`revoked_at is null`、identity・approval両台帳参照を事後確認した。family所有・所属、一般Admin、削除jobは0件である。
- 本番の本人セッションで削除専用auth-statusと一覧GETが200、モニター回答・AI利用・本番設定APIが各403となることを確認した。削除依頼は0件で、状態PATCH・削除前確認・実行POSTは呼んでいない。
- 本人は `/admin/delete-requests/setup` で個別Magic Linkと認証アプリを設定する。この画面は本人確認だけを行い、profile、家族、対象者、削除専用roleを作らない。登録・中断処理は開始時の同一AAL1 token、Auth user ID、この画面が作ったfactor IDに限定し、過去の未完了factorやverified factorを自動削除しない。verified TOTPが1件かつ現在のAAL2を確認できた場合だけ設定完了と表示する。
- 1段階目の「削除前の安全確認」は実行スイッチOFFかつAAL1でも行えるread-only `inspect_account_erasure_v2` で、jobや利用停止状態を作らない。2段階目の「削除対象を確定」は有効な削除専用実行者のAAL2だけが `prepare_account_erasure_v2` で行い、耐久jobとmanifest hashを作る。Webはこのv2ラッパーだけを呼び、安全blockは正規化codeと個人を識別しない数値件数だけを返す。`familyId`、`familyName`、Storage object/prefixの生pathはブラウザへ返さない。対象確定は1時間で失効し、期限切れ後は対象userに紐づく通常のStorage書き込み凍結を自動解除する。
- 3段階目はDB ownerがSQL Editorから `account_delete_private.open_account_erasure_execution_control_v1` を実行して開く、最大15分・1回限りのcontrol epochである。controlはmigration直後closed、private singleton、DB owner以外は開閉不可で、最初のDB削除成功時に消費される。
- 4段階目は実行者と別の、事前登録済みAAL2 app adminによる実行許可である。許可はrequest ID・job ID・target user hash・operator hash・manifest hashと現在のcontrol epochに固定し、control残時間内の最長10分、1回限りとする。生の対象・実行者・確認者UUIDはprivate grant証跡に残さない。
- 5段階目の実削除は、有効な削除専用実行者のAAL2、`ACCOUNT_ERASURE_EXECUTION_ENABLED=true`、live DB control、完全なrequest ID・user ID・job ID・manifest hash、確認文 `完全削除 <REQUEST_ID>`、未使用・未失効のgrantがすべて揃った時だけ開始する。`execute_account_erasure_database_v2` が同じトランザクション内で対象範囲を再計算し、job/hash/control epochと一致した場合だけDBを削除し、grantとcontrolを同時に消費する。
- 「確認中」「要確認」の変更は、現routeがAAL2 app adminを確認したうえで `update_account_delete_request_status_v2` を呼び、DBも正確なoperator user IDを有効なapp adminとして再確認してから依頼行と監査ログを1トランザクションで更新する。手動の完了、処理中・完了済み依頼の巻き戻しは拒否する。旧 `update_account_delete_request_status_v1` はservice roleから失効させ、AAL1の旧deploymentもPATCH前にfail closedにする。
- 実行APIは、control・grant・対象範囲を検証するDB削除v2 RPC、Supabase Auth userのhard delete、許可された `home-photos` objectの削除と不在確認、最終化RPCの順に進む。DB削除前に範囲変化等の安全blockを検出した場合は削除せずcontrolをfail closeしてgrantを取り消す。通信断やSQL例外ではcontrol/grant状態を推測せずowner-onlyで再確認し、activeならowner closeまたは期限切れまで再実行しない。通常の新規DB削除にはenv ON、live owner control、未使用・未失効grantを必須とする。唯一の途中再開はDB削除がcommit済みの `database_erased` に限り、最初のDB削除を実行した本人と同じ削除専用実行者が現在も有効かつAAL2で正確なrequest/target/job/manifest hashを送り、DB v2が同じjobの消費済み・未取消しgrantと現在の実行者hash＝grantの `operator_user_hash` を検証できた場合だけ、env OFF後もAuth/Storage不在確認と最終化を続行できる。DB未削除のjob、値の不一致、未消費・取消済みgrant、無効な実行者、AAL1、別の有効な削除専用実行者は拒否し、新規削除のenv OFF bypassにはしない。
- `account_erasure_execution_gate.sql` は旧 `inspect_account_erasure_v1` / `prepare_account_erasure_v1`、旧 `update_account_delete_request_status_v1`、旧の3引数 `execute_account_erasure_database_v1` のservice role実行権限を取り上げ、privacy-safeなinspect/prepare v2、AAL2 app adminをDBで再確認するstatus update v2、control必須のexecute v2だけをservice roleへ開く。対応WebよりDBを先に移行することで、旧Webは認可table SELECTまたはv1権限で拒否され、過去のON deploymentを含むv2経路もcontrolなしでは `execution_control_disabled` となり、どの過去URLも新規DB削除前にfail closedになる。
- 削除role・pipelineとprivate台帳の本番migration、担当者のverified TOTP、別確認者のAuth・profile一致と承認event、最小profile、削除専用role有効化、旧Webでの削除専用ログイン・一般Admin拒否は確認済み。`account_erasure_execution_gate.sql` は2026-09-05に本番適用し、読み取り専用12項目でRPC・ACL・FORCE RLSを確認した。controlは1行・active 0件、grant・削除依頼・削除jobは各0件、有効な削除専用実行者は1件だった。対応Web `c1415b3` は同日に本番反映済みで、更新後の本人ログインによる200/403・AAL2の再確認と単独テストアカウント完走は未確認である。本番の実行スイッチはOFFで、これらを確認するまで「削除運用開始済み」と扱わない。

### 8.2 事前条件

- [x] 削除専用role・private本人確認台帳・既存削除pipelineのmigrationを本番へ正しい順で適用し、読み取り専用検査を確認した。
- [x] migration後も `ACCOUNT_ERASURE_EXECUTION_ENABLED=false` を維持した。
- [x] `account_erasure_execution_gate.sql` を既存pipelineの後にDB-firstで本番適用し、private control/grant表とopen/close関数のowner-only ACL、controlの既定closed、`verify_account_delete_operator_v2` / `inspect_account_erasure_v2` / `prepare_account_erasure_v2` / `update_account_delete_request_status_v2` / `execute_account_erasure_database_v2` のservice-only ACL、`account_delete_executors` 生tableのservice role SELECTなし、旧v1 inspect/prepare/status update/execute RPCのservice role権限なしをread-onlyで確認した（2026-09-05、読み取り専用12項目PASS。private表FORCE RLS、active control 0件・grant 0件も確認）。
- [x] 対応Web `c1415b3b036fbdfa9977f0d870a808bb633c6467` を2026-09-05に本番へ反映した。CI `33952555663` PASS（2分24秒）、deploy workflow `33952555613` は未設定のためskip、Vercel CLIでdeployment `dpl_Hx7V71Pd9voYiMYgfmFFRxmo7MnA` を作成しReadyを確認した。直接URLは `https://oyano-moshimo-navi-oamhlgdrr-dogwoodcommunity1.vercel.app`、公開aliasは `https://oyano-moshimo-navi.vercel.app`。smokeは検査対象すべてPASS、Admin envは未認証401のためskip。削除API auth-status・一覧等の未認証401、未ログイン画面にCONTACT/REASON/HANDLED BY列がないことを確認した。productionの実行スイッチは未登録のためOFF。本人ログイン後のAPI・列の検査はこの確認に含めない。
- [ ] 更新後の本人ログインで削除専用auth-status・一覧の200と一般Admin APIの403を再確認し、認可が `verify_account_delete_operator_v2` だけを使い生executor行を読まないこと、preflight/prepareとPATCHがv2だけを使うこと、blocker応答がcode/数値件数だけで `familyId` / `familyName` / Storage生pathを含まないこと、PATCHがrouteとDBの両方でAAL2 app adminだけに成功すること、旧Webはexecutor認可またはv1権限で拒否、過去のON deploymentを含むexecute v2経路はlive DB controlなしで `execution_control_disabled` となりDB削除前にfail closedになることを確認した。
- [ ] 一覧が未完了依頼をページ取得で全件含め、完了済みだけを直近100件に限ることを、100件超の破棄データで確認した。
- [x] 実行予定者 `システム責任者 池田知也` の本人用個別Supabase Auth招待受諾・メール確認を本番で確認した。
- [x] `/admin/delete-requests/setup` でverified TOTP 1件と現在のAAL2を本人端末で確認し、Supabase側もverified 1件・unverified 0件を確認した。
- [x] 実行者とは別の確認者を `代表取締役 池田哲也` と指名し、確認済みAuthと一致profileを本番で読み取り確認した後、別操作で `activation_approved` eventを作成した。
- [ ] 別確認者が実行者・削除対象と異なる有効なapp adminで、当該実行者の `activation_approved` eventに登録された本人であり、本人用TOTPでAAL2に上げられることを本番で確認した。
- [x] `account_delete_identity_ledger.sql` を本番へ1回だけ適用し、DB owner専用・追記専用・API role権限なしを確認した。
- [x] 本人画面で選んだ正確な実行者Auth user IDをprivate台帳へ記録し、最小profileと `active=false` のexecutor行をfamily所有・所属・一般Adminなしで同一transactionにより作成した。
- [x] 一般Admin APIへ広がらない削除専用role、Bearer限定認証、実削除時AAL2、原子的な状態更新・監査を既存pipelineに実装し、ローカル回帰を通した。
- [ ] read-only preflight、AAL2耐久prepare、v2レスポンスのprivacy allowlist、削除専用一覧のSELECT段階での最小化、状態/処理メモPATCHのAAL2 app_admin限定、owner-only最大15分one-shot control、別のAAL2 app adminによるcontrol残時間内の最大10分grant、DB削除成功時のcontrol/grant原子的同時消費、job/hash/epoch/範囲変化のfail closedをローカル回帰で確認した。
- [x] 本番へ `account_delete_executor_role.sql` と更新済み削除pipelineを適用し、読み取り専用検証を確認した。
- [x] 上記の無効なexecutor行を、別確認者のAuth・profileと承認記録を照合した後だけ有効化し、削除対象本人とは別人であることを確認した。
- [x] 本番の削除専用実行者セッションでauth-statusと一覧GETが200、モニター回答・AI利用・本番設定APIが各403となることを確認した。
- [x] 初回の削除実行権限有効化では、実行者の本人確認eventと別確認者の `activation_approved` eventを分離して記録する手順を確定した。
- [x] 実際の削除1件ごとに、request ID・target user ID・operator user IDに加え、job ID・manifest hash・件数を二人で照合し、確認者を運用台帳へ残す手順を確定した（初回有効化eventとは別の確認）。
- [ ] 最後のapp adminと最後の有効な削除専用実行者を削除しない。
- [ ] familyに他メンバーがいるownerは、Webの家族管理で所有権移管を完了した。
- [ ] 最新backup、削除後に古いbackupを復元する場合の再削除手順、障害連絡先を確認した。
- [ ] 破棄可能なPostgreSQLで次が成功した。

  ```bash
  pnpm run test:web-account-deletion
  pnpm run test:account-delete-executor
  pnpm run test:account-erasure:sql
  ```

- [ ] 単独テストアカウントで事前確認→AAL2対象確定→DB owner control open→別AAL2 app admin承認→executor grant-status/完全削除、Auth・DB・Storage不在確認、途中再実行、完了証跡を確認した。
- [ ] controlなし・closed・期限切れ・消費済み、grantなし・期限切れ・再利用・別epoch、異なるrequest/target/job/hash/operator・対象範囲変化・未登録の別app adminがすべてDB削除前に拒否され、再prepareまたはowner closeが旧grantを取り消すことを確認した。
- [ ] `database_erased` の途中jobだけは、env OFFへ戻した後も、最初のDB削除を実行した本人と同じ削除専用実行者が現在も有効かつAAL2で、正確なrequest/target/job/manifest hash、消費済み・未取消しgrant、現在の実行者hash＝grantの `operator_user_hash` をDB v2が再検証した場合だけ再開できることを確認した。DB未削除、値不一致、grant未消費・取消済み、無効な実行者、AAL1、別の有効な削除専用実行者は拒否され、新規削除のenv OFF bypassにならないことも確認した。
- [ ] request ID、target user ID、operator user IDを二人で照合した。メールアドレスだけで対象を決めない。
- [ ] 上記確認後に限り、運用責任者が削除1件の実行時間帯に限定した本番の `ACCOUNT_ERASURE_EXECUTION_ENABLED=true` を承認し、ON deployment IDと直接URLを制限付き台帳へ記録した。
- [ ] 成功時はcontrol/grant同時消費、放棄時はowner close、期限切れ時はinactiveであり、active control/grantが0件であることを確認した。`ACCOUNT_ERASURE_EXECUTION_ENABLED=false` の新deploymentへaliasを移し、過去のON deploymentを削除または保護する閉鎖手順も確認した。

### 8.3 手順

以下の `<REQUEST_ID>`、`<TARGET_USER_ID>`、`<JOB_ID>`、`<MANIFEST_HASH>` は画面の実値を、`<OPERATOR_USER_ID>` は制限付き台帳と手順6のread-only検査値を、別担当が復唱してから入力する。APIによる削除、DB controlの開閉、環境変数変更、deployは本番変更である。人が表示内容を確認する行為は運用台帳に残し、owner-only control、確認済みjob/hash/control epochへの固定、別アカウント、期限、1回限り消費はDBで強制する。

1. AAL2の `app_admin` が未完了依頼が全件表示されていることを確認し、対象依頼を `reviewing` にする。現routeはAAL2 app adminを確認し、`update_account_delete_request_status_v2` も正確なoperator user IDをDB側でapp adminとして再確認してから更新する。旧v1 RPCを呼ぶAAL1の旧deploymentでは更新できない。期限、本人確認、family所有権、問い合わせ履歴を確認する。削除専用実行者には連絡先、自由記載の理由、処理メモ、担当者identityを開示せず、状態変更も行わせない。
2. 登録済み削除実行者の個別メールで管理画面へ再ログインする。対応Webは `verify_account_delete_operator_v2` で実行者role methodだけを検証する。生の `account_delete_executors` を読む旧deploymentでは進まず、緊急用管理キーのsessionでは閲覧も実行もしない。
3. `/admin/delete-requests` の「検証済みの完全削除」を開き、画面に表示された対象user IDを省略せず入力して「1. 削除前の安全確認」を押す。Webは `inspect_account_erasure_v2` だけを呼び、AAL1でも実行できるread-onlyで、通常のデータ保存を止めない。
4. `result=ready`、Auth=`exists`の時だけ進む。v2のblockerは正規化したcodeと数値件数だけで判定し、`familyId`、`familyName`、Storageのobject/prefix生pathを画面・一般台帳へ出さない。`blocked`、`target_mismatch`、`last_app_admin`、`last_account_delete_executor`、`ownership_transfer_required`、`shared_photo_transfer_required`、Auth未確認は解消まで停止する。共有familyに対象user名義の写真が残ることを `shared_photo_transfer_required` で検出した場合は、写真引継ぎ機能が整うまで `needs_followup` とし、手動で完了にしない。
5. 実行者が登録済み認証アプリの6桁コードで追加認証し、画面がAAL2確認済みになったことを確認する。確認文 `削除対象を確定 <REQUEST_ID>` を省略せず入力し、「2. 削除対象を確定する（まだ削除しない）」を1回押す。Webは `prepare_account_erasure_v2` だけを呼び、旧v1は直接呼ばない。
6. 画面に表示されたjob ID、manifest hash、写真件数、旧保存場所件数、対象確定の期限を制限付き台帳へ記録する。対象確定は1時間で失効する。family ID/名、Storage pathそのものは画面に表示せず、一般台帳にも転記しない。次のread-only検査と完全一致することを確認する。

   ```sql
   select id, status, operator_user_id, storage_manifest_hash,
          prepared_at, prepared_expires_at,
          jsonb_array_length(storage_objects) as storage_object_count,
          jsonb_array_length(storage_prefixes) as storage_prefix_count,
          last_error_code
   from public.account_erasure_jobs
   where request_id = '<REQUEST_ID>'::uuid;
   ```

7. 単一日記削除と対象者全体削除の未完了写真jobを確認し、該当job IDと件数だけを制限付き台帳へ記録する。アカウント削除pipelineがこれらをStorage manifestへ含めていることを、手順6の件数と照合する。

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

8. 運用責任者が対象の1件に限定して `ACCOUNT_ERASURE_EXECUTION_ENABLED=true` を承認し、ON deployment IDと直接URLを制限付き台帳に残す。対応コードのdeploymentであることを確認する。この段階ではDB controlがclosedのため、過去のON deploymentを含め、どのWeb URLからもDB削除は始まらない。
9. 手順6の対象確定を再照合した後、DB ownerがSQL Editorで次を1回だけ実行する。900秒は最大値であり、開放結果のepochと実期限を制限付き台帳へ記録する。`execution_control_open` かつ `active=true` の新しいepochだけを使う。`execution_control_already_open` の場合は別処理との衝突を疑い、そのepochを再利用せず停止する。進行中処理がないことを確認してowner closeした後に、新しいepochからやり直す。

   ```sql
   select account_delete_private.open_account_erasure_execution_control_v1(900);

   select epoch, opened_at, enabled_until, consumed_at, closed_at, opened_by,
          epoch is not null
            and consumed_at is null
            and closed_at is null
            and enabled_until > clock_timestamp() as active
   from account_delete_private.account_erasure_execution_control
   where control_key;
   ```

   open/close関数とcontrol表はDB owner専用で、service role、Web、一般ログイン、削除専用実行者、app adminからは操作できない。Webは10分grantを要求するため、15分controlを開いた場合も原則5分以内に手順10を完了する。残り10分未満ならgrantを短縮して回避せず、owner closeして新しいcontrolを開き直す。
10. 実行者と別で、同じ実行者の `activation_approved` eventに登録されたapp adminが別sessionでログインし、本人用TOTPでAAL2に上げる。request ID、target user ID、operator user ID、job ID、manifest hash、件数、blockなしを復唱し、job IDとmanifest hashを再入力する。確認文 `実行許可 <JOB_ID>` を入力し、「別担当者として10分間だけ実行を許可」を1回押す。実行者と同じAuthアカウント、AAL1、未登録app admin、当該実行者の有効化を承認していないapp admin、不一致値、control残時間を超えるgrantは拒否する。
11. 実行者は自分のAAL2 sessionへ戻り、「実行担当者として許可を再確認」を押す。`execution_grant_ready` と許可の実期限を確認し、controlとgrantの両期限内に画面どおり `完全削除 <REQUEST_ID>` を入力し、「4. Auth・DB・写真を検証して完全削除」を1回押す。APIは確定済みmanifestと現在値が完全一致するpath/prefixだけを扱う。prefixや手作業でStorageを一括削除しない。最初のDB削除成功時にgrantとcontrolが同じトランザクションで消費されるため、同じON deploymentから2件目は実行できない。
12. 成功応答の `completed=true` と `verified.authUserAbsent`、`databaseReferencesAbsent`、`storageObjectsAbsent`、`storageObjectCount` を記録する。`prepared_scope_changed` やDB helperの安全blockでは利用者データを削除せずcontrolをfail closeし、同epochの未使用grantを取り消す。`manifest_mismatch`、`execution_control_disabled`、`execution_grant_required` はDB削除前の拒否を示すため、owner-only状態確認へ進む。通信断・SQL例外・応答不明ではDB削除やcontrol/grant消費を推測せず手順13・14のread-only検査へ進み、active control/grantのまま再実行しない。DB未削除が確認できた場合だけ、原因解消後にread-only事前確認、対象再確定、control再開放、別担当者の再承認からやり直す。DB削除後にAuth/Storageで停止した場合は手書きで完了にせず、まずenvをOFFへ戻す。最初のDB削除を実行した本人と同じ削除専用実行者が現在も有効かつAAL2で、同じrequest ID・user ID・job ID・manifest hashを送り、DB v2が現在の実行者hashと消費済み・未取消しgrantの `operator_user_hash` の一致まで検証して `grant-status` に `database_erased_resume_allowed` を返した場合だけ、Auth/Storage不在確認と最終化を再開する。別の有効実行者への引継ぎは不可。この回復では新しいprepare・control・grantやenv ONを要求しないが、DB未削除の新規処理に流用してはならない。
13. 管理画面の依頼状態と、次のread-only検査を別担当が確認する。正常終了時は依頼が `completed` になっていること、応答不明時はDB削除前・DB削除後のどちらで停止したかをここで判定する。

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

    -- 手順7で記録したjobがない場合、この検査は省略する。
    -- 複数ある場合はjob IDごとに繰り返す。
    select count(*) as retained_cleanup_identity_count
    from public.notebook_storage_deletion_jobs
    where id = '<CLEANUP_JOB_ID>'::uuid;
    ```

    全redaction列がtrue、両statusが `completed`、hashと3時刻が存在し、すべてのraw identity countとretained cleanup countが0でなければ完了扱いにしない。
14. DB ownerが次の状態を確認する。成功時は同じepochのcontrolとgrantがともに消費済み、放棄時は必ず `close_account_erasure_execution_control_v1()` を実行してcontrolを閉じ、同epochの未使用grantを取り消す。期限切れでも放棄記録を曖昧にせずowner closeする。応答不明時は先にread-only SELECTだけを実行する。DB消去済みの `database_erased` ならcloseや新規prepareをせずenvをOFFへ戻し、最初のDB削除を実行した本人と同じ削除専用実行者の現在有効なAAL2、同じrequest/target/job/manifest hash、同じ消費済み・未取消しgrant、現在の実行者hash＝grantの `operator_user_hash` をDB v2が再検証した場合だけ手順13の続きを行う。別の有効実行者では再開しない。active control/grantが0件になるまで操作を終えない。

    ```sql
    -- 最初はread-only。成功時はconsumed_at、放棄後はclosed_atが入る。
    select epoch, opened_at, enabled_until, consumed_at, closed_at, opened_by,
           epoch is not null
             and consumed_at is null
             and closed_at is null
             and enabled_until > clock_timestamp() as active
    from account_delete_private.account_erasure_execution_control
    where control_key;

    select id, request_id, job_id, control_epoch, storage_manifest_hash,
           created_at, expires_at, consumed_at, revoked_at,
           consumed_at is null
             and revoked_at is null
             and expires_at > clock_timestamp() as active
    from account_delete_private.account_erasure_execution_grants
    where request_id = '<REQUEST_ID>'::uuid
    order by created_at desc;

    select count(*) as active_grant_count
    from account_delete_private.account_erasure_execution_grants
    where consumed_at is null
      and revoked_at is null
      and expires_at > clock_timestamp();

    -- DB未削除のまま中止・放棄する場合だけ、DB ownerが実行する。
    -- 同epochの未使用grantも同じ処理で取り消される。
    select account_delete_private.close_account_erasure_execution_control_v1();
    ```

    close後は上の2つのread-only SELECTとactive grant件数を再実行し、controlの `active=false`、`closed_at` 存在、同epochの未使用grantの `revoked_at` 存在、active grant 0件を確認する。

15. `ACCOUNT_ERASURE_EXECUTION_ENABLED=false` の新deploymentを反映して公開aliasをそちらへ移す。手順8で記録したON deploymentを削除または保護する。環境変数OFFやURL閉鎖だけを最終境界にせず、active control/grant 0件、旧v1 inspect/prepare/status update/execute RPC権限なし、旧ON直接URLからv2を呼んでもlive controlなしで新規DB削除が拒否されることを閉鎖証跡にする。DB削除済みの途中回復は手順12・14の限定条件だけで扱う。
16. 指定した問い合わせ窓口から、クラウド削除完了と「各端末のローカル手帳は利用者側で別途削除が必要」を連絡する。

### 8.4 残す証跡

残す: request ID、job ID、operator、確認者、control epoch・開放期限・消費/close/失効結果、grant ID・有効期限・消費/取消/失効結果、各工程時刻、result code、manifest hash、object/prefix件数、DB/Auth/Storage確認結果、ON/OFF deployment ID、ON直接URLの閉鎖確認結果、完了連絡時刻。

残さない: 生の本文、写真、access token、service role key、削除後のメールアドレス、Storage path一覧。

`account_delete_requests.due_at` と管理画面を毎日確認する。手書きメモだけで `completed` にしてはいけない。

### 8.5 個別削除cleanupとの統合境界

`account_deletion_pipeline.sql` は、対象利用者または単独所有familyのpending日記・対象者写真cleanupをStorage manifestへ統合する。DB削除時はpending jobを再試行用に残しつつ `created_by` をNULL化し、対象利用者または単独所有familyの個別削除receiptからraw identityを消す。最終化前の残存検査でも対象user IDが残っていないことを数え、APIがStorage不在を確認したmanifestと一致するpending jobを削除する。永続証跡は `account_erasure_jobs` のmanifest hash・件数と監査ログへ最小化する。これらは破棄DB回帰試験の対象である。

共有familyに対象利用者名義のnotebook写真pathが残る場合は、退会後の署名・表示不能と他familyの写真削除を避けるため `shared_photo_transfer_required` で停止する。現時点では自動引継ぎが実装済みとは扱わず、所有権移管だけでblockを解消したと判断しない。

一方、本番に `account_erasure_execution_gate.sql` が適用済みか、対応する実行APIがdeploy済みか、owner-only one-shot control、別のAAL2 app adminによるcontrol残時間内のgrant、外部Auth/Storageを含む単独テストアカウントの完走は、このリポジトリだけでは確認できない。実行スイッチはそれらを確認するまでOFFとし、コードがあることだけで「検証済み消去を運用中」と宣伝しない。

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
4. アカウント削除は上記と `admin_auth_hardening.sql` 等の前提後に `account_delete_executor_role.sql`、`account_delete_identity_ledger.sql`、`account_deletion_pipeline.sql`、`account_erasure_execution_gate.sql` の順でDB-first適用する。`account_delete_identity_ledger.sql` は実行者を登録する前に1回だけ適用する。execution gate適用後は旧v1 inspect/prepare/status update/execute RPCと `account_delete_executors` 生table SELECTのservice role権限が消え、service roleにはrole-method v2、privacy-safeなinspect/prepare v2、DB側でもapp adminを再確認するstatus update v2、gated execute v2の各RPCだけを開く。生tableや旧v1を使う旧Webは認可・PATCH・実行の各境界、execute v2はDB ownerがone-shot controlを開くまで拒否するため、対応Webのdeploy前後とも新規DB削除は意図的にfail closedとなる。
5. `verify_compact.sql` でaccount erasure、private本人確認台帳・execution control・grant、単一日記削除、対象者全体削除のtable、role-method/inspect/prepare/execute v2のservice-only RPC、v1とexecutor生table SELECTのservice role revoke、owner-only control、再作成・Storage race guard、internal helper非公開、完了証跡の最小化を確認する。念のため次もread-onlyで存在と権限を確認する。

   ```sql
   select to_regclass('public.account_erasure_jobs') is not null as account_erasure_jobs,
          to_regclass('account_delete_private.account_erasure_execution_control') is not null as erasure_execution_control,
          to_regclass('account_delete_private.account_erasure_execution_grants') is not null as erasure_execution_grants,
          to_regclass('public.notebook_storage_deletion_jobs') is not null as notebook_delete_jobs,
          to_regclass('public.notebook_diary_deletion_receipts') is not null as diary_delete_receipts,
          to_regclass('public.person_notebook_deletion_receipts') is not null as person_delete_receipts,
          to_regclass('public.person_notebook_storage_deletion_jobs') is not null as person_delete_jobs,
          to_regprocedure('public.verify_account_delete_operator_v2(uuid)') is not null as operator_role_method_v2,
          to_regprocedure('public.inspect_account_erasure_v2(uuid,uuid,uuid)') is not null as erasure_inspect_v2,
          to_regprocedure('public.prepare_account_erasure_v2(uuid,uuid,uuid)') is not null as erasure_prepare_v2,
          to_regprocedure('public.update_account_delete_request_status_v2(uuid,text,text,uuid)') is not null as erasure_status_update_v2,
          to_regprocedure('account_delete_private.open_account_erasure_execution_control_v1(integer)') is not null as erasure_control_open,
          to_regprocedure('account_delete_private.close_account_erasure_execution_control_v1()') is not null as erasure_control_close,
          to_regprocedure('public.execute_account_erasure_database_v1(uuid,uuid,uuid)') is not null as erasure_execute_internal,
          to_regprocedure('public.issue_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text,integer)') is not null as erasure_grant_issue,
          to_regprocedure('public.inspect_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text)') is not null as erasure_grant_inspect,
          to_regprocedure('public.execute_account_erasure_database_v2(uuid,uuid,uuid,uuid,text)') is not null as erasure_execute_gated,
          not has_function_privilege('service_role', 'account_delete_private.open_account_erasure_execution_control_v1(integer)', 'EXECUTE') as control_open_owner_only,
          not has_function_privilege('service_role', 'account_delete_private.close_account_erasure_execution_control_v1()', 'EXECUTE') as control_close_owner_only,
          not has_function_privilege('service_role', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE') as legacy_inspect_v1_revoked,
          not has_function_privilege('service_role', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE') as legacy_prepare_v1_revoked,
          not has_function_privilege('service_role', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE') as legacy_status_update_v1_revoked,
          not has_function_privilege('service_role', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE') as legacy_execute_v1_revoked,
          not has_table_privilege('service_role', 'public.account_delete_executors', 'SELECT') as raw_executor_select_revoked,
          has_function_privilege('service_role', 'public.verify_account_delete_operator_v2(uuid)', 'EXECUTE') as operator_role_method_v2_service_only,
          has_function_privilege('service_role', 'public.inspect_account_erasure_v2(uuid,uuid,uuid)', 'EXECUTE') as inspect_v2_service_only,
          has_function_privilege('service_role', 'public.prepare_account_erasure_v2(uuid,uuid,uuid)', 'EXECUTE') as prepare_v2_service_only,
          has_function_privilege('service_role', 'public.update_account_delete_request_status_v2(uuid,text,text,uuid)', 'EXECUTE') as status_update_v2_service_only,
          has_function_privilege('service_role', 'public.execute_account_erasure_database_v2(uuid,uuid,uuid,uuid,text)', 'EXECUTE') as gated_v2_service_only,
          to_regprocedure('public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)') is not null as erasure_finalize,
          to_regprocedure('public.delete_notebook_diary_v1(uuid,uuid,uuid,text,text,bigint,text)') is not null as diary_delete,
          to_regprocedure('public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)') is not null as person_delete;

   select epoch, opened_at, enabled_until, consumed_at, closed_at,
          not (
            epoch is not null
            and consumed_at is null
            and closed_at is null
            and enabled_until > clock_timestamp()
          ) as execution_control_not_active
   from account_delete_private.account_erasure_execution_control
   where control_key;
   ```

6. すべてtrue、control行が1件かつ `execution_control_not_active=true`、migration errorなしを確認してからWebをdeployする。DB migrationに失敗したままWebだけ進めない。
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

Incident Commanderの承認権限と、実際にVercelのrollback、SupabaseのDB操作、secret rotation等を実行できるサービス権限は別に管理する。主責任者・代行者の氏名と代行責任範囲を記録しただけでは、承認権限または実行権限を付与しない。最終承認者、実行者、権限範囲、MFA、二者確認、緊急時アクセス回復方法を制限付き運用台帳で確認してから本番操作を行う。

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
- v2-only対応Web更新後の本人ログインによる200/403・AAL2再確認、旧deploymentの認可fail closed、未完了全件+完了直近100件の一覧保全、privacy-safeなblocker応答、削除専用一覧のSELECT段階最小化、状態/処理メモPATCHのAAL2 app_admin限定、DB owner controlと別のAAL2 app adminのgrantを含む単独テストアカウントによる外部Auth/Storage完走。`account_erasure_execution_gate.sql` の本番適用、executor生table SELECT失効、control/grantのACL・初期閉鎖状態と対応Web `c1415b3` の本番反映・smokeは2026-09-05に確認済みだが、本人ログイン後の実機試験や完全削除E2Eの代わりにはしない。
- 更新版gateと対応Webは2026-09-05に本番反映済みで、owner-only control、別の登録済みapp admin、request/job/hash/operator/control epochへの固定、期限、DB削除成功時のcontrol/grant同時消費を実装している。更新後の本人ログイン・AAL2を含む実機完走は未確認であるため、削除運用はまだ開始しない。別確認者が表示された対象を実際に照合したことは運用証跡で補完する。
- 個別削除migration・cleanup Cron・復活防止receiptの本番適用と、2端末による完走。
- 非対話lint gateが未設定である点。

これらは「後で確認」ではなく、Stage A GO判定時に担当者が結果と根拠を記録する。
