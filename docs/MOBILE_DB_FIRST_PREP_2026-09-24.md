# モバイル初回公開: DB-first適用準備（未適用）

状態: 開発ブランチで対象SQLと隔離回帰を確認した段階。本番Supabaseへの適用指示ではない。
9月24日の本番メタデータ読取結果は `MOBILE_RELEASE_REVIEW_2026-09-24.md` を参照。適用時には必ず再確認する。

追記426で再照合し、finalizer限定patchと旧登録の排他lock下0件gateを追加した。
**最新の適用順・切戻し・承認境界は `MOBILE_AUTH_DB_INTEGRATION_REVIEW_2026-09-24.md` を優先する。**

## 最小の対象と順序

| 対象 | ソース | 現時点の扱い |
| --- | --- | --- |
| native初回手帳作成 | `supabase/create_initial_family_person.sql` | 9/24読取で関数不在。既存family/notebook権限・free上限との照合後に限定適用する候補。 |
| 通知登録・配送の世代管理 | `supabase/push_installation_protocol.sql` | 9/24読取でRPC/table/列が不在。旧tokenは当時0件だったが、適用直前に集計し直す。旧行・重複があれば停止し、勝手に消去/移管しない。 |
| 消去後の残存確認 | `supabase/account_erasure_push_finalizer_patch.sql` | 本番本文/ACLと照合済み。想定外の差分は停止し、owner残存検査の4行だけ追加する候補。2,085行のpipeline全体は再投入しない。 |

既存の `account_erasure_execution_gate.sql` は9月5日の本番適用記録がある。今回の不足を理由に再実行しない。
`schema.sql`、全RLS、全削除pipeline、旧通知行をまとめて再投入しない。

## 適用前に必須の読取確認

1. 対象projectと担当権限を再確認し、関数定義・署名・ACL・関連列/trigger・private schemaの現在値を保存する。メール、記録、写真、push token本文などの利用者データは取得しない。
2. 旧 `push_tokens` の総数、active/inactive、ownerless、物理token重複、installationとの紐付き件数を集計のみで確認する。0件でない/重複がある場合は適用を中止し、移行と旧binaryの扱いを再設計する。
3. `finalize_account_erasure_v1` の限定差分は追記426で準備/レビュー済み。適用時も本文/ACL guardで運用修正を上書きしない。想定外なら停止する。
4. private tombstone（ランダムinstallation ID、revision、erased状態）の保持期間は未承認。運用・プライバシー判断を終えるまで通知v2をONにせず、nativeログアウトの実受入も合格にしない。
5. 旧Web/旧binaryとの互換・切戻し、実バックアップと隔離復元を確認する。DB変更自体の本番実行は別の明示的承認を取る。

## 今回の隔離検証

- `scripts/test-family-management-sql.sh`: 使い捨てPostgreSQLで初回作成、無料上限、家族権限、Web同時作成の回帰PASS。
- `scripts/test-push-installation-sql.sh`: 使い捨てPostgreSQLで通知登録/解除/配送、独立接続5競合、既存消去executor/finalizerとの統合回帰PASS。
- いずれも合成データ。実本番の定義/データ、実通知、旧binary、保持期間、切戻しは未検証。

本番適用後もWeb配信、callback許可、両実機メール・通知・保存・削除試験、最終レビューとストア申請が別に必要。
