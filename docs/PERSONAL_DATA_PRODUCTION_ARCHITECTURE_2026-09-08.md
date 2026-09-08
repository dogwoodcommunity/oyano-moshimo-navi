# 個人情報を扱う本番構成 — AWSバックアップ保管庫

作成日: 2026-09-08。状態: **設計・構成コード。AWS未作成、実データ未取得、正式公開NO-GO**。

## 方針

手元のMacをサービスの災害復旧先にする前提をやめ、運営が管理するAWS東京リージョンの保管庫を設ける。
稼働中のVercel + Supabaseを維持し、別の保護層を加える。DBをRDSへ、写真配信をS3へ移行する変更ではない。
現在の利用者データ、認証、写真URL、家族権限、アプリの保存方式には手を加えない。

```text
利用者の端末 ─ HTTPS ─ Vercel（認証・家族権限を確認）
  │                         ├─ Supabase Auth / PostgreSQL / private写真Storage（正本）
  └─ 端末内データ             └─ 同意のあるAI相談 → Anthropic（別の外部処理境界）

運営用のバックアップ実行環境【次段階・未実装】
  ├─ DB/Authの整合したdump + schema/roles/ACL情報
  ├─ 写真の実ファイル + object metadata + SHA-256
  └─ 独立した最新削除ジャーナル
            │ 一時IAMロール・TLS・条件付き書込み
            ▼
AWS東京：専用backupアカウント推奨【今回の構成コード・未作成】
  ├─ Backup S3  : 世代ごとのDB/写真/暗号化manifest
  ├─ Receipt S3 : 最新削除証跡の独立保全
  └─ Audit S3   : CloudTrail操作記録、ログ整合性検証
       KMS鍵をデータ用/監査用に分離、全bucket非公開
            │ MFAを確認した復旧担当だけが一時ロールで読取
            ▼
隔離復旧先 → hash/権限/削除再適用/写真/Auth確認 → 二者承認 → 本番切替
```

S3だけで全ての個人情報保護が完了するわけではない。クラウド利用者側にも適切な安全管理措置が必要とされる。
法令適合をこのテンプレートだけで認定しない。[個人情報保護委員会FAQ](https://www.ppc.go.jp/all_faq_index/faq1-q7-54/)

## データの境界（現sourceの監査）

| 対象 | 正本・既存保護 | AWS追加後にも残る対応 |
| --- | --- | --- |
| 呼び名・日記・服薬/連絡先・家族情報 | Supabase DB、サーバー側認証/家族確認/RLS | 全本番設定の照合、最小収集、削除・実復旧 |
| 写真 | private `home-photos`、家族権限を照合する署名URL | 実ファイルの独立backup。DB backupは写真本体を含まない |
| AI相談・記憶 | 家族の事実と本人の相談履歴を分離。Anthropicへ必要なcontextを送信 | 自由文の人名/住所等は完全に伏字にならない。契約/保持/処理国/同意の確認 |
| ブラウザ | localStorageにJSON保存、永続Auth session | S3の暗号化は端末内JSONを暗号化しない。共用端末、盗難、XSS、ログアウト時残存を別に対策 |
| 保存済みPDF/JSON | 利用者が管理するファイル | 共有先・端末管理。クラウド削除で回収できない |

根拠: `apps/web/lib/store.ts`、`browserSupabase.ts`、`serverSupabase.ts`、`consult.ts`、
`apps/web/app/api/notebook/{photo-upload-url,sync}/route.ts`、`supabase/production_rls.sql`、
`storage_setup.sql`、`ai_consult_memory.sql`。
写真本体はDBとは別に保全する。[Supabase公式](https://supabase.com/docs/guides/platform/backups)

AWSの保管先を東京にしても、Vercel/Supabase/Anthropicを含めた全処理が日本国内になるわけではない。
各サービスの所在・契約・外的環境・利用者向け説明は別途確認する。
[個人情報保護委員会FAQ](https://www.ppc.go.jp/all_faq_index/faq1-q10-25/)

## 今回コードにする保管庫

`infra/aws-personal-data/backup-vault.cfn.json`。値を埋めて実行するのは承認後。

- 3個の専用S3 bucket。Block Public Accessを全項目ON、ACLを使わずBucketOwnerEnforced、Versioning有効。
  Webサイト配信・CORS公開・匿名GET・利用者ブラウザへのAWSキー配布はしない。
- データ用と監査用のKMS鍵2個。ローテーション有効。通信TLS、保管SSE-KMS。
  S3 Bucket Keyを用い、データ鍵利用を該当bucketのS3経由に限定する。
- 保存担当は追加用、復旧担当はbackup/receipt読取用、監査担当はaudit読取用の別ロール。
  信頼元は既存の正確なrole ARNで指定。共有パスワード・永続access keyの埋込みはしない。
- 復旧担当のMFAはIdentity Center等の上流認証で確認する。role ARN限定だけではMFAを保証しない。
  人と機械のroleを兼用せず、1時間以内のセッション・二者承認・個人単位の監査を運用に組み込む。
- backup/receiptへの条件付き書込みにより、既存current keyへの無条件上書きを拒否する。
  `PutObject`/`CompleteMultipartUpload`に`If-None-Match: *`が必要。`aws s3 sync`やCopyObjectを
  安易に収集処理に採用しない。multipartは公式のObjectCreationOperation例外に従う。
  [AWSの条件付き書込み](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html)
- writerのS3読取・削除・Object Lock解除は許可しない。ただしSSE-KMS multipartに必要な
  `kms:Decrypt`はS3経由・対象鍵/暗号化contextへ限定して付与する。これを「復号権限ゼロ」とは呼ばない。
  [AWSのSSE-KMS権限](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html)
- CloudTrailでbackup/receiptのオブジェクト読取・書込を記録し、暗号化された専用audit bucketへ出す。
  audit自身の書込をデータイベント対象にして循環増大させない。ログ整合性検証を有効にする。
  auditの既定暗号化とTrailはKMSを指定するが、整合性検証用digestの配送を壊さないようAES256も拒否しない。
  全ての監査objectが同じKMS方式になるとは保証せず、実配送・ログ検証を合成AWS試験で確認する。
  [AWS CloudTrailの暗号化の注意](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html)
- bucketとKMS鍵をCloudFormationの削除・置換からRetainする。**stack削除は消去や課金停止ではない。**
  手動削除・強権の管理者・KMS鍵削除まで防げるものではない。root/MFA、組織のSCP、緊急権限を別に管理する。

### 保持と削除（承認前の設計値）

| 保管対象 | 初期案 | 注意 |
| --- | --- | --- |
| backupのcurrent version | 30日でexpiration対象、noncurrentは1日後に削除対象 | lifecycleは非同期。正確な31日後の物理消去を約束しない |
| backupのObject Lock | GOVERNANCE 7日 | writerの削除から旧versionを守る。Complianceは採用しない |
| 削除証跡の保管コピー | 180日 + noncurrent 1日 | 元DBのreceiptを180日で消す意味ではない。累積snapshotを定期更新 |
| 監査ログ | 180日 + noncurrent 1日 | 本文・個人名・メール・tokenをobject key/ログへ入れない |
| 未完了multipart | 1日でabort対象 | 未完了世代を復旧候補へ公開しない |

Object Lockは一度有効化すると無効化できず、Versioning停止もできない。Governanceの例外削除は
別承認・別権限が必要で、今回のwriter/readerには与えない。権限設定なしに「いつでも即時消去」と約束しない。
Complianceは期限前にrootでも削除できないため、未確定の削除方針のまま設定しない。
[AWS Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html)

削除要求はまず稼働データと配信を止め、削除証跡を独立保全する。既存backupに残るコピーは復旧時の再適用で
利用者へ再表示させず、承認された保持期間・例外手順に従って処理する。利用者向け説明と法務判断が必要。
削除markerだけでは過去versionの消去にならない。[AWS Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html)

## 次段階の自動取得・復旧設計（未実装）

1. EventBridge Scheduler → 専用ECS Fargate taskを日次実行。常設Mac・GitHub hosted runnerに本番dumpを置かない。
   taskは受信portなし、read-only root filesystem、暗号化された一時領域、secretや本文をログに出さない。
   固定digestのcontainer、最小egress、実測した時間/容量上限を使う。NAT常設は料金が増えるので別見積り。
2. DB/Authのread-only専用接続とStorageの限定読取資格をSecrets Managerへ別々に置く。
   広いDB owner/service roleを便利だからとworkerへ渡さない。PGバージョン、IPv4/IPv6、session poolerと
   dumpの整合性、Auth/roles/ACL/管理schemaの復元範囲を実projectで確認する。秘密値はGit・argvへ書かない。
3. DBの同一snapshotとStorage inventoryの開始/終了時刻をmanifestで結ぶ。全bucket/全ページを走査し、
   objectの追加・変更・削除、取得漏れ、hash不一致があれば世代を未完了にする。
   S3に置いただけでトランザクション整合性を保証しない。原本write freezeは現在未実装である。
4. object keyは`backups/<UTC-run-id>/<opaque-artifact-id>`等。元のUUID/path対応表は暗号化manifest内のみ。
   DB/Auth dump、必要role設定、写真bytes/metadata、schema/release SHA、個別SHA-256、S3 VersionId、
   開始/終了時刻、件数/bytes、鍵参照を記録する。ETagをファイルSHA-256と同一視しない。
5. 全ファイル照合後だけ、一意keyのcomplete manifestを条件付き書込みする。412/409を成功扱いせず、
   応答消失は別の検証者がVersionId/hashを照合して判定する。S3 writerへ読取権限を足してごまかさない。
6. 削除ジャーナルはDB世代とは独立して短い間隔（目標15分）で保存し、毎日累積snapshotを更新する。
   日記・対象者・アカウントを別扱いにし、復旧先を開く直前に最新coverageを再確認。欠落/時刻逆転/取得失敗ならNO-GO。
   対象者receiptはservice roleにもSELECT不可、アカウント完了receiptはIDが最小化されるため、
   専用の限定export/照合/replay設計が必要。現試験は架空日記1件だけで汎用replayではない。
7. 最終成功世代の年齢（目標26時間超）、job失敗/未起動/過大bytes、削除ジャーナル欠落をCloudWatchで検知。
   Scheduler自身の失敗・DLQ、ECS停止理由、欠測も異常扱い。SNS通知先を担当/代行へ登録し、実受信まで検証する。
   「記録本文なし」の構造化ログとrun IDのみを出す。CloudTrailだけではbackup成功を監視できない。
8. RestoreReaderRoleを一時付与し、隔離先でDB/Auth/roles/ACL/写真を復旧。最新削除を再適用し、Auth/写真物理削除まで確認。
   新旧端末の再送、家族RLS、viewer拒否、ログイン、PDF写真を試験。メール/AI/通知/本番同期は切替まで停止する。
   目標RPO24時間、DB/Auth RTO8時間、写真RTO24時間は、実測して初めて達成と記録する。

対象者/アカウントの後発削除replay、自動収集、監視通知、取得先接続、実復旧はこのテンプレートに含まない。
保管庫だけ先に作っても「毎日自動バックアップ済み」「個人情報の本番対応完了」とは表示しない。

## 費用

AWS公式東京料金を2026-09-08確認（Price List publicationDate 2026-08-31）。USD・税別、無料枠/creditを差し引かない。

| 項目 | 単価・算定例 |
| --- | --- |
| S3 Standard | 全世代合計10GB=$0.25/月、100GB=$2.50/月（最初50TB、$0.025/GB月） |
| KMS | 2鍵の基本$2/月。最初と2回目のrotationで鍵ごと各$1加算、2鍵合計では将来最大+$4/月 |
| S3操作 | PUT/LIST $0.0047/1,000回、GET等 $0.0037/10,000回 |
| KMS操作 | $0.03/10,000回 |
| CloudTrail data events | $0.10/100,000件。管理イベントの追加コピー、ログ保管/操作も別確認 |
| 次段階Secrets Manager | 2 secretsで$0.80/月＋$0.05/10,000 API |
| 次段階Fargate | Linux/x86 1vCPU/2GB、10分×30日で$0.3081/月。実測前の仮定 |
| 次段階Scheduler/IPv4 | 30起動=$0.0000375、実行時のみIPを5時間=$0.025 |

**保管庫の基本小計は合計10GBなら約$2.25/月、100GBなら約$4.50/月＋従量分。総額上限ではない。**
収集・監視稼働時はさらにSecrets、Fargate、ECR、CloudWatch/SNS、監査ログ、復元/転送、Supabaseのegress等が増える。
表の30起動は日次backupだけの例で、独立削除ジャーナルの15分間隔取得や照合jobの費用は含まない。
DB10GBを毎日30世代そのまま保存すれば約300GBであり、10GB料金ではない。実容量/圧縮率/変更率を測ってから承認する。
予算通知は支払上限や自動停止ではない。超過時にbackupを黙って止める設計にもせず、責任者へ通知して判断する。
stackを削除してもRetainされたS3/KMSは残り、保存/鍵の料金が継続する。保持を満たした全version/ログ/鍵の
処理と監査確認を別の終了手順で行う。無料で無期限に運用できるとは案内しない。

根拠: [S3東京](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/ap-northeast-1/index.json)、
[KMS東京](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/awskms/current/ap-northeast-1/index.json)、
[KMS rotation料金](https://aws.amazon.com/kms/pricing/)、
[CloudTrail東京](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSCloudTrail/current/ap-northeast-1/index.json)、
[Secrets東京](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSSecretsManager/current/ap-northeast-1/index.json)、
[Scheduler東京](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSEvents/current/ap-northeast-1/index.json)、
[Fargate東京](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/ap-northeast-1/index.json)、
[IPv4](https://aws.amazon.com/vpc/pricing/)。

通信も認証情報も使わない概算表示:

```bash
node scripts/plan-personal-data-backup.mjs --plan --retained-gb 100 --daily-minutes 10
```

`--apply`、upload、実データ入力のモードは用意しない。

## 実環境へ作る前の確認

1. 所有AWSアカウント・請求先を指定。もしもナビ専用backupアカウントが第一案。既存の他サービス用bucketは流用しない。
2. 信頼元のcollector/restore/audit/admin role、MFA、緊急時の鍵回復、個人単位の監査を確認。
3. 保持日数、削除依頼の説明、月額試算と通知基準を承認。
4. CloudFormation change setの対象と権限変更を別確認者が確認。実行は別承認。東京以外では作らない。
5. 本番データを入れず、合成objectで公開GET/誤鍵/無条件上書き/writer読取削除を拒否し、正しいMPU/復旧読取/CloudTrailを確認。
6. 次段階worker・独立削除export・監視を実装して合成試験、通知の実受信を確認。
7. 個人情報をAWSへ複製する対象/保管/委託条件を承認後にだけ実backupを取得。隔離復旧と二者削除を終えて公開判定する。

S3/KMS/IAM/CloudTrailの作成、AWS契約/請求設定変更、Supabase移管、secret登録、実データ取得・uploadは今回行っていない。

## 検証方法と受入境界

- `node scripts/test-personal-data-infra.mjs`: 実テンプレートを使った構造・権限制約とoffline概算の回帰。
  既知の条件の合成評価と設定を意図的に壊すnegative controlであり、AWS IAMの実評価・配送試験ではない。
- `cfn-lint` 1.53.3で東京リージョンのCloudFormation schemaを検証する。AWS資格情報・APIを使わない。
  CIにも独立した検証jobを追加。テンプレートがlint合格でも上流role・アカウント・請求・service連携は未確認。
- Stage Aの最新定義はsource34/full48工程。cfn-lintはこの工程数に含めず別検証とする。
- 実装者以外が構成・データ境界・料金を独立レビュー。現構成で明確なP0/P1は見つからなかったが、
  本番用backup collector・監視・実復旧が完了したという判定ではない。Claudeへの新規送信ではない。

実行結果・commit・CIは `docs/SESSION_HANDOFF.md` の追記386で記録する。
