# セッション引き継ぎメモ

このファイルは、チャットが切れたり新しいチャットに移った場合でも作業を復元できるように、毎ステップ更新する。

## 現在の目的

「親のもしもナビ v0.3」を本番環境まで持っていく。

方針:

- Web入口: Next.js
- 継続アプリ: Expo
- DB/Auth/Storage: Supabase共通
- 発動サポートパック: Web/Stripe前提
- Expoアプリ内には外部Web決済CTAを置かない
- Family Plus等のアプリ内デジタル課金はIAP余地を残す

## 現在地

Step 1: 現状棚卸し 完了。

Step 2に入る前に、GitHubへ上げる準備中。

GitHub準備の進捗:

- `git init` 完了。
- 初回commit完了。
- commit: `47f6f57 Initial oyano moshimo v0.3 monorepo`
- `.env.example` をWeb/Mobileに追加済み。
- `.env`, `.env.local`, `node_modules`, `.next`, `.expo` はgit管理対象外。
- ユーザー判断でGitHub repo作成は後回し。
- GitHubなしでも進められる本番化作業を先に進める。
- ユーザーが「他の先進めれる？」と確認。
- Supabaseアカウント作成待ちの間、Stripe Checkout/Webhookの土台を先に実装する。

作成・更新済み:

- `docs/PRODUCTION_ROADMAP.md`
- `README.md`
- `docs/SESSION_HANDOFF.md`
- `apps/web/.env.example`
- `apps/mobile/.env.example`

確認済み:

- Web typecheck OK
- Mobile typecheck OK
- Next.js build OK
- Web dev server起動確認済み
- Expo Metro起動確認済み

## 実装済みの主な導線

Web:

- `/`
- `/start`
- `/diagnosis`
- `/result/[caseId]`
- `/result/[caseId]/share`
- `/support-pack`
- `/providers`
- `/admin`
- `/admin/cases`
- `/admin/cases/[id]`
- `/admin/support-packs`

Expo:

- `/(auth)/welcome`
- `/(tabs)/dashboard`
- `/people/[id]`
- `/people/[id]/tasks`
- `/people/[id]/status`
- `/people/[id]/assets`
- `/people/[id]/timeline`
- `/people/[id]/home`
- `/people/[id]/family`
- `/notifications`
- `/account/plan`

## 本番前に残っている重要課題

- WebはNext.js API経由でSupabase保存する構造に変更済み。ただしSupabase環境変数未設定時はlocalStorageフォールバック。
- Mobileはまだ `apps/mobile/lib/demoData.ts` のデモデータ表示。
- Supabase Authの実ログイン未接続。
- AdminはSupabase API読み取り優先に変更済み。`ADMIN_ACCESS_TOKEN` による簡易API保護は追加済み。本格的なSupabase Auth管理者権限は未接続。
- Supabase RLS policy SQLは作成済み。実プロジェクトへの適用は未実施。
- Stripe Checkout/Webhook API土台は実装済み。Stripeアカウント/環境変数/商品Price作成は未実施。
- Push通知送信ジョブ未実装。
- Supabase Storage写真アップロード未実装。

## 次にやること

まずGitHub準備。ただしユーザーが「とりあえず後でつくるから先進めてくれ」と言ったため、GitHub pushは保留。

現在分かっていること:

- このディレクトリはまだgit repositoryではなかった。
- 現在はgit repository化済み。
- GitHub CLI `gh` は入っているが、`dogwoodcommunity` のtokenがinvalid。
- そのため、ローカルgit初期化と初回commitまではCodex側で進められる。
- GitHubへのrepo作成/pushには、ユーザー側のGitHub再ログインが必要。

GitHubが必要な理由:

- VercelでNext.jsを本番公開する時、GitHub連携が最も安定する。
- 本番デプロイ履歴、rollback、環境変数管理、共同作業がしやすい。
- SupabaseやStripe接続後の変更履歴を安全に残せる。

現在の次作業:

- Web保存をNext.js API経由に変更する。完了。
- Supabase service role keyをサーバー側だけで使える構造にする。完了。
- Supabase本番用RLS SQLを準備する。完了。
- Supabase task template seed SQLを準備する。完了。
- `supabase/README.md` にSQL実行順と環境変数メモを追加。完了。
- Stripe Checkout/Webhookの土台を追加する。完了。
- Stripe SDK追加はpnpm storeの問題で一旦避け、Stripe REST API直叩きで実装。
- Stripe接続に必要なenvは `STRIPE_SECRET_KEY`, `STRIPE_SUPPORT_PACK_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`。
- AdminをSupabase API読み取り優先に変更。完了。
- Admin APIは `ADMIN_ACCESS_TOKEN` 設定時に `x-admin-token` が必要。
- Admin UIはlocalStorage `oyano_admin_token` をヘッダーに使う。未設定時はlocalStorageデモ表示にフォールバック。
- Admin API追加済み:
  - `GET /api/admin/cases`
  - `GET /api/admin/cases/[caseId]`
  - `GET /api/admin/support-packs`
- MobileにSupabaseデータ取得サービス `apps/mobile/lib/mobileData.ts` を追加。完了。
- Mobile dashboard/person/tasks はSupabaseがあれば実データ、なければdemoDataにフォールバック。
- Mobile Magic Link送信をSupabase Auth `signInWithOtp` に接続。Supabase未設定時はデモログインにフォールバック。
- Vercel設定 `vercel.json` を追加。Cronは `/api/cron/send-due-notifications` を30分ごとに叩く想定。
- Expo EAS設定 `apps/mobile/eas.json` を追加。
- デプロイ手順 `docs/DEPLOYMENT.md` を追加。
- Supabase Storage setup SQL `supabase/storage_setup.sql` を追加。
- Web API `POST /api/storage/home-photo-upload-url` を追加。
- Mobile写真アップロードservice `apps/mobile/lib/photoUpload.ts` を追加。
- Vercel Cron用API `GET /api/cron/send-due-notifications` を追加。Expo Push APIへ送信し、`scheduled_notifications` を `sent` に更新する。
- 本番化チェックリスト `docs/PRODUCTION_CHECKLIST.md` を追加。
- Web法務ページのひな形を追加:
  - `/legal/privacy`
  - `/legal/terms`
  - `/legal/tokushoho`
  - `/legal/disclaimer`
- Health check API `GET /api/health` を追加。
- Admin env確認 `GET /api/admin/env-check` と `/admin/env` を追加。
- GitHub Actions CI `.github/workflows/ci.yml` を追加。
- Supabase product seed `supabase/product_seed.sql` を追加。
- Supabase indexes `supabase/indexes.sql` を追加。
- Web handoff consume API `POST /api/handoff/consume` を追加。case_result tokenを検証し、family/person/tasksを生成してcaseをconvertedにする。
- Mobile `consumeWebHandoff` を追加し、welcome画面からWeb診断引き継ぎAPIを呼ぶ。
- 環境変数マトリクス `docs/ENVIRONMENT_MATRIX.md` を追加。
- Supabase task generation trigger `supabase/task_generation.sql` を追加。`person_status_events` 追加時に `task_templates` から未作成taskを生成し、`people.current_status` も同期する。
- Web Admin token保存UI `apps/web/components/AdminTokenControl.tsx` を追加。`ADMIN_ACCESS_TOKEN` 設定後、ブラウザlocalStorageに `oyano_admin_token` として保存し、Admin APIへ `x-admin-token` で送る。
- Web production smoke script `scripts/smoke-web.mjs` を追加。Vercel URLまたは `WEB_BASE_URL` を指定して主要ページ/APIの疎通確認ができる。
- GitHub Actions CIにWeb smoke stepを追加。build後にNext serverを起動して `scripts/smoke-web.mjs` を実行する。
- Mobile status画面を実person id対応に更新。`apps/mobile/lib/mobileData.ts` の `updatePersonStatus` から `person_status_events` に保存し、DB triggerでtasks生成につなぐ。
- Mobile tasks画面から `tasks.status` を更新できるようにした。完了時は `completed_at` と `updated_at` も保存する。
- Supabase task notification trigger `supabase/task_notification_generation.sql` を追加。task due_dateから前日9:00 JSTの `scheduled_notifications` を作成する。`scheduled_notifications` RLSも本人のall操作に更新。
- ローカル開発手順 `docs/LOCAL_DEVELOPMENT.md` と `scripts/local-doctor.mjs` を追加。`pnpm run doctor:local` で主要ファイル・env example・依存の存在を確認できる。
- Web Adminにローカルデモcase生成UI `apps/web/components/AdminLocalTools.tsx` を追加。Supabase未設定でも `/admin` からlocalStorage caseを作って詳細確認できる。
- Webデザインを刷新。生成画像 `apps/web/public/images/family-documents-hero.png` を追加し、トップをフルブリードヒーローに変更。`/start` のステータスカードと `/result/[caseId]` の結果・タスク・引き継ぎ表示もプロダクトUI寄りに再設計。
- Web `/diagnosis` を再設計。進捗レール、5つの入力セクション、ステップ番号、固定感のある送信エリアを追加し、フォーム単体感を減らした。
- Expoデザインの基礎を追加。`apps/mobile/lib/theme.ts` を作成し、dashboard/person/tabsへWebと近い色・カード・影・タイポグラフィを適用。
- Expo tasks/status/home画面もテーマ適用。タスクは未完了・重要の集計、状態別カウント、期限/優先度チップ、空状態表示を追加。
- Web `/support-pack` と `/providers` を再設計。商品範囲、除外事項、申し込みステップ、相談先カテゴリの比較軸を見やすくした。
- Dev serverで `/` だけ404になる環境差を避けるため、トップを `/home` でも提供し、`next.config.mjs` で `/ -> /home` の一時redirectを追加。smokeも `/home` を確認する。
- 携帯確認用script `pnpm run dev:web:lan` を追加。`pnpm --dir apps/web exec next dev -H 0.0.0.0 -p 3000` で起動する。3000番に古いNextプロセスが残ると `localhost` が別サーバーへ当たるので、`lsof -nP -iTCP:3000 -sTCP:LISTEN` で確認する。
- Expo assets/timeline/family/notifications画面もテーマ適用。旧色を置き換え、見出し・カード・通知表示をWeb寄りのトーンに統一。
- Web法務ページを整備。privacy/terms/disclaimer/tokushohoに共通legal hero/panelを適用し、本番前に確定すべき事業者情報・問い合わせ先が分かる表現へ調整。
- Web Adminを運用画面として整備。overview/cases/support-packs/env/case詳細にadmin hero、stat、chip、横スクロールtable、JSON表示を追加し、case確認・support pack確認が見やすい状態にした。
- 2026-07-06時点のローカル確認: `next build apps/web` OK、Web tsc OK、`scripts/smoke-web.mjs http://localhost:3000` OK。ブラウザ確認で `/admin`、`/admin/cases`、`/admin/support-packs`、`/admin/env`、ローカルデモcase詳細の主要DOMと横幅崩れなしを確認。LAN確認URLは `http://192.168.11.63:3000/home`。
- Expoのwelcome、plan tab、account plan、root layoutもテーマ適用。ログイン引き継ぎ画面からプラン確認まで、IAP余地とWeb/Stripe発動サポート分離方針を画面文言で保持。
- `docs/PRODUCTION_ROADMAP.md` を現状実装に合わせて更新。Web Supabase保存、Mobile Auth/実データfallback、Admin API、RLS、Stripe、通知、Storageの土台が実装済みであることを反映し、次ステップをSupabase本番Project接続中心に整理。
- `scripts/local-doctor.mjs` を本番準備向けに拡張。Web/App主要導線、Supabase SQL一式、Vercel/EAS設定、env example必須key、deploy docs、Vercel Cron routeを確認する。2026-07-06に実行してOK。
- Web結果/共有画面のアプリ引き継ぎURLを `NEXT_PUBLIC_APP_SCHEME` 対応へ変更。共有画面でもhandoff tokenがある場合はアプリリンク表示・コピー・起動ができる。
- Next dev中に `.next` キャッシュ破損で `Cannot find module './352.js'` が出て `/home` や `/start` が500になった。`rm -rf apps/web/.next` 後にLAN dev serverを再起動し、`scripts/smoke-web.mjs http://localhost:3000` は再度OK。
- `scripts/smoke-web.mjs` を拡張。`/result/smoke-case`、`/result/smoke-case/share`、`/admin`、`/admin/cases`、`/admin/support-packs` も確認対象に追加。ローカルで実行してOK。
- `supabase/verify_setup.sql` を追加。SQL投入後にtable/RLS/policy/storage bucket/seed件数を確認し、`ok=false` がないか見る。README、production checklist、roadmap、doctorにも反映。
- Expo通知登録を堅牢化。Android notification channel、`EXPO_PUBLIC_EAS_PROJECT_ID`、権限拒否/取得失敗時のnull返却と画面メッセージを追加。Mobile tscとdoctor OK。
- 注意: `next dev` 起動中に `next build` を走らせると同じ `.next` を触って `Cannot find module './xxx.js'` が出ることがある。build検証前はdev serverを止め、必要なら `rm -rf apps/web/.next` してからbuildする。
- 2026-07-06再検証: dev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、`node scripts/local-doctor.mjs` OK。その後LAN dev server再起動 -> 拡張 `scripts/smoke-web.mjs http://localhost:3000` OK。
- Web入口を診断訴求から「親のもしも準備ポータル」へ変更。トップは無料読みもの/準備テーマ/柔らかい「状況整理チェック」CTAを前面化し、会員登録・アプリ引き継ぎは結果後の保存/共有理由として見せる方針。`/start` も「診断」ではなく「状況整理チェック」文言へ変更。Web build、Mobile tsc、doctor、拡張smoke OK。
- 無料集客/信頼獲得用に `/guides` と `/guides/[slug]` を追加。入院・介護・認知症・死亡直後・相続前整理・実家じまいの6本を静的生成し、各記事から状況整理チェックへ接続。トップの準備テーマとナビもガイド導線へ変更。Web build、Mobile tsc、doctor、ガイド込みsmoke OK。
- 収益導線として `/plans` を追加。無料ポータル、家族共有アプリ(IAP想定)、困った時の整理サポート(Web決済)の3段階を明示し、信頼を失わず課金する線引きも表示。トップ/ナビ/doctor/smokeへ反映。Web build、Mobile tsc、doctor、料金込みsmoke OK。
- ユーザー向けの「診断」表現をさらに弱め、`/diagnosis` は「家族で確認することを整理する」、結果画面は「整理結果」へ変更。サポートパック/共有/プラン文言も入力内容・整理結果ベースに調整。Web build、Mobile tsc、doctor、smoke OK。
- SEO/検索流入の土台としてNext.js Metadata、`/sitemap.xml`、`/robots.txt` を追加。トップ、ガイド一覧、ガイド詳細、料金ページに個別metadataを設定し、`NEXT_PUBLIC_WEB_BASE_URL` をsitemap/robotsのbase URLに使う構成にした。`scripts/local-doctor.mjs` と `scripts/smoke-web.mjs` もsitemap/robots確認に対応。2026-07-06にdev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK。
- 登録前に使える無料ツールとして `/checklists` を追加。入院初日、介護開始、死亡後1週間、実家じまい前写真の4チェックリストを `apps/web/lib/checklists.ts` に定義し、トップ/ナビ/sitemap/doctor/smokeへ接続。2026-07-06にdev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK。アプリ内ブラウザで `/checklists` を確認し、スマホ幅375pxでも横はみ出しなし。
- 信頼・転換率向上のため `/safety` を追加。保存しない情報、専門判断を断定しない方針、Web/StripeとExpo/IAPの課金境界、業者ログイン/口コミ/予約/成約課金を作らない方針を明示。トップ/ナビ/footer/料金ページ/sitemap/doctor/smokeへ接続。2026-07-06にdev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK。アプリ内ブラウザで `/safety` を確認し、スマホ幅375pxでも横はみ出しなし。
- ユーザー指摘「趣旨と入口がわかりにくい」を受け、トップと `/start` を再設計。トップH1を「親が入院した/介護が始まる/亡くなった時に次に何をするか」へ明確化し、CTAを「いまの状況から始める」「準備ガイドを読む」の2つに整理。入口カードを「まず読む」「状況を整理する」「家族で管理する」の3ステップへ変更。`/start` は単なる一覧から、説明hero、急ぎのQuick start、状況グループ「いま起きている」「これから備える」「葬儀後・手続き中」へ再構成。2026-07-06にdev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK。アプリ内ブラウザで `/home` と `/start` を確認し、スマホ幅375pxでも横はみ出しなし。
- ユーザー指摘「めちゃシンプルで、高齢の方にもわかりやすく丁寧に」を受け、トップ/ナビ/`/start` をさらに簡素化。ナビは「はじめる・読む・チェックリスト・安心・料金」に削減。トップH1は「親のことで困ったら、まずここで整理できます。」へ変更し、CTAは「まず状況を選ぶ」「先に読む」の2つだけにした。3ステップは「状況を選ぶ」「5分で整理する」「必要なら保存する」へ平易化。`/start` は「親はいま、どの状況に近いですか？」を中心に、表示ラベルを「入院した」「介護・施設のこと」「亡くなった直後」など自然語へ変更。文字サイズ、ボタン高さ、カード余白も高齢者向けに拡大。2026-07-06にdev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK。アプリ内ブラウザで `/home` と `/start` を確認し、スマホ幅375pxでも横はみ出しなし。
- ユーザー質問「最初にアプリから入口にしない？このLPからの誘導？」に対して、方針は「Web/LPで入口、アプリは保存・家族共有・通知・写真管理の継続利用」と整理。結果画面の「アプリ引き継ぎ」文言をユーザー向けに変更し、「この結果を残して、家族で見るならアプリへ。」として、Webでできること/アプリで続けることを明示。共有画面も「家族に共有する」「アプリに保存する場合」に変更し、handoff tokenなど開発者向け表示を隠した。2026-07-06にdev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK。アプリ内ブラウザで `/result/58c035ea-fe09-4f92-92dc-08965653cc70` を確認し、スマホ幅375pxでも横はみ出しなし。
- アプリ継続利用設計についてユーザーから重要な方針修正あり。アプリはDAU型ではなく「低頻度・高重要度」型。毎日/毎週開かせる設計や無駄なゲーミフィケーションは避け、「必要な瞬間に必ず戻ってくる」ことを勝ち筋にする。KPIはDAUではなく通知開封率、90日後アカウント生存率、期限タスク完了率。通知は期限逆算エンジン(7日/14日/4か月/10か月/3年)、家族のタスク更新・写真追加、ステータス変化時の再発動、月1回の変化確認リマインドを中心にする。家族共有は課金壁に置かず、2名まで無料で拡散装置にする。有料は家族無制限+役割/担当割当、カスタムリマインド、写真無制限、複数の親、家族会議PDF、履歴保持で課金する。実装優先順位は 1. タスクに担当者・期限・push通知、2. 家族招待+Dashboardを今日やること/期限が近い/未割当中心に、3. 月1確認リマインド。実家カルテと課金導線はその後。
- 通知設計をスパム化しない方針へ実装修正。`scheduled_notifications` に `notification_type` と `opened_at` を追加し、`unique(user_id, task_id, notification_type)` で冪等化。`task_id` はnullableのままなので月1チェックインにも使える。通知生成SQLは全タスク4段ではなく、法定期限系(`legal_deadline/public/inheritance` または死亡届/年金/準確定申告/相続税/相続登記のtitle)だけ `14d/7d/1d/当日`、priority 1は `7d/1d`、それ以外は `1d` のみにした。due_date変更や担当者変更時はpending通知削除→UPSERT再生成、完了/スキップ時は生成しない。送信cronは個別通知ではなく `user_id × Asia/Tokyo日付` でダイジェスト化し、同日複数件は「今日の期限:n件」1通にまとめる。`notification_events` は作らず、MVPは `opened_at` 一本。ただしExpo receiptでは開封は取れないので、後続で通知タップ時のresponse listener→APIで `opened_at` 更新が必要。family_update即時通知はscheduledに混ぜず、後続のEdge Function対象。2026-07-06にdev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK。

その後に Step 2: Supabase本番準備。

ユーザーにお願いしている作業:

1. GitHub CLI再ログインが必要になったら、ブラウザ認証を完了する
2. その後、Supabaseへログイン
3. 新規Project作成画面へ進む
4. Project名は `oyano-moshimo-prod` 推奨
5. Regionは `Northeast Asia / Tokyo` があればそれ、なければ近いアジアリージョン
6. 作成できたらユーザーが「作った」と返す

その後にやること:

1. `supabase/schema.sql` をSQL Editorで実行
2. `supabase/task_template_seed.sql` をSQL Editorで実行
3. `supabase/task_generation.sql` をSQL Editorで実行
4. `supabase/task_notification_generation.sql` をSQL Editorで実行
5. `supabase/product_seed.sql` をSQL Editorで実行
6. `supabase/indexes.sql` をSQL Editorで実行
7. `supabase/production_rls.sql` をSQL Editorで実行
8. `supabase/storage_setup.sql` をSQL Editorで実行
9. Auth Email Magic Link設定
10. 環境変数取得
11. WebからSupabase保存確認

## 運用ルール

- これ以降、各ステップの完了時にこのファイルを更新する。
- チャットが切れた場合、新チャットではまずこのファイルを読む。
- 判断や未決事項もここに残す。
