# バックアップ取得元の権限・網羅性レビュー — 2026-09-24

## 判断と範囲

対象source: `3c74a4e`、開始HEAD: `49634fc`、branch: `codex/consult-guest-entry`。
追記428の設計を維持し、実source資格と合成Collector/checkpointを限定レビューした。
**実データ接続・統合はまだNO-GO。下記の限定修正・合成実装はSolで進められる。**
これは全アプリの最終レビューでも、独立したClaudeレビューでもない。

本番で行ったのはREAD ONLY transaction内のcatalog/ACL/関数定義の照会のみ。
日記・写真・Authユーザー行・鍵・パスワードを取得せず、管理関数を実行していない。
AWS作成、資格配布、DB権限変更、実backup、デプロイ、Store提出は未実施。

## 1. 確認できた実環境

- catalog上の通常/partitioned tableは92表: public 50、auth 27、storage 8、
  account_delete_private 3、realtime 3、vault 1。
  正確な名前は同日付の `backup-source-inventory-2026-09-24.json` に記録。
  新しい関係kind、schema、table、列、PK、extensionは自動受入せず、次の取得前に再照合する。
- 最初の4schemaの88表にPKがあり、8表がFORCE RLS。
  ローカル復元試験の56表とは異なる。56表PASSを本番全表の検証とは扱わない。
- 照会ロールpostgresはsuperuser=false、bypassrls=true、createrole=true。
  shared_preload_librariesにsupautils文字列はなかった。これは専用roleへBYPASSRLSを
  設定できない証明でも、設定できる証明でもない。role作成は今回試していない。
- PUBLIC EXECUTEのSECURITY DEFINER関数を10件確認。
  **通知管理2関数はanon/authenticatedにも実効EXECUTEがあり、本文にcaller制限がない。**
  `claim_due_scheduled_notifications(integer)` は通知をsendingへ更新しtask等を返す。
  `reset_stale_sending_notifications(interval)` は通知をscheduledへ戻す。
  実際の呼出/悪用/外部API経由の成功は試していない。DB権限・本文の確認に限る。
  `md5(pg_get_functiondef())` は順に
  `169ff1b8efe60179327d36ea999f46f6` / `7105328bfc4ddb697b634660666f90b2`。
  これは差分検出用で、暗号学的な完全性証明には使わない。
- `supabase/notification_delivery_hardening.sql` と `production_pending_hardening.sql` の
  grantだけではPUBLICを取り消していない。`api_grants.sql` の全関数authenticated grantでも
  再付与され得る。cron routeの正規callerはservice_roleを使う経路である。

### 最優先の限定修正契約

上記2RPCだけをservice_role専用へ制限するSQLと回帰をローカルで準備する。
PUBLIC/anon/authenticatedのEXECUTEを明示取消し、service_roleを維持する。
初期定義、pending bundle、api_grants再適用の全経路で権限が戻らないようにする。
本番用patchは同一transactionでsignature/owner/security-definer/body hash/ACL差分を先に照合し、
想定外なら全体ROLLBACK。本文や通知データは変更しない。適用は別承認。
残り8関数を一律service_role限定にすると家族招待等を壊すため、勝手に広げない。

## 2. 今回再現した合成コードの不備

本番には未接続。すべて注入した合成bytesだけの再現で、完了marker/外部通信はなし。
既存16＋15＋62ケースは今回もPASSしたが、以下を網羅していなかった。

| 優先度 | 再現した条件/結果 | Solの修正と完了条件 |
| --- | --- | --- |
| P1 | openSnapshot中にplan.sourceIdを変更すると初期synthetic限定検査を通過し候補成功 | await前にplan/options/adapterの値を検査・copy/freeze。snapshot/photoも保持前にcopy/freeze。後からの参照変更を拒否または無影響にする |
| P1 | 10ms期限、openSnapshotで60msイベントループを占有すると期限後に成功 | 単調時計の絶対deadlineを全await前後/stream境界/成功返却直前に照合。timer/abortだけに依存しない |
| P1 | sink保存後に応答が来ないとCOLLECTION_TIMEOUTとなり書込不確実性が消える | 書込dispatch以降の中断/時間切れはARTIFACT_WRITE_UNCERTAINを優先。固定のrun/key/kindだけを再照合用状態として保持し自動再送しない |
| P1 | checkpointのnested bodyDigestを書換えると変更検出が消える | 生成checkpoint・比較結果をdeep freeze。入力を完全検査/コピーし、真正性をfreezeだけで主張しない |
| P1 | 両checkpointのsourceId/epoch/schemaHash/keyVersionをnullにしても比較成功 | 作成時と読込時で同一の型/形式検査。scope重複、nested accessor/sparse array等も固定エラーで拒否 |

再現用一時スクリプト: `/tmp/oyano-backup-review-20260924.mjs`。
5条件すべてREPRODUCED。これは不備の再現で、受入PASSではない。
修正後は上の条件を恒久回帰へ移し、再現スクリプト自体を合格基準にしない。
関連して総bytes上限は書込完了後ではなくstream消費前に検査する。
cleanup/遅着callbackから新規source read/writeを始めない。期限内に消せない未確定artifactは
孤立候補のままで、別run成功や完了markerへ変換しない。

## 3. 実source資格の決定

### DB: 専用の全行読取role、管理者資格の常用は禁止

採用する契約は「固定projectへの専用LOGIN role＋明示した表/sequenceのSELECT＋必要schema USAGE」。
FORCE RLSを含む全行取得のためBYPASSRLSを必要とするが、superuser/CREATEROLE/CREATEDB/REPLICATION、
所有権、他の強いrole membership、DML/DDL/sequence更新権限は付けない。
将来の全tableへの自動grantはしない。未知tableは停止して分類後に許可する。

- BYPASSRLSは全表SELECT権限を自動付与しない。ただし既存PUBLIC grantとの合成は別に検査が必要。
  read-only transaction/default設定は事故防止であり、漏れた資格の権限制限の代わりではない。
- PUBLICやrole membership経由の書込/外部送信可能な関数、拡張機能、CREATE/TEMP権限まで検査する。
  2RPC修正だけで新DB roleの全実効権限が安全になったとはしない。
  `REVOKE ... FROM backup_reader` だけではPUBLIC由来権限を消せない。
- 新roleにアプリのanon/authenticated/service_roleを継承させない。
  PUBLIC経由の危険な関数は用途別の明示role grantに整理する必要がある。
  Solは必要な変更の一覧・局所patch/正規caller回帰を作成できるが、本番へ一括適用しない。
- account_delete_privateの読取追加は現行owner-only境界に対する例外になる。
  正確な対象/読取主体を権限拡大として別承認するまでgrantせず、既存owner/RLSは変更しない。
  必要表を読めない間は完全な世代として成功にしない。
- Supabase上でのBYPASSRLS設定可否は、承認されたbootstrap時の実確認gate。
  非対応/不完全読取なら停止し、postgres/service_role/password共用へfallbackしない。
  権限拡大案が必要なら再レビューする。

根拠: [SupabaseのDB role](https://supabase.com/docs/guides/database/postgres/roles)、
[PG17 predefined roles](https://www.postgresql.org/docs/17/predefined-roles.html)、
[PG17 privileges](https://www.postgresql.org/docs/17/ddl-priv.html)。
SupabaseはpostgresによるBYPASSRLS管理の追加を案内しているが、対象projectでの実行確認の代用ではない。
[Supabase公式告知の更新](https://github.com/orgs/supabase/discussions/9314)

### Storage: bucket限定カスタムroleの期限付きJWT、広いS3鍵は禁止

最初の実接続方式は、固定bucketへのSELECT/必要最小限のStorage読取権限だけを持つ
専用NOLOGIN/NOBYPASSRLS roleの短命JWTを、信頼された発行側から注入する契約とする。
DB roleとStorage roleを分ける。一般ユーザーのsessionを借りない。
Storage workerへ署名秘密鍵/JWT_SECRET/service_role/全bucket全操作のS3鍵を渡さない。
公式例のanon継承も、そのまま採用せず、必要なschema/関数権限を個別確認する。

- 初回は承認後に発行された短命tokenで固定runを実行。期限切れ/issuer/subject/role/project違いは停止。
  tokenにrole文字列があるだけで読取専用とは判断せず、実Storage APIの拒否試験が必須。
- GET/HEAD/list許可、他bucket/PUT/PATCH/DELETE/COPY/MOVE/署名URL発行等の不要操作を拒否する。
  signed URL等の権限がSELECTに結び付いて分離できない場合は、実際の許容範囲として明示して再判断。
- 更新token/署名権限をCollectorへ持たせない。自動日次運転を有効にする前に、
  token発行・失効・監査の運用を具体的なchange setに含める。現時点で自動更新は実装/稼働済みではない。
  新しい常設token issuerの本番導入はこのローカル実装許可に含まれない。
- Supabase S3でRLS適用のsession-token認証が使える。endpoint/anon key/tokenとAWS宛先資格を分離。
  対象projectでのcustom role＋S3認証は未実証なので、合成HTTP stubのPASSとは区別する。

[S3認証と生成鍵の広い権限](https://supabase.com/docs/guides/storage/s3/authentication)、
[Storage custom role](https://supabase.com/docs/guides/storage/schema/custom-roles)。
これは方式の決定であり、本番role追加/鍵発行/配布の承認ではない。

## 4. snapshot・全表・世代の結合

1. 直接接続かsession modeを固定し、PG17 coordinatorのREPEATABLE READ / READ ONLYを維持する。
   exported snapshotをdump、全行checkpoint、Storage catalogへ共有する。transaction poolは使わない。
   `pg_dump --snapshot`、明示table filter、`--strict-names`、有限lock/statement timeout。
   `--enable-row-security`で一部だけ取得して成功扱いにしない。
   [PG17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
2. inventoryの88表は「sealed隔離backup/比較の分類候補」であり、自動公開対象ではない。
   provider schema/version/列/PK/ACL/function/extensionをversion固定で分類し、未知は停止。
   realtime3表は稼働状態として再構築、vault1表の値は別承認の秘密保管でありこのcollectorから除外。
   除外をmanifestに明示し、完全なproject復旧と称さない。未分類を空表扱いにしない。
3. Auth27表にはsession/token/MFA等の秘密材料が含まれ得る。本文出力禁止・暗号化・隔離専用。
   取得許可にはこの範囲を明記する。認証/回復コードや管理権限を自動で本番へ再有効化しない。
   providerのAuth暗号鍵/設定・MFAの実復元は別gate。dumpだけでAuth復旧済みとしない。
4. 全PK列と列型をcatalogから確定し、PKの単純な文字列連結は禁止。
   64bit整数/numeric等をJavaScript Numberにして丸めない。
   各列の型・NULL・正確なtext表現をSQL側の固定順序で直列化し、その文字列をHMAC入力にする。
   時刻/timezone/float設定も固定。未対応型、重複PK、上限超過は拒否。
5. 今回の最小scope方式は、全rowにsource固有のglobal scopeを必ず付ける。
   1行でも削除/本文変更/権限変更があれば隔離先全体を公開不可とする保守的な初版。
   family/userへの安全な帰属が未証明でも見逃さない。global hashは明示して全体隔離判定に結ぶ。
   家族だけの部分公開は今回作らない。source全損/cutoff未確定なら従来どおり公開禁止。
6. `pg_dumpall --roles-only --no-role-passwords` には同じsnapshot指定がない。
   それだけを同一snapshot証拠にしない。role属性/所属/ACLを輸入snapshot内のcatalogで別に取得し、
   passwordのないrole artifactと照合する。前後のlive catalog差分でも変更を拒否。
   設定変更を止めた運用境界が未確認なら「全configが原子的」と保証しない。
   [PG17 pg_dumpall](https://www.postgresql.org/docs/17/app-pg-dumpall.html)
7. 新しい実用世代はschema v2。DB/roles/storage_catalog/photosに加え、
   source_contract artifact（source/epoch/schema/allowlist hash/snapshot/PG版/除外/role照合）と
   baseline_checkpoint artifactを固定VersionId＋byte hashでmanifestに結ぶ。
   Verifierはこれらの相互整合と既知schemaを検査。v1を黙って実backup相当へ昇格させない。
   byte一致はsourceの真正性保証ではない。侵害されたsource/Collectorまでは防げない。
   読込側は信頼されたjob記録に固定したobject VersionIdからのみbaseline/latestを受け取り、
   利用者が任意入力したJSON/自己申告hashを検証済みcheckpointとして受け入れない。
8. 同一MVCC snapshotを2回読んでも、取得中の写真変更検出にはならない。
   baseline catalogはsnapshot内、転送前/後のversion/catalogは別の最新観測として区別する。
   PUT/DELETE競合、本文差替え、孤立参照、件数差、未対応versioning/multipart等は世代不成立。

## 5. 次のSol工程と受入

1. 2つの通知RPCのACL限定patch・再適用回帰を先に用意。
2. 表2の5不備とstream総量/cleanupを修正し、既存16/15/62＋新規境界試験を恒久化。
3. network:noneの使い捨てPG17とStorage stubで、専用role/全PK・列型分類/
   実exported snapshot（並行更新と遅いcommit）/v2 artifact結合を実装。
   source資格・任意URLは受け取らず、専用合成allowlistで制限する。
4. RLSで一部しか読めないrole、FORCE RLS、未知table/ACL/PK、source差替え、
   数値精度、Auth秘密のlog漏れ、写真転送中変更、token期限切れ/別bucket書込を拒否する回帰。
   通知RPCはanon/authenticated/SELECT-only role拒否、service_role正常、
   pending bundle/API grantsの再適用後も同じ結果。ユーザーへメール/通知は送らない。
5. 実source bootstrapは、正確なroles/grants/trust、転送対象、token発行場所、期限/失効、
   費用/保持/削除方針、破棄可能なprovider試験先をひとつの承認資料にしてから。
   本番表の全件読取比較、Storage正負試験、Auth/MFA隔離復元、実IAM/CloudTrailは未完のまま残す。

上のローカル実装は確認済み範囲としてSolで継続可。同じ設計を毎回再レビューしない。
source管理者資格への変更、global隔離の緩和、保持/秘密配置の変更、未知provider schema、
新しい重大な不備は再判断。重要処理の統合/本番適用前には最終差分のAstra/既存独立レビューが必要。
その後もAWS作成/秘密配布/実データ移動/Store提出を「続けて」の包括承認にしない。
