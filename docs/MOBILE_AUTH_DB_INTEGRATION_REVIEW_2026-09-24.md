# 認証・DB-first 統合レビュー（追記426）

対象: `691ea17` と本レビュー中の限定追加差分。branch `codex/consult-guest-entry`、draft PR #9。
本人のAstra切替完了返答を受けて実施。別モデル/API・新しい外部レビューは呼んでいない。

## 判定と範囲

認証のfocus/対象/要求世代、例外回復の方針は維持できる。下記の送信直前ガードを追加し、
同じ限定設計を再度やり直さず、DB-first反映の準備・実機受入へ進める。
これは **本番・実機・審査提出の合格ではない**。本番変更の承認・実バックアップ/隔離復元、
通知情報の保持方針、両OS実機・正式署名・運用・申請宣言の既存ゲートは残す。

## 認証差分の確認と追加修正

- `691ea17` のwelcome/invite/handoff/callbackをレビュー。非表示画面の購読停止、要求世代照合、
  古い初回session読取/成功/失敗の無視、再試行回復、callback例外の処理を確認。
- state/期限/メール/開始本人/access-refresh照合と、ブラウザ待機中の認証ロック分離は維持。
  サーバーのhandoff同一本人冪等性、招待の本人・家族権限を変更しない。
- 残っていたP1: 実helper内部で`getSession`（handoff）/`getUser`（invite）を待っている間に
  blur/対象変更すると、その後に旧対象へのPOST/RPCを開始した。画面の「開始前/結果後」ガードだけでは不足。
  実component＋実helperの合成試験で、修正前は旧POST 1件、旧invite RPC 1件をそれぞれ再現した。
- helperに現在のfocus/要求を照合する必須callbackを渡し、読取完了後・書込開始直前に再確認。
  非表示なら送信0件、対象変更後は新しい対象への送信だけを許可する。通信開始済みの書込みを
  取消済みとは扱わず、遅着UI抑止/サーバー冪等性は残す。
- `scripts/test-mobile-auth-captcha.mjs` にblur/対象変更の4回帰を追加。
  TypeScript実ソースを動かすが、React hooks/navigation/認証/通信は合成である。
  手動focus/blurによる試験を実Expoナビゲーションや実メールの受入と混同しない。

## 本番DBの読取事実（2026-09-24、今回再確認）

対象projectのSQL Editorで `BEGIN READ ONLY` / `ROLLBACK` を使った。利用者の記録本文やtoken本文は取得していない。

| 項目 | 確認結果 |
| --- | --- |
| 初回手帳RPC | `create_initial_family_person(text,text,text)` 不在 |
| 通知ledger | `push_private.installations` 不在 |
| 旧通知 | 総数0、active0、inactive0、ownerless0、token重複group0 |
| 消去finalizer | owner postgres、SECURITY DEFINER、search_path=`pg_catalog, public, extensions` |
| finalizer実行権限 | postgresとservice_roleのみ |
| finalizer本文 | 13,411文字、MD5 `ec5733e6fba67d9e3d8211b8b067fc9d` |

この本文は、リポジトリの現行finalizerからpush ledger owner残存確認の4行だけを除いた本文と一致。
4行を加えた本文は13,648文字、MD5 `14e94525c994d32f5cac89930a313d22`。
ハッシュは設定差分検知用で、秘密値や本人識別子ではない。

## 限定DB変更と停止条件

1. `create_initial_family_person.sql`: 新しいRPCのみ。既存の家族権限・無料枠・Web同時作成lockを維持。
2. `account_erasure_push_finalizer_patch.sql`: 本文/所有者/ACL/search_pathを照合し、既存関数へ
   ledger残存確認だけを追加。差分/権限が想定外ならトランザクションを中断。
   反映後の完全本文、関数OID、ACL等を再確認し、同じ版の再適用はno-op。
   table不在でも安全に評価できるので、通知SQLより先に適用する。
3. `push_installation_protocol.sql`: 初回だけ旧通知0件を **同じtransactionの排他lock内** で確認する。
   事前集計後の旧登録増加は例外で止め、消去/移管しない。lock待ちは5秒で停止する。
   既に導入済みの場合の再実行は既存行を保持する。中途半端な導入状態は事前メタデータ照合で停止する。

新しいRLS一式・schema全体・2,085行の消去pipelineは再投入しない。旧tokenが1件でもあれば移行設計へ戻す。
実バックアップ/隔離復元と保持方針を確定後、対象SQL・権限変更・旧APIへの影響を示して本番適用の承認を得る。
DB-first後に対応Web、固定callbackの許可、v2 API有効化、専用試験アカウント/実機受入の順で進める。
nativeテストを始める時点ではregisterだけでなくrevokeも使える必要がある。flag OFFを受入PASSにしない。

## 切戻し（データを巻き戻さない）

- SQLの各transaction内エラーはそのtransactionをrollback。先に成功した追加RPC/強化finalizerは残してよい。
  障害対応で利用者の記録・写真を旧バックアップへ上書きしない。
- 通知SQLは直接DML権限を閉じる。手元の`origin/main`の旧登録APIは直接upsertしており、そのままでは失敗する。
  これはリポジトリ旧版の確認で、本番配信commitの再確認に代わるものではない。
  DB→Webの切替を管理された時間帯にまとめ、旧binaryの配布/稼働有無を確認する。
- v2利用開始後は、古いWebへ単純ロールバックしたりflagをOFFにしたりしない。nativeの解除/ログアウトが
  止まるため。必要ならv2登録/解除/配送・消去チェックを維持した互換修正版を作り、限定回帰を通して反映する。
  当該互換buildはまだ作成/受入していない。旧版に戻す必要があるなら本番適用前の必須準備とする。
- ledger/世代番号/消去済みID、列、制約、ACLを削除・緩和して戻すのは禁止。古い通信の再受付につながる。
  配信停止が必要な場合も「新規登録/配送の停止」と「解除受付の維持」を分けて設計する。

## 保持方針（本人確認待ち）

削除後はランダムinstallation ID・revision・erasedだけが残り、本人との紐づき/通知token/secret hash等は消去する。
技術上の推奨は、このprotocolを使う間は最小tombstoneを保持し、広告/分析に使わず、廃止時に
旧要求を受け付けないことを確認して破棄すること。絶対匿名/法令適合とは断定しない。
本人へ非同期質問を提示した。承認返答がない間は未承認のまま。本番の保持設定は変更していない。

## 次の通常作業と再レビュー条件

Solはこの確定範囲でバックアップ/隔離復元の証跡確認、配信前の現在値照合、運用と実機テスト準備を進める。
承認済みの範囲だけDB→Web→callback→実機受入を行い、正式署名candidate/申請素材を揃える。
同じfocus/遅着設計だけでAstraへ再切替しない。本人混同・未知の本番差分・旧通知の出現・
認証/権限/保持方式の変更・検証付き修正2回失敗なら再レビューする。初回公開candidateの最終レビューは別途必須。

検証・commit・CIの最終結果は `SESSION_HANDOFF.md` 追記426に記録する。
