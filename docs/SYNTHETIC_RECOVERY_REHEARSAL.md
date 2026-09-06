# 合成データによる隔離復旧演習

この演習はローカルの架空データだけを使い、PostgreSQLのdump／restoreと画像bytesの独立保存を確認します。
本番backup、Supabase Authログイン、Supabase Storage API、実機受入、正式公開の合格証跡ではありません。

```bash
node scripts/test-synthetic-recovery.mjs --plan
node scripts/test-synthetic-recovery.mjs
```

取得済みの `docker.io/library/postgres:16-bookworm` と、スクリプトに固定したイメージIDが必要です。
ローカルUnix socket以外を拒否し、image pull・package install・production接続を行いません。
Docker socketへのアクセスが許可されていなければ、ローカル実行権限が必要です。

- source／restore用の新しい2コンテナだけを作成し、`--pull=never --network=none` を使います。
- host bind、既存volume、公開portは使いません。PostgreSQL imageが作る新しい匿名volumeは終了時に削除します。
- 環境変数はローカル実行用の最小項目だけに絞り、dotenv、接続文字列、入力dumpを読みません。
- `--plan` に列挙した18本のtracked SQL（Auth／Storageの試験専用shimを含む）で、架空の2家族・3利用者を作成します。本番の全migration適用状態との一致は検証しません。
- binary dumpを別コンテナの空DBへrestoreし、全fixtureテーブルの件数と内容hash、roles、ACL、RLS、functions、triggersを比較します。
- 復元後に家族間の読取分離、viewerの更新／追加拒否、削除receiptとpending cleanup job、送信済みreceipt、閉じた削除実行gateを確認します。
- 削除済み日記ID／対象者IDの再作成を試して、復元済みreceiptが拒否することを確認します。
- 固定の合成PNGをDBと別の一時archiveへ保存し、元bytesを破棄してから復元します。件数・size・SHA-256・DB参照を照合し、破損bytesのhash不一致も確認します。
- 作成指示前に固有名を記録し、清掃時に名前・ID・固有label・image・networkを照合します。作成応答が失われても名前から再確認し、確認不能なら清掃失敗として報告します。一時ファイルも固定名だけを削除し、不明な内容を再帰削除しません。

成功は `SYNTHETIC_RESTORE_PASS` です。失敗・清掃失敗は非zeroで終了し、生のSQL出力や認証情報を証跡へ出しません。
`--plan` はDockerを操作しません。実行時の結果JSONにはdump hash、fixture／catalog hash、画像hash、時刻と所要時間を記録します。
dumpや画像の一時資材は保存し続けません。実行を強制終了した場合は清掃結果が得られないため、当該runの固有labelとコンテナを確認してください。

`syntheticRestoreDurationMs` は復元開始から確認完了までの合成演習時間です。
RTOを記録するときの式は **利用確認完了時刻－開始承認時刻** です。
この試験は本番データの損失時点を設定しないためRPOを測定せず、本番RPO／RTOも `NOT_TESTED` とします。

現状の範囲外は、backupより新しい削除receiptの再取得／再適用、実際のAuth資格情報・設定の復旧、Storage APIでのobject／metadata／権限の復旧、復旧したWebでの表示です。
cluster rolesはdump対象ではないため、固定された試験用3役割だけを別途作り直します。本番role設定の完全復旧を証明しません。
本番に対応するbackupの方式・保持・最新成功、Storage実objectの独立backup、実backupからの隔離復旧は
[運用手順書](COMMERCIAL_OPERATIONS_RUNBOOK.md)で別途確認します。

## 2026-09-06 ローカル実施記録

実行: `node scripts/test-synthetic-recovery.mjs`。結果は `SYNTHETIC_RESTORE_PASS`、終了コード0、清掃 `PASS`。
最終scriptを固定後、主担当も独立再実行しました。
2026-09-06 09:22:57.640 JSTに復元を開始し、09:23:00.430 JSTに確認完了しました。
合成復元時間は2,790 ms、演習全体は9,001 msです。この数値を本番RTOには使いません。

- binary dumpは467,557 bytes、56テーブルの件数・内容fingerprintが復元前後で一致。
- roles／実効ACL／RLS／functions／triggers、家族分離、viewer拒否、削除receipt、pending job、送信済みreceipt、閉じた実行gateの確認はPASS。
- 合成PNGは1件・68 bytes。独立archiveからの復元、SHA-256、DB参照の一致と破損検出はPASS。
- イメージは固定IDと一致。終了後、演習labelのコンテナ残存は0件とread-onlyで再確認。
- 未対応の `--source` 入力は終了コード2で拒否し、Dockerを操作しないことを確認。

実行したscript SHA-256: `457546b40f04ababfba1518f8a09bfa4c652bc4acebd85d5439e74d0448c24d1`

dump SHA-256: `2cff52ec75d279ade222dc950393d774fda1b1bd593205dbe0689a0f396ecc71`

合成PNG SHA-256: `5e3d382db4dd83d59aa5742793ad6b7903409e865c83bcbc54835049f043bc15`

本番backup、provider Auth／Storage、backupより新しい削除receiptの再適用、Web／実機、本番RPO／RTOはいずれも `NOT_TESTED`。
初回の起動待機とACL比較の失敗は修正後に再実行しました。失敗した試行も清掃PASSでした。
独立レビューで見つかった合成PNGのCRCと、Docker作成応答消失時の清掃追跡も修正し、上記の最終scriptで再検証しています。
