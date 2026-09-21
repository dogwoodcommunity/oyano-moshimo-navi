# 端末通知登録の世代管理 — 2026-09-21

**ローカル実装・合成/隔離SQL検証済み。本番未適用・有効化は既定OFF。旧登録移行と保管期間は公開ゲートのまま。**

旧方式の「送信結果が不明なら永久にログアウトできない」を、新方式の世代つき解除で解消する。
旧rowの本人/端末を推測して移管する機能は実装しない。実機・実配送・本番受入とは区別する。

## 実装箇所と状態

- native: `apps/mobile/lib/pushInstallation.ts`（通知helperから再export）。
  `oyano.push-installation.v2`へinstallation ID、256-bit secret、revision、保留操作をSecureStore保存する。
  ログアウトではID/secretを消さない。v1の未解除/未確定tokenがある場合は移管せず案内する。
- API: register/unregisterは`apps/web/lib/pushInstallation.ts`へ集約。
  protocol 2、入力、bearer本人を検証し、RPCへ渡す。本文のuser_idを信用しない。
  `PUSH_INSTALLATION_V2_ENABLED=true`でのみ処理する。未設定は503、旧protocolは426。
  初回プロフィールだけ作成可能とし、既存氏名等を上書きしない。既存の消去後再作成guardは維持する。
- DB: `supabase/push_installation_protocol.sql`。
  private ledger、登録/解除RPC、配送宛先RPC、配送失効RPC、RLS/ACLをまとめる。
  `api_grants.sql`再適用で直接書込みや一般利用者のRPC実行を復活させない。
- 配送: cron/family両経路は宛先RPCと世代を指定する失効RPCを使う。
- 消去: 既存profile削除のFKと新triggerへ統合し、既存finalizerにもledgerの本人残存検査を追加した。

## DBの境界

`push_private.installations`はpostgres所有、FORCE RLS、API roleから直接参照/更新不可。
列はid、secret_hash、revision、active_revision、owner_id、state、request_id、request_hash、last_error。
raw secret、メール、記録本文、Expo token本文はledgerに保存しない。

`push_tokens`のinstallation_id/installation_revisionがNULLのrowは旧方式のまま。
migrationは旧rowを変更しない。有効token全体の重複や1 installationの有効重複はunique indexで拒否する。
既存重複があればmigration全体が失敗し、自動的な無効化/削除で通過させない。

登録/解除RPCの署名：

`apply_push_installation_operation_v2(user_id, installation_id, secret, revision, request_id, action, token?, platform?)`

service_roleのみEXECUTE可能。Webで確認した本人を使用し、DBでもプロフィール存在を再確認する。
`account-erasure-target:<本人>`のadvisory lock→profile→installationの順で、既存消去処理と順序を揃える。
異なるinstallation同士の同一token取得も、token lockとunique制約で直列化する。

## 再送・遅延・本人切替

送信前にnativeがrevision/request_id/内容を永続化する。同じ操作は同じID/世代/内容で再送する。
解除は未確定の登録より大きなrevisionを持つ。初回登録より解除が先でもrevoked tombstoneを作る。

| 到着順/操作 | 結果 |
| --- | --- |
| register 11 → revoke 12 | 12でそのinstallationだけ解除 |
| revoke 12 → 遅れたregister 11 | 11はstale、再登録しない |
| 同revision/request_id/内容の再送 | 確定状態・確定した拒否を再返却 |
| 同revisionで内容/ID変更 | conflict、書込みなし |
| token交換が競合で拒否 | 操作revisionを記録し、以前のactive_revisionの配送を維持 |

成功応答のinstallation ID/revision/request ID/stateをnativeが照合し、SecureStore保存後にsign outする。
解除応答が失われても同じ解除を再送できる。通信不可/保存失敗/応答不一致は成功にしない。
登録/ログアウトを直列化するため、解除後に待機中の登録が古い本人を再登録しない。
新方式の通知許可なし端末でも、OS token取得を要求せず解除/ログアウトできる。

activeな別本人のinstallationは、新しい本人から変更できない。
前の本人がrevokedの場合だけ、同じsecretを持つ端末を新しい本人へbindできる。
アカウント消去済みのIDは永久retired。serverがretiredを返した場合だけnativeは新IDを作る。
通信断・所有者競合・旧版不明を理由にIDを作り直して制約を迂回しない。

## token行と配送結果

新方式の通常解除/交換は、**同じinstallation・当該本人のmanaged token行だけ**除去する。
過去本人のinactive tokenを履歴として残さず、世代はprivate ledgerに残して遅延要求を拒否する。
installation_id=NULLの旧rowは解除/交換RPCで削除しない。他本人/他端末の一括解除もない。

`list_deliverable_push_tokens_v2`はmanaged行のowner/active_revision/state一致を確認する。
旧方式の配送を勝手に止めないため、旧active行もそのまま返す。これを旧方式の安全性確認とは扱わない。
`invalidate_push_delivery_v2`は送信時のrow ID/revision/tokenが一致した場合だけ失効する。
遅れて届いた旧世代の失効結果で新登録を止めない。旧rowの配送失効は従来どおり無効化し、削除しない。
すでにExpoへ渡した通知は回収できない。「新規配送対象から外した」と「配送中通知の取消し」を区別する。

## 旧登録移行・本番有効化の条件

1. read-onlyで旧rowのactive/inactive件数、重複token、本人不明行を集計する。
   token本文・利用者一覧・secretをチャット/ログへ出さない。既存rowを削除しない。
2. 旧rowが存在する場合、当該本人と実端末の一致を確認する移行方法を別途受入する。
   OSの現在tokenだけでは、回転前tokenや旧本人を特定できない。
   token文字列の所持だけで別所有者の変更を認めず、必要な端末到達challenge等は未実装。
3. 旧直接upsertを拒否するDB権限、旧APIの426、新API/配送RPCを揃えて適用する。
   migration前に新版Webだけ公開しない。旧binary利用状況と更新案内を確認する。
4. 旧移行・下記保管期間・消去整合・実機受入を確認してから、環境変数をtrueへ変更する。
   旧row 0件の証拠も、今回のローカル検証だけでは取得していない。
   対応表なし/OS token取得不可/旧本人登録が残る状態は未解決の公開ゲートである。

## 検証と残条件

- `node scripts/test-mobile-push-logout.mjs`：実API/native helperを合成transportで実行。
  永続化失敗、401再試行、登録遅延、解除応答消失/再起動、本人/端末分離、token交換、
  古い配送結果、ログアウト競合、旧v1状態保持、消去後ID再作成を確認。
- `bash scripts/test-push-installation-sql.sh`：ネットワークなしの使い捨てPostgreSQL。
  実RPC/ACL/旧row保持/失敗再送/active_revision、独立接続5競合を確認。
  別DBで既存account-erasure回帰を無変更実行し、v2→v1 executorのdatabase_erasedと
  finalizer completedの両段階でtoken消去、tombstone最小化、別本人保持を検査した。
- 本番migration、旧登録移行、二実機の受信/解除・本人切替、通知許可拒否、実署名ビルド受入は未実施。

## tombstoneの消去整合と保管期間

profile削除時にraw tokenは既存CASCADEで消える。
private ledgerはFK SET NULLのtriggerでstate=erasedとし、owner/secret hash/request ID/fingerprint/last_error/
active_revisionをNULLにする。ランダムinstallation ID、revision、erased状態だけを残し、再使用を拒否する。
profile削除と登録が重なる両順序、既存executorとfinalizerでこの動作を実SQL確認した。

tombstoneを消すと旧IDの再受理が可能になるため、今回のコードに自動purgeはない。
**この最小tombstoneを保持する期間と運用・プライバシー判断は未承認。本番有効化の条件として残す。**
