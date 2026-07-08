# セッション引き継ぎメモ

このファイルは、チャットが切れたり新しいチャットに移った場合でも作業を完全に復元できるように、毎回必ず更新する。実装内容、実行したコマンド、成功/失敗、次にやること、外部サービスのURLやIDはここに残す。作業が進んだら、可能な限りGitHubにもcommit/pushして退避する。

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
- Supabase task notification trigger `supabase/task_notification_generation.sql` を追加。task due_dateから期限通知の `scheduled_notifications` を作成する。`scheduled_notifications` RLSも本人のall操作に更新。
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
- 通知レビュー対応を追加。担当者変更時の旧担当pending削除は `delete from scheduled_notifications where task_id = new.id and status = 'scheduled'` でtask全体を消してから再生成するため、長男→長女変更時に旧担当pendingは残らない設計。push payloadには単発互換の `scheduled_notification_id` と、ダイジェスト全件の `scheduled_notification_ids` を積む。Webに `POST /api/notifications/opened` を追加し、Expo root layoutで `addNotificationResponseReceivedListener` を登録、通知タップ時に複数IDまとめて `opened_at` 更新する。ダイジェスト本文は先頭2件を `タイトル(担当: relationship/role)` で出し、残りは `他n件` にする。既存DB向けに `supabase/notification_delivery_hardening.sql` を追加し、README/doctorのSQL順も `schema -> template -> task_generation -> notification_delivery_hardening -> task_notification_generation` に更新。2026-07-06に `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK、`POST /api/notifications/opened` はSupabase未設定時skip応答確認済み。
- 通知opened APIの所有権チェックを追加。`POST /api/notifications/opened` はSupabase設定済み環境ではBearer token必須、`supabase.auth.getUser(token)` で userId を取り、`scheduled_notifications.id in (...) and user_id = userId and opened_at is null` の条件で初回開封のみ更新する。モバイル側は通知タップ時にSupabase session access tokenをAuthorization headerへ付けてWeb APIを呼び、Web未接続時はSupabase client直更新へfallback。`notification_delivery_hardening.sql` には既存DB向けに `scheduled_notifications.task_id -> tasks(id) on delete cascade` のFK張り直しも追加。2026-07-06にdev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK。ローカルはSupabase未設定のためopened APIはskip応答。
- Expo担当者表示・変更を実装。`apps/mobile/lib/mobileData.ts` に `fetchFamilyMembers(personId)` と `updateTaskAssignee(taskId, memberId | null)` を追加し、`MobileTask` は `assignedMemberId/assigneeLabel` を持つ。`tasks.assigned_member_id` の更新だけをアプリ側で行い、通知再生成はDB triggerに任せる。`apps/mobile/app/people/[id]/tasks.tsx` は各タスクに担当チップを表示し、未割当は目立つ「担当未定」バッジ、チップタップでボトムシートから「自分が担当する」/家族一覧/「未割当に戻す」を選ぶ。楽観更新で失敗時rollback。`apps/mobile/app/(tabs)/dashboard.tsx` は「今日・期限超過」「7日以内」「担当未定」の3セクションに再構成し、担当未定件数を家族ボードの核として表示。RLSは `tasks manage family` がperson.family_id経由でfamily memberのみ更新可。通知triggerは `after insert or update of due_date, status, assigned_member_id` なので担当者変更で発火する。2026-07-06にdev停止 -> `.next`削除 -> `next build apps/web` OK、Mobile tsc OK、doctor OK、dev再起動後の拡張smoke OK。
- 家族招待2名無料のRPCを実装。`supabase/family_invite_rpc.sql` を追加し、`create_family_invite` はfamily memberのみ実行可、Freeは「owner以外のfamily_members + 7日以内pending family_invites」が2名まで、Plusは無制限。既存の同一メールpending招待は上限チェック前に再利用するので、満枠でも同じリンクの再表示はできる。招待は7日expire扱いで、物理cronなしでもSQL側が古いpendingを読み飛ばす。`accept_family_invite` は受諾時にもFree上限を再チェックし、accepted_at/statusを更新する。`family_invites` に `relationship/created_by/accepted_at`、`pgcrypto`、token unique indexを追加。RLSは `family_invites` 直INSERTポリシーなし、`family_members` の全操作admin policyをupdate/deleteへ分離して、client直INSERTはRPC経由だけにした。`apps/mobile/app/people/[id]/family.tsx` はメール/続柄から招待リンクを作成し、LINEやメールのShareへ渡せる。共有文面には `myapp://invite?token=...` とWeb fallback `/invite/[token]` を入れる。Web fallbackページ `apps/web/app/invite/[token]/page.tsx` はアプリを開く/サイトを見るの最小受け口。`free_plan_limit_reached` はエラーではなく「Family Plusを見る」CTAとして表示。2026-07-06にMobile tsc OK、doctor OK、dev停止 -> `.next`削除 -> `next build apps/web` OK、dev再起動後の招待fallback込み拡張smoke OK。
- 月1チェックイン通知を実装。`supabase/monthly_checkin_notifications.sql` を追加し、active push tokenがあり `notification_preferences.reminders_enabled` がfalseでないユーザーに、未来の `monthly_checkin` が無い場合だけ30日後9:00(JST)の `scheduled_notifications` を1件補充する。`task_id` はnull、`notification_type='monthly_checkin'`。この補充関数は全ユーザー分を見るのでauthenticatedには開けず、`service_role` のみにexecute grant。`apps/web/app/api/cron/send-due-notifications/route.ts` は送信前に `ensure_monthly_checkin_notifications` を呼び、月1通知は「月1回の状況確認です」「親御さんの状況に変わりがないか確認しましょう」として、期限タスクdigestとは本文を分ける。`supabase/verify_setup.sql` は通知/招待関連function存在確認を追加。README/doctorのSQL順も更新。2026-07-06にMobile tsc OK、doctor OK、dev停止 -> `.next`削除 -> `next build apps/web` OK、dev再起動後の拡張smoke OK。
- 要配慮個人情報とApp Store審査のガードレールを追加。`docs/PRIVACY_AND_REVIEW_GUARDRAILS.md` に、親の入院・認知症・危篤・死亡などは要配慮情報に該当し得る前提、本人同意/家族登録時の必要最小限入力、Supabaseリージョン/暗号化/RLS確認、App StoreのPrivacy Policy URL、アカウント削除導線、アプリ内にWeb/Stripe/外部決済CTAを出さない方針を固定。Webプライバシーポリシー `apps/web/app/legal/privacy/page.tsx` に要配慮情報、本人説明、保存しない情報、保管場所、安全管理、同意撤回/削除を追記。Web状況整理チェック `apps/web/app/diagnosis/DiagnosisForm.tsx` に要配慮情報の理解と必要最小限入力のrequired同意を追加。Expo welcomeにセンシティブ情報注意を追加し、plan画面/account plan画面から「Web」「Stripe」「外部決済CTA」など審査上余計な文言を削除。参照元は個人情報保護委員会の法令・ガイドライン等とApple App Review Guidelines。2026-07-06に実装。
- 機能追加はv0.3で打ち止め。次は「本番Supabase接続 -> プラポリ正式化 -> 家族3組テスト」。特商法表記 `apps/web/app/legal/tokushoho/page.tsx` をBEECH名義前提の叩き台に更新し、販売価格、追加料金、支払時期/方法、提供時期、キャンセル/返金、動作環境、専門判断を断定しない注意を追加。正式名称、代表者、住所、電話番号、問い合わせ窓口は `[要確定]`。`docs/FAMILY_TEST_COOPERATION_REQUEST.md` を追加し、洗心会側の家族3組テスト依頼文、2週間の確認項目、9,800円(税込)の発動サポート支払い意思確認、撤退ライン案を固定。参照元は消費者庁の特定商取引法ガイド(通信販売)。2026-07-06に実装。
- Expoアプリ内を家族3組テスト向けに整備。`apps/mobile/app/people/[id]/tasks.tsx` でDashboardから渡す `filter=due/soon/unassigned` を実際に反映し、表示中フィルタを明示。`apps/mobile/app/notifications.tsx` はDB名やpush token生表示を消し、低頻度・高重要度の通知説明、月1確認、通知OFF前の注意へ変更。`apps/mobile/app/(tabs)/settings.tsx` を追加し、通知設定、プライバシーポリシー、削除依頼、プラン状態の入口をまとめた。`apps/mobile/app/(tabs)/_layout.tsx` に設定タブを追加。`apps/mobile/app/people/[id]/index.tsx` から開発者向けperson id表示を削除。2026-07-06にMobile tsc OK。
- Supabase本番Projectを作成し、リージョンはNortheast Asia (Tokyo)を選択。SQL Editorで `schema.sql -> task_template_seed.sql -> task_generation.sql -> notification_delivery_hardening.sql -> task_notification_generation.sql -> monthly_checkin_notifications.sql -> product_seed.sql -> indexes.sql -> production_rls.sql -> family_invite_rpc.sql -> storage_setup.sql -> verify_setup.sql` を順番に投入。`verify_setup.sql` はSupabase画面で最後の結果表だけ見えたため、追加で `supabase/verify_compact.sql` を作成して投入し、25 rowsの確認表で見えている範囲の `ok` がすべてtrueであることを確認。Project URL / publishable key / legacy service_role keyを `apps/web/.env.local` と `apps/mobile/.env.local` に設定。新UIのSecret keyでは `permission denied for table cases` が出たため、Legacy service_role API keyへ差し替えた。さらにPostgREST用のrole権限が不足していたため `supabase/api_grants.sql` を追加・投入。`POST /api/cases` が `persisted:true` を返し、本番Supabaseの `cases` へ保存できることを確認。2026-07-06時点で本番DB初期構築とローカルWeb/AppのSupabase接続は完了扱い。次はVercel/EASなど本番環境変数へ同じ値を入れる。
- ロゴ、アプリアイコン、スプラッシュ画面を追加。`scripts/generate-brand-assets.mjs` で外部画像/AI生成画像に依存しないPNG資産を生成し、`apps/mobile/assets/icon.png`、`adaptive-icon.png`、`splash.png`、`notification-icon.png`、`apps/web/public/brand/logo-mark.png`、`apple-touch-icon.png` を作成。Expo `apps/mobile/app.json` に icon/splash/adaptiveIcon/notification を接続し、Web `apps/web/app/layout.tsx` のmetadata iconsと `apps/web/app/globals.css` のヘッダーブランドマークにも接続。方針は深緑・書類・確認チェック・家族の丸を使った公共サービス寄りの落ち着いた記号。`docs/BRAND_ASSETS.md` に生成方法と接続箇所を記録。2026-07-06にWeb typecheck OK、Mobile typecheck OK、Next build OK、local doctor OK、local smoke OK。本番Vercelへdeploy済みで `https://oyano-moshimo-navi.vercel.app` のsmokeもOK。GitHub commitは `53a1689 Add brand icon and splash assets`。
- Expo EAS preview build前の整備を追加。`apps/mobile/app.config.js` を作成し、`EXPO_PUBLIC_EAS_PROJECT_ID` から `extra.eas.projectId`、`EXPO_OWNER` からowner、`IOS_BUILD_NUMBER`/`ANDROID_VERSION_CODE` からbuild番号を差し込めるようにした。`apps/mobile/eas.json` のdevelopment/preview/productionに `EXPO_PUBLIC_APP_SCHEME=oyanomoshimo` と `EXPO_PUBLIC_WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app` を設定。`scripts/mobile-build-doctor.mjs` と `pnpm run doctor:mobile-build` を追加し、アイコン/スプラッシュ、bundle id、package、EAS profile、projectId有無を確認できるようにした。`docs/MOBILE_TEST_BUILD.md` もEAS env登録、`eas init`、preview build手順に更新。Expo config確認、Mobile typecheck、mobile-build doctor OK。`EXPO_PUBLIC_EAS_PROJECT_ID` は未設定なので、EAS project作成後に入れる必要あり。
- App Store審査と信頼性のため、アプリ内アカウント削除依頼導線を追加。`apps/mobile/app/account/delete.tsx` から連絡先メール/理由を入力して送信し、`apps/mobile/lib/account.ts` がWeb API `POST /api/account/delete-request` へBearer token付きで送る。Web APIはSupabase Auth tokenで本人確認し、`audit_logs` に `account_delete_requested` を記録する。設定画面 `apps/mobile/app/(tabs)/settings.tsx` から削除依頼画面へリンク。未ログイン時は送信不可。`scripts/local-doctor.mjs` と `scripts/smoke-web.mjs` にも削除導線/APIを追加し、未認証POSTが401になることを確認。Web/Mobile typecheck OK、Next build OK、local doctor OK、local smoke OK。
- 家族招待リンクの受け側をExpoに追加。`apps/mobile/app/invite.tsx` で `oyanomoshimo://invite?token=...` を受け取り、ログイン済みなら `accept_family_invite` RPCを実行、未ログインなら同じinvite画面へ戻るMagic Linkを送れるようにした。`apps/mobile/lib/mobileData.ts` に `acceptFamilyInvite`、`apps/mobile/lib/auth.ts` に任意redirectPath対応を追加。Stackとdoctor、`docs/MOBILE_TEST_BUILD.md` も更新。これで「家族を招待する -> LINE/メールでリンク送信 -> 受け手がアプリで参加」のMVP導線が揃う。
- Adminに削除依頼確認画面を追加。`apps/web/app/api/admin/delete-requests/route.ts` が `audit_logs.action = account_delete_requested` を取得し、`apps/web/components/AdminDeleteRequests.tsx` と `/admin/delete-requests` で確認できる。Admin overviewにも導線を追加。削除依頼を記録するだけでなく運営が拾える状態にした。
- 2026-07-07にEAS実機配布準備を継続。`pnpm dlx eas-cli --version` は `eas-cli/20.5.1` で取得OK。`pnpm dlx eas-cli whoami` は `Not logged in` のため、EAS project初期化とpreview buildはExpoログイン待ち。root `package.json` に `eas:whoami`、`eas:login`、`eas:mobile:init`、`eas:mobile:build:ios`、`eas:mobile:build:android` を追加し、`docs/MOBILE_TEST_BUILD.md` も `pnpm dlx eas-cli` 前提の手順に更新。
- App Store審査向けにExpoアプリ内の課金連想文言をさらに削減。`apps/mobile/app/(tabs)/plan.tsx`、`apps/mobile/app/account/plan.tsx`、`apps/mobile/app/(tabs)/settings.tsx` から「購入」「外部サービスへの誘導」などを削り、状態確認専用の表現へ変更。`scripts/mobile-build-doctor.mjs` に `Stripe`、`Webで申し込`、`外部決済`、`外部サービスへの誘導`、`購入や` の混入チェックを追加し、doctorで再発検知できるようにした。
- Expo dashboardの空状態を追加。Supabase接続済みで `people` が0件の場合、これまでは見本データへ戻る可能性があったため、`apps/mobile/lib/mobileData.ts` に `source: "empty"` と `emptyDashboardData()` を追加し、`apps/mobile/app/(tabs)/dashboard.tsx` で「まだ対象者が登録されていません」「Webの整理結果を引き継ぐ」案内を表示するように変更。これにより本番/家族テストで見本データと実データが混ざるリスクを下げた。Mobile typecheck、local doctor、mobile-build doctor OK。

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

## 2026-07-06 14:09 JST 追記

- GitHub CLIのブラウザ認証を完了し、remoteをHTTPSへ設定した。
- Repository: https://github.com/dogwoodcommunity/oyano-moshimo-navi
- `main` branchをGitHubへpush済み。最新push時点の先頭commitは `28a299e Add Supabase API grants verification`。
- `apps/web/.env.local` と `apps/mobile/.env.local` はローカルだけにあり、gitignore対象。Supabaseのservice role keyなどの秘密情報はGitHubへ保存していない。
- 本番Supabase初期構築とローカル接続確認は完了済み。次の大きな作業はVercelへWebを本番デプロイし、同じ環境変数をVercel側へ安全に設定すること。

## 2026-07-06 14:20 JST 追記

- Expoアプリ内を家族3組テスト向けに追加調整。
- `apps/mobile/lib/supabase.ts` はSupabase clientをシングルトン化し、毎回clientを作り直さないようにした。
- ログイン画面 `apps/mobile/app/(auth)/welcome.tsx` から `caseId/token` とpush tokenの開発者向け表示を削除。メール未入力時は明示エラー、デモ導線は「確認用デモ」として分離。
- 通知開封処理 `apps/mobile/lib/notifications.ts` のSupabase fallbackでも `opened_at is null` 条件を追加し、初回開封時刻を上書きしないようにした。
- 情報登録画面 `apps/mobile/app/people/[id]/assets.tsx` は `demoPerson.id` 固定を廃止し、URLのperson idへ保存するよう修正。保存中表示と保存失敗メッセージも追加。
- 実家カルテ `apps/mobile/app/people/[id]/home.tsx` から開発者向けの `home_photos` / Supabase Storage文言を削除し、写真管理と「保存しないもの」を家族向け説明に変更。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm run doctor:local` OK。

## 2026-07-06 15:25 JST 追記

- Vercel本番公開完了。
- Production URL: https://oyano-moshimo-navi.vercel.app
- Vercel Project: `dogwoodcommunity1/oyano-moshimo-navi`
- Hobbyプランでは30分ごとのCronが使えないため、`vercel.json` の `/api/cron/send-due-notifications` は初期公開用に1日1回 `0 9 * * *` へ変更。通知運用を本格化する段階でPro化または外部cronを検討する。
- Vercel Production環境変数は設定済み: `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`NEXT_PUBLIC_APP_SCHEME`、`NEXT_PUBLIC_WEB_BASE_URL`、`ADMIN_ACCESS_TOKEN`、`CRON_SECRET`。
- `STRIPE_SECRET_KEY`、`STRIPE_SUPPORT_PACK_PRICE_ID`、`STRIPE_WEBHOOK_SECRET` は未設定。発動サポートパック決済を実装・テストする段階で入れる。

## 2026-07-06 17:27 JST 追記

- ユーザー指摘「デザインがAIっぽい」「入口がわかりにくい」を受け、Webトップと `/start` を再調整。
- トップは生成画像ヒーローを外し、紙の案内・整理メモ風の見た目へ変更。背景グラデーションや強いSaaS風カードを減らし、「入口はこちら」「状況を選んで始める」をファーストビュー中央に配置。
- トップに「親が入院した」「介護が始まりそう」「亡くなった直後」「実家を片付けたい」の短い入口リンクを追加。
- `/start` は写真背景を外し、受付票のような白い面と左線の構成へ変更。「ここからです」「急いでいる時は、ここから選んでください。」を明示し、各選択肢に「この状況で始める」「選ぶ」を追加。
- スマホ幅ではナビを `ここから始める / 読む / 安心` に絞り、開始画面の重複説明を隠して選択ボタンが早く見えるようにした。
- 確認: Web typecheck OK、Next build OK、ローカルdev再起動後に `node scripts/smoke-web.mjs http://localhost:3000` OK。アプリ内ブラウザで `/home` と `/start` をdesktop/390px幅で確認。
- GitHubへcommit `3dc2806 Make web entry design more grounded` をpush済み。
- Vercel本番へdeploy済み。Production URLは引き続き `https://oyano-moshimo-navi.vercel.app`。本番smoke OK。`/api/admin/env-check` は本番Admin tokenなしのため401 skipで想定通り。

## 2026-07-06 19:14 JST 追記

- 次工程としてStripe発動サポートパック決済のコード側を本番向けに整理。
- `/support-pack` と結果画面の開発者向け文言を削除し、「申し込み画面へ進む」「内容を確認して申し込む」などユーザー向け文言へ変更。
- `POST /api/stripe/checkout` は、同じcaseですでに `paid/reviewing/report_ready/delivered/closed` のsupport packがあれば409を返し、`requested` がある場合は既存行の `requested_scope` を更新するようにした。ボタン連打で同一caseのrequested行が増えにくい。
- `POST /api/stripe/webhook` は、同じStripe checkout session idのpurchaseが既にある場合は再利用し、Webhook再送でpurchaseが重複しにくいようにした。
- `docs/STRIPE_SETUP.md` を追加。Stripe商品/Price ID/Secret key/Webhook endpoint/Vercel env/テスト確認手順を1枚に整理。
- 確認: Web typecheck OK、Next build OK。
- GitHubへcommit `a4a82e7 Prepare Stripe support pack flow` をpush済み。
- Vercel本番へdeploy済み。Production URLは引き続き `https://oyano-moshimo-navi.vercel.app`。本番smoke OK。`/api/admin/env-check` は本番Admin tokenなしのため401 skipで想定通り。
- まだ未実施: Stripe Dashboardで商品作成、Vercel env `STRIPE_SECRET_KEY` / `STRIPE_SUPPORT_PACK_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` 設定、Production redeploy、テスト決済。

## 2026-07-06 19:57 JST 追記

- Stripe外部設定は後回しになったため、先にExpoアプリを家族3組テスト向けに整備。
- `apps/mobile/app.json` に iOS bundle identifier `jp.beech.oyanomoshimo`、Android package `jp.beech.oyanomoshimo`、通知/カメラ/写真ライブラリ用途説明を追加。EAS build前の詰まりを減らす。
- モバイル画面から `Push token`、`EAS projectId`、`Supabase未設定`、`Stripe Checkout`、`MVP`、`デモ表示` などの開発者向け文言が出ないように調整。
- Welcomeの「確認用デモ」は「まず見本を見る」へ変更。登録前に保存なしで確認できる表現にした。
- Plan/Account Planは、外部決済CTAを出さず、Freeの利用範囲と発動サポートパックの状態表示だけを説明する表現に整理。
- Notificationsは「この端末で通知を受け取れるようにしました」など利用者向け文言に変更し、通知OFF時は登録ボタンを無効化。
- `docs/MOBILE_TEST_BUILD.md` を追加。EAS preview build前の環境変数、家族3組テストで見る項目、未確定事項を整理。
- 確認: `pnpm --filter mobile run typecheck` OK、`node scripts/local-doctor.mjs` OK。
- `ADMIN_ACCESS_TOKEN` は新しいランダム値に更新し、Macのクリップボードへコピー済み。チャットやGitHubには保存していない。
- 本番確認:
  - `https://oyano-moshimo-navi.vercel.app/api/health` OK。
  - `scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。Admin env APIのみtoken必須のため通常smokeではskip。
  - `POST /api/cases` でSupabase保存 `persisted:true` を確認。テストcase id: `9e4f9718-b882-4508-9c89-64ac975f8d36`。
  - クリップボードのAdmin tokenで `/api/admin/env-check` OK。Stripe 3項目だけ未設定、それ以外configured true。

## 2026-07-07 追記

- ExpoアプリのMagic Link復帰を強化。
- `apps/mobile/lib/auth.ts` に `handleAuthRedirectUrl` を追加し、Supabase Magic Linkで戻ってきたURLの `code` を `exchangeCodeForSession` へ渡す。古いimplicit flow向けに `access_token` / `refresh_token` がURL fragmentに来た場合は `setSession` で復帰する。
- `apps/mobile/app/_layout.tsx` でアプリ初期URLとディープリンクイベントを監視し、ログインリンク・招待リンクから戻ったときにSupabase sessionへ変換するようにした。
- `apps/mobile/lib/supabase.ts` に `@react-native-async-storage/async-storage` を接続し、Expo/React Nativeでもログインセッションが端末内に残るようにした。
- 追加依存: `@react-native-async-storage/async-storage@1.23.1`。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK。
- 残: EASアカウント/プロジェクト確定後に `EXPO_PUBLIC_EAS_PROJECT_ID` と `EXPO_OWNER` を設定する。

## 2026-07-07 追記 2

- Web結果画面からExpoアプリへ保存する `/handoff` 導線を実装。
- `apps/mobile/app/handoff.tsx` を追加。`oyanomoshimo://handoff?caseId=...&token=...` で開き、ログイン済みならWeb整理結果を保存、未ログインならMagic Linkを送って同じhandoff画面へ戻す。
- `apps/mobile/lib/handoff.ts` はSupabase sessionのaccess tokenを `Authorization: Bearer ...` に入れて `/api/handoff/consume` を呼ぶように変更。
- `apps/web/app/api/handoff/consume/route.ts` はBearer token必須に変更し、Supabase userを検証してから `profiles`、`families.owner_user_id`、`family_members(role=owner)`、`people`、`tasks` を作るように修正。既に同じcaseが変換済みなら既存family/personを返し、重複作成を避ける。
- これで「アプリに保存する」から作られた対象者とタスクが、RLS越しにログイン本人の家族ボードで見える設計になった。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm --filter web run typecheck` OK、`pnpm --filter web run build` OK、`pnpm run doctor:mobile-build` OK。
- GitHubへcommit `946e43f Connect web handoff to mobile app` をpush済み。
- Vercel本番へdeploy済み。Production alias: `https://oyano-moshimo-navi.vercel.app`。本番smoke OK。Admin env APIのみtoken必須のため401 skipで想定通り。
- 作業中に `apps/web` 直下から一度deployを実行してしまい、Vercel側に `dogwoodcommunity1/web` という失敗プロジェクト/deploymentが作成された可能性あり。実運用の本番は `dogwoodcommunity1/oyano-moshimo-navi` で正しく稼働中。不要なら後でVercel dashboardから削除する。

## 2026-07-07 追記 3

- Expoアプリのpush token登録を本番ユーザー向けに修正。
- `apps/mobile/lib/notifications.ts` は固定デモuser idを受け取らず、Supabase sessionのログイン本人を使う。未ログイン時は端末tokenを取得してもDB保存せず `login_required` を返す。
- `apps/mobile/app/notifications.tsx` はログイン必要・通知拒否・保存失敗を利用者向けメッセージに分岐。
- `apps/mobile/app/(auth)/welcome.tsx` からデモuser idでのpush token登録を削除。通知登録はログイン後の通知設定画面で行う。
- `apps/web/app/api/push-tokens/register/route.ts` を追加。Bearer tokenでSupabase userを検証し、`profiles` をupsertしてから `push_tokens` をupsertする。ログインだけ済ませた新規ユーザーでも外部キーで落ちない。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm --filter web run typecheck` OK、`pnpm --filter web run build` OK、`pnpm run doctor:mobile-build` OK。
- GitHubへcommit `9032b3e Register push tokens for signed-in users` をpush済み。
- Vercel本番へdeploy済み。Production alias: `https://oyano-moshimo-navi.vercel.app`。本番smoke OK。Admin env APIのみtoken必須のため401 skipで想定通り。

## 2026-07-07 追記 4

- Expoアプリの通知設定スイッチをDB保存・復元対応。
- `apps/web/app/api/notification-preferences/route.ts` を追加。Bearer tokenでSupabase userを検証し、`profiles` をupsertしてから `notification_preferences` をGET/POSTする。
- `apps/mobile/lib/notifications.ts` に `fetchNotificationPreferences` / `saveNotificationPreferences` を追加。Web API優先、ローカル開発ではSupabase直読み書きへfallback。
- `apps/mobile/app/notifications.tsx` は起動時に通知設定を読み込み、期限リマインド・月1回確認・重要な連絡の各Switch変更時に保存する。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm --filter web run typecheck` OK、`pnpm --filter web run build` OK、`pnpm run doctor:mobile-build` OK。
- GitHubへcommit `9489866 Persist mobile notification preferences` をpush済み。
- Vercel本番へdeploy済み。Production alias: `https://oyano-moshimo-navi.vercel.app`。本番smoke OK。Admin env APIのみtoken必須のため401 skipで想定通り。

## 2026-07-07 追記 5

- Expoアプリの空Dashboardを初回体験向けに改善。
- `apps/mobile/app/(tabs)/dashboard.tsx` の対象者未登録状態で、「Webで5分整理を始める」ボタンを表示し、`EXPO_PUBLIC_WEB_BASE_URL/start` を開くようにした。
- すでにWeb整理済みの人向けに、結果画面の「アプリに保存する」から戻る説明を明示。
- アプリで続ける価値を「期限確認」「担当未定を家族で分ける」「通知・写真・メモを見返す」の3点に整理。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK。Web/API変更なしのためVercel deployは不要。

## 2026-07-07 追記 6

- EAS preview build前のProject ID反映手順を整備。
- `scripts/set-mobile-eas-project-id.mjs` を追加。`pnpm run eas:mobile:set-project-id -- <Expo Project ID>` で `apps/mobile/.env.local` の `EXPO_PUBLIC_EAS_PROJECT_ID` を安全に更新できる。
- root `package.json` に `eas:mobile:set-project-id` scriptを追加。
- `docs/MOBILE_TEST_BUILD.md` に `eas init` 後のProject ID反映コマンドを追記。
- `scripts/mobile-build-doctor.mjs` は `app.config.js` のresolved configを読み、Project ID envがある場合に `extra.eas.projectId` と一致するか確認する。
- 確認: `pnpm run doctor:mobile-build` OK、`pnpm --filter mobile run typecheck` OK。Web/API変更なしのためVercel deployは不要。

## 2026-07-07 追記 7

- ユーザーから「できるところまで全部進めて、許可する」と指示あり。
- EASログインを試行したが、`pnpm dlx eas-cli whoami` は `Not logged in`。`pnpm dlx eas-cli login` はブラウザログイン待ちまで進んだが、ユーザーがExpoログイン情報不明とのこと。EASログイン待機プロセスはキャンセル済み。
- Expo/EASは、Expoアカウント新規作成またはパスワード再設定後に再開する。復旧手順として `docs/EXPO_ACCOUNT_RECOVERY.md` を追加。
- 家族3組テスト当日に使う短い進行表として `docs/FAMILY_TEST_SCRIPT.md` を追加。Web完走、アプリ保存、担当変更、通知設定、家族招待、7日後再訪、9,800円支払意思を確認する。
- `docs/PRODUCTION_CHECKLIST.md` を現状に合わせて更新。GitHub/Supabase/Vercel/セキュリティは概ね完了、StripeとExpoログイン/preview build、法務正式情報が未完了。

## 2026-07-07 追記 8

- Expoログイン情報が不明なため、EAS preview buildは引き続き保留。Web/Supabase/Vercel側の作業は継続可能。
- `docs/DEPLOYMENT.md` のEAS手順を、root script経由の `pnpm run eas:*` に更新。ログイン不明時は `docs/EXPO_ACCOUNT_RECOVERY.md` を確認する導線を追加し、`SUPABASE_SERVICE_ROLE_KEY` をEAS/Expoへ入れない注意も追記。
- `scripts/smoke-web.mjs` に未認証API確認を追加。`/api/notification-preferences` と `/api/push-tokens/register` が本番で401を返すことをsmoke対象にした。
- `scripts/local-doctor.mjs` のEAS文言チェックを現行ドキュメントに合わせて更新。
- 確認: `pnpm run doctor:local` OK。
- 確認: `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。`/api/notification-preferences` と `/api/push-tokens/register` は401で想定通り。Admin env APIはtoken未指定のため401 skip。
- Web実装のランタイム変更はないため、この追記分ではVercel再deploy不要。

## 2026-07-07 追記 9

- Expoアカウント作成とEAS CLIログインが完了。`pnpm run eas:whoami` は `oyanomosimonavi` / `info@bee-ch.co.jp`。
- EAS project `@oyanomosimonavi/oyano-moshimo-navi` を作成。Project IDは `8ed038b0-28d1-42e1-8ef6-e7e2098c11d3`。
- 動的Expo configのため `eas init --force` はProject作成後に自動書き込みだけ失敗したが、`pnpm run eas:mobile:set-project-id 8ed038b0-28d1-42e1-8ef6-e7e2098c11d3` で `apps/mobile/.env.local` に反映。
- `apps/mobile/app.config.js` はProject IDとownerを公開デフォルト値として持つように変更。EAS remote buildでも `extra.eas.projectId` と `owner` が落ちない。
- EAS preview environmentに `EXPO_PUBLIC_SUPABASE_URL`、`EXPO_PUBLIC_SUPABASE_ANON_KEY`、`EXPO_PUBLIC_APP_SCHEME`、`EXPO_PUBLIC_WEB_BASE_URL`、`EXPO_PUBLIC_EAS_PROJECT_ID` を設定済み。`SUPABASE_SERVICE_ROLE_KEY` は入れていない。
- Android preview build `c0a85205-81bd-4a26-a8e8-98cf0541b9ea` を開始したがGradleで失敗。ログ上の原因は `settings.gradle` が `android/null` を参照し、`@react-native/gradle-plugin` を解決できないこと。
- 対応として `apps/mobile/package.json` に `@react-native/gradle-plugin@0.74.87` をdevDependencyとして明示追加。`node --print "require.resolve('@react-native/gradle-plugin/package.json')"` が `apps/mobile` から成功することを確認。
- `scripts/mobile-build-doctor.mjs` は環境変数だけでなくresolved Expo configのProject ID/ownerを見るように更新。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK、`pnpm run doctor:local` OK。
- 次: この修正をcommit/push後、Android preview buildを再実行する。成功したらインストールURLを家族テスト用に控える。

## 2026-07-07 追記 10

- Android preview build 2回目 `29f6229b-cce3-40bb-8e00-00b9972ecd6f` は、Gradle plugin問題を越えてJS bundleまで進んだが、`:app:createBundleReleaseJsAndAssets` で失敗。
- EAS log上の主因は `Error: The required package expo-asset cannot be found`。ローカル `expo export --platform android` ではさらにExpo Router entry未設定と `@babel/runtime` 解決不足も確認。
- 対応:
  - `apps/mobile/package.json` に `main: "expo-router/entry"` を追加。
  - `expo-asset@10.0.10` をdependenciesに追加。
  - `@babel/runtime` をdependenciesに追加。
- 確認: `expo export --platform android --output-dir /tmp/oyano-mobile-export` OK、`pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK、`pnpm run doctor:local` OK。
- 次: commit/push後にAndroid preview buildを3回目実行する。

## 2026-07-07 追記 11

- Android preview build 3回目 `e2ea70af-9b0c-425d-b289-70459ffb16f0` は、JS bundleまで進んだが `Error: Cannot find module '@react-native/assets-registry/registry.js'` で失敗。
- pnpm monorepo + EAS remote buildでMetroがReact Native配下のassets registryを直接解決できないため、`apps/mobile/package.json` に `@react-native/assets-registry@0.74.87` をdependenciesとして明示追加。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK、`expo export --platform android --output-dir /tmp/oyano-mobile-export` OK。
- 次: この修正をcommit/push後、Android preview buildを4回目実行する。成功したらEASのinstall URLを控えて家族3組テスト用に共有する。

## 2026-07-07 追記 12

- `@react-native/assets-registry@0.74.87` の明示依存修正をcommit `1b65a6d Fix React Native asset registry resolution` としてGitHubへpush済み。
- Android preview build 4回目 `c761577d-79b9-4740-ab98-fc664c106561` は成功。
- Android install URL: `https://expo.dev/accounts/oyanomosimonavi/projects/oyano-moshimo-navi/builds/c761577d-79b9-4740-ab98-fc664c106561`
- 次: Android実機でインストールし、Magic Linkログイン、Web結果からのhandoff、dashboard/person/tasks表示、push token保存を確認する。iOS TestFlight向けにはApple Developer/App Store Connect側の準備後にiOS preview buildを作る。

## 2026-07-07 追記 13

- Android実機 `3917JR` をADBで認識し、preview APK `/tmp/oyano-moshimo-preview.apk` を `adb install -r` でインストール成功。
- 起動直後にホームへ戻ったためlogcatを確認。原因は `ReactNativeJS: TypeError: Cannot read property 'useMemo' of null`、`ContextNavigator` / `ExpoRoot` 起点のクラッシュ。
- root/webのReactが18.3.1、mobileのReactがExpo SDK 51指定の18.2.0でズレており、pnpm monorepo + EAS bundleでReactが二重解決された可能性が高い。
- 対応: root `package.json` と `apps/web/package.json` の `react` / `react-dom` を `18.2.0` に統一。Next.js 14はReact 18.2.0でbuild OK。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm --filter web run typecheck` OK、`pnpm run doctor:mobile-build` OK、`pnpm --filter web run build` OK、`expo export --platform android --output-dir /tmp/oyano-mobile-export` OK。
- 次: この修正をcommit/push後、Android preview buildを5回目実行し、実機に再インストールして起動確認する。

## 2026-07-07 追記 14

- React 18.2.0統一修正をcommit `9587ff3 Align React version for Expo runtime` としてGitHubへpush済み。
- Android preview build 5回目 `800e5b14-e4a8-45d5-9361-2a1f1bb96702` は成功。
- APK URL: `https://expo.dev/artifacts/eas/wWmmMm-wAF76scliNvmDlcVfsCwapgtJYiAjLzmdeXI.apk`
- APKを `/tmp/oyano-moshimo-preview-reactfix.apk` にdownloadし、Android実機 `3917JR` へ `adb install -r` で再インストール成功。
- 起動後のlogcatで `ReactNativeJS TypeError` / `AndroidRuntime FATAL` は再発なし。`pidof jp.beech.oyanomoshimo` でプロセス生存を確認。
- 起動直後スクリーンショットが真っ黒に見えたが、原因は端末の `screen_brightness` が0/暗転状態だったこと。`settings put system screen_brightness_mode 0` と `settings put system screen_brightness 180`、`screen_off_timeout 600000`、`KEYCODE_WAKEUP`、`wm dismiss-keyguard` で復旧。
- 復旧後、Android実機スクリーンショットでログイン画面を確認済み。表示内容は「ログイン」「家族ボードへログイン」「親のもしもナビ」「メール」「ログインする」。
- 実機確認で、ログイン画面下部の「まず見本を見る」カードがAndroid実機の初期表示範囲外に隠れ、固定Viewのため到達できないことを発見。
- 対応: `apps/mobile/app/(auth)/welcome.tsx` を `ScrollView` 化し、小さい画面でもメールログイン下の見本導線までスクロールできるようにした。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK、`expo export --platform android --output-dir /tmp/oyano-mobile-export-scrollfix` OK。
- Android preview build 6回目 `04ab728c-379a-4da0-8044-31cdaac41654` は成功。APK URL: `https://expo.dev/artifacts/eas/aZsSrK5zMpjWqoIASSZrGvF46OMQXVCCo6zzSiF2Sfk.apk`
- APKを `/tmp/oyano-moshimo-preview-scrollfix.apk` にdownloadし、Android実機へ `adb install -r` で再インストール成功。
- 起動後、空Dashboardが表示され「Webで5分整理を始める」導線を確認。下タブのアイコンが四角表示になっていたため、`@expo/vector-icons` をmobile依存に明示追加し、`(tabs)/_layout.tsx` に `MaterialCommunityIcons` の `account-group-outline` / `calendar-check-outline` / `cog-outline` を設定。
- 確認: `pnpm install --no-frozen-lockfile` OK、`pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK、`expo export --platform android --output-dir /tmp/oyano-mobile-export-icons` OK。
- タブアイコン修正はcommit `a14c4fa Add mobile tab icons` としてGitHubへpush済み。
- Android preview build 7回目 `6980d13f-de13-40b0-be2f-194eb998797d` は成功。APK URL: `https://expo.dev/artifacts/eas/wzdTPZL_QS2Ydr95e0EWTlgMY_nOFuSMWSeGrZd-2Fo.apk`
- APKを `/tmp/oyano-moshimo-preview-icons.apk` にdownloadし、Android実機へ `adb install -r` で再インストール成功。
- インストール後の起動確認直前にADBが `no devices/emulators found` となり、実機接続が外れた。端末を再接続できたら、Dashboard表示とタブアイコンの実機確認から再開する。
- 次: Android実機をADB再接続し、Dashboard表示とタブアイコンを確認する。その後、「見本で開く」/メールログイン/Magic Link、Web診断結果からのhandoff、push token保存を順に確認する。

## 2026-07-07 追記 15

- ユーザーから「アプリ起動直後にメールアドレス入力・ログインを求めるのは抵抗がある」「内容を見て興味を持ってから会員登録へ誘導したい」「AIっぽく安っぽいデザインを直し、画像も使って高齢者にも分かりやすくしたい」と指示あり。
- `apps/mobile/app/(auth)/welcome.tsx` を初回体験向けに再設計。
  - 起動直後はメール入力を出さず、まず「親のもしもナビ」の価値説明を表示。
  - 上部に家の書類・スマホ・湯のみの実写風ヒーロー画像を配置し、AIっぽいカードだけの印象を軽減。
  - 「期限を忘れない」「家族で担当を分ける」「写真とメモを保管する」の3点でアプリの使い道を説明。
  - 主CTAを「新規会員登録はこちら」に変更。登録済みユーザーは「登録済みの方はログイン」から進む。
  - メール入力欄は会員登録/ログインCTAを押した後だけ表示。ボタン文言は「確認メールを送る」にし、いきなりログイン感を弱めた。
  - Web診断からのhandoff時は「新規会員登録して保存する」文言に切り替わる。
- 新規画像アセット `apps/mobile/assets/onboarding-family-home.png` を追加。生成画像は `$HOME/.codex/generated_images/...` からworkspaceへコピー済み。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK、`expo export --platform android --output-dir /tmp/oyano-mobile-export-onboarding-redesign` OK。画像込みでAndroid bundle export成功。
- 変更はcommit `eca2dac Redesign mobile onboarding entry` としてGitHubへpush済み。
- Android preview build 8回目 `88992d8f-696f-412b-ba57-82c4530ac2a3` は成功。
- APK URL: `https://expo.dev/artifacts/eas/sxcQtUuqioui1sjfYsQxIK1ya3jtF7vODLRa9TTq_uw.apk`
- Install page: `https://expo.dev/accounts/oyanomosimonavi/projects/oyano-moshimo-navi/builds/88992d8f-696f-412b-ba57-82c4530ac2a3`
- `adb devices` は空で、Android実機がMacに接続されていない状態。端末を再接続できたら、このAPKを入れて新オンボーディングを実機確認する。

## 2026-07-08 追記 1

- ユーザーがAndroid実機を再接続。`adb devices` で端末 `42545251` を認識。
- Android preview build 8回目のAPK `/tmp/oyano-moshimo-preview-onboarding.apk` をdownloadし、`adb install -r` で実機インストール成功。
- `adb shell monkey -p jp.beech.oyanomoshimo -c android.intent.category.LAUNCHER 1` で起動し、スクリーンショット `/tmp/oyano_onboarding_check.png` を取得。
- 新オンボーディングは表示されたが、Stack headerがまだ「ログイン」と出ていたため、`apps/mobile/app/_layout.tsx` の `(auth)/welcome` titleを「はじめに」に変更。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK。
- Header修正はcommit `09184af Rename mobile onboarding header` としてGitHubへpush済み。
- Android preview build 9回目 `5ba4867a-ccba-4158-97c7-22e9f9c7d2ef` は成功。
- APK URL: `https://expo.dev/artifacts/eas/e9DQDqqgLDRCNTygKaaa77kaaErXABJkO4mxiURjKS8.apk`
- Install page: `https://expo.dev/accounts/oyanomosimonavi/projects/oyano-moshimo-navi/builds/5ba4867a-ccba-4158-97c7-22e9f9c7d2ef`
- APKを `/tmp/oyano-moshimo-preview-onboarding-header.apk` にdownloadし、Android実機 `42545251` へ `adb install -r` で上書きインストール成功。
- 起動後スクリーンショット `/tmp/oyano_onboarding_header_check.png` を取得し、ヘッダーが「はじめに」、上部に写真ヒーロー、本文に「このアプリでできること」が表示されることを確認。初回表示でメール入力やログイン要求は出ない。
- 次: ユーザー確認後、会員登録CTA押下時のメール入力表示、見本で開く、Magic Link送信、Web診断handoffを実機で順番に確認する。

## 2026-07-08 追記 2

- ユーザーから「アプリ立ち上げたら家族ボードにいく」と報告あり。Androidが前回のDashboardルートを復元している可能性が高く、未ログイン初回導線として不適切。
- `apps/mobile/lib/demoSession.ts` を追加。`activateDemoSession()` / `isDemoSessionActive()` で、その起動中にユーザーが「まず見本を見る」を押した場合だけDashboard表示を許可する。
- `apps/mobile/app/(auth)/welcome.tsx` の `continueDemo()` で `activateDemoSession()` を呼ぶように変更。
- `apps/mobile/app/(tabs)/_layout.tsx` に入口ガードを追加。Supabaseログイン済み、または同一起動中の見本セッションだけTabsを表示し、未ログインで前回Dashboardが復元された場合は `/(auth)/welcome` へ戻す。
- 確認: `pnpm --filter mobile run typecheck` OK、`pnpm run doctor:mobile-build` OK、`expo export --platform android --output-dir /tmp/oyano-mobile-export-entry-guard` OK。
- 次: commit/push後、Android preview buildを作成し、実機へ再インストールして「普通に起動すると入口」「見本を見るを押すと家族ボード」を確認する。

## 2026-07-08 追記 3

- ユーザーから「ここまでの設計をプレビューしてもらうから資料だして」と依頼あり。
- 最初に利用者向けの簡易プレビュー資料 `outputs/oyano_moshimo_preview_brief.md` を作成したが、ユーザーから「開発内容も全部みてもらう。エンジニアに」と訂正あり。
- エンジニアレビュー用資料 `outputs/oyano_moshimo_engineer_review_packet.md` を追加。
- 内容は、リポジトリ構成、Web/App/Supabase/通知/RLS/RPC/決済/セキュリティ/環境変数/確認コマンド/未完了/レビュー観点/読む順番を含む。
- この資料をエンジニアに渡せば、画面だけでなく実装・設計全体をレビューできる。

## 2026-07-08 追記 4

- 外部レビューで、要配慮個人情報の同意設計、service role/admin API認可、handoff token設計、PMF前のネイティブ負荷が指摘された。
- 判断: 指摘は概ね妥当。Expoは捨てずに既存検証用として維持し、追加開発は抑制。Web課金検証と家族3組テストを優先する。
- 即時対応:
  - `packages/shared/src/index.ts` の `createHandoffToken()` を `Math.random()` から `globalThis.crypto.getRandomValues()` ベースに変更。
  - `case_results.app_handoff_consumed_at` を追加するため、`supabase/schema.sql` と `supabase/handoff_security_hardening.sql` を追加/更新。
  - `/api/handoff/consume` は24時間以内・未消費handoffだけ受け付け、consume時に `app_handoff_consumed_at` を先に更新。二重consumeは409。
  - `apps/web/lib/adminAuth.ts` は `?adminToken=` 受付を廃止し、`x-admin-token` headerのみ。比較は `crypto.timingSafeEqual`。
  - `/api/cron/send-due-notifications` は `?cronToken=` 受付を廃止し、`Authorization: Bearer <CRON_SECRET>` のみ。比較は `crypto.timingSafeEqual`。
  - `supabase/README.md` と `docs/PRODUCTION_CHECKLIST.md` に `handoff_security_hardening.sql` を反映。
  - `outputs/oyano_moshimo_review_response.md` を追加し、外部レビューへの対応方針と残課題を整理。
- 確認:
  - `pnpm --filter web run build` OK。
  - 初回 `pnpm run typecheck` は並列build中の `.next/types` 作り直しと衝突してTS6053で失敗。Web build完了後に単独再実行し、`pnpm --filter web run typecheck` OK、`pnpm --filter mobile run typecheck` OK。
  - `pnpm run doctor:mobile-build` OK。
- 重要残タスク:
  - 本番Supabaseに `supabase/handoff_security_hardening.sql` を投入する。
  - Vercelへ再deployする。
  - Adminを静的tokenから個別管理者認証へ移行する設計を決める。
  - 要配慮個人情報の同意設計を法務レビュー前に具体化する。

## 2026-07-08 追記 5

- 外部レビューの最優先指摘「要配慮個人情報の同意設計」をWeb診断に実装。
- `packages/shared/src/index.ts` に `SENSITIVE_INFO_CONSENT_VERSION` / `SENSITIVE_INFO_CONSENT_TEXT` と `DiagnosisAnswers.consentToSensitiveInfo` / `consentTextVersion` を追加。
- `apps/web/app/diagnosis/DiagnosisForm.tsx` で、要配慮情報に該当し得ることの理解と、本人に説明できる場合は説明したうえで必要最小限だけ入力する旨の同意を送信データに含めるよう変更。画面上のチェックボックスは既存の必須チェックを利用。
- `apps/web/app/api/cases/[caseId]/diagnosis/route.ts` で `consentToSensitiveInfo` をAPI側でも必須化。未同意の場合は400。Supabase保存時に `cases.consent_to_sensitive_info`、`sensitive_info_consent_version`、`sensitive_info_consented_at` を保存し、`consent_logs` に同意種別、同意文言、IP、User-Agentを記録。
- `apps/web/lib/store.ts` のローカルデモ診断にも同意項目を追加。
- `supabase/schema.sql` に同意保存カラムを追加。既存本番DB向けに `supabase/sensitive_info_consent_hardening.sql` を追加。
- `supabase/README.md` と `docs/PRODUCTION_CHECKLIST.md` に `sensitive_info_consent_hardening.sql` の投入手順を追加。
- `docs/PRIVACY_AND_REVIEW_GUARDRAILS.md` と `outputs/oyano_moshimo_review_response.md` に実装済み同意記録を追記。
- 確認:
  - `pnpm --filter web run typecheck` は環境PATHの都合で、Codex同梱NodeをPATHに追加して実行しOK。
  - `pnpm --filter mobile run typecheck` OK。
  - `pnpm --filter web run build` OK。
  - `pnpm run doctor:mobile-build` OK。
- 重要残タスク:
  - 本番Supabaseに `supabase/handoff_security_hardening.sql` と `supabase/sensitive_info_consent_hardening.sql` を投入する。
  - Vercelへdeploy後、本番Web診断で `cases.consent_to_sensitive_info = true` と `consent_logs` 作成を実弾確認する。
  - 親本人が同意できない場合の法的整理は弁護士レビューで最終確認する。

## 2026-07-08 追記 6

- 同意実装に合わせて、Webの法務ページを本番寄りに更新。
- `apps/web/app/legal/privacy/page.tsx`:
  - `SENSITIVE_INFO_CONSENT_VERSION` / `SENSITIVE_INFO_CONSENT_TEXT` を表示し、診断画面で保存する同意ログとプライバシーポリシーの文言を揃えた。
  - Supabase本番リージョンを `Northeast Asia (Tokyo)` と明記。
  - アカウント削除依頼について、原則30日以内に削除処理または継続確認の連絡を行う旨を追加。
- `apps/web/app/legal/terms/page.tsx`:
  - 親本人の情報を入力する場合、本人に説明できる状態なら利用目的・家族内共有範囲を説明し、難しい場合は必要最小限に限る旨を追加。
- 確認:
  - `pnpm --filter web run build` OK。
  - 並列実行した初回 `pnpm --filter web run typecheck` は、Next buildが `.next/types` を再生成したタイミングと衝突してTS6053。build完了後に単独再実行しOK。
- 次:
  - 本番SupabaseのSQL投入を済ませたら、本番Web診断で同意ログが作られるか確認する。

## 2026-07-08 追記 7

- 本番Supabaseに後追い投入が必要なSQLを1本にまとめた。
- 追加ファイル: `supabase/production_pending_hardening.sql`
  - `case_results.app_handoff_consumed_at` 追加
  - `idx_case_results_handoff_valid` 追加
  - `cases.consent_to_sensitive_info` / `sensitive_info_consent_version` / `sensitive_info_consented_at` 追加
  - `idx_consent_logs_case_type` 追加
- `supabase/README.md` に、既存本番DBへ後追いhardeningだけ入れる場合は `production_pending_hardening.sql` を実行する旨を追記。
- `docs/PRODUCTION_CHECKLIST.md` に一括SQLの投入項目を追加。個別SQLは一括SQLを使わない場合だけ実行する扱い。
- 次:
  - ユーザーがSupabase SQL Editorで `supabase/production_pending_hardening.sql` を投入。
  - Vercelの自動deploy完了後、本番 `/diagnosis` から診断送信し、`cases` と `consent_logs` を確認する。

## 2026-07-08 追記 8

- Supabase確認SQLを更新。
- `supabase/verify_setup.sql` と `supabase/verify_compact.sql` に以下の確認を追加:
  - `case_results.app_handoff_consumed_at`
  - `cases.consent_to_sensitive_info`
  - `cases.sensitive_info_consent_version`
  - `cases.sensitive_info_consented_at`
  - `idx_case_results_handoff_valid`
  - `idx_consent_logs_case_type`
- これにより、`production_pending_hardening.sql` 投入後にSQL Editorで `ok=true` を確認できる。

## 2026-07-08 追記 9

- 本番Web診断とSupabase同意ログ保存を確認する専用スモークを追加。
- 追加ファイル: `scripts/smoke-production-consent.mjs`
  - `POST /api/cases/:caseId/diagnosis` に `consentToSensitiveInfo=true` のテスト診断を送信。
  - `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が環境変数にある場合、Supabase RESTで `cases.consent_to_sensitive_info`、`sensitive_info_consent_version`、`sensitive_info_consented_at`、`consent_logs` を確認。
  - Supabase keyがない環境ではWeb API送信確認だけ行い、DB直確認はskipする。
- `package.json` に `smoke:production-consent` を追加。
- `docs/PRODUCTION_CHECKLIST.md` に `pnpm smoke:production-consent https://oyano-moshimo-navi.vercel.app` を追加。
- 注意:
  - このスモークは本番DBにテストcaseを1件作成する。
  - 本番Supabaseに `production_pending_hardening.sql` を投入してから実行する。

## 2026-07-08 追記 10

- Admin case詳細で要配慮情報の同意状態を確認できるようにした。
- `apps/web/app/api/admin/cases/[caseId]/route.ts`:
  - `cases.consent_to_sensitive_info`
  - `cases.sensitive_info_consent_version`
  - `cases.sensitive_info_consented_at`
  - `consent_logs(id, consent_type, consent_text, created_at)`
  を取得して `AdminCaseDetail` に含める。
- `apps/web/app/admin/cases/[id]/page.tsx`:
  - case上部に「要配慮情報の同意」「同意バージョン」「同意日時」を表示。
  - `consent_logs` がある場合は「同意履歴」テーブルを表示。
- 確認:
  - `pnpm --filter web run typecheck` OK。
  - `pnpm --filter web run build` OK。

## 2026-07-08 追記 11

- アカウント削除依頼の運用状態をAdminで管理できるようにした。
- `apps/web/app/api/admin/delete-requests/route.ts`:
  - GETで `metadata.status`、`metadata.handled_at`、`metadata.handled_note` を返す。
  - PATCHを追加し、Admin token付きで `requested` / `reviewing` / `needs_followup` / `completed` へ更新可能にした。
  - 実データ削除そのものは行わず、依頼対応ステータスだけを `audit_logs.metadata` に保存する。
- `apps/web/components/AdminDeleteRequests.tsx`:
  - 削除依頼一覧にstatus列と操作ボタン「確認中」「要確認」「完了」を追加。
  - 更新後に一覧を再読み込みする。
- `apps/web/app/globals.css`:
  - Admin表内の小さい操作ボタン用CSSを追加。
- 確認:
  - 初回typecheckはNext buildとの `.next/types` 再生成競合でTS6053。build完了後に単独再実行しOK。
  - `pnpm --filter web run build` OK。

## 2026-07-08 追記 12

- 外部レビューの「実家写真 + 空き家特定リスク」対応を実装。
- `apps/web/app/api/storage/home-photo-upload-url/route.ts`:
  - Bearer token必須化。
  - Supabase Auth tokenからユーザーを確認。
  - `homeId -> homes -> people.family_id -> family_members.user_id` を確認し、同じfamily memberだけsigned upload URLを発行。
  - 許可MIMEは `image/jpeg` / `image/png` / `image/webp` のみ。
  - `fileSizeBytes` がある場合は10MB超を拒否。
  - レスポンスに「外観、表札、住所、鍵番号を避ける」「位置情報を削除する」警告を含める。
- `supabase/storage_setup.sql`:
  - 新規DBでは `home photos upload authenticated` の広いinsert policyを作らないよう削除。
- `supabase/home_photo_security_hardening.sql`:
  - 既存DB向けに `home photos upload authenticated` policyをdropするSQLを追加。
- `supabase/production_pending_hardening.sql`:
  - 上記Storage policy dropも一括hardeningに追加。
- `apps/mobile/app/people/[id]/home.tsx`:
  - 写真管理カードに、表札、住所、鍵番号、郵便物、車のナンバー、空き家と分かる外観写真、位置情報への注意を追加。
- `docs/PRIVACY_AND_REVIEW_GUARDRAILS.md`、`docs/PRODUCTION_CHECKLIST.md`、`supabase/README.md` を更新。
- 確認:
  - `pnpm --filter mobile run typecheck` OK。
  - `pnpm --filter web run build` OK。
  - 初回Web typecheckはNext buildとの `.next/types` 再生成競合でTS6053。build完了後に単独再実行しOK。
- 注意:
  - 写真のEXIF/GPS除去をサーバー側で実際に処理する機能は未実装。現時点では注意表示とアップロード権限強化まで。

## 2026-07-08 追記 13

- 家族代表が亡くなった/使えなくなった場合の承継MVPを実装中。
- 方針:
  - 既存の家族メンバーを後から共同管理者にできる。
  - 直接owner招待は作らない。まず通常メンバーとして招待し、信頼できる人だけ昇格する。
  - 代表者の降格/自動交代はMVPでは作らない。誤操作で管理者不在になるリスクを避ける。
  - `families.owner_user_id` はprimary ownerとして残す。
  - Free招待枠は `role <> owner` ではなく、primary owner以外の人数で数える。共同管理者昇格で無料枠をすり抜けないため。
- 追加/更新:
  - `supabase/family_owner_succession.sql` を追加。
    - `promote_family_member_to_owner(p_family_member_id uuid)` RPCを作成。
    - 呼び出し元は同familyの `owner/admin` のみ。
    - 対象memberを `role='owner'` に更新。
    - `families.owner_user_id` がnullなら補完する。
  - `supabase/family_invite_rpc.sql` を更新。
    - Free上限の人数計算を `families.owner_user_id` 以外のfamily_members + 7日以内pending invites に変更。
  - `apps/mobile/lib/mobileData.ts` に `promoteFamilyMemberToOwner` を追加。
  - `apps/mobile/app/people/[id]/family.tsx` に共同管理者ボタンを追加。
    - 現在ログイン中のmemberが `owner/admin` の時だけ表示。
    - 変更は楽観更新し、失敗時rollback。
  - `docs/FAMILY_SUCCESSION_POLICY.md` を追加。
  - `supabase/README.md`、`docs/PRODUCTION_CHECKLIST.md`、`scripts/local-doctor.mjs`、`supabase/verify_setup.sql`、`supabase/verify_compact.sql` を更新。
- 次に必要:
  - TypeScript/build/doctorを実行済み。
  - 問題なければcommit/push。
  - 本番Supabaseには `family_invite_rpc.sql` の再実行と `family_owner_succession.sql` の実行が必要。
- 確認:
  - `pnpm --filter mobile run typecheck` OK。
  - `pnpm --filter web run build` OK。
  - `pnpm --filter web run typecheck` OK。
  - `pnpm run doctor:local` OK。
  - `pnpm run doctor:mobile-build` OK。
  - `git diff --check` OK。

## 2026-07-08 追記 14

- 外部レビューで指摘された handoff token / Magic Link redirect の安全性をさらに強化中。
- 変更:
  - `packages/shared/src/index.ts`:
    - 新規 `createHandoffToken` からcaseId断片を削除。
    - 以後のtokenは `handoff_` + 48桁hexランダム値。
    - 既存tokenはサーバー側正規表現で引き続き受け付ける。
  - `apps/web/app/api/handoff/consume/route.ts`:
    - DB照会前にcaseId UUID形式とhandoff token形式を検証。
    - 不正形式は404で返す。
  - `apps/mobile/lib/auth.ts`:
    - Magic Linkの `emailRedirectTo` をアプリ内許可パスへ制限。
    - 許可: `/(tabs)/dashboard`、`/invite?token=...`、`/handoff?caseId=...&token=...`
    - 許可外はdashboardへfallback。
  - `apps/web/app/result/[caseId]/page.tsx`:
    - local recordにhandoff tokenがない場合、予測可能なダミーtokenリンクを出さない。
  - `docs/PRIVACY_AND_REVIEW_GUARDRAILS.md`:
    - Webからアプリへの引き継ぎガードレールを追記。
- 次:
  - TypeScript/build/doctorを実行済み。
  - 問題なければcommit/push。
- 確認:
  - `pnpm --filter mobile run typecheck` OK。
  - `pnpm --filter web run build` OK。
  - `pnpm --filter web run typecheck` OK。
  - `pnpm run doctor:local` OK。
  - `pnpm run doctor:mobile-build` OK。
  - `git diff --check` OK。

## 2026-07-08 追記 15

- 外部レビューで指摘された service role key / Admin API の認可を強化中。
- 方針:
  - Admin APIは `SUPABASE_SERVICE_ROLE_KEY` を使うため、RLSではなくAPI側で認可する。
  - 正式ルートとしてSupabase Authの個別管理者を追加。
  - `family_members.role='admin'` かつ `relationship='app_admin'` のユーザーだけAdmin APIを使える。
  - 既存の `ADMIN_ACCESS_TOKEN` + `x-admin-token` は暫定fallbackとして残す。
- 変更:
  - `apps/web/lib/adminAuth.ts`:
    - `Authorization: Bearer <Supabase session access token>` を受け取り、`supabase.auth.getUser` でユーザー確認。
    - `family_members` に `role=admin` / `relationship=app_admin` があれば許可。
    - fallbackで既存 `x-admin-token` も許可。
  - Admin API routesを `await verifyAdminRequest` に更新。
  - `apps/web/app/api/admin/delete-requests/route.ts`:
    - PATCH時に `handled_by_user_id` / `handled_by_email` / `handled_by_method` をmetadataへ保存。
  - `apps/web/components/AdminDeleteRequests.tsx`:
    - 処理者列を追加。
  - `docs/ADMIN_AUTH_POLICY.md`:
    - app_admin作成SQLと運用方針を追加。
- 次:
  - TypeScript/build/doctorを実行済み。
  - 問題なければcommit/push。
- 確認:
  - `pnpm --filter web run build` OK。
  - 初回 `pnpm --filter web run typecheck` はNext build前の `.next/types` 競合でTS6053。build後に単独再実行しOK。
  - `pnpm --filter mobile run typecheck` OK。
  - `pnpm run doctor:local` OK。
  - `pnpm run doctor:mobile-build` OK。
  - `git diff --check` OK。

## 2026-07-08 追記 16

- エンジニア監査用に、最新commit `97a19bd` のrepo zipを `git archive` で作成。
- 作成先:
  - `review_exports/oyano-moshimo-navi-code-review-97a19bd.zip`
- 内容:
  - Git管理されているソースコード、SQL、docsのみ。
  - `.env.local`、`node_modules`、`.next`、Expo cacheなどは含まない。
- 用途:
  - RLS、handoff、admin認可、通知冪等性、Storage権限、App Store審査リスクのコード監査。
- 注意:
  - `review_exports` はGit管理外。一時共有用の成果物。

## 2026-07-08 追記 17

- コード監査レポート `親のもしもナビ_コード監査_2026-07-08.md` を確認。
- 監査評価:
  - handoff、要配慮同意、実家写真、owner承継、admin認可、RLS、秘密情報、Magic Link redirect、Stripe署名、cron secretは概ね良好。
- 即対応した指摘:
  - 家族招待RPCの権限昇格穴。
    - `create_family_invite` は `owner/admin` のみ実行可能に変更。
    - `admin` 招待は `owner` のみに制限。
    - `viewer/member` は招待不可。
    - `accept_family_invite` で既存owner/adminが招待受諾により低いroleへ落ちる事故を防止。
  - 通知cronの二重送信リスク。
    - `claim_due_scheduled_notifications(p_limit int)` RPCを追加。
    - cronは送信前に `scheduled -> sending` へclaimしてからExpo Push送信。
    - Expo送信全体が失敗した場合はclaim行を `scheduled` に戻す。
    - 成功時は `sending` の行だけ `sent` に更新。
  - Stripe webhookのリプレイ対策。
    - `stripe-signature` のtimestampが5分以内であることを確認。
- 更新ファイル:
  - `supabase/family_invite_rpc.sql`
  - `supabase/notification_delivery_hardening.sql`
  - `supabase/production_pending_hardening.sql`
  - `apps/web/app/api/cron/send-due-notifications/route.ts`
  - `apps/web/app/api/stripe/webhook/route.ts`
  - `supabase/verify_setup.sql`
  - `supabase/verify_compact.sql`
  - `docs/PRODUCTION_CHECKLIST.md`
- 次:
  - 検証済み:
    - `pnpm --filter web run build`
    - `pnpm --filter web run typecheck`
    - `pnpm --filter mobile run typecheck`
    - `pnpm run doctor:local`
    - `pnpm run doctor:mobile-build`
    - `git diff --check`
  - 問題なければcommit/push。
  - 残る中程度指摘「削除依頼パイプライン」は次に設計して実装する。

## 2026-07-08 追記 18

- コード監査で残っていた中程度指摘「アカウント削除依頼がaudit_logsだけで、SLA/処理パイプラインが弱い」に対応中。
- 実装方針:
  - `audit_logs` は履歴として残しつつ、正規の処理キュー `account_delete_requests` を追加。
  - 依頼は原則30日以内対応として `due_at = now() + 30 days` をDBに持つ。
  - 同一ユーザーの未完了依頼は1件に制限し、再送時は既存依頼を更新。
  - Adminは `requested/reviewing/needs_followup/completed` を更新でき、状態変更は `audit_logs.action = account_delete_status_updated` に残す。
  - Admin UIではSLA列を表示し、期限超過を明示する。
- 変更ファイル:
  - `supabase/schema.sql`
  - `supabase/account_deletion_pipeline.sql`
  - `supabase/production_pending_hardening.sql`
  - `supabase/indexes.sql`
  - `supabase/production_rls.sql`
  - `supabase/verify_setup.sql`
  - `supabase/verify_compact.sql`
  - `supabase/README.md`
  - `scripts/local-doctor.mjs`
  - `apps/web/app/api/account/delete-request/route.ts`
  - `apps/web/app/api/admin/delete-requests/route.ts`
  - `apps/web/components/AdminDeleteRequests.tsx`
  - `apps/mobile/app/account/delete.tsx`
  - `apps/mobile/lib/account.ts`
  - `docs/PRODUCTION_CHECKLIST.md`
- 次:
  - 検証済み:
    - `pnpm --filter web run typecheck`
    - `pnpm --filter mobile run typecheck`
    - `pnpm run doctor:local`
    - `pnpm --filter web run build`
    - `pnpm run doctor:mobile-build`
    - `git diff --check`
  - 問題なければcommit/push。
  - 本番Supabaseには `account_deletion_pipeline.sql` を投入する必要あり。

## 2026-07-08 追記 19

- 次工程として、発動サポートパックのWeb/Stripe導線を事業検証向けに整理中。
- 背景:
  - 監査では「9,800円の支払意思を測ること」が重要と指摘あり。
  - 結果画面に「サポート依頼を作成」と「内容を確認して申し込む」が並ぶと、無料依頼と決済申込が混ざって転換率が濁る。
- 実装した変更:
  - 結果画面の発動サポートCTAを「内容を確認して申し込む」1本に統一。
  - `/support-pack` で連絡先メールと連絡同意を入力できるようにし、診断時に連絡先未入力でもStripeへ進める形にした。
  - `POST /api/stripe/checkout` はSupabase必須に変更し、存在する `case`、`result_ready/converted`、連絡先メール、連絡同意を確認してからCheckoutを作成。
  - Checkoutには `customer_email` とmetadataを入れ、caseの連絡先も更新する。
  - 旧 `POST /api/support-packs` は無料のrequested作成をやめ、Stripe Checkout誘導の410応答に変更。
  - Stripe success/cancelで戻った結果画面に受付/未完了メッセージを表示。
  - `/support-pack` の内部方針っぽい文言をユーザー向け文言へ修正。
  - `docs/STRIPE_SETUP.md` と `docs/PRODUCTION_ROADMAP.md` を現行導線に更新。
- 変更ファイル:
  - `apps/web/app/api/stripe/checkout/route.ts`
  - `apps/web/app/api/support-packs/route.ts`
  - `apps/web/app/result/[caseId]/page.tsx`
  - `apps/web/app/support-pack/SupportPackClient.tsx`
  - `apps/web/app/support-pack/page.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/lib/store.ts`
  - `docs/STRIPE_SETUP.md`
  - `docs/PRODUCTION_ROADMAP.md`
- 次:
  - 検証済み:
    - `pnpm --filter web run typecheck`
    - `pnpm run doctor:local`
    - `git diff --check`
    - `pnpm --filter web run build`
    - `node scripts/smoke-web.mjs http://127.0.0.1:3010`
  - 3000番は別Dockerプロセスが使っていたため、確認用にNext dev serverを `127.0.0.1:3010` で起動してsmokeした。
  - 問題なければcommit/push。

## 2026-07-08 追記 20

- 監査の軽微指摘「通知開封APIが実際の更新件数ではなく、リクエストID数を返している」に対応中。
- `POST /api/notifications/opened` の `scheduled_notifications` 更新に `select("id")` を付け、`opened_at is null` で実際に初回開封更新できた行数を `updated` として返す。
- レスポンスは `{ requested, updated }`。
- 次:
  - 検証済み:
    - `pnpm --filter web run typecheck`
    - `pnpm run doctor:local`
    - `git diff --check`
    - `pnpm --filter web run build`
  - 問題なければcommit/push。

## 2026-07-08 追記 21

- ユーザー要望: 「アプリの中身を見てみたい」。
- 現状:
  - Expo Metroを `apps/mobile` で起動中。
  - 起動URL: `http://localhost:8082`
  - ADBでAndroid端末 `42545251` / model `3917JR` が認識された。
  - `adb reverse tcp:8082 tcp:8082` 済み。
  - 端末にExpo Go (`host.exp.exponent`) は未インストールだった。
  - ADBでAndroid端末側にPlay StoreのExpo Goページ `market://details?id=host.exp.exponent` を開いた。
- 次:
  - ユーザーが端末でExpo Goをインストールする。
  - インストール後、`adb shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8082'` でアプリを開く。
  - まず「見本で開く」からDashboard/家族ボード/タスク/写真/設定を確認する。

## 2026-07-08 追記 22

- Android実機プレビューの続き。
- 実施したこと:
  - SDK51互換のExpo Go 2.31.2をADBで端末にインストール。
  - Metroを8082番で起動し、`adb reverse tcp:8082 tcp:8082` で端末から接続できるようにした。
  - pnpm workspace環境でMetroが `node_modules/.pnpm/.../expo-router/entry` をlaunchAssetに出してAndroid側で解決できない問題を確認。
  - `apps/mobile/index.js` を追加し、`apps/mobile/package.json` の `main` を `index.js` に変更。
  - `apps/mobile/metro.config.js` を追加し、workspace rootとnodeModulesPathsを明示。
  - `expo-notifications` のトップレベルimportを遅延読み込みに変更し、起動直後のネイティブモジュール初期化リスクを下げた。
- 現状:
  - Android向けmanifestは `index.bundle?platform=android` を返すところまで改善済み。
  - ただしExpo Go上では `UIManager` / `NativeModule` 周りのクラッシュが残り、端末プレビューは一旦深追い停止。
  - 次に実機で確実に見る場合はExpo Goではなく、`expo run:android` の専用dev buildに切り替える。
  - その前段で `spawn npm ENOENT` が出たため、`/private/tmp/npm` にpnpmへ委譲するnpm shimを作成済み。次に試すなら `chmod 755 /private/tmp/npm` してからPATHに入れて再実行する。
- 次:
  - ユーザーから「もう遅いからええわ次進んでくれ」と指示あり。
  - 実機プレビューは保留し、次はアプリ起動直後の入口を「いきなりログイン」ではなく、説明→新規会員登録/見本体験へ進む設計に作り替える。

## 2026-07-08 追記 23

- アプリ起動直後の入口を作り直し。
- 背景:
  - ユーザー指摘: 「いきなりメールアドレス入力・ログインは抵抗がある」「会員登録はこちら、という誘導にしたい」「AIっぽく安っぽいデザインを避けたい」。
- 実装:
  - `apps/mobile/app/(auth)/welcome.tsx` を写真中心の落ち着いた入口に再構成。
  - 既存素材 `onboarding-family-home.png` を冒頭に大きく表示。
  - 初期表示ではメール入力を出さず、まず趣旨説明、`ここから新規会員登録`、`登録前に見本を見る`、`登録済みの方はログイン` を明確化。
  - 会員登録/ログインを押した後だけメール入力パネルを表示。
  - Web診断からアプリへ来た場合、Magic Linkのredirectに `/handoff?caseId=...&token=...` を載せるよう修正。登録後に診断結果を失わない。
  - Expo Go調査で入れた起動安定化差分:
    - `apps/mobile/index.js` 追加。
    - `apps/mobile/package.json` の `main` を `index.js` に変更。
    - `apps/mobile/metro.config.js` 追加。
    - `expo-notifications` を遅延importへ変更。
    - 動的importを通すため `apps/mobile/tsconfig.json` に `module: esnext` を明示。
- 検証:
  - `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH CI=true pnpm --filter mobile run typecheck` 成功。
- 注意:
  - `review_exports/oyano-moshimo-navi-code-review-97a19bd.zip` は未追跡の監査用zip。今回のアプリ入口改善コミットには混ぜない。

## 2026-07-08 追記 24

- ログイン後の最初の画面「家族ボード」を整理。
- 実装:
  - `apps/mobile/app/(tabs)/dashboard.tsx` の英語見出し `Family tasks` を廃止。
  - 冒頭を `家族ボード` + 対象者ステータス + `○○さんの今` に変更。
  - `今日見るところ` として、`今日まで`、`7日以内`、`担当未定` の3指標を上部に集約。
  - タスク一覧の各セクションにアイコンを追加し、低頻度・高重要度アプリらしく「どこを見るか」がすぐ分かる構成に変更。
  - 期限表示を日付そのものではなく、`今日まで`、`n日後`、`n日超過` と読める表現に変更。
- 検証:
  - `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH CI=true pnpm --filter mobile run typecheck` 成功。

## 2026-07-08 追記 25

- 家族ボードから遷移するタスク画面も整理。
- 実装:
  - `apps/mobile/app/people/[id]/tasks.tsx` の英語見出しを廃止。
  - 上部に `すべて`、`今日まで`、`7日以内`、`担当未定` のフィルタタブを追加。
  - タスクカードの右上に `今日まで`、`n日後`、`n日超過` の期限バッジを表示。
  - 担当チップにアイコンを追加し、割当済み/担当未定が視覚的に分かるようにした。
  - 優先度を数字ではなく `重要`、`高め`、`通常` の表示へ変更。
- 検証:
  - `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH CI=true pnpm --filter mobile run typecheck` 成功。

## 2026-07-08 追記 26

- 家族共有画面を整理。
- 実装:
  - `apps/mobile/app/people/[id]/family.tsx` をスクロール可能に変更。小さいAndroid端末でも招待フォームとメンバー一覧が切れないようにした。
  - `Family` の英語見出しを廃止し、`家族で同じボードを見る` に変更。
  - 無料招待枠の説明カードを追加。オーナー以外2名まで無料、3人目以降/複数親管理はFamily Plusという線引きを画面上でも明確化。
  - 招待前にメール形式の簡易チェックを追加。
  - 招待リンク作成後は送信用リンクを枠内に表示し、`LINEやメールで送る` ボタンをアイコン付きで明示。
  - メンバー一覧に頭文字アバターを追加し、共同管理者ボタンを短くして小画面でも収まりやすくした。
- 検証:
  - `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH CI=true pnpm --filter mobile run typecheck` 成功。

## 2026-07-08 追記 27

- 情報登録と実家カルテを整理。
- `apps/mobile/app/people/[id]/assets.tsx`:
  - 既存の `asset_items` スキーマに合わせ、カテゴリ、有無、項目名、保管場所、分かる人メモを登録できるようにした。
  - `asset_categories` をSupabaseから取得し、未接続時はフォールバックカテゴリを表示。
  - 保存済み項目の一覧を追加。保存後に再読込して画面上で確認できる。
  - 暗証番号、パスワード、マイナンバー画像、本人確認書類画像を保存しない注意を画面上に明示。
- `apps/mobile/app/people/[id]/home.tsx`:
  - 英語見出しを廃止し、実家カルテの目的を「離れていても状況が分かるように」に変更。
  - 写真で残す場所のチェックリストを追加。
  - 空き家特定リスクを避けるため、表札・住所・郵便物・車のナンバー・位置情報への注意を明示。
  - 保管場所メモ追加への導線を主ボタン化。
- 検証:
  - `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH CI=true pnpm --filter mobile run typecheck` 成功。

## 2026-07-08 追記 28

- 通知設定と設定タブを整理。
- `apps/mobile/app/notifications.tsx`:
  - 英語見出しを廃止し、`必要な時だけ知らせる` に変更。
  - 「同じ日の通知はまとめる」「通知を増やしすぎない」方針を画面上に明示。
  - 期限リマインド、端末通知登録、月1回確認、重要な連絡をカード化し、アイコン付きで整理。
  - 小さい端末でも切れないようScrollView化。
- `apps/mobile/app/(tabs)/settings.tsx`:
  - 英語見出しを廃止し、通知、プライバシー、削除依頼、プラン状態をアイコン付きメニューに整理。
  - 設定画面から迷わず各詳細画面へ入れるようにした。
- 検証:
  - `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH CI=true pnpm --filter mobile run typecheck` 成功。

## 2026-07-08 追記 29

- プラン画面と削除依頼画面を整理。
- `apps/mobile/app/(tabs)/plan.tsx`:
  - 英語見出しを廃止し、現在の利用状態確認に特化。
  - Freeの範囲、Family Plusで扱う範囲、発動サポートパックの状態表示方針を整理。
  - App Store審査対策として、アプリ内に外部決済への案内を置かない文言に統一。
- `apps/mobile/app/account/plan.tsx`:
  - 利用状態の詳細を表形式で表示。
  - 発動サポートパックは `未申込または状態未取得` など状態表示のみ。
  - 外部決済リンクやWeb申込案内は入れていない。
- `apps/mobile/app/account/delete.tsx`:
  - 連絡先メールの形式チェックを追加。
  - 原則30日以内確認、削除対象、保存対象外情報の注意をカード化。
  - 送信ボタンをアイコン付きにし、小画面でも読める構成へ変更。
- 検証:
  - `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH CI=true pnpm --filter mobile run typecheck` 成功。
