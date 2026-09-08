# バックアップ世代の内容照合と完了記録

2026-09-08。**共通処理と合成試験まで。本番への接続・自動backup・実復旧は未実施。**

## 今回追加したこと

`scripts/lib/backup-generation.mjs` は、収集済みのファイルを別の読取担当で読み直し、
宣言された件数・VersionId・byte数・SHA-256が一致した場合だけmanifestを確定する共通処理。
AWS SDK、接続情報、ファイル入力CLI、DB取得、写真取得、送信先設定は持たない。
既存の手帳、写真、認証、Supabase schemaには変更を加えない。

```text
収集処理が作る世代情報【接続部分は未実装】
  ↓ 形式・必須ファイル・写真一覧の一致を確認
指定VersionIdを独立したreaderでストリーム読取
  ↓ 全ファイルの実bytes / SHA-256を照合
完了manifestを If-None-Match: * 付きで1回だけ書込
  ↓ 応答のVersionIdを指定してmanifest自体を再読取・照合
manifestのkey / VersionId / bytes / SHA-256を外側receiptへ
  ↓
byte照合済みの候補（復旧GO・正式公開GOではない）
```

## 確認する範囲

- database、roles、storage_catalogを各1ファイル必須にする。写真0件でもcatalogは必要。
- 取得前/後の写真一覧のIDとversion、および写真artifactの対応が完全一致することを確認。
  これは**入力された一覧同士の照合**で、元Storageの全ページを取得したという証明ではない。
  将来collectorで全ページ・metadata・追加/変更/削除を独立に確認する必要がある。
- 世代/ファイルIDは新規乱数の32桁hexを使う。実利用者IDを加工して流用しない。
  keyは`backups/<run-id>/artifacts/<artifact-id>`、manifestは`backups/<run-id>/complete.json`。
  元DB/Authや写真pathとの対応は、暗号化されたdump/catalogの中にだけ持たせる。
- 重複、欠落、未知項目、別世代key、path traversal、version欠落、0byte、無効な日時/件数を拒否。
  JSONのplain object/arrayに限定し、getter・Proxy・配列subclass・型変換による検証のすり抜けも拒否する。
- ファイル全体をメモリに展開せず、実ストリームからSHA-256とbyte数を算出。
  ETagをSHA-256の代わりにしない。内容の1byte変更、切断、過大chunk、不正chunkは失敗にする。
- 入力をawait前に凍結コピーし、照合中の呼出元の変更がmanifestへ入り込まないようにする。
- 標準timeoutは全工程30秒、設定上限1時間。AbortSignalと経過時間の両方を確認。
  chunk最大8MiB、artifact最大256GiB、世代合計1TiB、最大10,000artifact等は安全上限であり、
  その容量・時間で本番backupを実行できることを実測した値ではない。

## 中断時の扱い

- manifest送信前に失敗した場合、完了記録を書かない。
- 409/412は拒否として失敗。応答消失・timeout・不正ACK・送信後の再読取失敗は
  `MANIFEST_WRITE_UNCERTAIN`として失敗し、**送信先にobjectが存在する可能性を残す**。
- 自動再送、既存keyへの無条件上書き、取り消しのための自動削除は行わない。
  後続の再照合手順は未実装。writerにGET権限を追加して回避しない。
- adapterはAbortSignalを守り、接続や読取を止める必要がある。共通処理のtimeoutだけでは
  遠隔サーバーで受理済みの書込みを取り消せない。止まらないiteratorのcleanup完了も保証しない。
- エラーは固定コードのみ。利用者の本文・写真path・接続情報・adapter例外の内容を出力しない。

条件付き書込みの競合やcurrent versionの制限は[AWS公式](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)を確認。
ファイルの内容照合には[AWSの整合性確認](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html)と
[Node.jsのHash API](https://nodejs.org/api/crypto.html#class-hash)を参照した。

## adapter接続時の契約（未実装）

- `readObject({key,versionId}, {signal})`は、指定versionの実bytesをasync iterableとして返す。
  返却は`{key,versionId,body}`のみ。latest GETへの置換やETagだけの確認は禁止。
- `writeManifest({key,ifNoneMatch,body}, {signal})`は、正常ACKを`{status:200,key,versionId}`へ正規化。
  HTTP成功だけでなくSDKのbody/errorも解釈し、実際のversionを返す。
- readerは復旧/検証用、writerは追加用の別資格情報を使用する。共通関数へのcallback注入は
  IAMやプロセスの分離を実現するものではない。実環境では権限・実行境界も検証する。
- manifestは自身のVersionId/hashを内包しない。再読取成功後に外側receiptとして返す。
  このreceiptは暗号署名された第三者証明ではなく、永続化・保管/検証先の設計も次段階。

## 合格しても未完了のこと

manifestと返却結果に以下を固定し、byte照合を本番対応完了と混同しない。

```text
scope: BYTE_INTEGRITY_ONLY
productionReady: false
deletionCoverage: NOT_VERIFIED
semanticRestore: NOT_VERIFIED
sourceSnapshotConsistency: NOT_VERIFIED
```

本番DB/Authの意味的な復元、元DBと写真の同時点整合、独立した削除ジャーナルのcoverage、
日記/対象者/アカウントの後発削除再適用、実AWS権限、KMS、監視通知、実機は未検証。
特にアカウント削除完了時は関連receiptや元ID/pathが削除・最小化されるため、現時点のreceipt一覧を
単純保存するだけでは過去の削除漏れを防げない。限定した累積export/照合/replayが別途必要。

## 検証

`node scripts/test-backup-generation.mjs`はメモリ内の架空dump・合成1pixel PNGだけを使用する。
実bytesの照合、欠落/重複/破損、入力形式攻撃、途中例外、timeout、拒否/応答消失、manifest再読取を試験する。
DBの本物のdump形式検証やAWSのservice試験ではない。CI・Stage A source35/full49へ登録。
実行結果と独立レビューの指摘/修正は`SESSION_HANDOFF.md`の追記387へ記録する。

AWS CLIのprofile一覧は0件だった。これはAWSアカウント未契約の意味ではなく、使うアカウントは未確認。
接続先の選択をユーザーへ質問中。費用発生する作成・本番資格情報・実データの取扱いは別確認のまま。
