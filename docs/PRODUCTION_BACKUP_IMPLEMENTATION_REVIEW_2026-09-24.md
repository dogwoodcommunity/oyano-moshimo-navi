# 実バックアップの最小実装レビュー

2026-09-24 / 開始HEAD `f8674ab` / `codex/consult-guest-entry` / PR #9 draft。
本人のAstra切替完了返答後の設計工程。**実装範囲を確定。AWS作成・秘密取得・実データ転送・本番復元・申請は未実施。**

## 1. 判断

既存のS3保管庫だけでは自動取得・復元を保証できない。次のSol工程は、下記の契約に沿う
**収集adapter、独立検証、隔離復元の入場判定と合成試験**まで進める。いきなり本番の消去関数を変更しない。
本番データを復元先から利用者へ公開する自動処理は作らない。

- 正本は引き続きVercel/Supabase。S3へDBや写真配信を移転しない。
- AWS東京の専用資源。別サービスのbucket・role・鍵を流用しない。
- 日次のDB/Auth/写真backupと、15分ごとの比較用metadata checkpointを分離する。
- 15分checkpointは最新削除の完全な証明ではない。障害直前の変更を欠く可能性がある。
- sourceが失われ最新の状態を確定できない場合、隔離調査だけを許し、利用者への公開を拒否する。
  **削除RPOゼロ・必ず復旧可能・RTO達成とは言わない。** RPO24h、DB/Auth8h・写真24hは未実測の目標。
- source存続時の隔離復元実証を先に完成させる。source全損でも直ちに公開復旧できる方式は今回の確定範囲外。
  これが必要なら同期的な外部削除証跡などの追加設計・承認が必要で、日次backupのPASSで代替しない。

## 2. 今回の証拠（内容は取得せず、件数・schemaのみ）

Supabaseの対象project SQL Editorで `BEGIN READ ONLY`、8秒timeout、集計、`ROLLBACK` を実行。

| 項目 | 実測 |
| --- | --- |
| PostgreSQL | 17.6 |
| DB全体の使用bytes | 15,772,819（dumpサイズではない） |
| Storage | `home-photos` の14行、metadata申告サイズ合計7,519,641 bytes |
| Storage異常・versioning | size欠落0、version欠落0、versioned/archived/delete-marker各0 |
| 指定候補のapp/private schema | public、account_delete_private。push_private/backup_privateは未存在 |
| 対象private schemaのtable数 | 3 |
| 検証済みMFA factor数 | 1（アプリAuth集計。Dashboard MFAの検証ではない） |

DB bytesとStorage metadataは整合した実dump/実写真の取得証明ではない。秘密・写真・記録本文は未取得。
既存のPostgreSQL16合成演習は、本番17.6の復元互換性を証明しない。新試験はPG17の固定image digestを使う。
前回427のFree Plan/backup不在、AWS名前検索、iPhone接続、署名0件は前回の証拠として扱う。

## 3. 見つかった不足と、最初の実装での対処

### 消去済みIDを後から収集できない

`account_deletion_pipeline.sql` の消去処理は、単独所有familyの既存日記/対象者receiptを削除し、
finalizerでtarget user ID、owned family IDs、Storageの生path/prefixを消す。残るuser hash/countだけでは
削除時点のfamily範囲を復元できない。古いbackupの所有者から推定すると、所有権移譲済みfamilyを巻き込む。
日記/対象者receiptだけではAI履歴削除・記憶reset・写真差替え・家族退会/権限変更もカバーできない。

**最初は遅れてreceiptを集める方式を「完全な削除台帳」にしない。** backup時点と最新sourceの
全対象行の存在/内容digest・関連範囲を比較し、不一致の範囲を公開不可にする保守的方式を採用する。
元の内容を復元してよいか判断できない行を、古い値で復活させない。
将来の同一transaction消去journal追加は、この収集実装のために先行適用しない。

### 保存者自身が「検証完了」を書ける

既存 `backup-vault.cfn.json` のwriterは `backups/*` に書けるため、`complete.json` も書ける。
既存 `backup-generation.mjs` の別callbackは別IAM主体の保証ではない。
templateに機械用VerifierRoleを追加し、writerと完了marker作成権限を分ける。人用RestoreReaderRoleを兼用しない。

### sourceのStorage鍵の権限

Supabaseの生成済みS3 access keyは全bucketの全操作を許しRLSを迂回する。
日次workerへ渡して「読取専用」と説明してはいけない。
[公式の権限説明](https://supabase.com/docs/guides/storage/s3/authentication)

v1のadapterはStorageへのGET/HEADだけを公開し、source/destinationのclientを型・設定で分離する。
現行Webと同等の広いserver credentialを使う接続案は、**秘密へのアクセス範囲拡大として明示承認前は接続禁止**。
workerへ新規配布済みと扱わない。Supabase JWT/RLSでの専用read-only主体が実証できれば優先するが、
その認証/権限の追加は別の小さなレビュー対象。失敗時にservice_roleへ黙ってfallbackしない。
Solは先に合成source adapterで以下の収集・拒否契約を完成できる。

## 4. adapterと保管の契約

### source snapshot

1. 受け入れる接続先は専用設定に固定したproject/host/TLS。任意URL・環境全走査・接続失敗時の本番fallbackなし。
2. 専用DB資格は対象tableのSELECTのみを基本とする。FORCE RLSを含む全行を読めるか別検証する。
   `pg_read_all_data`だけでRLSを迂回できると仮定しない。漏れ・権限不足は失敗し、superuserへfallbackしない。
3. coordinatorのrepeatable-read snapshotを維持し、PG17 `pg_dump --snapshot` とDB行/Storage catalogを共有。
   exported snapshotのhandleと`pg_current_snapshot()`の可視性情報、schema fingerprint、PG/tool版、source epochを記録。
   timeoutでtransactionを閉じる。sourceでDDLやrole/ACL変更があれば世代不成立。
   [PG17のsnapshot指定](https://www.postgresql.org/docs/17/app-pgdump.html)
4. table allowlist/classificationはバージョン管理。public、auth、storage、account_delete_private、
   導入後のpush_private、存在するmigration履歴等を列挙する。未知table・新schema・未知主キーは停止。
   schema全体名だけで全table取得済みとしない。provider管理schema、extension、ACL/trigger、custom roleもinventoryへ。
5. role dumpはパスワードなし。復元で必要な秘密やprovider設定は別の承認済みsecret escrow。
   DB接続URL/password、Auth/MFA材料、API key、写真path、本文をargv・CloudWatch・Gitへ出さない。

### 写真

- DB snapshot中のStorage catalogを正とし、ページ上限/重複/欠落を検出。現在の14件を固定値にしない。
- v1はversioned/archived/delete-markerが1件でもあれば未対応として停止。無視して成功にしない。
- 全対象objectをGETし、streamのbytes/SHA-256を測定。取得前後のversion/metadata/catalogの一致も確認する。
  更新・削除・不足・孤立した参照・途中page失敗は不完全世代。ETagをSHA-256と扱わない。
- 新規uploadとの競合で失敗したら新runで限定回数再試行し、継続失敗を通知。sourceのuploadを止めない。
- mapping（元bucket/path/version、参照範囲）は暗号化catalog内だけ。S3 keyはopaque run/artifact ID。
  DB metadataを戻しただけで写真を復元済みにしない。隔離Supabase StorageへAPIで実bytesを戻し照合する。

### AWS上の主体と完了の境界

| 主体 | 許す操作 | 許さない操作 |
| --- | --- | --- |
| Collector | 指定runのartifacts/candidateを条件付き追加 | backup読取、削除、完了marker、保持/ACL変更 |
| Checkpoint collector | receipt bucketのcandidateを条件付き追加 | 完了marker、backup読取、削除 |
| 機械Verifier | candidateと指定VersionIdの実bytesを読取、verified marker/receiptを条件付き追加 | source秘密取得、artifact差替え、削除、保持変更 |
| 人のRestoreReader | MFA・時間制限下で承認世代を読取 | 通常の書込、削除、保持変更 |
| Audit/Admin | 既存の役割分離、個人単位の監査 | writerとの兼用、account全体の無条件trust |

正確なrole ARN/sessionとprefix/条件をIAM・bucket policy・KMS contextの両側で制限。
Collectorが別inline policyを持ってもmarkerを書けないDenyを試験する。verifierへsource credentialは渡さない。
検証者もsource全行の真正性を魔法のように保証するわけではない。侵害されたsource/collector対策の限界を残す。

`complete.json`は**バイト完全性だけ**。利用者公開許可とは分離する。
既存v1の3必須artifact契約を黙って緩めず、metadata/config bundle追加はschema v2＋旧v1拒否/互換試験で明示する。
manifest不明writeは同じrun/versionを照会して照合。新markerを上書きして成功にせず、`WRITE_UNCERTAIN`で停止。

## 5. 最新状態の比較と隔離復元の入場判定

### 比較checkpoint

- 15分ごとに整合snapshotから全対象の存在/row digest/親scopeを取得。本文コピーの代わりに、
  version付きHMAC-SHA256（domain・table・PK・正規化row）を使用。raw email等の単純hashは使わない。
- DB内scope IDもHMAC化し、backup内mappingと比較可能にする。秘密は専用secret、workerログに出さない。
  これは匿名データではなく照合可能な仮名化metadata。個人情報に準じて保管・削除する。
- 主キーなし・canonicalize不能・未知table・範囲対応不明なら失敗。table数/row数/全page/重複も検証する。
- table分類は、家族データ/本人データ/権限関係/復元しない認証・配送状態/非個人の構成データを区別する。
  sessionの時刻更新などをfamilyの消去と判定しない。除外する運用tableもinventoryに記載し、
  「常に無効化して再発行する」という復元規則を試験する。個人情報を含むtableの黙った除外は禁止。
- 累積全件snapshotを保存する。最大連番や時刻だけの増分取得は禁止（先に番号取得したtransactionの遅いcommitを落とす）。
- source epoch/schema/HMAC key版が異なるcheckpointは比較不可。rotationは旧世代の比較キーを勝手に廃棄しない。

### restoration states

`CAPTURED → BYTE_VERIFIED → ISOLATED_RESTORED → PRIVACY_CHECKED → HUMAN_RELEASE_REVIEW`

各段階の証跡は別々。自動処理の最終出力は常に `publicReleaseAllowed: false`。
最後の本番切替は今回実装しない。receiptや入力JSONの`true`だけでgateを通さない。

1. 新しい隔離先とsource/destination識別子の相違を照合。メール/通知/AI/決済/Webhook/cron/公開URLは先に無効化。
   ローカル合成演習はnetworkなしの専用container。実Supabase隔離先は別の承認後。
2. DB/Auth、custom role/ACL/RLS/trigger、写真実体を復元。復元用の権限はsourceの資格と分ける。
   authのsession/refresh token/one-time tokenは再利用せず再認証前提。招待/share link、push配送も既定無効。
3. 最新の権威あるsource checkpointとbaselineを比較。消えた行だけでなく変更された行も検出。
   v1は不一致の所属family/user全体を隔離し、古い記録/権限/AI記憶を公開しない保守的動作。
   範囲不明、共有データへの影響不明なら全体NO_GO。所有権移譲をアカウント削除と推定して消さない。
4. 正本の生存・checkpointの新しさだけでは切替証明にならない。本番切替前は別承認で全writer/backgroundを
   制止し、進行中transaction/Storage処理の終了を確認したcutoff checkpointが必要。
   今回の隔離演習でこの本番停止操作はしない。cutoff未証明なら `PRIVACY_COVERAGE_UNPROVEN`。
5. source全損・journal欠測・最後15分が不明なら公開不可。古いcheckpointや人の推測で「削除漏れなし」にしない。
   影響範囲の隔離は実データの消去ではなく、保護された復元先でのアクセス禁止。解除も別承認。

Authの復元はSQLが通るだけでは不足。verified MFA factorが現在1件あるため、その復元/再登録も実証対象。
Vault/column encryptionが使われる場合のroot keyと、Auth暗号化材料は同じものと断定しない。
存在確認・provider対応・鍵回復手順を秘密非表示で確認し、復号/再認証失敗時はNO_GO。
公式manual restoreはmanaged schemaのカスタム変更やrole credentialを別扱いする。
[Supabaseの復元手順](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## 6. 実行基盤・保持・費用

- 日次CollectorとVerifierは別Fargate task/role。固定digest、readonly root、暗号化ephemeral disk、ingressなし。
  public IPは実行中のみ、既存サービスを触らない専用network。TLS接続先allowlist、本文ログなし。
- checkpointは専用Lambda、concurrency 1、timeoutと再試行上限。日次Verifierとは別にcheckpoint bytesも照合。
- Scheduler失敗/DLQ・job失敗・日次26時間/metadata30分の欠測を監視。担当/代行への通知実受信まで試験する。
  閾値を過ぎた世代は復元準備OKと表示しない。通知宛先・権限は未作成。
- 保持候補は従来のbackup30日＋noncurrent1日、GOVERNANCE lock7日、receipt/audit180日＋noncurrent1日。
  依然未承認。checkpoint/HMAC keyは比較対象backupの全version残存確認前に消さない。
  初版は自動GCで比較可能性を壊さず、残存時に停止/通知する。無期限保持を黙って合意した扱いにしない。

2026-09-24に公式料金表を再取得。税・無料枠・creditsを除く、**実請求でも支払上限でもない**。

| 仮定 | 月額USDの基本部分 |
| --- | ---: |
| S3全世代合計10GB × $0.025 | 0.25 |
| KMS 2鍵（rotation追加分なし） | 2.00 |
| Secrets 3件（DB・source Storage・checkpoint HMAC）× $0.40 | 1.20 |
| Fargate 1vCPU/2GB、収集10分＋照合10分 ×30日 | 0.6162 |
| その実行時だけIPv4、10時間 × $0.005 | 0.05 |
| checkpoint Lambda512MB・10秒 ×2,880回、GB秒のみ | 0.24000048 |
| **以上の小計** | **約4.36** |

別途: Lambdaリクエスト、S3 PUT/GET、KMS/Secrets API、Scheduler、CloudTrail、ECR、監視/ログ/通知、
再試行、復元環境、Supabase egress、転送、税。root-key escrow等でsecret数が増えれば再算定。
10GBは現時点の実dumpサイズではない。timeout/再試行上限は異常費用を抑えるが総額上限にならない。
予算通知の候補$10/$20は通知閾値であり、発注許可や自動停止ではない。今回は未設定。

価格根拠（東京regional JSON）:
[S3](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/ap-northeast-1/index.json)
publication 2026-09-18、[ECS](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/ap-northeast-1/index.json)
2026-09-11、[Secrets](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSSecretsManager/current/ap-northeast-1/index.json)
2026-09-11、[Lambda](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/ap-northeast-1/index.json)
2026-09-19。併せて[KMS](https://aws.amazon.com/kms/pricing/)、[IPv4](https://aws.amazon.com/vpc/pricing/)、
[CloudTrail](https://aws.amazon.com/cloudtrail/pricing/)を再確認。既存offline plannerの9/8値を総額と誤認しない。

## 7. Solが進める順序・テスト・承認境界

1. `scripts/lib/backup-*` にpure checkpoint契約/比較・restore admissionを追加し、PG17合成fixtureで検証。
   adapterは明示注入、本番URL/秘密自動取得なし。既存byte verifierは継続利用。未知形式は拒否。
2. `infra/aws-personal-data/backup-vault.cfn.json` にVerifierRoleとprefix分離を追加し、既存59 policy fixtures/
   10 negative controlsへ拒否試験を追加。worker IaCは別template、schedule既定無効。まだAWS作成しない。
3. 収集/照合の実adapterとcontainer定義を作成。source synthetic endpoint/PG17とローカルStorage stubで試験。
   本番secretなしで、timeout/中断/容量上限/一部page失敗/VersionID差替え/不明writeを再現する。
4. 明細付きchange set、正確なrole trust、保持、月額仮定、source資格の実権限、転送対象と隔離先をまとめて提示。
   AWS作成・IAM拡張・secret登録・本番データ転送はその操作時の承認を得てから。
5. 承認後、AWS合成objectでwriterのGET/DELETE/marker偽造拒否、Verifierのartifact書換拒否、
   条件付き再送/CloudTrail/SNS実受信を検証。合成PASS後だけ、承認された実backup/隔離復元へ進む。

必須の合成回帰:

- 同一snapshotのdump/catalog。別snapshot、未知schema、RLSで一部だけ取得、異なるproject、PG major不一致を拒否。
- snapshot後の日記/対象者/アカウント削除、本文編集による個人情報除去、写真削除/差替え、
  AI履歴削除/記憶reset/除外、同意撤回、家族退会/権限低下/所有権移譲を検出して隔離。
- アカウント消去で元receiptが消えても最新全件比較で欠落検出。移譲済みfamilyを削除対象と推定しない。
- 遅いcommit・欠けたpage・複製行・不正HMAC/別key版・checkpoint空配列/古い世代・source全損はNO_GO。
- byte照合PASSだけで公開しない。改ざんされた`publicReleaseAllowed`を入力しても拒否。
- secrets/body/pathがconsole/例外/プロセス引数へ出ない。資格をsource/destinationで入れ替えた場合は接続前拒否。
- 隔離復元先からのメール/通知/AI/決済/本番接続ゼロ、削除範囲へ旧session/家族viewerでアクセス不可。

完了条件はまず上記のローカル実装・合成回帰・CI・証跡まで。本番復旧・審査提出の完了とは別。
重要処理の実装差分は統合前にAstra/既存独立レビュー工程へ渡す。同じ設計を毎回読み直す必要はない。
source権限方式の変更、未知managed schema、公開復旧/cutoffの自動化、同期削除journal、保持/鍵運用の変更、
検証付き修正2回失敗、新しい重大リスクでは再びAstra判断。認証DB-first計画（追記426）は変更しない。

## 8. 今回行っていないこと

AWS資源作成・IAM変更・secret読取/登録・DB migration・実backup・写真download・隔離project作成・
実データ削除・Web deploy・ストアupload/提出はすべて未実施。料金照会とSupabase集計以外の外部処理はない。
通知tombstone保持の未回答を今回のモデル切替で承認済みにしない。
