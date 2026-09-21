# アプリ申請準備 — 2026-09-21

**状態: 準備中 / 提出不可。** この資料はストア申請の作業台帳。Web公開、型チェック、CI成功をアプリの審査合格とは扱わない。
最新依頼は「申請までやってくれ」。iOS 16.4以降への変更も本人承認済み。未達の安全性/実機/運用条件を省略しない。新規契約・課金・有料EASビルドは別に確認する。本番変更・ストア提出は未実施。

## 最初の配信範囲

- 無料利用を中心にした iPhone / Android アプリ。既存 `apps/mobile` のExpo/React Native実装を使用する。
- 親の呼び名・日々の記録・家族で確認すること・AI相談を中心にする。ロゴ/キャラクターは残す。
- ネイティブ未実装の写真/PDF添付、Webだけの機能、有料プラン購入をストア説明に含めない。
- 課金導入は別案件。無料版の提出準備のために新しい有料商品や外部購入誘導を追加しない。
- AIは診断・治療・緊急判断をしない。保存された記録を参考にする機能であり「すべてを完全に記憶」「絶対安心」と宣伝しない。

## 開発者アカウント確認（9月21日）

- 本人はApple Developer / Google Play ConsoleをBEECH名義で「登録済み」と回答。再契約しない。
- Google Play Consoleで「株式会社BEECH」「組織アカウント」を実確認。全アプリ一覧は既存別アプリ1件だけで、親のもしもナビは未登録。
- 新規アプリ作成画面の項目（名前、パッケージ名、言語、アプリ/無料、ポリシー/輸出法の宣言）を読取確認。何も送信せず閉じた。パッケージ予約/署名/新規アプリ作成/審査提出はしていない。
- Android開発者認証の画面にパッケージ/署名鍵登録の案内あり。このアプリの完了を意味しない。Identity欄は既存開発者アカウント由来の情報であり、全要件の合格判定とは扱わない。
- 本人ログイン後、Apple DeveloperのBEECH, K.K.・組織・Account Holderを実確認。Team ID `P58FA4CC7R`、メンバーシップ更新日は2027-06-23。
- 更新されたDeveloper Program License Agreementについて本人「同意した」後、Developer/App Store Connectの未同意警告消失を確認。代理同意はしていない。
- 専用のExplicit App ID `jp.beech.oyanomoshimo`（Description: Oyano Moshimo Navi）を登録済み。ソースの通知用途に合わせ通常のPush Notificationsを選択。APNs鍵/証明書/プロファイルの発行は未実施。In-App PurchaseはApple画面の既定チェックだが、有料契約/商品は作成しない。
- App Store Connectに日本語/iOSの「親のもしもナビ」を作成。Apple ID `6814299610`、SKU `oyano-moshimo-navi-ios`。ユーザアクセスは制限あり（本人選択、Admin等の既定アクセスは変更しない）。既存別アプリは変更なし。
- [申請用レコード](https://appstoreconnect.apple.com/apps/6814299610/distribution/ios/version/inflight)は既定版1.0の「提出準備中」。ソース0.3.0と最終版番号の整合は未完。署名/build送信/審査提出/公開とは別段階。配信国/価格/プライバシー/年齢区分の宣言は未設定、EUトレーダー案内も未対応。
- 通知の世代管理はローカル実装/隔離SQL確認済み。旧端末移行/保持期間/本番有効化は未完。`MOBILE_PUSH_INSTALLATION_PROTOCOL.md`参照。

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
| 必須 | Expo SDK更新 | 51→57の段階更新/型/両OSbundle PASS。iOS16.4+は本人承認済み。署名build/両実機が未完 |
| 必須 | サーバーと認証の整合 | Web `/auth/mobile` 配信、Supabase URL許可/CAPTCHA設定、新binaryのメール復帰と別人分離 |
| 必須 | 複数手帳のAI対象 | 選択/ID引継ぎ/状態分離/遅延応答抑止を実装・合成PASS、実機は未 |
| 必須 | AI回答のアプリ内通報 | 同意付き報告/限定管理画面/AAL2/監査/競合防止を実装・合成PASS。担当/保存期間/実受入は未 |
| 必須 | ログアウト後の通知 | v2の世代管理/不明応答再送/消去統合は隔離SQL含めPASS。旧登録の本番調査・移行/保持期間/実配送が未完で既定OFF |
| 必須 | 削除・復元・権限 | 専用試験データでAuth/DB/Storage削除完了とバックアップ復元。viewer/owner・複数家族の漏えい防止 |
| 必須 | 実機受入 | 下記iPhone/Android表。JS/合成テストだけでは閉じない |
| 必須 | 申請情報 | 実developer組織、規約、Privacy/Data Safety/年齢区分、審査用ログイン、実画面画像、提出承認 |

Supabase DashboardはMFA復旧待ち。受付 `SU-478850`（9月19日）は復旧の成功ではない。
CLIや管理キーでMFAを迂回しない。既存ユーザーの削除・パスワード変更を試験手段にしない。

## SDK移行の順番

1. 51 → 52 → 53 → 54 を一段ずつ更新・検証する。最初に54でAPI36対応のビルド経路を確認するが、54を最終採用とはしない。
2. 各段で `expo install --check`、型チェック、両OSのJS export、既存認証/記憶/通知回帰を実行する。ネット接続・installが必要になっても課金ビルドは別承認。
3. SDK55以降のNew Architecture、React19、Metroのworkspace解決を確認。WebのReact18を巻き込まない。旧RN固定のgradle-plugin/assets-registryも整合させる。
4. 9月21日も公式表で57を確認し採用。57はNode22.13+ / iOS16.4+。本人がiOS16.4以降を明示承認、Node24を使用。
5. Xcode、Android toolchain、dev-client、SecureStoreのbackup除外設定、Privacy manifestを移行先SDKの仕様で確認する。現SecureStore15はinstalled pluginを確認し、backup除外を明示した。FaceID利用は追加しない。
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

現SDK57の `doctor:mobile-store` も宣言検査のみで `SOURCE_CHECKS_ONLY` / `NOT_VERIFIED`。
旧SDK検出の回帰も維持する。実機・実binary・Consoleの検証とは別。

## 次の区切り

ローカル残件/最終SDK → 認証の本番整合 → 署名付き内部テストビルド（費用/配布確認）→ 実機受入 → 申請情報の確定 → 意向確認済みの提出 → 審査。
ストア文面・スクリーンショット計画は `MOBILE_STORE_SUBMISSION_DRAFT.md`。承認済み/提出済みと誤認しないこと。

## 前回の検証結果（source b7daff9）

- source-only 50/50 PASS（Auth・画面の合成回帰を含む）。Mobile型チェック、`git diff --check` PASS。
- `EXPO_OFFLINE=1` / telemetry OFF / 実環境の変数とdotenvなしで、既存Expo51のiOS・Android JS/Hermes exportが両方exit 0。
  native compile、署名、実API、本番・実機の受入ではない。生成物は一時ディレクトリでGitへ追加しない。
- `doctor:mobile-store`: BLOCKED / NOT_VERIFIED / exit 1（現SDK51の検出）。依存更新はまだ実行していない。
- 先行する認証互換変更 `7796d3c` のGitHub CI `35440317168` はsuccessを再確認。今回追加分のCI結果とは分ける。
- 初回の並行監査で問題を抽出して修正した。追加の独立最終レビューは担当の利用制限で未完了。主担当で差分/テストを確認したが、第三者レビュー済みとはしない。

## 過去の検証結果と残件（SDK54時点・追記411）

- SDK52・53・54の型/公式同梱依存チェック（offline）/iOS・Android JS/Hermes export成功。52/53 Routerの未宣言依存を一時補完し、54では公式依存に含まれるため撤去。54最終出力 `apps/mobile/dist/qualification-i29ADj`。
- Web React18とlockのWeb依存解決は維持。MobileはReact19.1/RN0.81.5、Metro既定設定、New Architectureとautolinking解決を使用。dev-client/font/constants/metro-runtimeの対応版を明示。
- `test:mobile-bundle` と `test:mobile-native-config` を追加しCIへ。dotenv/秘密環境変数を排除、offline、prebuildは一時コピーのみ。CocoaPods/Gradleのinstallや署名はしない。
- 隔離native設定生成でSecureStore backup除外、未使用camera/photo/FaceID用途なし、Android外部storage/overlay権限の除外、ATSの任意HTTP不許可、iOS最小15.1を確認。最終merged manifest/実binaryの証拠ではない。
- source-only 53/53、Web/Mobile型、Web lint/build、diff check PASS。lint既存warning、Node20のSupabase非推奨warningあり。Node22+/最終SDKは次の更新対象。
- 独立レビュー: AI通報とSDKチェックポイントでmust-fixなし。通知レビューは旧本人の同一token残存と書込前拒否の回復問題を発見し限定修正。通報の運用は `AI_ANSWER_REPORTING.md`。
- **通知は未完了**: 対応表のない別端末登録を旧登録と区別できない。送信結果不明が後でcommitする競合を現schemaでは回復できない。現在のOS tokenも取得できない旧本人の登録は、本人のactive=0だけでは否定不能。新規の通知拒否端末を一律ログアウト不能にする変更は採用しない。このため旧版移行/共有端末を安全とせず、installation識別と世代付きサーバー更新・移行手順が必要。
- 現在tokenが取得できる場合は別ownerの同一token残存を検知し解除成功としない。他owner/他端末の行を削除しない。登録APIのwrite前拒否は明示receiptで再試行可、通信断/書込開始後の不明応答は未確定保持。
- ローカルtoolchain: Xcode26.6とiOS26.5 Simulatorあり、アプリは未起動。CocoaPods未検出。AndroidはAPI35/build-tools34・35とJDK17あり、API36/NDK未検出。端末利用/署名/実APIテストは未実施。
- 前回CI `35512152991` (b7daff9) は両ジョブsuccess。今回差分のCIはcommit後に別記する。本番/ストアへは出していない。
- 今回source `1a5acba24cdc080c4c81ef785ca2d497ecef2475` をpushし、CI `35513187211` のweb-and-mobile / personal-data-infrastructure全successを確認。Linuxでの両OSexport/native設定生成、既存隔離SQL、Web build/smokeも通過。旧端末通知・実機・運用ゲートを解消した証拠ではない。

## 最新の検証結果（SDK57・追記415）

- Expo54→55→56→57の型/依存チェック/両OS export/一時native設定生成を確認。iOS16.4+は本人承認済み。
  RN0.86.3/React19.2.3/TS6.0.3。ローカルNode24.19.0、CI Node24、pnpm9.15.9。Web依存は維持。
- ローカル70項目PASS（source55・Web lint/両型3・隔離SQL11・Web build1）。通報画面の最終修正後もAPI/UI/型PASS。
  通報の認証失効時に本文を消す回帰と、再認証/競合後の再取得も確認。
  source `0ac6a2c` のCI `35548532460` は全ジョブsuccess。最後の初回画面の文言修正は後続commitで管理。
- 通知v2の永続installation/revision、遅延/再送/本人切替/旧row維持/アカウント消去を実装。
  隔離PostgreSQLの独立接続5競合と既存executor/finalizer統合PASS。実配送ではない。既定OFFと旧版移行等のゲートは維持。
- Ruby3.3.6/CocoaPods1.16.2を一時領域へ導入。Gemfile/lockはJSON2系を固定しCocoaPodsのJSON3非互換を回避。
  `test:mobile-ios-compile`はmacOS/Xcode用。先に`BUNDLE_GEMFILE`を`scripts/native-build/Gemfile`、
  `BUNDLE_PATH`を専用の一時ディレクトリにして`bundle install`し、同じRuby/Node24のPATHで実行する。
  dotenv/秘密env/利用者データはコピーせず、public依存取得だけ。ソースのアップロードや署名・ストア送信はしない。
- Xcode26.6/iOS Simulator SDK26.5で署名なしReleaseをコンパイル成功。
  生成Info.plistでMinimumOSVersion16.4、Bundle ID `jp.beech.oyanomoshimo`を確認。
  一時コピー `oyano-ios-compile-aeGrgl`、`DerivedData/Build/Products/Release-iphonesimulator/app.app`。
  専用iPhone17/iOS26.5 Simulatorで起動し、初回画面、接続未設定時の登録/保存不可、
  未ログインの急なとき→詳細→チェック0/3から1/3への反応を確認。送信/電話/実データ入力なし。
  未提供の写真メモ/添付機能を初回画面が案内していたため、日々の記録/書類の場所へ修正し回帰と型PASS。
  `37ca7d0`の修正文言を同じ一時コピーで差分コンパイルし、専用Simulatorへの再インストール/起動/UI反映も確認。
  テスト終了後はこのSimulatorだけ停止、データを残して再確認可能にした。
  同sourceのCI `35548989941`も全ジョブsuccess（両OS export/native設定、隔離SQL、Web build/smoke含む）。
- Android API36/build-tools36.0.0をofficial sdkmanagerで導入し一覧で確認。NDK/native compile/16KB実行は未完。
- EASの既存owner/project一致をread-only確認。費用/署名資格/クラウドbuild/IPA・AAB送信/審査提出は未実施。
  Supabase MFAは再確認でも未完。ticket SU-478850は9月19日の受付だけで新しい復旧案内なし。
  本番認証/通知旧版調査・移行/通報運用/実機受入/正式版番号と申請宣言が残る。
