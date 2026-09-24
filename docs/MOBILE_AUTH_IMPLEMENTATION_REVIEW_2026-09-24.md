# モバイル認証の統合前レビュー — 2026-09-24

判定: **修正後に再確認。現状の認証差分を本番統合しない。**

対象は `29ab8d7`、レビュー開始HEAD `79f8257`、branch `codex/consult-guest-entry` / draft PR #9。
本人のAstra切替完了返答を受け、追記423の重要処理レビューを実施した。
今回のアプリコード修正・本番設定変更・ストア提出はない。

## 確認できたこと

- システム認証セッションの待機と `authBusy` は分離され、既存callbackの検証を再利用している。
- state、固定callback、期限、入力メール、開始本人、確認済みuser、access/refresh双方の本人照合は維持。
  `completedAuth` はtokenを保持せず、新規試行/ログアウトで失効。同じcallbackの同時受信はPromiseを共有する。
- dismiss/cancelでpendingを消さず、古い失敗の消去は同じロック内でstateを比較する。
- source `29ab8d7` のCI `35959526031` が全2ジョブsuccessであることを今回GitHubで再確認。
  追記423の両OSローカルコンパイルは前回実行結果。今回同じbuildを再実行した意味ではない。

## 修正が必要な点

### 1. P1 — 表示していない引継ぎ画面が、後のログインで保存を始める

`apps/mobile/app/handoff.tsx:51` の認証購読は `useEffect` のunmount時だけ解除される。
Stackでは別画面へ移動しても前の画面が残る。`consume` に表示状態の判定がないため、
引継ぎ画面を離れた後の `SIGNED_IN` でも古いcase/tokenを保存し、保存先画面へ遷移できる。
認証自体を突破する問題ではないが、本人が今操作していない古い引継ぎを後の本人へ結びつけ得る。
この購読は今回の差分以前から存在する。新しいresult復帰との統合を調べて発見した既存問題。

合成再現: 実コンポーネントのeffectsを実行→未ログインの初回読取完了→unmountせず画面移動→
後の別ログイン通知を発生。`consumeWebHandoff` と `router.replace` が各1回呼ばれた。
APIは合成で、実データの保存や別人へのアクセスは実行していない。

### 2. P2 — mountedだけの確認では遅着する画面遷移を止められない

`apps/mobile/app/(auth)/welcome.tsx:43` とinvite/handoffのログイン結果処理は
`mountedRef` だけを確認する。画面移動でblurしてもtrueのままなので、旧リクエストの結果で
表示中の別画面を置き換え得る。result/Linkingが重なる場合も、session保存の冪等性だけでは
元画面の遅いUI更新を抑止できない。

合成再現: 実 `continueToApp` を遅延した認証Promiseで開始→mountedを保って画面移動→
成功を返すと元画面から `router.replace` が実行された。
既存のテストはmounted true/falseだけで、blurや同じ画面への復帰を検証していなかった。

### 3. P2 — 例外時に再試行表示へ戻らない経路がある

- `apps/mobile/lib/auth.ts:109`: 新しい重複callback用の `getSession()` がcatchの外。
  保存先読取がthrowすると `handleAuthRedirectUrl()` 自体がrejectし、callback画面の `.then()` では処理できない。
  合成再現では1回目の正常認証後に読取をthrowさせると再試行結果ではなくrejectになった。
- `apps/mobile/app/handoff.tsx:32`: `consumeWebHandoff` のfetch等がthrowすると
  `consumedRef=true` / `isLoading=true` のまま。追加したresult-only経路の `void consume()` も同じ経路を通る。
  合成再現では通信例外後のloading更新はtrueのみで、再試行できる状態へ戻らなかった。

## 次のSol修正範囲（設計判断済み）

1. 認証3画面のリクエストを、画面のfocus期間とcase/tokenなどの対象、個々のリクエストへ紐づける。
   `useFocusEffect` 等でblur/unmount/対象変更時に世代を無効化し、focusし直しても前の結果は適用しない。
   非表示・古い世代からmessage/保存/画面遷移を実行しない。単に `isFocused` を1回追加するだけでは
   blur→refocusの遅着を防げない。同期的なrefで連打も抑止し、再focus/失敗時にはボタンを再操作できるよう戻す。
2. handoffの認証購読と初回session読取をfocus期間に限定し、古い読取/認証通知を無視する。
   `consume` の開始時と完了時も表示世代/対象を照合する。遷移済みの旧画面から新しい保存を始めない。
   初回の遅いsigned-out読取が後のSIGNED_IN/保存状態を上書きしないよう、通知との順序も管理する。
   通信開始済みの保存を「取消済み」とは表示しない。応答不明時の再試行は既存サーバー側の同一本人向け
   handoff冪等性を利用し、token消費/家族権限のSQLを緩和しない。
3. 重複callbackも含め、認証helperの想定される保存先/通信例外を失敗結果へ変換する。
   `activeCallback`/ロックはfinallyで解放し、失敗からやり直せることを試験する。
   handoffではthrowも捕捉し、現在の世代だけがloading/consumedを解除して再試行の案内を出す。
   古いcatch/finallyが新しい処理状態を消してはいけない。
4. `scripts/test-mobile-auth-captcha.mjs` に実コンポーネント/handlerを用いるfocus/blur/cleanupの回帰を追加。
   現在のfixtureだけへ不自然な実装チェックを足すのではなく、下記のユーザー操作順を駆動する。

必要な回帰:

- mountedのままblur、blur→refocus、case/token変更後の遅着成功/失敗が画面を奪わない。
- 元画面とcallback画面に結果が届いても、非表示画面が保存/遷移しない。result-only/Linking-onlyは両方継続可能。
- 非表示のhandoffで後からログインしても保存0回。戻って本人が操作した場合は正しい対象を保存可能。
- 古いgetSessionの結果が後の認証状態や処理中表示を戻さない。unsubscribe後のキュー済み通知も無視する。
- 認証済み重複callbackでgetSessionがthrowしても失敗結果になり、次の試行が進む。
- handoff通信失敗/応答不明から再試行でき、旧finallyが新しいsavingを解除しない。
- 既存の別本人/メール/期限/state/mixed token、logout競合、招待/引継ぎ先制限の回帰を維持。

Mobile型と限定回帰、両OS JS/Hermes exportを実施する。今回の修正がJS/画面のみなら、
同じnative依存の全再コンパイルを途中で繰り返す必要はない。正式candidateには最終JSを必ず含める。
依存/プラグイン/権限を変えた場合はnative compileを再実行する。

この設計範囲の通常修正はSolで進められる。同じ設計の確認だけで何度も切り替えない。
修正後は不足migrationの限定差分と隔離SQL検証の準備まで進められる（追記422）。
認証修正差分と本番migration/切戻しの統合前レビューをまとめて行う。
新しい本人混同、保存先/認証方式の変更、2回の検証付き修正失敗ならAstraへ戻す。

## 証跡・現在の境界

合成再現script: `/private/tmp/oyano-auth-review.JeTbyL/reproduce.mjs`、4ケース再現成功。
実ファイルのhelper/handler/componentをTypeScript変換して動かし、Auth/Storage/通信/画面制御は合成。
一時scriptはGitへ保存しない。修正側では安全な期待値を恒久回帰へ追加する。
これは実機での再現確認ではない。既存CIの成功を否定するものではなく、未収録の条件を検出したもの。

Supabase管理画面は今回操作していない。追記422のcallback未登録/不足RPC等は同日の前回確認値。
本番の反映・承認手順、ゲスト/CAPTCHA OFF、データ保護、正式署名・実機・運用・提出の残件は維持する。

参照:
- [React Navigation: 前画面のmount維持とfocus lifecycle](https://reactnavigation.org/docs/navigation-lifecycle/)
- [Expo WebBrowser: auth session](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- Expo57の実装: `apps/mobile/node_modules/expo-web-browser/src/WebBrowser.ts` のAndroid race/redirect処理
