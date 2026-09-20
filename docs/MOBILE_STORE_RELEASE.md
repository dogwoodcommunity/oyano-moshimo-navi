# アプリ申請準備 — 2026-09-20

**状態: 準備中 / 提出不可。** この資料はストア申請の作業台帳。Web公開、型チェック、CI成功をアプリの審査合格とは扱わない。
本人の依頼は「アプリ申請に向けてすすめよか」。ローカル修正・検証・資料作成を進める。契約、課金、EASリモートビルド、ストア提出、本番設定変更はまだ実行しない。

## 最初の配信範囲

- 無料利用を中心にした iPhone / Android アプリ。既存 `apps/mobile` のExpo/React Native実装を使用する。
- 親の呼び名・日々の記録・家族で確認すること・AI相談を中心にする。ロゴ/キャラクターは残す。
- ネイティブ未実装の写真/PDF添付、Webだけの機能、有料プラン購入をストア説明に含めない。
- 課金導入は別案件。無料版の提出準備のために新しい有料商品や外部購入誘導を追加しない。
- AIは診断・治療・緊急判断をしない。保存された記録を参考にする機能であり「すべてを完全に記憶」「絶対安心」と宣伝しない。

## 今回のローカル修正

- 見本を実際の手帳として開く入口、設定不足/通信失敗時の架空データ表示を廃止する。
- アプリ内の本人確認・明示的なログアウトと保護画面を整理する。
- 対応不要のタスク件数、固定の実家情報、未提供の添付・料金案内を修正する。
- 日記のUTC日付ずれを端末日付へ修正。日記/保管場所メモの保存例外で入力を保持し、例文を保存値にしない。
- 未使用のiOSカメラ/写真ライブラリ用途宣言を削除。生成アプリ内の権限は後日再検査する。
- `doctor:mobile-store` を追加。旧SDKを検出し、構成ファイルの成功だけで申請可能と判断させない。

## 提出を止める項目

| 優先 | 項目 | 完了に必要な証跡 |
| --- | --- | --- |
| 必須 | Expo SDK更新 | 現51/RN0.74から段階移行、対応依存・lock・型・bundle・native buildの成功 |
| 必須 | サーバーと認証の整合 | Web `/auth/mobile` 配信、Supabase URL許可/CAPTCHA設定、新binaryのメール復帰と別人分離 |
| 必須 | 複数手帳のAI対象 | 対象者選択とID引継ぎ、先頭の手帳へ勝手に相談しない実機試験 |
| 必須 | AI回答のアプリ内通報 | 画面を離れず報告、所有権確認・受付保存・運営確認・削除/保存期間の運用。メールリンクだけでは代替しない |
| 必須 | ログアウト後の通知 | その端末のtokenのみ解除する仕組みと受信停止。他端末を巻き添えにしない |
| 必須 | 削除・復元・権限 | 専用試験データでAuth/DB/Storage削除完了とバックアップ復元。viewer/owner・複数家族の漏えい防止 |
| 必須 | 実機受入 | 下記iPhone/Android表。JS/合成テストだけでは閉じない |
| 必須 | 申請情報 | 実developer組織、規約、Privacy/Data Safety/年齢区分、審査用ログイン、実画面画像、提出承認 |

Supabase DashboardはMFA復旧待ち。受付 `SU-478850`（9月19日）は復旧の成功ではない。
CLIや管理キーでMFAを迂回しない。既存ユーザーの削除・パスワード変更を試験手段にしない。

## SDK移行の順番

1. 51 → 52 → 53 → 54 を一段ずつ更新・検証する。最初に54でAPI36対応のビルド経路を確認するが、54を最終採用とはしない。
2. 各段で `expo install --check`、型チェック、両OSのJS export、既存認証/記憶/通知回帰を実行する。ネット接続・installが必要になっても課金ビルドは別承認。
3. SDK55以降のNew Architecture、React19、Metroのworkspace解決を確認。WebのReact18を巻き込まない。旧RN固定のgradle-plugin/assets-registryも整合させる。
4. 最終候補は保守中SDK。9月20日公式表では57が最新。57はNode22.13+ / iOS16.4+、55はiOS15.1+。対応端末を狭める判断は配信前に確認する。
5. Xcode、Android toolchain、dev-client、SecureStoreのbackup除外設定、Privacy manifestを移行先SDKの仕様で確認する。今のSecureStore13のpluginを新しい説明だけで設定しない。
6. 最後に生成IPA/AABを検査する。configのtarget値変更だけ、Xcodeがインストール済みだけでは完了にしない。

確認した現在の要件（2026-09-20）:

- Apple: Xcode26以上/iOS26 SDK以上でアップロードする。[Apple公式](https://developer.apple.com/news/upcoming-requirements/)
- Google Play: 2026-08-31から新規・更新はtarget API36以上。延長は自動適用とみなさない。[Google公式](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- Android: 16KB対応はZIP/ELF alignmentと16KB環境で実行検証する。現在の公式ページの更新拒否開始日は2027-02-01。提出直前にも読み直す。[Android公式](https://developer.android.com/guide/practices/page-sizes)
- 対応表/段階移行: [Expo SDK表](https://docs.expo.dev/versions/latest/)、[更新手順](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- AI通報: アプリ内で不適切な生成内容を報告できること。[Google生成AIポリシー](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en)

## 実機受入表（すべて未実施）

利用者の実記録ではなく、専用の許可済み試験アカウント/架空データで行う。ログにメールリンク・コード・秘密値は残さない。

| 場面 | 合格基準 | iPhone | Android |
| --- | --- | --- | --- |
| 新規/再ログイン | メールから冷起動・温起動で正しい手帳へ戻る。期限切れ/再使用は安全に拒否 | 未 | 未 |
| 他アカウント | 未ログインの直リンクで個人画面不可。別メールのtokenで既存本人を置換しない | 未 | 未 |
| 日記 | 日付境界、選択式入力、保存、再起動後の再読込、通信失敗時に入力保持 | 未 | 未 |
| 家族/手帳 | 対象者A/Bを混ぜない。招待先・権限が正しくviewerは変更不可 | 未 | 未 |
| AI | 同意前送信なし。正しい対象者/記憶、再ログイン後履歴、訂正/削除、失敗/制限時の回復 | 未 | 未 |
| 通報 | 回答カードから受付まで完了、重複送信防止、運営が確認できる | 未 | 未 |
| 通知 | 拒否しても使用可。許可/停止/ログアウト/再ログイン時に別人へ残らない | 未 | 未 |
| 削除/復元 | 受付と削除完了を区別。対象者/家族/Storage/backupの範囲を確認 | 未 | 未 |
| 読みやすさ | 大きい文字、VoiceOver/TalkBack、細い画面、キーボード表示でも操作可 | 未 | 未 |

## オフライン検査

```sh
node scripts/mobile-build-doctor.mjs
node scripts/mobile-store-preflight.mjs
node scripts/test-mobile-store-preflight.mjs
corepack pnpm@9.15.9 --filter mobile run typecheck
```

`doctor:mobile-store` のexit 1は現SDK51を検知した意図した停止。テスト失敗を隠すために0へ変更しない。
将来宣言依存が一致しても結果は `SOURCE_CHECKS_ONLY` / `NOT_VERIFIED`。実機・実binary・Consoleの検証とは別。

## 次の区切り

ローカル修正/SDK移行 → 認証の本番整合（別承認）→ 署名付き内部テストビルド（費用/配布承認）→ 実機受入 → 申請情報の確定 → 本人が提出承認 → 審査。
ストア文面・スクリーンショット計画は `MOBILE_STORE_SUBMISSION_DRAFT.md`。承認済み/提出済みと誤認しないこと。

## 今回の検証結果

- source-only 50/50 PASS（Auth・画面の合成回帰を含む）。Mobile型チェック、`git diff --check` PASS。
- `EXPO_OFFLINE=1` / telemetry OFF / 実環境の変数とdotenvなしで、既存Expo51のiOS・Android JS/Hermes exportが両方exit 0。
  native compile、署名、実API、本番・実機の受入ではない。生成物は一時ディレクトリでGitへ追加しない。
- `doctor:mobile-store`: BLOCKED / NOT_VERIFIED / exit 1（現SDK51の検出）。依存更新はまだ実行していない。
- 先行する認証互換変更 `7796d3c` のGitHub CI `35440317168` はsuccessを再確認。今回追加分のCI結果とは分ける。
- 初回の並行監査で問題を抽出して修正した。追加の独立最終レビューは担当の利用制限で未完了。主担当で差分/テストを確認したが、第三者レビュー済みとはしない。
