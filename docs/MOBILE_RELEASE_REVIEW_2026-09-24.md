# 申請前レビュー・次の実装範囲 — 2026-09-24

状態: **現行候補の審査提出は保留。次の限定実装はSolへ引き継ぎ可能。**

追記424: 認証実装 `29ab8d7` の統合前レビューでfocus/遅着・例外回復の修正点を検出。
最新の限定修正範囲は `MOBILE_AUTH_IMPLEMENTATION_REVIEW_2026-09-24.md` を参照。
以下のDB-first順序と本番/実機/提出の前提は維持する。

本人の「切り替えた。続けて」を受けた重要箇所のレビュー。開始branchは
`codex/consult-guest-entry` / `770cdef`、アプリsourceは `4b8fc38`。
モデル名を環境から推定せず、本人の切替完了返答に基づく工程として記録する。
同じ継承設定の独立担当2名が認証・申請条件を読取レビュー。Claude APIのレビューではない。

## 今回実環境で確認したこと

Supabase Dashboardへ到達でき、SQL Editorで `BEGIN READ ONLY` 内のSELECTとROLLBACKを実行できた。
設定保存、migration、利用者レコードの取得/変更、メール送信はしていない。
SQL Editorの照会用下書きは作成された。データの実行権限を拡大したわけではない。

| 対象 | 9/24の結果 | 判断 |
| --- | --- | --- |
| Email / 新規signup / Confirm email | 有効 | メール認証の基本設定は存在。実送信・テンプレート・復帰は別途受入 |
| 匿名認証 / CAPTCHA | 無効 | 通常メール認証のために有効化する必要はない |
| Redirect URL | Web `/**` と旧 `oyanomoshimo://handoff` / `oyanomoshimo:///handoff` の3件 | 新 `oyanomoshimo:///auth/complete?state=*` が未登録。旧URLを消さず限定追加を承認後に行う |
| 本番 `/auth/mobile` | 公開GETが404 | nativeが使用する認証ページは未配信 |
| 本番 `/admin/ai-reports` | 公開GETが404 | 更新した通報管理画面は未配信。認証後機能の受入とは区別 |
| `create_initial_family_person(text,text,text)` | 不在 | 新規native手帳作成の前提不足 |
| push v2の登録・配送一覧・失効RPC / private installations / 新2列 | 不在 | 対応migrationが未導入 |
| `push_tokens` | 全件0、active/inactive/ownerless/重複/active重複も0 | この時点では旧登録データの移管不要。適用直前の再集計は必要 |
| `sync_notebook_v2` / `check_public_api_rate_limit` | 存在、anon/authenticated不可・service_roleのみ実行可 | 既存ACL修復の再適用は不要。実動作の合格証拠ではない |
| 主要12テーブルのRLS | 有効（FORCEはfalse） | ポリシー内容/役割別の漏えい試験は別。FORCE falseだけで不備と判定しない |
| notebook revision 3トリガー / storage delete guard | 存在・通常有効 | native→Web同期の実受入は残る |
| 家族招待create/accept RPC | 存在、anon/auth/service実行可、定義に `auth.uid()` あり | 文字列の存在だけで拒否条件を検証済みにしない。ゲストOFFを維持し関数の実権限を回帰確認 |

照会はメタデータと集計値のみ。氏名・メール・本文・写真・相談・通知tokenは取得していない。
メタデータ照会1回はPostgreSQL内部char型の連結で失敗し、明示的text castへ修正後に成功。
DBの既存データを変更するクエリはない。

## 判明した提出前の問題

1. `apps/mobile/lib/auth.ts` の `sendMagicLink` はCAPTCHA無効でも `/auth/mobile` を開く。
   ページ配信とcallback登録だけでなく、既定ブラウザへ出る `Linking.openURL` をシステム認証画面へ直す。
   Appleは既定ブラウザへの登録/ログイン遷移を不適切と案内している。
2. `signOutThisDevice` → `withDevicePushRevoked` は、通知を許可していない新端末でもv2解除成功を待つ。
   v2 APIが既定OFFのままでは503でログアウトできない。解除を黙って省略する修正は禁止。
3. 新版Webのcronと家族通知はflagに関係なく `list_deliverable_push_tokens_v2` を呼ぶ。
   **PR #9全体の反映はDB-first。** Webだけ反映すると既存通知処理も失敗する。
4. ソース上の通報/削除実装、正式な運用、専用試験アカウントによる完走は別。
   通報の担当・代行・頻度・保持期間、削除完了目安/完了連絡、実バックアップ/隔離復元が未受入。
   既存二者確認や削除の復活防止を省略しない。新AWS作成/有料契約が唯一の手段とはしない。
5. 既存Android全23部品の16KB適合/専用emulator起動は追記417のPASSが最新。
   古い21/23未達表記を訂正。テスト鍵成果物であり正式署名・実機・ストア合格ではない。

## 今回決めた実装方針

- 無料の既存native範囲を維持。写真/PDF添付・課金・新ゲスト公開を追加しない。
- 通知は現行安全要件を満たす方向。通知を初版から削除する別案は勝手に実装しない。
- `CONSULT_GUEST_ENABLED` はOFFのまま。Supabase匿名認証/CAPTCHAを通常ログインの都合でONにしない。
- 認証はExpo57対応 `expo-web-browser ~57.0.3` の `openAuthSessionAsync` を使う。
  iOSはASWebAuthenticationSession、AndroidはCustom Tabs。WebViewや既定ブラウザへのfallbackを追加しない。
- callback許可は固定scheme/pathとstateのみ。秘密値をURL query/log/ドキュメントに出さない。
  現行のメール・開始本人・確認済み状態・access/refresh両本人・期限・state照合をすべて維持する。

### Solが次に行う限定実装（本番未変更）

対象: `apps/mobile/lib/auth.ts` / `authFlow.ts`、既存の認証呼出3画面・callback画面、
`apps/mobile/package.json` / lock、`scripts/test-mobile-auth-captcha.mjs` と必要な限定試験。

1. ブラウザ待機と認証変更のロックを分離する。
   `準備・pending保存 → ロック解放 → ブラウザ待機 → callback検証/保存時だけ再ロック`。
   認証ブラウザは同時に1つ。待機中ずっと `authBusy` にしてcallbackを拒否する実装は禁止。
2. `openAuthSessionAsync(browserUrl, MOBILE_AUTH_CALLBACK + '?state=' + state)` のsuccessと、
   既存 `/auth/complete` のcold/warm復帰を同じ検証処理へ渡す。global Linking listenerの重複追加はしない。
3. 同じcallbackの同時受信は同一Promiseへ合流。完了後の遅着は短時間のメモリ上の
   `{state,userId,redirectPath}`（tokenなし）と現在本人を照合し、session保存/pending消費を一度だけにする。
   新しい試行・ログアウトで完了記録を失効。期限を明示し、再使用で再認証させない。
4. OSのcancel/dismissだけではpendingを削除しない。Androidでは正常復帰でもdismissが先に返り得る。
   表示は「確認画面を閉じた」等に留め、メール送信/認証成功・取消完了を断定しない。
   明示取消・新試行・ログアウト・15分期限で失効させる。古いcatch/finallyが新pendingを消さないよう
   比較と消去を同じロック内で行う。開始/完了/取消/ログアウトの競合を試験する。
5. result成功時の安全な画面遷移、unmount後の表示変更抑止、古い試行結果の表示抑止を呼出画面に反映する。
6. 新native依存追加後は既存Node24/SDK57の型・export・設定生成、両OS native compileを実行する。
   正式ビルド/申請台帳との版番号整合を準備するが、署名や課金設定を勝手に変えない。

必須回帰: resultだけ/Linkingだけ/同時/完了後遅着、dismiss先行→正常callback、cancel後メール復帰、
旧catch/finallyと新pending、ログアウト競合、期限切れ・別メール/本人・混在token・再使用、
通信失敗/認証失敗からの再試行、招待/引継ぎ先の制限。
Solの完了条件はこの限定差分と回帰・native生成証跡。実メール・両実機の認証完走とは区別する。

### その後の反映・受入順序

1. 不足の `create_initial_family_person.sql`、push protocol、消去finalizer差分を限定migrationとして準備。
   `schema.sql` / RLS / 大きな消去pipelineを無条件で再投入しない。現在定義との照合と隔離SQL回帰を行う。
   push世代失効のledger保持方針と通報の運用決定は未承認事項として明示する。
2. 重要差分レビュー後、実行時の本番承認を得る。適用直前に旧通知登録が0か再確認する。
   0でなくなった場合は自動削除/取り込みをせず移管設計へ戻す。旧binaryの直接書込制限の影響も確認する。
3. DB-firstで不足処理を反映→対応Web配信→限定callback許可→通知API整合→専用試験で受入。
   ゲスト/CAPTCHAを同時に有効化しない。ロールバックと新旧clientの影響を確認する。
4. 署名candidateでiPhone/Androidの実メールcold/warm復帰、新規/再ログイン、通知拒否時を含むログアウト、
   別本人切替、保存/再起動/Web再読込、家族権限、AI/通報、二端末通知、二者削除/復元を完走する。
   認証セッションがメールアプリから自動で閉じる/戻ることは実機結果なしに保証しない。
5. 運営の担当/代行/保存期間と認知試験、実backup/隔離復元、正式版の権限/Privacy manifest/全ABIを確認。
   版番号、画像、Privacy/Data Safety、年齢/健康関連・配信国設問、正規の審査アクセス手段を完成させる。
6. 最終candidateの重要処理/初回公開レビューを経て、依頼済みの審査提出へ進む。
   規約同意・権限拡大・実データ削除・実データ移送・課金は各既存承認を守る。

Solへ戻した後、設計前提変更、2回の検証付き修正失敗、新たな漏えい/本人混同、旧通知行の出現、
新認証/権限/保持方式の追加でAstraへ戻す。今回の限定認証実装中は同じ設計判断を繰り返さない。
本番統合直前の実装レビューは別の必須工程。

## 根拠と今回の検証境界

- 最新SDK/ストア要件は公式資料を再確認。既存のiOS16.4+ / Xcode26系 / target36方針を維持。
- 今回は読取レビューと文書のみ。ビルド・機能試験・メール送信・DB変更・公開・署名・審査提出は未実施。
- 既存CI `35566065837`、source `4b8fc38` と追記417のPASSを再実行結果として扱わない。
- MFA待ちという古い停止理由は解消。現在の停止理由は上記の具体的な実装/配信/受入不足。

公式資料:
- [Apple: アカウント削除/登録・認証の案内](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- [Expo SDK57: Androidのdismiss/redirect競合実装](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-web-browser/src/WebBrowser.ts)
- [Apple提出要件](https://developer.apple.com/news/upcoming-requirements/)
- [Google target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Android 16KB](https://developer.android.com/guide/practices/page-sizes)
- [Google生成AI](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en)
