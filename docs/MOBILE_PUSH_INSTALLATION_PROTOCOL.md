# 端末通知登録の世代管理案 — 2026-09-21

**設計のみ・未実装。本番DB/通知/アカウントへの操作なし。申請可否の判定ではない。**

現行はSecureStoreにtokenを保存するが、DBは`unique(user_id, expo_push_token)`だけ。
登録の通信結果不明、旧tokenの端末識別、同一tokenの別本人登録を完全には解決できない。
現RLSは本人の直接upsertも許す。新APIだけ世代管理しても、この旧経路が残れば解除をすり抜ける。

## 新方式の最小構成

- アプリはランダムな`installation_id`と256-bitの`installation_secret`を生成し、SecureStoreに保持する。
  ログアウトで消さず、本人の切替後も同じ端末登録の履歴を継続する。token/secretをログに出さない。
- 操作ごとに`revision`を単調増加させ、`request_id`と送信内容を**送信前**にSecureStoreへ保存する。
  同じ操作の再送は同じrevision/request_id/内容。解除は未確定の登録より大きなrevisionを使う。
- private schemaに`push_installations`を追加する。
  最低限の列は`installation_id PK / secret_hash / revision / owner_id / state / last_request_id / last_request_hash`。
  raw secret・メール・記録本文は保存しない。`state`はactive/revoked。解除後も世代を消さない。
- `push_tokens`にnullableな`installation_id`と`installation_revision`を追加する。
  NULLは旧方式。新方式は1 installationにつき有効tokenを最大1件とする。
  有効なExpo tokenも全体で1件に制約する。既存重複を勝手に無効化してindexを通さない。

## 単一トランザクションのRPC

`apply_push_installation_operation(user_id, installation_id, secret, revision, request_id, action, token?)`
をregister/unregisterの共通入口とする。Webはbearerを検証し、本文のuser_idを信用しない。
RPCはservice_role専用、固定search_pathのSECURITY DEFINERとし、PUBLIC/anon/authenticatedからEXECUTEを剥奪する。
RPC内でも対象プロフィールの存在・削除済みでないことを検証する。

installation行を作成/lockしてsecret_hash・本人・revisionを照合し、token更新と世代更新を同時にcommitする。
初回の解除が登録より先に到着しても、解除の世代を持つrevoked行を作れることが必要。
新旧tokenの競合判定もDB内で行い、同じtokenを別installation/別本人が同時取得できないよう制約とlockで守る。

| 到着した操作 | DBの処理 |
| --- | --- |
| register 11 → revoke 12 | 11を登録し、12でそのinstallationだけ無効化 |
| revoke 12 → 遅れてregister 11 | 12の解除を保持し、11はstaleとして書込みなし |
| 同じrevision/request_id/内容の再送 | 再適用せず現在の確定状態を返す |
| 同じrevisionで別内容／別request_id | conflictとして書込みなし |

成功応答にはinstallation_id・確定revision・現在stateを含め、nativeは自身の保留操作と照合する。
以前の登録要求が未確定でも、より新しい解除が確定すれば旧要求は再有効化できず、ログアウトできる。
応答消失時は同じ解除を再送する。通信できない間は解除成功とせず、ログインと保留操作を保持する。
新方式で通知登録要求を一度も送っていないことが確認済みの端末は、通知許可なしでもログアウトできる。

本人切替は、同じsecretであることに加え、前の本人の登録がrevokedの場合だけ新しい本人をbindできる。
activeな別本人/別installationのtokenを乗っ取らない。本人ごとの全端末解除は実装しない。
token交換は同じinstallationの旧token無効化と新token登録を1 transactionで行う。

## 書込み経路と配送側

- `push_tokens own`のALL policyを見直し、一般利用者の直接INSERT/UPDATE/DELETEを停止する。
  新ledgerの直接参照/更新も許可しない。必要な本人向け参照だけ別policyにする。
- service_roleからの従来の直接upsertも停止し、登録/解除はRPCへ限定する。
  旧register API/旧binaryからの要求は`upgrade_required`を返す。旧fallbackが書けないことを実SQLで確認する。
- cron/family通知の失効処理も、小さいservice_role専用RPCへ移す。
  `(installation_id, revision, token)`が現在と一致する配送結果だけ無効化し、遅れた旧世代の結果で新登録を止めない。
  送信対象のSELECTもledgerの本人・世代・active状態と一致する行だけにする。
- すでにExpoへ渡した通知はこの解除では回収できない。配送中の通知と、新規配送を止めたことを区別する。

## 旧登録の移行と受入条件

1. 本番適用前にread-onlyで、旧方式active件数・同一token重複・本人不明行を集計する。
   token本文や利用者一覧をチャット/ログへ出さない。重複があれば自動削除せずmigrationを止める。
2. 新規column追加だけで旧rowへinstallation_idを推測して埋めない。
   旧登録が0件と確認できた場合は、旧経路の停止確認後、新方式の新規登録から開始できる。
3. 旧登録がある場合、本人認証と実端末の一致が確認できた**その1件だけ**移行する。
   OSから取得した現在tokenだけでは過去に回転したtokenや旧本人の登録まで特定できない。
   token文字列の所持だけを別所有者の変更権限としない。
   必要な端末到達challenge等の本人/端末確認手順は別途設計・受入が必要で、自動移管はまだ承認しない。
4. 別端末の旧登録を理由に本人の全通知を解除しない。旧本人のrowも新本人の要求では変更しない。
   対応表なし・現在token取得不可・旧本人登録の組合せは、新規インストールと確実に区別できない。
   この状態が残る場合、世代管理の導入だけで「通知の公開ゲート完了」としない。

## 実装順と検証

1. 隔離PostgreSQLで新ledger/制約/RPC/権限と既存row保持を実装・検証する。本番migrationは別承認の工程。
2. WebをRPCへ置換し、配送SELECT/失効RPCと旧APIの拒否を揃える。
3. nativeの永続化・同一操作再送・新世代解除・本人切替を実装する。
   旧方式の移行判定は新方式から分離し、未対応状態を成功に変換しない。
4. API/native合成テストに加え、独立したDB接続で実際の同時実行を検証する。
   登録11/解除12の両到着順、commit後応答消失、解除再送、同revision内容改変、旧register遅延、
   token交換と遅延失効応答、二端末/別本人/secret不一致、プロセス再起動、SecureStore失敗を含める。
5. 旧直接upsert拒否、別端末保持、旧row未変更、通知拒否の新規端末、二実機の本人切替/受信を受入する。
   API応答だけで実配送停止・旧版移行完了とは扱わない。

## tombstoneとアカウント削除 — 未決事項

解除の世代を削除すると古い登録を再受理するため、通常ログアウトでledgerを削除しない。
一方、owner_idやtokenを無期限に残す設計にはしない。
アカウント削除では同じinstallation lockの順序を使い、登録を失効させ、tokenと本人への紐付けを除去する必要がある。
再送拒否に必要なランダムID/hash/revisionだけを残す場合の保管期間・削除後再登録規則・既存削除executorへの統合は未決。
**この整合と旧登録移行の受入を決めるまでは、本番適用・通知ゲート解除をしない。**
