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

## 最新状況 2026-08-21

- ユーザー要望: 「レビューしてもらうから資料だして」。
- 直近のプロダクト判断:
  - 初期の `Web入口 + Expo継続アプリ` 方針から、現在は **PWA/アプリのみで完結する家族の手帳** へ寄せている。
  - 1人目は無料でしっかり価値を出す。2人目以降、家族共有、写真/PDF容量、AI相談、月次まとめを有料候補にする。
  - 対象者は父母固定ではなく、義父母、親戚、その他も1人ずつ管理する。
  - 1人目登録後は、その人専用のマイページ/手帳で、プロフィール、日々の記録、写真/PDF、確認リスト、過去のまとめ、アラート、AI相談へつなげる。
- 直近の強い未解決要望:
  - `/home` の「確認リスト」項目、特に「緊急連絡先と看取り方針を共有する」のような1件を編集できるようにしたい。
  - プロフィールの変更方法、過去の記録の見方が分かりにくい。
  - 日々の記録からAI診断/予測、過去記録まとめ、アラート、確認リスト追加へつながる“本当の手帳”体験が必要。
  - Petterの「私のうちの子ログ」のように、日々の変化を蓄積して見返せる体験を参考にする。
- レビュー用資料を作成済み:
  - フォルダ: `review_exports/oyano_moshimo_review_2026-08-21/`
  - `review_exports/oyano_moshimo_review_2026-08-21/README_REVIEW_2026-08-21.md`
  - `review_exports/oyano_moshimo_review_2026-08-21/ENGINEER_REVIEW_BRIEF_2026-08-21.md`
  - `review_exports/oyano_moshimo_review_2026-08-21/PRODUCT_UX_REVIEW_BRIEF_2026-08-21.md`
  - `review_exports/oyano_moshimo_review_2026-08-21/REVIEW_CHECKLIST_2026-08-21.md`
  - ソースZIP: `review_exports/oyano_moshimo_review_2026-08-21/oyano-moshimo-navi-source-2026-08-21-38e65f3.zip`
- ZIP作成:
  - `git archive --format=zip -o review_exports/oyano_moshimo_review_2026-08-21/oyano-moshimo-navi-source-2026-08-21-38e65f3.zip HEAD`
  - `unzip -l ... | grep -Ei '(^|/)(\\.env|\\.env\\.local|env\\.local|secret|service_role|SUPABASE_SERVICE_ROLE_KEY)' || true`
  - 結果: `.env.example` 以外の秘密系ファイルは検出なし。
- 次に実装するなら:
  1. 確認リスト1件の詳細/編集画面を追加。
  2. プロフィールに明確な「編集する」導線を追加。
  3. 過去の記録タイムライン/検索/まとめを強化。
  4. 日記から確認リスト・アラート候補を作る。
  5. Plus候補としてAI相談の情報参照範囲と安全文言を設計。

## 最新状況 2026-08-20

- 2026-08-20 追加対応3: ユーザー要望「安心設計ページの意味が薄い」「読む記事を100本程度へ増やして検索絞り込み」「先頭の漢字アイコンがダサい」に対応中。
- 判断:
  - `安心設計` は削除せず、プライバシー/免責/App Store審査/要配慮情報の説明として残す。ただし通常ユーザーの主導線ではないため、ヘッダーナビからは外し、フッターの `安全方針` に下げる。
  - `読む` は少数記事の一覧では価値が弱いため、100本の無料ガイド + 検索 + カテゴリ絞り込みへ変更。
  - 診断対象者選択の丸い漢字アイコンは廃止し、キャラマーク + 色ドットへ変更。
- 変更ファイル:
  - `apps/web/lib/guides.ts`
  - `apps/web/components/GuideSearch.tsx`
  - `apps/web/app/guides/page.tsx`
  - `apps/web/app/guides/[slug]/page.tsx`
  - `apps/web/app/diagnosis/DiagnosisForm.tsx`
  - `apps/web/app/home/page.tsx`
  - `apps/web/app/layout.tsx`
  - `apps/web/app/plans/page.tsx`
  - `apps/web/app/safety/page.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/public/sw.js`
- 実装内容:
  - ガイド記事を100本生成する構造へ変更。入院、退院後在宅、介護、看取り、死亡直後、葬儀後、相続前、実家じまいなどのステージと、連絡先、支払い、保険/年金、薬/通院、鍵/ライフライン、書類、役割分担、本人希望、写真/持ち物、親族連絡、専門家相談準備などのテーマを組み合わせる。
  - `/guides` をクライアント検索つきに変更。検索語、カテゴリチップ、表示件数、空状態を追加。
  - ガイド詳細に読了目安とタグを表示。
  - ヘッダーナビとホーム内の上部タブから `安心` を削除。フッター表示は `安全方針` に変更。
  - `/safety` は削除せず、利用者の主導線から下げたうえで、要配慮情報・免責・保存しない情報の説明ページとして残す。ページ名も `安心設計` から `安全方針` に変更。
  - 診断フォームの対象者アイコンを漢字から `/brand/watch-bird-mark.svg` ベースへ変更。
  - Service Worker cache versionを `oyano-moshimo-navi-v16` に更新。
- 検証:
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。`/guides/[slug]` は100本分生成されることを確認。
  - ローカル `http://localhost:3002/guides` / `http://localhost:3002/guides/hospital-care-window` / `http://localhost:3002/safety` はHTTP 200。
  - 注意: Supabase JSからNode 20非推奨警告あり。動作には影響なし。後日Node 22へ上げる。
- GitHub:
  - 実装コミット `9cf3ccb Improve guide library and simplify safety entry` を `main` へpush済み。
- 本番反映:
  - 最初に `apps/web` 直下で `npx vercel --prod --yes` を実行したところ、Vercel側の `npm install` が `Unsupported URL Type "workspace:"` で失敗。monorepo rootではないため。
  - リポジトリrootから `npx vercel --prod --yes` を再実行して成功。
  - Deployment ID: `dpl_DFaNCC6R23DC39LV3VrjwwFKLjt1`
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-bw8pz8zgc-dogwoodcommunity1.vercel.app`
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `npx vercel curl https://oyano-moshimo-navi.vercel.app/sw.js` で `oyano-moshimo-navi-v16` を確認。
- 次に見るなら:
  - iPhoneで `https://oyano-moshimo-navi.vercel.app/home?fresh=20260820` を開き、古いService Worker表示が残らないか確認。
- 2026-08-20 追加対応2: ユーザー要望「キャラを全面的に存在感出す」「家族が亡くなるまで使って良かったと思える機能性を補う」に対応し、`/home` をさらに手帳/伴走型へ強化。
- 変更ファイル:
  - `apps/web/app/home/page.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/lib/store.ts`
  - `apps/web/public/manifest.webmanifest`
  - `apps/web/public/sw.js`
- 実装内容:
  - キャラ `/brand/watch-bird-mark.svg` を、表紙、今日見るところ、次に備えること、今日の記録、気づきメモ、これからの道すじ、過去の手帳、プロフィール、写真・資料、Plus導線に配置。単なる装飾ではなく「次に何を見るか」を案内する役割にした。
  - 「今日見るところ」は急ぎ/確認/安心の2件に絞り、全画面を見なくてもよい設計にした。
  - 「次に備えること」を追加。日記未入力、プロフィール不足、本人希望未入力、書類・鍵・支払い確認、未割当タスクなどから次の一手を出す。
  - 「今日の記録」は、食事・水分、薬・服薬、体調、歩行・転倒、発言・気分、病院・介護先のチップを押すと記録欄に入る形にし、タップ対象が分かる説明をキャラ付きで追加。
  - 「気づきメモ」は、記録内容から次に備えること、家族に聞くことを出す。医療・法律・税務判断は断定しない注意文を維持。
  - 「これからの道すじ」を追加。状況登録、日々の記録、病院/介護/家族窓口、書類・鍵・写真、本人希望の共有という流れを、済/今/次で見えるようにした。
  - 「過去の手帳」に最近のまとめ、記録数、変化数、写真/PDF数、記録から見えるテーマタグを追加。
  - プロフィールを13項目へ拡張。家族構成、緊急連絡先、ケアで大事にしたいこと、会わせたい人・伝えたいことを保存できるようにした。充実度が低い場合は編集欄を自動で開く。
  - 「この手帳を家族で続ける」Plus導線を追加。家族共有、2人目以降、AI相談、月まとめを、1人目の手帳が育った後に広げる機能として提示。
  - PWA start_urlを `/home?source=pwa` に変更。
  - Service Worker cache versionを `oyano-moshimo-navi-v14` に更新。
- ローカル確認:
  - 確認用dev server: `http://localhost:3002/home?codexPreview=5`
  - iPhone相当390px幅で上部/中段/下部をin-app browser確認。横スクロールなし (`scrollWidth=clientWidth=390`)。
  - 登録済み状態で、表紙、今日見るところ、次に備えること、記録チップ、気づきメモ、これからの道すじ、過去の手帳、プロフィール編集、写真・資料、Plus導線が表示されることを確認。
- 最終確認/本番反映:
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。
  - 実装コミット `142f371 Make family notebook guided by mascot` を `main` へpush済み。
  - Vercel本番deploy OK。
    - Deployment ID: `dpl_JD451SZnbE34zB5BcJ2hgHWPQeCE`
    - Production URL: `https://oyano-moshimo-navi.vercel.app`
    - Deployment URL: `https://oyano-moshimo-navi-lar92adjn-dogwoodcommunity1.vercel.app`
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `https://oyano-moshimo-navi.vercel.app/sw.js` で `oyano-moshimo-navi-v14` を確認。
- 2026-08-20 追加対応: 添付の `Codex実装依頼書_home刷新.md` に沿って、`/home` を「採用案5a 藍の表紙」ベースの手帳型UIへ刷新。
- 変更ファイル:
  - `apps/web/app/home/page.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/app/layout.tsx`
- 実装内容:
  - 旧hero/LP的な見せ方、`board-stats`、`notebook-hero-preview`、大きなPlus導線を撤去。
  - `/home` 先頭を濃紺 `#24424E` の手帳カバーに変更。鳥ロゴ、対象者名、関係/状態、プロフィール導線、対象者タブ、手帳追加導線を配置。
  - 未登録時は「この画面が、その人専用の手帳になります。」カードと `1人目の手帳を作る` CTAに整理。
  - 登録済み時は「今日見るところ」「今日の記録」「気づきメモ」「過去の手帳」「プロフィール」「確認リスト」「写真・資料」の1カラム構成に整理。
  - 健康チップと日記入力を「今日の記録」カードに統合。保存ボタンを1つに集約。
  - 「AI」表現はPlus注記に寄せ、通常画面では「気づきメモ」として表示。
  - プロフィールは常時フォーム表示をやめ、4行サマリー + 編集detailsに圧縮。
  - タスクのミニカレンダーをやめ、日付つき行リストに変更。
  - 写真・資料は3列グリッドに変更。
  - `Shippori Mincho` を追加し、見出しに手帳らしい明朝系の質感を追加。
- 検証:
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。
  - ローカルdevは `http://localhost:3002/home` で起動確認。375px幅で未登録状態は横スクロールなし、CTA高さ58pxを確認。
  - 本番deploy OK。
    - Deployment ID: `dpl_5FtDYdf6tHoHmSkaVS7HPoEJs9MZ`
    - Production URL: `https://oyano-moshimo-navi.vercel.app`
    - Deployment URL: `https://oyano-moshimo-navi-rgqprslsr-dogwoodcommunity1.vercel.app`
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。主要ページ/APIは全て期待ステータスで通過。
- GitHub:
  - 実装コミット `65f4342 Refresh home notebook design` を `main` へpush済み。
- 注意:
  - in-app browserのlocalStorage注入が制限され、登録済み状態のブラウザ強制再現は未実施。ただしTypeScript/buildは通過し、登録済み分岐のJSX/CSSは実装済み。
- 現在の実装方針は、当初の「Web入口 + Expo継続アプリ」から、ユーザー判断により「PWA/アプリのみで完結する家族の手帳」へ寄せている。
- 本番URL: `https://oyano-moshimo-navi.vercel.app`
- GitHub: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`
- 直近のユーザー指摘:
  - スマホで変更がちゃんと表示されない。
  - ロゴが前のままに見える。
  - デザイン反映が不安定。
  - その後、iPhoneスクリーンショットでヘッダー左の旧ロゴ残骸らしい緑四角がまだ表示されていると指摘。
- 直近対応:
  - ヘッダーの旧四角ロゴを廃止し、critical CSSと通常CSSの両方で `/brand/watch-bird-mark.svg` を使うよう統一。
  - Service Workerを `oyano-moshimo-navi-v5` に更新。
  - `/home` などHTMLページをcache-firstから外し、network-firstに変更。
  - PWA登録時に `registration.update()` と `controllerchange` 自動リロードを追加。
  - 追加対応として、ヘッダーロゴをCSS疑似要素 `.brand::before` ではなく、実DOMの `<img src="/brand/watch-bird-mark.svg">` へ変更。
  - ヘッダーclassも `.brand` から `.app-brand` に変更し、古いCSSキャッシュの `.brand::before` が当たらないようにした。
  - Service Workerをさらに `oyano-moshimo-navi-v6` に更新。
- 直近コミット:
  - `89e79d9 Fix PWA logo and stale page cache`
  - `7277488 Replace cached header logo pseudo element`
- 直近本番デプロイ:
  - Deployment ID: `dpl_2eKp9rgi3aaLxFwz5a2zzBvVxqj3`
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-mria21kko-dogwoodcommunity1.vercel.app`
- 直近検証:
  - `npm run typecheck --workspace apps/web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace apps/web` OK。
  - `curl -I https://oyano-moshimo-navi.vercel.app/home` 200。
  - `curl -L https://oyano-moshimo-navi.vercel.app/sw.js` で `oyano-moshimo-navi-v6` を確認。
  - `curl -L https://oyano-moshimo-navi.vercel.app/` で header が `.app-brand` と `<img class="app-brand-logo" src="/brand/watch-bird-mark.svg">` になっていることを確認。
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
- 注意:
  - iPhone/PWA側で古いService Workerが残っている場合、タブまたはホーム画面PWAを一度閉じて開き直すと更新される。
  - `review_exports/` は未追跡のまま残っている。今回も触っていない。

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
- 2026-07-08にWeb入口LPを再調整。ユーザー指摘「AIっぽい」「入口がわかりにくい」を受け、`apps/web/app/page.tsx` のトップヒーローを実写系の `family-documents-hero.png` 背景に変更し、「ここからです」「状況を選んで整理する」を主導線として明示。4つの状況カードも `/start` へ直接つなぎ、「この状況で整理する」を追加。`apps/web/app/globals.css` に写真ヒーロー、白パネル、スマホ向け背景/余白調整を追加。検証: Web typecheck OK、Next build OK、`git diff --check` OK。
- 2026-07-08にExpo初回導線を再調整。`apps/mobile/app/(auth)/welcome.tsx` は、起動直後にメール入力を迫るのではなく「もっと詳しく使いたい方へ」から新規会員登録、登録せずWebで状況整理、登録前の見本確認を選べる構成に変更。会員登録後にできること、保存しない情報(暗証番号/パスワード/マイナンバー画像)も明示。`apps/mobile/app/(tabs)/settings.tsx` に「最初の説明を見る」を追加し、家族ボードへ直接入った場合でも初回説明へ戻れるようにした。App Store審査向けに `apps/mobile/app/(tabs)/plan.tsx` と `apps/mobile/app/account/plan.tsx` から「外部決済」などのユーザー画面文言を削除。検証: Mobile typecheck OK、mobile-build doctor OK、local doctor OK、`git diff --check` OK。
- 2026-07-08にWeb→アプリ引き継ぎをRPC化。従来の `/api/handoff/consume` はトークン消費後にfamily/person/tasksを作っていたため、途中失敗時に再試行不能になるリスクがあった。`supabase/handoff_consume_rpc.sql` の `consume_case_handoff` で、24時間以内・未消費tokenの検証、`case_results`/`cases` の行ロック、profile upsert、family/person/tasks作成、case converted更新、token消費を1トランザクション化。APIはBearer認証と入力検証後にRPCを呼ぶだけに変更。`production_pending_hardening.sql`、`supabase/README.md`、`verify_setup.sql`、`verify_compact.sql`、`scripts/local-doctor.mjs`、`docs/PRODUCTION_CHECKLIST.md` も更新。検証: Web typecheck OK、Mobile typecheck OK、local doctor OK、Next build OK、`git diff --check` OK。
- 2026-07-09に削除依頼Adminをhardening。`apps/web/app/api/admin/delete-requests/route.ts` は `completed` 更新時に10文字以上の処理メモを必須化し、`audit_logs.metadata.handled_note` に同じ内容を残す。`apps/web/components/AdminDeleteRequests.tsx` に処理メモ入力欄を追加し、完了時にメモなしで進めないUIにした。`apps/web/app/globals.css` にテーブル内textareaの固定スタイルを追加。検証: Web typecheck OK、Next build OK、local doctor OK、`git diff --check` OK。
- 2026-07-09にAdmin画面の認証送信を整理。`apps/web/lib/adminClientAuth.ts` を追加し、Admin API呼び出しは `oyano_admin_bearer_token` があれば `Authorization: Bearer ...` を優先、なければ暫定fallbackとして `oyano_admin_token` を `x-admin-token` で送る。`AdminTokenControl` は `app_admin access token` と `ADMIN_ACCESS_TOKEN fallback` の2欄に変更。Admin cases/support-packs/delete-requests/env/case詳細の重複 `adminHeaders()` を共通化。`docs/ADMIN_AUTH_POLICY.md` も更新。検証: Web typecheck OK、Next build OK、local doctor OK、`git diff --check` OK。

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

## 2026-07-09 追記 30

- GitHub push再開作業中。
- ローカル状態:
  - `main...origin/main [ahead 3]`
  - 未push commit:
    - `e6b27db Harden handoff consumption`
    - `a47442a Harden delete request handling`
    - `c912b9e Prefer app admin bearer auth`
  - `review_exports/` は未追跡。レビュー用出力なのでcommit対象外。
- `gh auth status` はまだ `token invalid`。GitHubブラウザ承認後、ユーザー側ターミナルで `Enter` を押して `gh auth login -h github.com` を完了させる必要あり。
- 認証完了後に実行すること:
  - `gh auth status`
  - `git push origin main`

## 2026-07-09 追記 31

- GitHub認証を復旧。
  - `gh auth status` で `dogwoodcommunity` のログインを確認。
  - `gh auth setup-git` を実行し、Git pushがGitHub CLI認証を使えるようにした。
- GitHub push完了。
  - `git push origin main` 成功。
  - push範囲: `2cf9933..19721f1`
  - 送信済みcommit:
    - `e6b27db Harden handoff consumption`
    - `a47442a Harden delete request handling`
    - `c912b9e Prefer app admin bearer auth`
    - `19721f1 Update session handoff for GitHub auth`
- 現在のローカル状態:
  - `main...origin/main` 同期済み。
  - `review_exports/` のみ未追跡。レビュー用出力なので未commitのまま保持。

## 2026-07-09 追記 32

- GitHub push後の本番確認を実施。
- Vercel smoke:
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app`
  - 公開ページ、主要APIの認可確認はOK。
  - Admin env APIは `ADMIN_ACCESS_TOKEN` 未指定のため401でSKIP。
- 本番同意ログsmoke:
  - `node scripts/smoke-production-consent.mjs https://oyano-moshimo-navi.vercel.app`
  - 診断case作成は成功。
  - DB検証は失敗。理由: 本番DBに `cases.consent_to_sensitive_info` カラムが存在しない。
  - 次にSupabase SQL Editorで `supabase/production_pending_hardening.sql` を実行する。最低限の個別対応なら `supabase/sensitive_info_consent_hardening.sql`。
- 実装:
  - `scripts/smoke-production-consent.mjs` が `.env.local` と `apps/web/.env.local` を自動読込するように変更。
  - 同意カラム未投入時は、実行すべきSQL名を明示して失敗するように変更。
- 次にやること:
  - Supabase SQL Editorで `production_pending_hardening.sql` を投入。
  - その後 `verify_compact.sql` を実行し、`cases.consent_to_sensitive_info`, `consume_case_handoff`, `claim_due_scheduled_notifications` がtrueか確認。
  - 再度 `node scripts/smoke-production-consent.mjs https://oyano-moshimo-navi.vercel.app` を実行。

## 2026-07-09 追記 33

- 本番Supabase hardening投入作業を開始。
- `supabase/production_pending_hardening.sql` をMacのクリップボードへコピー済み。
- ユーザー作業待ち:
  - Supabase SQL Editorを開く。
  - エディタを全消しして `⌘ + V`。
  - `Run` を押す。
- 成功後にやること:
  - `supabase/verify_compact.sql` をクリップボードへコピーして実行してもらう。
  - `cases.consent_to_sensitive_info`, `consume_case_handoff`, `claim_due_scheduled_notifications` がtrueか確認。
  - 本番同意ログsmokeを再実行。

## 2026-07-09 追記 34

- ユーザーがSupabase SQL Editorで `production_pending_hardening.sql` を実行。
- 実行結果: `Success. No rows returned`
- 次の確認作業:
  - `supabase/verify_compact.sql` をMacのクリップボードへコピー済み。
  - SQL Editorの中身を全消しして `⌘ + V`、`Run`。
  - `ok` が全てtrueか確認。
  - 特に `cases.consent_to_sensitive_info`, `consume_case_handoff`, `claim_due_scheduled_notifications` を見る。

## 2026-07-09 追記 35

- `verify_compact.sql` の結果をユーザーが確認。
  - `ok` は全部true。
  - 重要項目 `cases.consent_to_sensitive_info`, `consume_case_handoff`, `claim_due_scheduled_notifications` もtrue。
- 本番同意ログsmokeを再実行。
  - 診断APIは `persisted:true` で成功。
  - ただしDB上の `cases.consent_to_sensitive_info` がfalse、`sensitive_info_consent_version` がnull。
  - ローカルコード `apps/web/app/api/cases/[caseId]/diagnosis/route.ts` は同意カラムを書いているため、Vercel本番APIが古いデプロイを返している可能性が高い。
- `scripts/smoke-production-consent.mjs` を改善。
  - `persisted:true` を必須確認。
  - DBの実際のcase行を失敗メッセージに出す。
- 次にやること:
  - 改善commitをGitHubへpushし、Vercel再デプロイを待つ。
  - 再度 `node scripts/smoke-production-consent.mjs https://oyano-moshimo-navi.vercel.app` を実行。

## 2026-07-09 追記 36

- Vercel本番が2日前のデプロイで止まっていることを確認。
  - `vercel ls oyano-moshimo-navi` で最新Productionが2日前だった。
  - そのため、GitHub push済みの診断API修正が本番へ反映されていなかった。
- Vercel CLIで本番へ明示デプロイ。
  - `pnpm dlx vercel deploy --prod --yes`
  - Deployment ID: `dpl_9X1aaftb1c7bzHeH2scEuX1L4k2Z`
  - Production URL: `https://oyano-moshimo-navi-my7cxxbs8-dogwoodcommunity1.vercel.app`
  - Alias: `https://oyano-moshimo-navi.vercel.app`
  - Build/Deploy成功。
- 本番同意ログsmoke再実行。
  - `node scripts/smoke-production-consent.mjs https://oyano-moshimo-navi.vercel.app`
  - `OK diagnosis submitted`
  - `OK cases consent fields saved`
  - `OK consent_logs sensitive_info row saved`
- 本番Web smoke再実行。
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app`
  - 公開ページと主要API認可はOK。
  - Admin env APIは `ADMIN_ACCESS_TOKEN` 未指定のため401でSKIP。
- 次に残る本番化タスク:
  - Admin APIをapp_admin個別アカウントのBearer認証で確認。
  - Stripe関連env/商品/Webhookを設定。
  - Expo Magic Linkログイン、dashboard/person/tasks実データ読込、push token保存を実機確認。

## 2026-07-09 追記 37

- Admin APIのapp_admin Bearer認証を本番確認。
- 追加:
  - `scripts/smoke-admin-bearer.mjs`
- スモーク内容:
  - 本番Supabase Authに一時ユーザーを作成。
  - `profiles` をupsert。
  - 一時familyを作成。
  - `family_members.role='admin'` / `relationship='app_admin'` を作成。
  - Password grantで一時access tokenを発行。
  - `https://oyano-moshimo-navi.vercel.app/api/admin/env-check` に `Authorization: Bearer <token>` でアクセス。
  - Admin APIが200を返すことを確認。
  - 最後に一時familyと一時auth userを削除。
- 実行結果:
  - `OK admin env-check accepted app_admin Bearer token`
  - `OK temporary admin smoke data cleaned up`
- `docs/PRODUCTION_CHECKLIST.md` のAdmin Bearer確認を完了に更新。
- 注意:
  - これは一時ユーザーによる確認。実運用の恒久app_adminユーザー作成は、代表/運営メールが確定した後に `docs/ADMIN_AUTH_POLICY.md` の手順で作る。

## 2026-07-09 追記 38

- エンジニアレビュー依頼用の資料作成を開始。
- 追加予定:
  - `docs/ENGINEER_REVIEW_BRIEF_2026-07-09.md`
  - `docs/ENGINEER_REVIEW_CHECKLIST_2026-07-09.md`
- 目的:
  - コード、設計、RLS、handoff、Admin認可、通知、要配慮個人情報、Stripe未接続部分、Expoアプリ審査リスクをレビューしてもらう。
  - 最新コード一式のZIPも `review_exports/` に作成する。

## 2026-07-09 追記 39

- エンジニアレビュー依頼用の資料を作成完了。
- 追加済み資料:
  - `docs/ENGINEER_REVIEW_BRIEF_2026-07-09.md`
  - `docs/ENGINEER_REVIEW_CHECKLIST_2026-07-09.md`

## 2026-07-09 追記 40

- 外部コード監査結果を受けてCritical/Highを先に修正。
- Admin APIのBearer認証を `family_members.role='admin'` / `relationship='app_admin'` から `app_admins` 専用テーブルへ分離。
  - `apps/web/lib/adminAuth.ts` はBearer tokenのSupabase userを確認後、`app_admins.user_id` だけを見る。
  - `supabase/schema.sql` / `production_rls.sql` / `production_pending_hardening.sql` に `app_admins` と新しい `is_app_admin()` を追加。
  - 既存本番DB向けに `supabase/admin_auth_hardening.sql` を追加。これを本番Supabase SQL Editorで実行する必要あり。
  - `scripts/smoke-admin-bearer.mjs` は一時family/family_membersを作らず、一時auth user + profile + `app_admins` 行でAdmin APIを確認する形へ変更。
- 家族招待RPCの防御を強化。
  - `create_family_invite` は `relationship='app_admin'` を予約語として拒否。
  - `accept_family_invite` は招待先メールとログインユーザーのAuth email一致を必須化。
  - 受諾時にも予約role/relationshipを再チェック。
- 通知送信の詰まり対策を追加。
  - `scheduled_notifications.claimed_at` を追加。
  - `claim_due_scheduled_notifications` は `sending` へclaim時に `claimed_at=now()` を入れる。
  - `reset_stale_sending_notifications()` を追加し、cron開始時に古い `sending` を `scheduled` へ戻す。
  - Expo Push ticketで `DeviceNotRegistered` が返ったpush tokenは `is_active=false` に更新。
- 検証SQLを更新。
  - `verify_compact.sql` / `verify_setup.sql` に `app_admins`, `reset_stale_sending_notifications`, `legacy_family_app_admin_absent` を追加。
- 次にやること:
  - typecheck/build/doctorを実行。
  - 本番Supabaseへ `supabase/admin_auth_hardening.sql` と更新済み `supabase/notification_delivery_hardening.sql` を投入。
  - `verify_compact.sql` で全true確認。
  - `smoke-admin-bearer.mjs` を本番で再実行。
  - GitHubへcommit/pushし、レビュー用ZIPを再作成。

## 2026-07-09 追記 41

- 監査対応commitを作成しGitHubへpush。
  - Commit: `0dfbc07 Harden admin auth and notification delivery`
  - Remote: `https://github.com/dogwoodcommunity/oyano-moshimo-navi.git`
- ローカル検証:
  - Web typecheck OK
  - Mobile typecheck OK
  - local doctor OK
  - Web production build OK
- 次にやること:
  - レビュー資料の対象commitを最新へ更新。
  - `git archive` で監査対応後のZIPを作成。
  - 本番Supabaseにはまだ `admin_auth_hardening.sql` と更新済み `notification_delivery_hardening.sql` の投入が必要。

## 2026-07-09 追記 42

- レビュー資料の対象commitは、自己参照でcommit hashがずれ続けないように `main latest as of 2026-07-09` 表記へ変更。
- 監査対応本体commitは `0dfbc07 Harden admin auth and notification delivery`。

## 2026-07-09 追記 43

- 監査対応後のGitHub push完了。
  - Latest pushed branch: `main`
  - Remote: `https://github.com/dogwoodcommunity/oyano-moshimo-navi.git`
- レビュー用ZIPを作成。
  - Path: `review_exports/oyano-moshimo-navi-code-review-2026-07-09-main-2d910de.zip`
  - `git archive` 由来なので `.env.local` は含まない。
  - ZIP内の秘密情報確認では `.env.example` のみ検出。
- 検証済み:
  - Web typecheck OK
  - Mobile typecheck OK
  - local doctor OK
  - Web production build OK
- 本番Supabaseにはまだ以下をSQL Editorで実行する必要あり:
  - `supabase/admin_auth_hardening.sql`
  - 更新済み `supabase/notification_delivery_hardening.sql`
  - その後 `supabase/verify_compact.sql` で全true確認。

## 2026-07-09 追記 44

- 本番Supabaseへ監査対応SQLを投入完了。
  - SQL Editor URL: `https://supabase.com/dashboard/project/ypnuxyfirlvbsqujocuy/sql/new`
  - 投入内容: `admin_auth_hardening.sql` + 更新済み `notification_delivery_hardening.sql`
  - 初回はコピー範囲が途中で切れて `syntax error at or near "if"` が出たが、完全版を再コピーして再実行し `Success. No rows returned`。
  - `verify_compact.sql` を実行し、ユーザー確認で全 `ok=true`。
- Vercel本番へ最新mainを明示デプロイ。
  - 本番Web: `https://oyano-moshimo-navi.vercel.app`
  - Deployment ID: `dpl_J88R8ML4ZMvu9rjLaAaZaYu9Qk23`
  - Production URL: `https://oyano-moshimo-navi-4i2tzed0g-dogwoodcommunity1.vercel.app`
  - Alias: `https://oyano-moshimo-navi.vercel.app`
- 本番smoke再確認。
  - `node scripts/smoke-admin-bearer.mjs https://oyano-moshimo-navi.vercel.app` OK
    - 一時auth user + profile + `app_admins` 行を作成。
    - `Authorization: Bearer <token>` で `/api/admin/env-check` が200。
    - 一時データ削除済み。
  - `node scripts/smoke-production-consent.mjs https://oyano-moshimo-navi.vercel.app` OK
    - diagnosis submitted
    - cases consent fields saved
    - consent_logs sensitive_info row saved
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK
    - public pages/auth-required 401 checks OK
    - admin env apiはADMIN_ACCESS_TOKEN未指定のためSKIPだが、Bearer smokeで別途OK確認済み。
- 次に残る大きい本番化タスク:
  - Stripe商品/Price/Webhook/env設定。
  - Expo実機でMagic Link、dashboard/person/tasks、push token保存確認。
  - iOS preview build。

## 2026-07-09 追記 45

- 監査指摘M-3対応としてStripe webhookを拡張。
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
- `apps/web/app/api/stripe/webhook/route.ts` はcheckout sessionイベントを共通処理し、既存purchaseがある場合もstatusを更新するように変更。
- 非同期決済成功時は `purchases.status='paid'`、`support_packs.status='paid'` へ更新。
- 非同期決済失敗時は `purchases.status='failed'`、`support_packs.status='requested'` のまま維持。
- `docs/STRIPE_SETUP.md` と `docs/PRODUCTION_CHECKLIST.md` のWebhook購読イベントを更新。

## 2026-07-09 追記 46

- Stripe webhook拡張をGitHubへpush。
  - Commit: `f76c7df Handle async Stripe checkout events`
  - Remote: `https://github.com/dogwoodcommunity/oyano-moshimo-navi.git`
- Vercel本番へ明示デプロイ。
  - 本番Web: `https://oyano-moshimo-navi.vercel.app`
  - Deployment ID: `dpl_9YzF2EGwFcZiUyHvPTgK74bvET5A`
  - Production URL: `https://oyano-moshimo-navi-3x0yrh58t-dogwoodcommunity1.vercel.app`
  - Alias: `https://oyano-moshimo-navi.vercel.app`
- 本番smoke再確認。
  - Admin Bearer smoke OK
  - Production consent smoke OK
  - Web smoke OK
- Stripe DashboardでWebhookを作る時のURL:
  - `https://dashboard.stripe.com/test/webhooks`
  - Endpoint URL: `https://oyano-moshimo-navi.vercel.app/api/stripe/webhook`
  - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
- GitHub push済み:
  - commit `6e40589 Add engineer review materials`
- 最新コードZIPを作成:
  - `review_exports/oyano-moshimo-navi-code-review-2026-07-09-6e40589.zip`
  - `git archive` で作成したため、`.env.local` など未追跡secretは含まれない。
  - ZIP内のsecret系確認では `.env.example` のみ検出。
- 旧ZIP:
  - `review_exports/oyano-moshimo-navi-code-review-97a19bd.zip` は古いレビュー用出力として残存。

## 2026-07-09 追記 47

- ユーザー指示「俺が設定しなくてもええのを先に」に従い、外部サービス設定なしでできるStripe checkout認可強化を実装中。
- 監査観点:
  - 旧状態では `/api/stripe/checkout` が `caseId` と連絡先だけで `cases.contact_*` と `consent_to_contact` を更新し、Stripe Checkoutを作れるため、既知caseIdへの更新面が広かった。
- 実装方針:
  - 結果画面 `/result/[caseId]` だけが持つ `handoffToken` を `checkoutToken` として `/support-pack` に渡す。
  - `/support-pack` は `checkoutToken` が無い場合、Stripe申込ボタンを無効化し、整理結果画面から開き直すよう案内する。
  - `POST /api/stripe/checkout` は `checkoutToken` 必須。Supabase `case_results.app_handoff_token` と一致し、`case_results.created_at` が24時間以内の場合のみ、連絡先更新とStripe Checkout作成へ進む。
  - `app_handoff_consumed_at` は見ない。アプリ引き継ぎ後でも、24時間以内なら同じ結果画面から発動サポートパック申込ができるようにするため。
- 変更ファイル:
  - `apps/web/app/result/[caseId]/page.tsx`
  - `apps/web/app/support-pack/SupportPackClient.tsx`
  - `apps/web/app/api/stripe/checkout/route.ts`
  - `docs/STRIPE_SETUP.md`
- 関連URL:
  - 本番Web: `https://oyano-moshimo-navi.vercel.app`
  - GitHub: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`

## 2026-07-09 追記 53 最新状態

- 最新のコードpush先:
  - GitHub: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`
  - 最新コードcommit: `51b8515 Automate review zip creation`
- 最新の本番Web:
  - `https://oyano-moshimo-navi.vercel.app`
  - アプリ本体の最新デプロイID: `dpl_7rpsWuM7qSeVCYxhkoodnx9R7589`
- 最新レビューZIP:
  - `review_exports/oyano-moshimo-navi-code-review-2026-07-09-51b8515.zip`
  - `git archive` 由来。
  - `.env.local` / 実secretファイルなし。`.env.example` のみ許可。
- ZIP作成コマンド:
  - `CI=true pnpm run review:zip`
  - 直接実行するなら `node scripts/create-review-zip.mjs`
- 直近の検証:
  - `pnpm run doctor:local` OK
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK
  - Stripe checkout tokenなし拒否チェックもsmokeに組み込み済み。
- まだユーザー設定が必要な残タスク:
  - Stripe Dashboardの商品/Price/Webhook/env設定。
  - Expo実機でMagic Link、handoff、dashboard/person/tasks、push token保存確認。
  - iOS preview build。
- 関連URL:
  - Vercel: `https://vercel.com/dogwoodcommunity1/oyano-moshimo-navi`
  - Supabase SQL Editor: `https://supabase.com/dashboard/project/ypnuxyfirlvbsqujocuy/sql/new`
  - Stripe webhook設定: `https://dashboard.stripe.com/test/webhooks`
  - Expo project: `https://expo.dev/accounts/oyanomosimonavi/projects/oyano-moshimo-navi`

## 2026-07-09 追記 50

- 最新レビューZIPを作成。
  - Path: `review_exports/oyano-moshimo-navi-code-review-2026-07-09-7886bac.zip`
  - Base commit: `7886bac Smoke checkout token enforcement`
  - 作成方法: `git archive --format=zip`
  - サイズ: 約3.7MB
- ZIP内のsecret系ファイル名確認:
  - `.env.local` なし
  - `.env` なし
  - 検出されたのは `apps/web/.env.example` と `apps/mobile/.env.example` のみ。
- このZIPは未追跡ファイルとして `review_exports/` に置いている。GitHubにはpushしていない。

## 2026-07-09 追記 51

- ユーザー指示「全部進めて」に対し、外部設定なしで進められるレビュー準備を追加実施。
- `docs/ENGINEER_REVIEW_BRIEF_2026-07-09.md` を最新化。
  - 対象commitを `e2fbea9 Update engineer review scope` に更新。
  - Stripe checkout token必須化と24時間照合をレビュー観点へ追加。
  - 最新ZIP名を反映。
- `docs/ENGINEER_REVIEW_CHECKLIST_2026-07-09.md` を最新化。
  - `/api/stripe/checkout` が `caseId` だけで進まないこと。
  - 結果画面から申込に進む場合 `checkoutToken` が付くこと。
- 検証:
  - `pnpm run doctor:local` OK
- GitHub push済み:
  - Commit: `e2fbea9 Update engineer review scope`
  - Remote: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`
- 最新レビューZIPを作成:
  - Path: `review_exports/oyano-moshimo-navi-code-review-2026-07-09-e2fbea9.zip`
  - Base commit: `e2fbea9 Update engineer review scope`
  - 作成方法: `git archive --format=zip`
  - サイズ: 約3.7MB
  - `.env.local` / 実secretファイルなし。検出された環境変数ファイルは `apps/web/.env.example` と `apps/mobile/.env.example` のみ。
- 関連URL:
  - 本番Web: `https://oyano-moshimo-navi.vercel.app`
  - GitHub: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`

## 2026-07-09 追記 52

- レビューZIP作成を自動化。
- 追加:
  - `scripts/create-review-zip.mjs`
  - `package.json` script `review:zip`
- 仕様:
  - 現在の `HEAD` から `git archive --format=zip` で `review_exports/oyano-moshimo-navi-code-review-YYYY-MM-DD-<commit>.zip` を作る。
  - `unzip -l` で `.env.local`、`.env`、secret/service role系のファイル名混入を検査する。
  - `.env.example` は許可。
- 実行結果:
  - 初回 `pnpm run review:zip` はCIフラグなしでpnpmが依存確認に入り、ネットワーク制限で失敗。
  - `CI=true pnpm run review:zip` はOK。
  - `node scripts/create-review-zip.mjs` もOK。
- GitHub push済み:
  - Commit: `51b8515 Automate review zip creation`
  - Remote: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`
- 最新レビューZIP:
  - Path: `review_exports/oyano-moshimo-navi-code-review-2026-07-09-51b8515.zip`
  - Base commit: `51b8515 Automate review zip creation`
  - `.env.local` / 実secretファイルなし。`.env.example` のみ検出。
- `docs/ENGINEER_REVIEW_BRIEF_2026-07-09.md` の対象commitとZIP名も `51b8515` へ更新。
  - Vercel: `https://vercel.com/dogwoodcommunity1/oyano-moshimo-navi`
  - Supabase SQL Editor: `https://supabase.com/dashboard/project/ypnuxyfirlvbsqujocuy/sql/new`

## 2026-07-09 追記 48

- Stripe checkout認可強化を検証・GitHub push・本番デプロイまで完了。
- 検証:
  - Web typecheck OK
  - local doctor OK
  - Web production build OK
  - 本番 `node scripts/smoke-admin-bearer.mjs https://oyano-moshimo-navi.vercel.app` OK
  - 本番 `node scripts/smoke-production-consent.mjs https://oyano-moshimo-navi.vercel.app` OK
  - 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK
  - `POST https://oyano-moshimo-navi.vercel.app/api/stripe/checkout` に `checkoutToken` なしで投げると `400 {"error":"checkout_token_required"}` を返すことを確認。
- GitHub push:
  - Commit: `b50d2ea Require checkout token for support pack`
  - Remote: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`
- Vercel本番デプロイ:
  - 本番Web: `https://oyano-moshimo-navi.vercel.app`
  - Deployment ID: `dpl_7rpsWuM7qSeVCYxhkoodnx9R7589`
  - Production URL: `https://oyano-moshimo-navi-kpi0xak3v-dogwoodcommunity1.vercel.app`
  - Alias: `https://oyano-moshimo-navi.vercel.app`
- 残タスク:
  - Stripe Dashboardで商品/Price/Webhook/env設定。
  - Expo実機でMagic Link、handoff、dashboard/person/tasks、push token保存確認。
  - iOS preview build。

## 2026-07-09 追記 49

- ユーザー設定なしで進められる追加品質改善として、`scripts/smoke-web.mjs` にStripe checkout認可の退行検知を追加。
- 追加チェック:
  - `POST /api/stripe/checkout`
  - body: `caseId`, `contactEmail`, `consentToContact` のみ
  - 期待値: `400`
  - 意味: `checkoutToken` なしで発動サポートパック申込APIが進まないことを、通常smokeで毎回確認する。
- 検証:
  - `pnpm run doctor:local` OK
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK
  - 追加行 `OK stripe checkout requires token: 400 /api/stripe/checkout` を確認。
- 関連URL:
  - 本番Web: `https://oyano-moshimo-navi.vercel.app`
  - GitHub: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`

## 2026-07-10 追記 54

- Android実機でWeb診断 -> Expoアプリhandoffを確認。
- 実機:
  - ADB device: `42545251`
  - installed package: `jp.beech.oyanomoshimo`
- `apps/mobile/.env.local` はローカル確認用に `EXPO_PUBLIC_WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app` を使った。
  - Android端末の `localhost` は端末自身を指すため、本番Web APIを見る設定にした。
  - `.env.local` はGit管理外。commitしない。
- 追加した確認用スクリプト:
  - `scripts/create-handoff-smoke-case.mjs`
    - 本番 `/api/cases/:caseId/diagnosis` にテスト診断を作成し、Web結果URLとアプリhandoff URLを出す。
  - `scripts/create-mobile-auth-redirect.mjs`
    - ローカルの `apps/web/.env.local` からSupabase URL/service roleを読み、実機確認用のSupabase Auth URLを生成する。
    - secretはコードへ書かない。
  - `scripts/adb-open-url.mjs`
    - Android shellで `&` や認証パラメータが壊れないよう、URLを端末側shellでクォートして開く。
- 作成したhandoffテストケース:
  - caseId: `c24c4160-300a-4fa6-9602-e4baf0d1f07f`
  - Web result: `https://oyano-moshimo-navi.vercel.app/result/c24c4160-300a-4fa6-9602-e4baf0d1f07f`
  - app link: `oyanomoshimo://handoff?caseId=c24c4160-300a-4fa6-9602-e4baf0d1f07f&token=...`
- 確認結果:
  - `oyanomoshimo://handoff?...` はAndroid実機で `jp.beech.oyanomoshimo/.MainActivity` を開けた。
  - 未ログイン状態ではhandoff画面に留まり、「本人確認メールを送る」「ログイン済みなので保存する」が表示された。
  - Supabase Authの生成リンクは、現状だとプロジェクトのSite URL `http://localhost:3000` へ戻る。実ユーザーのMagic Linkを成立させるには、Supabase AuthのRedirect URLsにアプリスキーム/本番URLを追加する必要がある。
  - 開発確認として、認証後URLを `oyanomoshimo://handoff?...` に変換して実機で開いたところ、Supabase session復帰 -> `/api/handoff/consume` -> RPC `consume_case_handoff` -> タスク画面遷移まで成功。
  - 実機画面で「家族タスクボード」が表示され、未完了2件/担当未定2件、タスク「病院の窓口と退院見込みを確認する」「支払いと保険請求に必要な書類を集める」が確認できた。
- 次に必須の外部設定:
  - Supabase Dashboard > Authentication > URL Configuration でRedirect URLsを確認。
  - 少なくとも `oyanomoshimo://**` 相当、またはExpo/standaloneアプリの実際の戻りURLを許可する。
  - 設定後、メール本文のMagic Linkを実機で直接開き、localhostに落ちずアプリへ戻ることを再確認する。
- 関連URL:
  - 本番Web: `https://oyano-moshimo-navi.vercel.app`
  - Supabase SQL Editor: `https://supabase.com/dashboard/project/ypnuxyfirlvbsqujocuy/sql/new`
  - Supabase Auth URL設定: `https://supabase.com/dashboard/project/ypnuxyfirlvbsqujocuy/auth/url-configuration`
  - Expo project: `https://expo.dev/accounts/oyanomosimonavi/projects/oyano-moshimo-navi`

## 2026-07-10 追記 55

- Supabase Auth URL Configuration をユーザー操作で更新済み。
  - Site URL: `https://oyano-moshimo-navi.vercel.app`
  - Redirect URLs:
    - `https://oyano-moshimo-navi.vercel.app/**`
    - `oyanomoshimo://handoff`
    - `oyanomoshimo:///handoff`
- Android実機handoffの追加確認:
  - 使用メール: `tettsu0529@gmail.com`
  - 実機画面で「本人確認メールを送る」を押したところ、Supabase側の `email rate limit exceeded` が表示された。
  - これはアプリの入力エラーではなく、Supabase内蔵メール送信のレート制限。
  - 待機で進めず、検証用スクリプト `scripts/create-mobile-auth-redirect.mjs` で認証済みhandoff URLを生成し、`scripts/adb-open-url.mjs` でAndroid実機へ直接投入した。
  - secret/tokenはログ・コード・docsに残さない方針。
- 確認結果:
  - Android実機で `jp.beech.oyanomoshimo/.MainActivity` がhandoff URLを受け取った。
  - Supabase session復帰後、アプリは「タスク」画面へ遷移。
  - 画面上で「家族タスクボード」、未完了2件、担当未定2件を確認。
  - 表示タスク:
    - 「病院の窓口と退院見込みを確認する」
    - 「支払いと保険請求に必要な書類を集める」
- 判断:
  - Web診断結果 -> アプリhandoff -> ログイン/session -> case consume -> 家族タスクボード表示の本筋は成功。
  - 実ユーザー向けメール送信は、Supabase内蔵メールの制限に当たるため、本番/テスト配布前にCustom SMTP設定が必要。
- 次候補:
  - Supabase Custom SMTP設定。
  - Android実機で、同じメールの実Magic Linkを開いた時にアプリへ戻るか再確認。
  - `review_exports/` の扱い確認後、必要ならGitHubへpush。

## 2026-07-10 追記 56

- Supabase Custom SMTP用の候補情報をユーザーから受領。
  - SMTP host: `mail86.onamae.ne.jp`
  - SMTP port: `465` SSLあり、または `587` SSLなし
  - SMTP username: `info@bee-ch.co.jp`
  - SMTP password: 受領済みだが機密情報のため記録しない
  - sender email: `info@bee-ch.co.jp`
- 推奨設定:
  - まずは `465` + SSL/TLS有効で設定する。
  - Sender name は `親のもしもナビ`。
  - Sender email / Reply-to は `info@bee-ch.co.jp`。
- 注意:
  - SMTPパスワードがチャットに貼られたため、本番固定前に可能ならメール側でパスワード再発行・ローテーションするのが望ましい。
  - 設定後、Supabase Authメールの再送テストをAndroid実機で行い、`email rate limit exceeded` が解消されるか確認する。

## 2026-07-10 追記 57

- Supabase Custom SMTP設定後、Android実機で実メール経由handoffを再確認。
- ユーザー操作:
  - Supabase Authentication > Emails でCustom SMTPを保存。
  - Android実機でWebトップから診断を実施。
  - 結果画面「長期入院タイプ」まで到達。
  - アプリ保存導線からExpoアプリへ遷移。
- 確認結果:
  - Android実機で「家族タスクボード」画面が表示された。
  - 未完了2件、担当未定2件を確認。
  - タスク例:
    - 「病院の窓口と退院見込みを確認する」
    - 「支払いと保険請求に必要な書類を集める」
- 判断:
  - SMTP設定後、実機の通常操作で Web入口 -> 診断 -> 結果 -> アプリ保存 -> 家族タスクボード の流れは成功。
  - v0.3のWeb/App接続導線は実機で成立。
- 次候補:
  - SMTPパスワードのローテーション。
  - メールテンプレート日本語化。
  - Android実機で担当者変更・完了ボタン・通知許可の確認。
  - GitHubへこの引き継ぎメモをpush。

## 2026-07-10 追記 58

- ユーザー指示: SMTPパスワード変更は除外し、それ以外を進める。
- 追加した資料:
  - `docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md`
  - Supabase Authメールを日本語化するためのテンプレート集。
  - 対象は Confirm signup / Magic Link / Invite user / Reset password / Reauthentication。
  - 送信元は `親のもしもナビ <info@bee-ch.co.jp>` 前提。
- 追加した確認スクリプト:
  - `scripts/verify-mobile-user-state.mjs`
  - メールアドレスを指定して、本番Supabase上のauth user / push_tokens / notification_preferences / family_members / people / tasksを確認する。
  - service role keyはローカル環境変数・`.env.local`から読む。値はログ出力しない。
- 実行確認:
  - `node --check scripts/verify-mobile-user-state.mjs` は成功。
  - `scripts/verify-mobile-user-state.mjs tettsu0529@gmail.com` を本番Supabaseに対して実行。
  - 結果:
    - auth userあり。
    - family_members: 2件。
    - people: 2件。
    - tasks: 4件。
    - incomplete: 4件。
    - unassigned: 4件。
    - done: 0件。
    - push_tokens: 0件。
    - notification_preferences: 未作成。
  - 表示タスク:
    - 「病院の窓口と退院見込みを確認する」
    - 「支払いと保険請求に必要な書類を集める」
- 判断:
  - Web診断 -> アプリhandoff -> タスクDB保存は成立済み。
  - 複数回テストにより、同じユーザー配下にpeople/tasksが重複している。これは検証操作由来で、削除はまだ行っていない。
  - push token保存は未完了。Android実機で通知許可画面を開いて「この端末で通知を受け取る」を押す確認が必要。
- 現在のブロッカー:
  - `adb devices` で接続端末が表示されないため、こちらからAndroid実機操作を自動化できない。
  - Android実機をUSBデバッグ接続し直したら、通知許可、push token保存、タスクの進行中/完了/担当変更を確認する。
- 機密メモ:
  - SMTPパスワードはユーザーから共有済みだが、コード・docs・ログには残さない。
  - 本番前にはメール側でパスワード再発行/ローテーション推奨。

## 2026-07-12 追記 59

- ユーザー指示: 通知許可/push token確認は除外し、それ以外を進める。
- 追加した検証スクリプト:
  - `scripts/verify-task-actions.mjs`
  - 指定メールのユーザー配下からタスク1件を選び、`doing`、担当者設定、`done`、元状態への復元を実行できる。
  - デフォルトはdry-run。`--apply` 指定時だけ本番DBのテスト対象タスクを一時更新する。
  - service role keyはローカル環境から読む。値はログ出力しない。
- タスク操作検証:
  - 対象ユーザー: `tettsu0529@gmail.com`
  - 対象タスク: 「病院の窓口と退院見込みを確認する」
  - 実行結果:
    - `todo` -> `doing` 成功。
    - 担当未定 -> 自分のfamily_memberへ割当成功。
    - `done` + `completed_at` 設定成功。
    - 最後に `todo` / 担当未定へ復元成功。
  - 復元後の確認:
    - tasks: 4件。
    - incomplete: 4件。
    - unassigned: 4件。
    - done: 0件。
- 追加した整理レポート:
  - `scripts/report-test-duplicates.mjs`
  - 指定メールのfamily/people/tasks/casesを読み、同じfamily内の重複person候補を表示する。
- 重複テストデータ確認:
  - 対象ユーザー: `tettsu0529@gmail.com`
  - families: 2件。
  - people: 2件。
  - tasks: 4件。
  - duplicate person groups: 0件。
  - 同じタスク名が4件見えるが、2つのfamilyに分かれているため、現時点では削除しない判断。
- メールテンプレート:
  - 日本語テンプレート資料は `docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md` に作成済み。
  - Supabase DashboardのAuth Templatesへ貼り付ける外部操作は未実施。
- 残:
  - Android実機がADBに出ていないため、UI上のタップ確認とpush token保存確認は未実施。
  - 通知許可/push token確認は今回ユーザー指示で除外。

## 2026-07-12 追記 60

- ユーザー指示: モバイルのデザインがダサい/AIっぽいので、写真素材や背景色を含めてこだわってほしい。
- 対応画面:
  - `apps/mobile/app/(auth)/welcome.tsx`
  - `apps/mobile/app/(tabs)/dashboard.tsx`
  - `apps/mobile/app/people/[id]/tasks.tsx`
  - `apps/mobile/lib/theme.ts`
- デザイン方針:
  - 既存の生活感ある写真素材 `apps/mobile/assets/onboarding-family-home.png` を、単なる挿絵ではなくヒーロー背景として使用。
  - 白一色/濃緑一色のAIっぽい画面から、生成感の少ない「家の机・書類・暮らし」のトーンへ寄せた。
  - 背景色を少し暖かい紙色に変更し、カードも真っ白ではなく温かい白へ調整。
  - 入口の文言を「ここからです」「続けて管理する方は、会員登録へ」に変更し、いきなりログインを迫る印象を弱めた。
  - 家族ボード/タスク画面にも同じ写真背景を入れ、プロダクト全体の一貫性を上げた。
- 変更内容:
  - Welcome:
    - 写真ヒーロー化。
    - 写真上にブランド/価値/説明を重ねる構成へ変更。
    - 新規会員登録導線をより明確化。
  - Dashboard:
    - 写真ヒーロー化。
    - 「必要な時に戻れる場所」という低頻度・高重要度の位置付けに文言調整。
    - 今日までの件数がある場合のメトリクスを少し目立たせる。
  - Tasks:
    - 上部だけ写真ヒーロー化し、リスト本体は読みやすさ優先。
    - タスクカード背景/チップ色を暖かい紙色に調整。
  - Theme:
    - `paper` / `surface` / `surfaceSoft` / `line` を暖色寄りに変更。
    - `clay` / `moss` を追加。
    - shadowを少し控えめで自然な色へ変更。
- 検証:
  - `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node_modules/.bin/tsc --noEmit`
  - mobile typecheck成功。
  - `pnpm --filter mobile run typecheck` はpnpmがregistryへメタ情報取得しに行き、ネットワーク/TTY都合で失敗したため、直接tscで検証した。
- 未実施:
  - Android実機スクリーンショット確認。
  - 外部フリー素材への差し替え。現時点ではライセンス/通信依存を避け、既存ローカル写真素材を活用した。

## 2026-07-13 追記 61

- ユーザー指示: Android実機を接続したので、モバイルの最新デザイン確認を進める。
- Android実機:
  - `adb devices` で `42545251 device` を確認。
  - 端末には `host.exp.exponent` と `jp.beech.oyanomoshimo` が入っていた。
  - 既存の `jp.beech.oyanomoshimo` を起動したところ、古いビルドの画面が表示されたため、最新ソース確認にはExpo Goを使う判断。
- Expo Go:
  - 端末のExpo GoがSDK 54系で、現在のアプリSDK 51と合わなかった。
  - Expo CLIの案内に従い、互換版Expo Go 2.31.2を端末へインストール。
  - `apps/mobile` で `expo start --android --localhost` を起動し、`exp://127.0.0.1:8081` をAndroid実機で開いた。
  - 最新のwelcome画面が実機表示された。
- 実機で見えた問題:
  - 初回表示時に `Possible unhandled promise rejection` の黄色い警告が出た。
  - Metro/logcatには原因の詳細が残らなかったため、Promise投げっぱなしになっている箇所を先に安全化。
- 修正:
  - `apps/mobile/app/_layout.tsx`
    - `Linking.getInitialURL()`、`handleAuthRedirectUrl()`、`expo-notifications` dynamic import、`markNotificationsOpened()` にcatchを追加。
  - `apps/mobile/app/(auth)/welcome.tsx`
    - Web開始リンクの `Linking.openURL()` にcatchを追加し、失敗時はユーザー向けメッセージを出す。
  - `apps/mobile/app/(tabs)/dashboard.tsx`
    - `fetchDashboardData()` 失敗時にdemo dashboardへ戻すcatchを追加。
    - Web開始リンクの `Linking.openURL()` にcatchを追加。
  - `apps/mobile/app/(tabs)/settings.tsx`
    - プライバシーポリシーリンクの `Linking.openURL()` にcatchを追加。
- 検証:
  - `apps/mobile` で直接 `tsc --noEmit` 成功。
  - Expo Goで再表示後、スクリーンショット確認では黄色い警告は消えた。
  - `adb logcat` の直近ログにも `Possible unhandled` / `TypeError` / `ReferenceError` は出ていない。
- 注意:
  - Expo Goで表示しているのは最新ソースの開発表示。
  - 端末に入っている standalone app `jp.beech.oyanomoshimo` は古いビルドのため、最新デザインを正式アプリとして見るにはEAS preview buildを作り直してインストールする必要がある。

## 2026-07-13 追記 62

- ユーザー指示: 次へ進める。Expo Go確認から、家族3組テストに使えるAndroid preview build作成へ進めた。
- EASログイン:
  - `pnpm dlx eas-cli whoami` で `oyanomosimonavi / info@bee-ch.co.jp` を確認。
  - EAS project:
    - fullName: `@oyanomosimonavi/oyano-moshimo-navi`
    - ID: `8ed038b0-28d1-42e1-8ef6-e7e2098c11d3`
- EAS preview環境変数:
  - `EXPO_PUBLIC_APP_SCHEME=oyanomoshimo`
  - `EXPO_PUBLIC_EAS_PROJECT_ID=8ed038b0-28d1-42e1-8ef6-e7e2098c11d3`
  - `EXPO_PUBLIC_SUPABASE_URL=https://ypnuxyfirlvbsqujocuy.supabase.co`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` はEAS上で登録済み。値は表示/記録しない。
  - `EXPO_PUBLIC_WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app`
- Android preview build:
  - `pnpm dlx eas-cli build --platform android --profile preview --non-interactive` 実行。
  - build ID: `5da38ffb-625c-45f9-8fa7-cb3c65546c83`
  - 完了ステータス: `FINISHED`
  - Install URL:
    - `https://expo.dev/accounts/oyanomosimonavi/projects/oyano-moshimo-navi/builds/5da38ffb-625c-45f9-8fa7-cb3c65546c83`
  - APK artifact:
    - `https://expo.dev/artifacts/eas/JBa8QRRgNijixexJOw3ODmjkz6zZSfYwSQrZz30NQxs.apk`
  - buildはcommit `ba093def75117ab73409b62d8f78e6ccb1e19ad8` を元に作成された。
- Android実機インストール:
  - `eas build:run --platform android --latest` はAPKダウンロード成功後、ローカルemulator実行ファイルが無いことで失敗。
  - APKを `/private/tmp/oyano-preview.apk` にcurlで取得し、`adb push` で `/data/local/tmp/oyano-preview.apk` へ転送成功。
  - `adb install -r` と `adb shell pm install -r -d` は端末側で返ってこず、手動停止した。空き容量は `/data` 73GB空きで問題なし。
  - 端末のブラウザへEAS build URLを `adb shell am start -a VIEW -d ...` で開いた。ユーザー側でInstallを押して入れるのが次の安全な手順。
- 設定修正:
  - `apps/mobile/eas.json` に `cli.appVersionSource: "local"` を追加。EASの将来必須警告を次回以降消すため。
- 検証:
  - `node scripts/mobile-build-doctor.mjs` OK。
- 次にやること:
  - Android実機でEAS buildページからInstallを押して最新preview appを入れる。
  - インストール後、`jp.beech.oyanomoshimo/.MainActivity` を起動して、welcome/dashboard/tasksの最新デザインがstandalone appでも反映されているか確認する。

## 2026-07-14 追記 63

- ユーザー指示: モバイルデザインをさらに親しみやすくするため、かわいいキャラを作りたい。
- 判断:
  - 画像生成は一度試したが方向がズレたため採用せず。
  - 外部素材/生成画像に依存せず、React NativeのViewで描ける小さな案内役キャラを作る方針に変更。
  - キャラは人型や動物ではなく、親しみがある「小さな緑のノート/お守り」風。重いテーマを軽くしすぎず、年配ユーザーにも不安を与えない意図。
- 実装:
  - `apps/mobile/components/MascotGuide.tsx`
    - `MascotMark`: 葉っぱ付きのノート/お守り風マスコット。
    - `MascotGuide`: マスコット+吹き出し。入口やタスク画面で短く案内する用途。
  - `apps/mobile/app/(auth)/welcome.tsx`
    - ブランドピルにマスコットを追加。
    - 新規会員登録CTA前に、登録前の見本確認と本人確認の説明をキャラ吹き出しで表示。
    - 低頻度・高重要度の説明帯にもマスコットを追加。
  - `apps/mobile/app/(tabs)/dashboard.tsx`
    - 家族ボードのheroと「今日見るところ」にマスコットを追加。
    - 全部やらなくてよい、担当未定から分ける、という案内文を追加。
  - `apps/mobile/app/people/[id]/tasks.tsx`
    - タスクheroにマスコットを追加。
    - 現在のfilterに応じた案内吹き出しを追加。
  - `apps/mobile/scripts/renderBrandAssets.swift`
    - 追加インストールなしでアイコン/スプラッシュ/通知アイコンを再生成するSwiftスクリプトを追加。
  - 再生成したアセット:
    - `apps/mobile/assets/icon.png`
    - `apps/mobile/assets/adaptive-icon.png`
    - `apps/mobile/assets/splash.png`
    - `apps/mobile/assets/notification-icon.png`
- 検証:
  - `apps/mobile` で `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit` 成功。
  - `node scripts/mobile-build-doctor.mjs` 成功。
  - `git diff --check` 成功。
  - `sips` でアセットサイズ確認:
    - icon/adaptive-icon: 1024x1024
    - splash: 1242x2436
    - notification-icon: 96x96
  - `view_image` でicon/splashを目視確認。落ち着いた緑のマスコットに更新済み。
- 未実施:
  - Android実機確認。`adb devices` で端末が見えていなかったため、今回のターンでは実機スクショ確認なし。
- 次にやること:
  - Android端末をUSBデバッグで再接続し、Expo Goまたは新しいEAS preview buildでwelcome/dashboard/tasksの表示を確認。
  - 見た目がOKならEAS preview buildを再作成し、家族3組テスト用の配布URLを更新する。

## 2026-07-14 追記 64

- ユーザー指示: Android携帯を接続したので実機確認を進める。
- Android実機:
  - `adb devices` で `42545251 device` を確認。
  - 端末解像度: 1080x2340 / density 480。
  - `host.exp.exponent` と `jp.beech.oyanomoshimo` がインストール済み。
- Expo Go:
  - 端末のExpo GoがSDK 54版に戻っていたため、SDK 51の本プロジェクトと非互換。
  - Expo CLIの案内に従い、SDK 51推奨のExpo Go 2.31.2を再インストール。
  - Metro起動時、Node 24 + `freeport-async` + sandboxの組み合わせでポート探索が落ちたため、権限付きでMetroを起動。
  - `node_modules/.pnpm/freeport-async@2.0.0/node_modules/freeport-async/index.js` は作業用に一時パッチ済みだが、node_modules配下なのでgit管理対象外。リポジトリにはコミットしない。
  - Metro URL: `exp://127.0.0.1:8081`
  - `adb reverse tcp:8081 tcp:8081` 後、端末でExpo Go起動成功。
- 実機確認:
  - Welcome画面のキャラ入りデザインをAndroid実機で確認。
  - 初回確認で入口カードの見出し「続けて管理する方は、会員登録へ」が端末の大きい文字設定で「へ」だけ改行されていた。
  - `apps/mobile/app/(auth)/welcome.tsx` を修正:
    - Hero title: `親のことで、家族が迷わないように。` → `親のことで、家族が迷わないように`
    - CTA見出し: `続けて管理する方は、会員登録へ` → `会員登録して続ける`
  - 再スクショで「会員登録して続ける」が自然に収まることを確認。
  - 空の家族ボードがまだ硬く見えたため、`apps/mobile/app/(tabs)/dashboard.tsx` のempty stateにもマスコットと短い案内を追加。
- 検証:
  - `apps/mobile` で `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit` 成功。
  - Expo GoでAndroid bundle成功。
  - `adb logcat` 直近確認でアプリ由来の `Possible unhandled` / `TypeError` / `ReferenceError` / `SyntaxError` は見当たらず。Google Play Services由来の `DEVELOPER_ERROR` ログは端末環境側。
- スクショ:
  - `/private/tmp/oyano-mascot-welcome.png`
  - `/private/tmp/oyano-mascot-welcome-v2.png`
  - `/private/tmp/oyano-after-tap.png`
  - `/private/tmp/oyano-mascot-dashboard.png`
  - `/private/tmp/oyano-empty-dashboard-v2.png`
- 次にやること:
  - 実機で「登録前に見本を見る」からdemo dashboard/tasksまでの遷移確認を完了する。
  - その後、最新コミットでEAS Android preview buildを再作成する。

## 2026-07-14 追記 65

- ユーザー指示: Webの質問ページがGoogle Formっぽいので、デザインを変えてほしい。
- 判断:
  - Google Formっぽさの主因は、`select` / `textarea` / checkboxが縦に並ぶ「入力フォーム主役」の構成。
  - 親のもしもナビの入口トーンに合わせ、診断ではなく「家族の整理ノート」として見せる方針に変更。
  - いきなり情報を要求されている印象を下げるため、状態選択をプルダウンから大きい選択カードに変更。
- 実装:
  - `apps/web/app/diagnosis/page.tsx`
    - eyebrowを「家族の整理ノート」に変更。
    - H1を「いま必要なことを、順番に整理します」に変更。
    - loading文言を「整理ノートを読み込み中」に変更。
  - `apps/web/app/diagnosis/DiagnosisForm.tsx`
    - intro文言を「3分で整理」に変更。
    - progress表示を `1 状況を選ぶ / 2 分かる範囲で確認 / 3 結果を見る` に変更。
    - form全体を `diagnosis-notebook` に変更。
    - 各sectionを `diagnosis-sheet` に変更。
    - 親の状況選択を `<select>` からカード式radio風buttonに変更。
    - 困りごとは `concern-card` の選択チップ風UIに変更。
    - 自由入力欄は `soft-memo-field` に入れて、メモ扱いの見え方に変更。
  - `apps/web/app/globals.css`
    - `diagnosis-notebook`, `diagnosis-sheet`, `status-choice-grid`, `diagnosis-status-card`, `soft-memo-field`, `concern-grid`, `concern-card` を追加。
    - 紙の整理ノート風の薄い罫線背景、カード選択、選択済みグリーン表示を追加。
- 検証:
  - `apps/web` で `PATH=/Users/ikedatetsuya/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit` 成功。
  - `git diff --check` 成功。
  - `pnpm --filter web run typecheck` はpnpmが依存状態確認でregistryへアクセスしようとして失敗。ローカルの`tsc`直接実行で代替検証済み。
  - Next dev serverを `http://127.0.0.1:3005` で一時起動し、in-app browserで `/diagnosis?status=hospitalized` を確認。
  - PC幅・390pxスマホ幅で、フォーム感が薄れ、選択カード型になっていることを目視確認。
- 次にやること:
  - 必要なら `/result/[caseId]` も同じ「整理ノート」トーンにさらに寄せる。
  - 本番反映後、スマホ実機でWeb診断から結果画面まで通し確認する。

## 2026-07-16 追記 66

- ユーザー指示: Web入口をPWAにする。最初は「WPS」と言われたが、確認後にPWAと判明。
- 判断:
  - 親の病気・入院・死亡など要配慮情報を扱うため、PWA化しても診断結果・API・Admin・診断入力ページをservice workerで勝手にキャッシュしない。
  - まずはホーム画面追加、standalone起動、アイコン、テーマカラー、iPhoneのWeb App設定を入れる。
  - オフライン対応は後回し。MVPでは個人情報保護を優先し、service workerはブランドアイコン等の静的資産だけをキャッシュする。
- 実装:
  - `apps/web/public/manifest.webmanifest`
    - `name`, `short_name`, `start_url=/home?source=pwa`, `display=standalone`, `theme_color`, `background_color`, icons, shortcutsを追加。
  - `apps/web/public/sw.js`
    - brand iconsのみcache。
    - `/api/`, `/admin`, `/result/`, `/diagnosis` はfetch handler対象外にして、個人情報や結果を保存しない。
  - `apps/web/components/PwaRegister.tsx`
    - production環境のみ `/sw.js` を登録。
    - 登録失敗してもWeb入口自体は止めない。
  - `apps/web/app/layout.tsx`
    - `manifest`, `applicationName`, `themeColor`, `appleWebApp`, `formatDetection` をmetadataへ追加。
    - `<PwaRegister />` をbody末尾に追加。
  - `apps/web/public/brand/pwa-icon-192.png`
    - `logo-mark.png` から `sips -z 192 192` で生成。
  - `scripts/local-doctor.mjs`
    - PWA関連ファイルとアイコンを必須確認に追加。
  - `scripts/smoke-web.mjs`
    - `/manifest.webmanifest` と `/sw.js` を疎通確認に追加。
- 次にやること:
  - Web build/typecheck/smokeで検証。
  - 本番Vercel反映後、Android Chrome/iPhone Safariで「ホーム画面に追加」確認。
  - 必要ならPWA用の案内UI(「ホーム画面に追加できます」)を控えめに追加する。

## 2026-07-16 追記 67

- ユーザー指摘:
  - スマホ実機のトップ画面で「ここから始める」と「状況を選んで整理する」が両方強く見え、どこが入口か分かりにくい。
- 判断:
  - ファーストビューの本命入口を1つに絞る。
  - 上部ナビのCTA感を弱め、スマホでは上部の `/start` 導線を非表示にする。
  - ヒーロー内の大ボタンだけを「入口」として強調する。
  - よくある状況チップはリンクではなく例示にして、押す場所が増えすぎないようにする。
- 実装:
  - `apps/web/app/layout.tsx`
    - 上部ナビの文言を「ここから始める」から「入口」に変更。
  - `apps/web/app/page.tsx`
    - ヒーローCTAのラベルを「入口はこのボタンです」に変更。
    - CTAを「無料で状況を選ぶ」に変更し、補足として「ログインなしで始められます」をボタン内に表示。
    - 状況チップを `Link` から `span` に変更。
  - `apps/web/app/globals.css`
    - 上部 `nav-start` の塗りボタン表現を解除。
    - スマホ幅では `/start` ナビリンクを非表示。
    - ヒーローCTA枠を太い緑枠、番号バッジ、強い影、縦組みボタンで入口として明確化。
- 検証:
  - `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `next build` OK。
- 次にやること:
  - GitHub push後、Vercel反映を待ってスマホ実機でトップの入口が1つに見えるか確認。

## 2026-07-16 追記 68

- ユーザー指摘:
  - スマホ実機で上部の「ここから始める」がまだ残って見えており、入口が複数に見える。
- 判断:
  - CSSでスマホだけ隠すのではなく、上部ナビから `/start` 導線自体を削除する。
  - トップの入口はヒーロー内の大きいCTAだけに固定する。
- 実装:
  - `apps/web/app/layout.tsx`
    - `<Link className="nav-start" href="/start">入口</Link>` を削除。
  - `apps/web/app/globals.css`
    - `.nav-start` スタイルを削除。
- 次にやること:
  - build後にGitHubへpushし、Vercel反映後にスマホで強制リロードして確認。

## 2026-07-16 追記 69

- ユーザー指摘:
  - GitHub push後も本番スマホ表示に「ここから始める」が残っていた。
- 調査:
  - `curl -L https://oyano-moshimo-navi.vercel.app` で本番HTMLを確認したところ、Vercelが古いbuildを返していた。
  - GitHub `origin/main` は最新commit `8f2b618` までpush済みだったため、GitHubではなくVercel側の反映遅れ/未反映と判断。
- 対応:
  - `pnpm dlx vercel@latest --prod --yes` をNode PATH付きで実行し、Productionへ手動デプロイ。
  - デプロイID: `dpl_853UqeNMgvtZS3HiULdQ5PEBehJ9`
  - Production URL: `https://oyano-moshimo-navi-nwf54uycl-dogwoodcommunity1.vercel.app`
  - Alias: `https://oyano-moshimo-navi.vercel.app`
- 検証:
  - 再度本番HTMLを確認し、上部ナビから「ここから始める」が消えていることを確認。
  - ヒーローCTAは「入口はこのボタンです」「無料で状況を選ぶ」に更新済み。
- 次にやること:
  - ユーザーのスマホでページを閉じて再オープン、または更新して確認。
  - もしまだ古い表示なら、ブラウザ/PWAキャッシュの可能性が高いため、タブを閉じる・履歴/サイトデータ削除・別ブラウザで確認する。

## 2026-07-16 追記 70

- ユーザー指摘:
  - `/start` の選択画面がまだフォームっぽく、イラストやデザイン性が足りない。
  - 参考として医療系アプリのスクショが共有され、やさしいイラスト付きカードの方向性が求められた。
- 判断:
  - まず追加画像素材を増やさず、CSSだけで軽量な案内キャラと状況アイコンを作る。
  - 高齢者や家族が迷わないよう、選択肢カードは余白を増やし、各状況を小さなイラスト枠で見分けやすくする。
  - 診断入口なので、派手すぎる装飾ではなく、医療/介護系に合う落ち着いた親しみを優先。
- 実装:
  - `apps/web/app/start/page.tsx`
    - `statusVisuals` を追加し、各ステータスに短い漢字アイコンと色調を割り当て。
    - ヒーロー右側を `start-guide-card` に変更し、CSS製の案内キャラを表示。
    - 主要カード・通常カードに `status-visual` を追加。
  - `apps/web/app/globals.css`
    - `/start` ヒーローを淡い背景とグリッド柄で改善。
    - CSS製の案内キャラ、書類イラスト、状況アイコンを追加。
    - quick/statusカードを角丸・上罫線・余白増しにして、フォーム感を軽減。
    - スマホでは案内キャラを横長コンパクト表示に調整。
- 検証:
  - `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `next build` OK。
  - ローカル `http://127.0.0.1:3005/start` をスマホ幅 `390x844` でブラウザ確認。ヒーローとカード表示をスクショで確認済み。
- 次にやること:
  - GitHub push後、Vercel本番へ反映。
  - 実機で `/start` のファーストビューとカード一覧を確認。
  - さらに必要なら、外部フリー素材/独自キャラクター画像を正式に作って差し替える。

## 2026-07-16 追記 71

- ユーザー指摘:
  - `/start` の見た目は改善されたが、「親はいま、どの状況に近いですか？」の下に並ぶカードがクリック/タップできるものだと分かりにくい。
  - 「当てはまるものをクリックしてください」のような明示説明と、押しやすいアイコン/ボタン感が必要。
- 判断:
  - デザイン装飾よりも操作理解を優先し、選択画面の上に「当てはまるカードを1つタップしてください」と明示する。
  - 各カードに「タップ」バッジ、右上矢印、下部の「これを選ぶ →」導線を入れ、カード全体が押せることを視覚化する。
  - 高齢者/家族利用を想定し、専門的なUIより「押」「タップ」「カード全体が押せます」という直接的な言葉を採用。
- 実装:
  - `apps/web/app/start/page.tsx`
    - ヒーロー説明を「下のカードから、当てはまるものを1つ押してください」に変更。
    - 利用ステップを「1. カードを押す」に変更。
    - `start-select-guide` セクションを追加し、「当てはまるカードを1つタップしてください」「カード全体が押せます」と明示。
    - quick/statusカードに `status-card-top`、`tap-badge`、矢印付きの選択ラベルを追加。
  - `apps/web/app/globals.css`
    - 選び方ガイドの濃緑ボックスと「押」アイコンを追加。
    - 選択カードの角丸、影、右上矢印、タップバッジ、下部CTA風ラベルを追加。
    - スマホ幅で選び方ガイドが詰まらないよう調整。
- 検証:
  - `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `node scripts/local-doctor.mjs` OK。
  - `next build` OK。
- 注意:
  - Playwrightのブラウザ実体がローカルに無く、スクショ自動取得は未実施。
  - 次はGitHub pushとVercel本番反映後、実機で `/start` を再確認する。

## 2026-07-16 追記 72

- ユーザー依頼:
  - エンジニアに再レビューしてもらうため、最新版の資料とZIPを再度出す。
- 対応:
  - `docs/ENGINEER_REVIEW_BRIEF_2026-07-16.md` を新規作成。
  - `docs/ENGINEER_REVIEW_CHECKLIST_2026-07-16.md` を新規作成。
  - 対象commitは直近の `b00fdb2 Clarify start card selection affordance`。
  - 2026-07-09版資料から、PWA対応、Android実機handoff確認、入口/選択画面デザイン改善、Supabase Auth Redirect/SMTP設定、未完了リスクを反映。
- 検証:
  - `apps/web` の `tsc --noEmit` OK。
  - `apps/mobile` の `tsc --noEmit` OK。
  - `node scripts/local-doctor.mjs` OK。
- 次にやること:
  - 新規レビュー資料をcommitする。
  - `scripts/create-review-zip.mjs` で最新版レビューZIPを作成する。
  - ZIPに `.env.local` やsecretが入っていないことを確認する。

## 2026-07-16 追記 73

- レビュー資料作成後の実行結果:
  - `docs/ENGINEER_REVIEW_BRIEF_2026-07-16.md` と `docs/ENGINEER_REVIEW_CHECKLIST_2026-07-16.md` をcommit。
  - commit: `46171aa Add engineer review package docs`
  - GitHub `origin/main` へpush済み。
  - `scripts/create-review-zip.mjs` でレビューZIPを生成。
  - 生成ZIP: `review_exports/oyano-moshimo-navi-code-review-2026-07-16-46171aa.zip`
  - ZIPサイズ: 3.9MB
  - secretチェック: `.env.local` やsecret envは含まれず、`.env.example` のみ許可でOK。
- 注意:
  - この追記自体をcommitする場合は、最終レビューZIPを再生成するとさらに新しいcommit名のZIPになる。

## 2026-07-16 追記 74

- ユーザー共有の再監査資料 `親のもしもナビ_再監査_2026-07-16.md` を確認。
- 監査結論:
  - RLS、handoff、admin認可、Stripe、通知は、閉じた家族3組テストならブロッカーなし。
  - 広い本番公開前には、削除実行、匿名診断保持期限、公開APIレート制限、RLS自動テスト、監視、バックアップ方針が残る。
- 今回の実装方針:
  - すぐ効く公開APIレート制限と、放置匿名診断ケースの保持期限削除から対応。
  - 削除実行はAuth削除や家族データの扱いが絡むため、次のまとまった工程で慎重に実装する。
- 実装中のファイル:
  - `apps/web/lib/publicRateLimit.ts` を追加。Supabase RPC `check_public_api_rate_limit` があればDB共有制限、未投入時はローカル簡易制限。
  - `apps/web/app/api/cases/route.ts`、`apps/web/app/api/cases/[caseId]/diagnosis/route.ts`、`apps/web/app/api/stripe/checkout/route.ts` に制限を追加。
  - `apps/web/lib/cronAuth.ts` を追加し、cron認証を共通化。
  - `apps/web/app/api/cron/purge-anonymous-cases/route.ts` を追加。
  - `supabase/public_api_rate_limits.sql` と `supabase/anonymous_case_retention.sql` を追加。
  - `vercel.json` に匿名ケース削除cronを追加。
  - `supabase/README.md`、`supabase/verify_compact.sql`、`docs/PRODUCTION_CHECKLIST.md`、`docs/PRIVACY_AND_REVIEW_GUARDRAILS.md`、`apps/web/.env.example`、`scripts/local-doctor.mjs` を更新。
- 次にやること:
  - `tsc`、`local-doctor`、`next build` を通す。
  - 必要なら本番Supabaseに新SQL 2本を投入し、`verify_compact.sql` で新項目までtrue確認。
  - commit/push/Vercel deploy。

## 2026-07-16 追記 75

- 再監査対応の検証結果:
  - `apps/web` の `tsc --noEmit` OK。
  - `apps/mobile` の `tsc --noEmit` OK。
  - `node scripts/local-doctor.mjs` OK。
  - `next build` OK。新しい `/api/cron/purge-anonymous-cases` route もbuild対象に入った。
- 注意:
  - 通常の `pnpm --filter web exec tsc --noEmit` は、Codex環境の `pnpm` がregistry確認に行き、ネットワーク制限で失敗した。
  - 代わりにバンドルNodeをPATHへ追加し、既存 `apps/web/node_modules/.bin/tsc` と `apps/mobile/node_modules/.bin/tsc` を直接実行して検証した。
  - 本番DBの新SQL投入は未実行。`supabase/public_api_rate_limits.sql` と `supabase/anonymous_case_retention.sql` をSQL Editorで実行後、`verify_compact.sql` で新項目がtrueになるか確認する。

## 2026-07-16 追記 76

- 再監査対応をcommit/pushした。
  - commit: `3c10c6f Add public API rate limits and anonymous retention`
  - GitHub `origin/main` へpush済み。
- 最新レビューZIPを生成した。
  - `review_exports/oyano-moshimo-navi-code-review-2026-07-16-3c10c6f.zip`
  - サイズ: 3.9MB
  - secret envチェックOK。`.env.local` 等は含まず、`.env.example` のみ許可。
- 次に必要:
  - この追記を含めてもう一度commitする場合は、レビューZIPのbase commitが1つ古くなるため、必要なら再生成する。
  - 本番反映はVercel deployまたはGitHub連携の自動deploy確認。
  - 本番Supabase SQL Editorで `public_api_rate_limits.sql`、`anonymous_case_retention.sql` を実行し、`verify_compact.sql` で `public_api_rate_limits`、`check_public_api_rate_limit`、`purge_stale_anonymous_cases` がtrueになることを確認する。

## 2026-07-16 追記 77

- Vercel本番deployを実行し、成功。
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-182x6tjg3-dogwoodcommunity1.vercel.app`
  - Deployment ID: `dpl_EdhbCQqYYRduBeDwrNUQfTXZ3od2`
- 本番確認:
  - `GET https://oyano-moshimo-navi.vercel.app/api/health` は `200`。
  - `GET https://oyano-moshimo-navi.vercel.app/api/cron/purge-anonymous-cases` はトークンなしで `401 Invalid cron token`。cron保護OK。
- 最新レビューZIP:
  - `review_exports/oyano-moshimo-navi-code-review-2026-07-16-3d7e4ec.zip`
  - `.env.local` などsecret envは含まれないことを生成時に確認済み。
- 残タスク:
  - Supabase SQL Editorで `supabase/public_api_rate_limits.sql` と `supabase/anonymous_case_retention.sql` を本番DBへ投入する。
  - 投入後、`supabase/verify_compact.sql` で新しいrate limit/retention項目までtrue確認する。

## 2026-07-16 追記 78

- ユーザー指摘:
  - スマホで `/start` のカードをタップしても、すぐ反応せず時間差でページが開く感じがある。
- 原因:
  - `apps/web/lib/store.ts` の `createCase()` が、カードタップ直後に `/api/cases` のPOST完了を待ってから `/diagnosis` へ遷移していた。
  - スマホ回線やVercelの応答で数百ms以上待つと、押しても反応していないように見える。
- 対応:
  - `createCase()` を端末内で即時case作成する形に変更。DB保存は診断送信時の `/api/cases/[caseId]/diagnosis` upsertに寄せる。
  - `/start` でカードを押した瞬間に `choosingStatus` を立て、選択カードだけ「開いています」表示に変更。
  - 他カードは無効化して二重タップを防止。
  - `router.prefetch("/diagnosis")` を追加。
  - CSSに `touch-action: manipulation`、押下中のscale、遷移中の濃緑反転表示を追加。
- 検証:
  - `apps/web` の `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `next build` OK。
- 次にやること:
  - commit/push/Vercel本番deploy。
  - 実機スマホでカードタップ直後に見た目が反応し、診断画面へ速く移るか確認。

## 2026-07-16 追記 79

- スマホタップ反応改善をcommit/pushし、本番deployまで完了。
  - commit: `27dd47d Make start card taps respond immediately`
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-6n0pppj0d-dogwoodcommunity1.vercel.app`
  - Deployment ID: `dpl_DgbFDdBpgqKLyVm4oSUNo1ndKNFu`
- 本番確認:
  - `GET https://oyano-moshimo-navi.vercel.app/api/health` は `200`。
  - `HEAD https://oyano-moshimo-navi.vercel.app/start` は `200`。
- 実機確認ポイント:
  - スマホで `/start` の状況カードを押した瞬間に、カードが濃緑になり「開いています」が表示されるか確認する。
  - 画面遷移前に反応が見えるため、以前の「押しても反応していない感じ」は改善しているはず。

## 2026-07-16 追記 80

- ユーザー指摘:
  - 「対象者を誰にするか選択できたほうがええやろ」
- 判断:
  - その通り。家族ボードは低頻度・高重要度型で、あとから複数の親/義父母/祖父母を扱う前提があるため、最初の整理結果にも「誰のことか」を残す必要がある。
  - ただしログイン前に氏名必須にすると抵抗が出るため、関係性選択を主、呼び名入力を任意にした。
- 対応:
  - `DiagnosisAnswers` に `targetRelationship` と `targetName` を追加。
  - `targetLabel()` を追加し、呼び名があれば呼び名、なければ「お母さん/お父さん/義母/義父/祖父母/その他の家族」、未設定なら「親御さん」と表示。
  - Web診断画面の最初に「誰のことを整理しますか？」を追加。母/父/義母/義父/祖父母/その他をカードで選択できる。
  - 結果画面を「対象者の整理結果」として表示し、meta chipにも対象者を表示。
  - 結果サマリー本文も対象者名を含めるように変更。
- 検証:
  - Web typecheck OK。
  - Mobile typecheck OK。
  - `git diff --check` OK。
  - `next build apps/web` OK。
- 本番反映:
  - commit: `2908962 Add diagnosis target person selection`
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-299hu47g8-dogwoodcommunity1.vercel.app`
  - Deployment ID: `dpl_BQxbaJSeRzwgqxgiAVERZWT7WKKJ`
  - `HEAD /start` 200、`HEAD /diagnosis` 200。

## 2026-07-16 追記 81

- ユーザー指摘:
  - 「入院して退院後で在宅のステータスはないの？」
- 判断:
  - 必要。入院中と施設入所の間に、退院後の在宅療養・通院・服薬・訪問サービス・家の安全確認という別フェーズがある。
  - ここを「入院した」に混ぜると、退院後に家族が実際に困るタスクが弱くなるため、独立ステータス `post_discharge_home` として追加した。
- 対応:
  - shared `ParentStatus` に `post_discharge_home` を追加。
  - 表示名は「退院後・在宅療養」、Web入口ラベルは「退院後、家で過ごす」。
  - Web `/start` の急ぎ導線と状況グループへ追加。
  - Web `/diagnosis` の状況選択説明へ追加。
  - `buildDiagnosisResult` のタスクテンプレートに以下を追加:
    - 退院後の生活体制を確認する
    - 在宅サービスと連絡先をまとめる
    - 家の中の危ない場所を確認する
  - 相談先カテゴリは「ケアマネジャー」「訪問看護」「地域包括支援センター」。
  - `supabase/task_template_seed.sql` に新規DB向けseedを追加。
  - 既存本番DB向けに `supabase/post_discharge_home_task_seed.sql` を追加。Supabase SQL Editorで1回実行すれば、handoff後のtask生成にも反映される。
- 検証:
  - Web typecheck OK。
  - Mobile typecheck OK。
  - `git diff --check` OK。
  - `next build apps/web` OK。
- 残タスク:
  - 本番Supabase SQL Editorで `supabase/post_discharge_home_task_seed.sql` を実行する。
- 本番反映:
  - commit: `392f972 Add post-discharge home status`
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-gp1kdzaph-dogwoodcommunity1.vercel.app`
  - Deployment ID: `dpl_5URBDHsinvydyaqAu4b7bnctGbQH`
  - `HEAD /start` 200、`HEAD /diagnosis` 200。

## 2026-07-16 追記 82

- ユーザー指摘:
  - 「対象者が複数いる場合もあるやろ」
- 判断:
  - その通り。実際には母と父、実父母と義父母などを同時に気にしているケースがある。
  - ただしWeb診断のステータス選択と期限タスク生成は、まず一番急ぐ人を主対象にしないと結果がぼやける。
  - 方針は「主対象1名 + 追加対象者」。主対象に対して整理結果と初期タスクを作り、追加対象者は結果に残して、アプリ保存後に人ごとの家族ボードへ展開できる設計にする。
- 対応:
  - sharedに `TargetRelationship` / `DiagnosisTarget` を追加。
  - `DiagnosisAnswers.additionalTargets` を追加し、既存の `targetRelationship` / `targetName` は互換のため残した。
  - `diagnosisTargets()` と `targetDisplayName()` を追加し、`targetLabel()` は複数対象なら「母、父」または「母、父ほか1名」と表示。
  - Web診断の対象者セクションに「ほかにも一緒に気になる人がいる場合」を追加。
  - 追加対象者は最大4名まで、関係性選択 + 呼び名任意 + 削除ボタンで入力できる。
  - 結果画面では複数対象のchipを表示し、「主対象のタスクを作っている」「複数対象はアプリ保存後に人ごとに分けられる」と補足する。
- 検証:
  - Web typecheck OK。
  - Mobile typecheck OK。
  - `git diff --check` OK。
  - `next build apps/web` OK。
- 本番反映:
  - commit: `aeeef07 Allow multiple diagnosis targets`
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-2hl0s221o-dogwoodcommunity1.vercel.app`
  - Deployment ID: `dpl_HGkossDpewDifRYKSh5p7vjt1e2t`
  - `HEAD /start` 200、`HEAD /diagnosis` 200。
- 実機確認ポイント:
  - スマホで `/diagnosis` の最初に「対象者を追加」ボタンが出るか確認する。
  - 複数対象を追加して結果画面へ進むと、「2名を一緒に整理」などのchipが出るか確認する。

## 2026-07-16 追記 83

- ユーザー確認:
  - 「複数選んだら、それぞれの状況で管理できるの？アプリにも引き継がれる？」
- 正直な現状確認:
  - 追記82時点では、Web回答に `additionalTargets` は保存されるが、Supabase `consume_case_handoff` RPC は `people` を1件だけ作っていた。
  - Expo Dashboardも `people.limit(1)` で最初の対象者だけ表示していた。
  - つまり「結果には残る」が「アプリで複数人をそれぞれ管理できる」とは言えない状態だった。
- 対応:
  - `DiagnosisTarget.status` を追加。追加対象者ごとに状況を選べるようにした。
  - Web診断の追加対象者行に、関係性・呼び名・状況の3項目を表示。
  - `supabase/handoff_consume_rpc.sql` と `supabase/production_pending_hardening.sql` の `consume_case_handoff` を更新。
    - 主対象は `targetName` / `targetRelationship` から `people.display_name` と `relationship_to_family` を作成。
    - 追加対象者は `answers.additionalTargets` を走査して、対象者ごとに `people` を作成。
    - 追加対象者ごとの `status` に応じて `task_templates` から初期タスクを作成。
  - Expo `fetchDashboardData()` は `people.limit(1)` をやめ、同じ家族の対象者一覧を取得。
  - Expo Dashboardに「対象者」横スクロール一覧を追加。複数人がいる場合、各対象者のタスク画面へ移動できる。
- 検証:
  - Web typecheck OK。
  - Mobile typecheck OK。
  - `git diff --check` OK。
  - `next build apps/web` OK。
- 重要な残タスク:
  - 本番Supabase SQL Editorで `supabase/handoff_consume_rpc.sql` を再実行する。
  - これを実行しない限り、本番DBのRPCは古いままで、複数対象者はアプリに複数 `people` として作られない。
  - SQL投入後、実機で「母: 入院」「父: 退院後・在宅療養」など複数対象を選び、アプリ保存後にDashboardの対象者一覧へ2名出るか確認する。

## 2026-07-17 追記 84

- ユーザー指摘:
  - 「対象者を追加できるのはええけど、それ以降の質問でそれぞれの状態や状況がバラバラになる可能性もある」
  - 「とりあえず1人ずつ登録して、次に2人目・3人目を登録してマイページでそれぞれ管理できるようにできへんか」
- 判断:
  - この指摘を採用。Web診断内で複数人を同時に入力すると、後続質問の回答が誰の状態なのか曖昧になる。
  - 方針を「Web診断は1人ずつ」「2人目以降はアプリの家族ボードで追加」「対象者ごとに状態・期限・担当を分ける」に戻した。
  - DB/RPCの複数対象者対応は、古い診断データ互換のため残す。ただし新しいUIからは `additionalTargets` を送らない。
- 対応:
  - `apps/web/app/diagnosis/DiagnosisForm.tsx`
    - 追加対象者フォームを削除。
    - 対象者説明を「まず1人だけ」「2人目以降はアプリの家族ボードから追加」に変更。
    - 送信データから `additionalTargets` を外した。
  - `apps/web/app/result/[caseId]/page.tsx`
    - 複数対象者chipと補足文を削除。
    - アプリ保存案内に「複数人は保存後に家族ボードから1人ずつ追加」と明記。
  - `apps/mobile/lib/mobileData.ts`
    - `createPersonForFamily()` を追加。
    - 既存の対象者から `family_id` を取得し、同じ家族に新しい `people` を作成。
    - 作成後に `person_status_events` をinsertし、DB triggerで対象者ごとの初期タスク生成につなぐ。
  - `apps/mobile/app/people/new.tsx`
    - 新規追加。呼び名、続柄、今の状態だけで対象者を追加する画面。
    - 追加後はその対象者のタスク画面へ遷移。初期タスク生成に失敗した場合はステータス変更画面へ遷移して再保存できる。
  - `apps/mobile/app/(tabs)/dashboard.tsx`
    - 家族ボードに「対象者を追加」ボタンを常時表示。
    - 対象者カード一覧を1人だけの時も表示し、横スクロール末尾に「対象者を追加」カードを追加。
  - `apps/mobile/app/_layout.tsx`
    - `people/new` をStackに追加。
- 検証:
  - Web typecheck OK。
  - Mobile typecheck OK。
  - `git diff --check` OK。
  - `next build apps/web` OK。
- 本番反映:
  - commit: `d8a5c35 Switch diagnosis to one person at a time`
  - GitHub push: `main` へ反映済み。
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-iibpm0g69-dogwoodcommunity1.vercel.app`
  - Deployment ID: `dpl_E8qKiaSf8fLqyYC8Mh8PfLAckEYQ`
  - `HEAD /start` 200、`HEAD /diagnosis` 200。
- 次の確認:
  - Android実機で家族ボードを開き、「対象者を追加」から2人目を登録できるか確認する。
  - 追加した対象者のタスク画面に、その状態に応じたタスクが出るか確認する。

## 2026-07-17 追記 85

- ユーザー指摘:
  - `/start` の状況選択画面について「なんかわかりにくくない？」
  - スクショ上で「急いでいる時は、近いカードを押してください」「急いで確認したい」が重複して見え、どこを押すべきか迷う状態だった。
- 判断:
  - 選び方説明、よく選ばれる入口、カテゴリ見出しが重なっており、初見ユーザーには情報が多すぎた。
  - カード内にも「タップ」「矢印」「これを選ぶ」が並び、押せる場所の説明が逆にノイズになっていた。
- 対応:
  - `apps/web/app/start/page.tsx`
    - 重複していた「よく選ばれる入口」ブロックを削除。
    - 選び方説明を「下のカードから、近いものを1つ選びます」に変更。
    - 最初のカテゴリ見出しを「当てはまるものを1つ選んでください」に変更。
    - カード右上の「タップ」バッジを削除。
    - カード下部CTAを「このカードを選ぶ」に統一。
  - `apps/web/app/globals.css`
    - 状況カードを少し大きくし、下部CTAを横幅いっぱいのボタンに変更。
    - カテゴリ見出しをスマホでも読みやすいサイズへ調整。
- 検証:
  - Web typecheck OK。
  - `git diff --check` OK。
  - `next build apps/web` OK。
- 本番反映:
  - commit: `8493685 Clarify start status selection`
  - GitHub push: `main` へ反映済み。
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-hqy0662gi-dogwoodcommunity1.vercel.app`
  - Deployment ID: `dpl_BKkUAJQNcisozX5QG1NH5Rjnk1Wt`
  - `HEAD /start` 200。

## 2026-07-18 追記 86

- ユーザー状況:
  - 「アプリの中身を見れてないんや」と相談。
  - まずExpo実機プレビューを出す作業を開始。
- 確認:
  - 8081番ポートは未使用。
  - `adb devices` ではAndroid端末が未検出だったため、USB自動起動ではなくExpo GoのQR/URLで案内する方針にした。
  - `pnpm --filter mobile start -- --lan` はpnpmがnode_modules再作成を求めたため中止。
  - Codex同梱Node 24ではExpo SDK 51の `freeport-async` が `ERR_SOCKET_BAD_PORT` で落ちた。
  - Homebrewで `node@20` をインストールし、Node 20で再試行。
  - サンドボックス内ではポート待受が `EPERM` になったため、権限付きでExpo Metroを起動。
- 起動結果:
  - Expo Metro起動済み。
  - 実機確認URL: `exp://192.168.11.63:8081`
  - Expo GoでQRを読むか、URLを手入力すればアプリの中身を確認できる。
  - 表示対象は `apps/mobile` のExpoアプリ。
- 注意:
  - この起動はローカル開発サーバーなので、PCとスマホが同じWi-Fiにいる必要がある。
  - AndroidをUSBで直接開くには、端末側でUSBデバッグ許可後に `adb devices` で表示される必要がある。

## 2026-07-27 追記 87

- ユーザー判断:
  - 「基本アプリのみで使うやつと思ってる」
  - 「アプリの前段階がこの診断サイトってこと？」
  - 「いや、もうweb入口いらんで。いきなりアプリでええと思うで」
- 判断:
  - この方針を採用。
  - プロダクト本体はExpoアプリの「家族ボード・期限通知・写真/メモ・対象者管理」。
  - Webは診断入口ではなく、アプリ紹介、ガイド、法務、Stripe/管理画面などの補助役にする。
  - 既存の `/start -> /diagnosis -> /result` は互換・検証用として残すが、トップページの主導線からは外す。
- 対応:
  - `apps/web/app/page.tsx`
    - メタデータを「家族で使う保管庫・通知係」に変更。
    - Heroの主CTAを「無料で状況を選ぶ」から「アプリを開く」に変更。
    - Web診断入口を前面に出す構成をやめ、アプリの機能紹介へ変更。
    - 「最初からアプリで始めます」「対象者ごとに管理」など、アプリ本体前提のコピーへ変更。
  - `apps/web/app/globals.css`
    - 新しい `.app-gateway` を追加し、Webトップの主CTAがアプリ入口として見えるよう調整。
  - `apps/mobile/app/(auth)/welcome.tsx`
    - 「まずWebで整理したあと」という表現を削除。
    - アプリ内で親の名前・状況を登録して始めるコピーへ変更。
    - Webへの導線は「登録せずにWebで状況を整理する」から「使い方・安心設計を読む」へ変更。
- 検証:
  - Web typecheck OK: `apps/web/node_modules/.bin/tsc --noEmit`
  - Mobile typecheck OK: `apps/mobile/node_modules/.bin/tsc --noEmit`
  - `git diff --check` OK。
  - `next build` OK。
  - 注意: `pnpm --filter` はローカル環境でnode_modules再作成確認が出るため使わず、既存 `.bin` を直接実行した。

## 2026-07-27 追記 88

- ユーザー確認:
  - 「これは、アプリをダウンロードした後、開いたら最初に見るページ？」
  - 「せやな。アプリ内の設計、デザインやろ」
- 判断:
  - Web診断を前段にしない方針に合わせ、Expoアプリだけで初回の家族ボード作成が完了する必要がある。
  - 既存実装は `dashboard` の空状態がまだ「まずWebで状況を整理します」になっており、`people/new` も既存 `anchorPersonId` がないと対象者を追加できなかった。
- 対応:
  - `supabase/create_initial_family_person.sql`
    - 認証済みユーザー向けRPC `create_initial_family_person(display_name, relationship, status)` を追加。
    - profile upsert、family作成、owner family_member作成、people作成、person_status_events作成を1回で実行。
    - 既存familyがあるユーザーはそれを再利用し、初期タスクは既存triggerで生成する。
  - `apps/mobile/lib/mobileData.ts`
    - `createInitialFamilyPerson()` を追加。
    - 初回登録ではSupabase RPCを呼び、作成後に `fetchPerson()` で対象者を取得する。
  - `apps/mobile/app/(tabs)/dashboard.tsx`
    - 空状態を「Webで5分整理」から「まず親を1人登録して、家族ボードを作ります」へ変更。
    - CTAを `/people/new` への「家族ボードを作る」に変更。
    - Web整理済み説明を削除し、登録内容の説明へ変更。
  - `apps/mobile/app/people/new.tsx`
    - `anchorPersonId` がない場合は初回登録モードとして動作。
    - 初回CTAを「家族ボードを作る」に変更。
    - 2人目以降は従来通り既存familyへ追加。
  - `supabase/README.md`、`supabase/verify_setup.sql`、`supabase/verify_compact.sql`、`scripts/local-doctor.mjs`、`docs/PRODUCTION_CHECKLIST.md`
    - 新SQLと確認項目を追加。
- 検証:
  - Mobile typecheck OK: `apps/mobile/node_modules/.bin/tsc --noEmit`
  - `git diff --check` OK。
  - `node scripts/local-doctor.mjs` OK。
- 本番DBに追加で必要:
  - Supabase SQL Editorで `supabase/create_initial_family_person.sql` を1回実行する。
  - その後 `supabase/verify_compact.sql` で `create_initial_family_person` が true になることを確認する。

## 2026-07-27 追記 89

- ユーザー依頼:
  - 「pwaつくって」
- 判断:
  - 方針はアプリ/PWAファースト。
  - ネイティブアプリ公開前でも、iPhone/Androidのホーム画面に追加して「アプリのように使える」導線を先に完成させる。
  - 既存Web診断は残すが、PWA導線は `/home` と家族ボード利用を中心にする。
- 対応:
  - `apps/web/app/install/page.tsx`
    - PWAインストール案内ページを追加。
    - Android/Chromeではインストールボタン、iPhone/Safariでは共有ボタンからホーム画面追加の手順を表示。
  - `apps/web/components/PwaInstallPanel.tsx`
    - `beforeinstallprompt` を受けて、対応ブラウザではその場でインストールを促すUIを追加。
    - すでにスタンドアロン起動中の場合は「追加済み」と表示。
  - `apps/web/app/offline/page.tsx`
    - オフライン時のフォールバック画面を追加。
  - `apps/web/public/manifest.webmanifest`
    - `start_url` は `/home?source=pwa` のまま、ショートカットを「家族ボード」「ホームに追加」に更新。
  - `apps/web/public/sw.js`
    - Service Workerをv2化。
    - `/home`、`/install`、`/offline`、ガイド系ページと主要アイコンをキャッシュ。
    - `/api`、`/admin`、`/result`、`/diagnosis` はキャッシュ対象外。
    - ナビゲーション失敗時は `/offline` へフォールバック。
  - `apps/web/app/layout.tsx`
    - ナビとフッターに「ホームに追加」を追加。
  - `apps/web/app/page.tsx`
    - トップの主導線をPWA追加導線へ変更。
  - `apps/web/app/sitemap.ts`
    - `/install` を追加。
  - `scripts/local-doctor.mjs`、`scripts/smoke-web.mjs`
    - PWA必須ファイルと `/install`、`/offline` の確認を追加。
- 検証:
  - `python3 -m json.tool apps/web/public/manifest.webmanifest` OK。
  - Web typecheck OK: `apps/web/node_modules/.bin/tsc --noEmit`
  - `git diff --check` OK。
  - `node scripts/local-doctor.mjs` OK。
  - `next build` OK。
  - ローカル本番起動 `next start -p 3010` 後、`node scripts/smoke-web.mjs http://localhost:3010` OK。
- ユーザー確認URL:
  - 本番PWA追加ページ: `https://oyano-moshimo-navi.vercel.app/install`
  - iPhoneではSafariで開いて、共有ボタンから「ホーム画面に追加」。

## 2026-07-29 追記 90

- ユーザー確認:
  - iPhoneで `oyano-moshimo-navi.vercel.app` を開いたところ、PWA確認ページが 404 になったスクリーンショットを共有。
- 調査:
  - `https://oyano-moshimo-navi.vercel.app/home` は 200。
  - `https://oyano-moshimo-navi.vercel.app/install` は 404。
  - GitHub Actionsの最新run `Add PWA install flow` が失敗していた。
  - Next buildログ上では `/install` は生成されていたため、ページ実装ではなくデプロイ/CI側の問題。
  - 失敗原因は `.github/workflows/ci.yml` のSmoke起動コマンド。
    - 旧: `pnpm --filter web run start -- -p 3000`
    - Next側で `-p` がプロジェクトディレクトリ扱いになり、`apps/web/-p` が存在しないとして失敗。
- 対応:
  - `.github/workflows/ci.yml` を修正。
    - 新: `pnpm --filter web exec next start -p 3000`
  - これでCIのSmokeが正しくNext本番サーバーを3000番で起動する想定。
- 追加対応:
  - 修正後のCIでは `/install` は 200 になった。
  - 残りの失敗は `/api/account/delete-request`。
  - このAPIはSupabase未設定環境では `{ skipped: true }` で 200 を返し、本番設定ありでBearerなしなら 401 を返す設計。
  - `scripts/smoke-web.mjs` を `expectStatuses: [200, 401]` 対応にし、CI未設定環境と本番設定環境の両方を許容するよう修正。
- 次に必要:
  - commit/push後、GitHub Actionsが通ることを確認。
  - Vercelが再デプロイした後、`https://oyano-moshimo-navi.vercel.app/install` が 200 になることを確認。
- 完了確認:
  - GitHub Actions `Allow smoke auth skip response` は success。
  - Vercel CLIで本番デプロイを実行。
  - Production alias: `https://oyano-moshimo-navi.vercel.app`
  - `curl -I https://oyano-moshimo-navi.vercel.app/install` は 200。
  - `manifest.webmanifest` も新しいPWAショートカット内容へ更新済み。
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。

## 2026-07-29 追記 91

- ユーザー指摘:
  - 「入口がださい」
  - 「アプリ化するから最初のアプリにできますはいらん」
  - 「AI感がすごいからデザイン変えて」
- 判断:
  - `/install` はPWA説明ページではなく、アプリを開いた最初の入口画面として扱う。
  - 「ホーム画面に追加」「PWAとして使えます」をファーストビューから外し、家族ボードへ進む導線を中心にする。
  - ホーム画面追加の説明は、必要な人だけ読む下部補助に落とす。
- 対応:
  - `apps/web/app/install/page.tsx`
    - metadataを「ホーム画面に追加」から「親のもしもナビを開く」へ変更。
    - 「アプリ公開前の確認」など検証用コピーを削除。
    - 「親を1人ずつ管理」「期限と担当を見える化」「必要な時だけ戻る」へ説明を変更。
  - `apps/web/components/PwaInstallPanel.tsx`
    - 見出しを「ホーム画面に追加して、アプリのように使えます」から「家族で確認することを、ここにまとめます」へ変更。
    - 主CTAを「家族ボードを開く」に変更。
    - 「状況から整理する」も補助CTAとして残す。
    - 家族ボードのプレビューカードを追加し、単なる説明ページ感を減らした。
  - `apps/web/app/globals.css`
    - `/install` のheroを紙・付箋・家族ボード風に調整。
    - 白い説明カード中心から、家族ボードプレビューが見える構成へ変更。
  - `apps/web/app/page.tsx`
    - トップCTAを「ホーム画面に追加」から「親のもしもナビを開く」へ変更。
  - `apps/web/app/layout.tsx`
    - ナビ文言を「アプリを開く」に変更。
  - `apps/web/public/manifest.webmanifest`
    - shortcut名を「ホーム画面に追加」から「親のもしもナビを開く」へ変更。
- 検証:
  - Web typecheck OK: `apps/web/node_modules/.bin/tsc --noEmit`
  - `git diff --check` OK。
  - `manifest.webmanifest` JSON OK。
  - `next build` OK。
  - ローカル本番起動後、`node scripts/smoke-web.mjs http://localhost:3010` OK。

## 2026-07-29 追記 92

- 追記91の変更を本番へ反映。
- Git:
  - commit: `52f73cb Refine app entry design`
  - push: `main -> origin/main`
- Vercel:
  - production deploy OK。
  - deployment id: `dpl_Zu3gRbxmShkncY5qza1jwxwRihHN`
  - production alias: `https://oyano-moshimo-navi.vercel.app`
  - preview URL: `https://oyano-moshimo-navi-k6j0bkspw-dogwoodcommunity1.vercel.app`
- 本番確認:
  - `curl -I https://oyano-moshimo-navi.vercel.app/install` は 200。
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `/install`、`/home`、`/start`、`/diagnosis`、`/manifest.webmanifest`、`/sw.js` など主要導線が 200。
  - 認証必須APIは期待通り 401、Stripe checkoutは期待通り 400。
- 次に見るなら:
  - iPhoneで `https://oyano-moshimo-navi.vercel.app/install` を開き、入口が「PWA説明」ではなく「家族ボード入口」に見えるか確認。
  - まだAI感が残る場合は、次は写真/イラスト/キャラクター素材を入れて、アプリ初回画面全体のトーンを再設計する。

## 2026-07-29 追記 93

- ユーザー追加指摘:
  - 「なんかもっと」
  - 直前の意図は「入口がまだださい」「アプリ化説明はいらない」「AI感をもっと減らしたい」。
- 判断:
  - `/install` はさらに「PWA説明ページ」から離し、アプリを開いた最初のホーム/家族ボード入口として見せる。
  - 大きな白カードだけだとAIテンプレ感が残るため、見守り係の小さなキャラ、今日見るところ、対象者切替、担当未定タスクのプレビューを入れる。
- 対応:
  - `apps/web/components/PwaInstallPanel.tsx`
    - 小さな「見守り係」キャラを追加。
    - 「今日の入口 / まずは家族ボードを見ます」を追加。
    - 見出しを「親のことで動く時、家族の確認場所をひとつに。」へ変更。
    - できることチップ「対象者ごと」「担当未定を確認」「期限通知」を追加。
    - CTAを「今日の家族ボードを見る」「親の状況を追加する」に変更。
    - 家族ボードプレビューに「今日見るところ」、母/父の対象者カード、担当未定タスクを追加。
    - ホーム画面追加説明はさらに下部補助へ弱めた。
  - `apps/web/app/globals.css`
    - `/install` の背景を写真ベースの柔らかい生活感に寄せた。
    - メインパネルをアプリ初回ホーム風に調整。
    - 見守り係キャラ、ステータスチップ、家族ボードプレビュー、対象者カードのスタイルを追加。
- 検証:
  - Web typecheck OK: `apps/web/node_modules/.bin/tsc --noEmit`
  - `git diff --check` OK。
  - `next build` OK。
- 次:
  - commit/push。
  - Vercel本番deploy。
  - 本番URL `https://oyano-moshimo-navi.vercel.app/install` で確認。

## 2026-07-29 追記 94

- 追記93の変更を保存・本番反映。
- Git:
  - commit: `552e350 Warm up app entry design`
  - push: `main -> origin/main`
- 注意:
  - 一度 `apps/web` 直下で `npx vercel --prod --yes` を実行したところ、誤って別Vercelプロジェクト `dogwoodcommunity1/web` にリンクされ、`npm install` で失敗した。
  - その際に生成された `apps/web/.vercel` と `apps/web/.gitignore` は削除済み。
  - 今後Vercel本番deployは必ずリポジトリルート `/Users/ikedatetsuya/Documents/Codex/2026-07-05/zip-v0-3-web-expo-codex` で実行する。
- 正しい本番deploy:
  - project: `dogwoodcommunity1/oyano-moshimo-navi`
  - deployment id: `dpl_ED9rBa3Y8mZwEXiDSxyfjTSjXukf`
  - production URL: `https://oyano-moshimo-navi.vercel.app`
  - preview URL: `https://oyano-moshimo-navi-htbs1xucs-dogwoodcommunity1.vercel.app`
- 本番確認:
  - `curl -I https://oyano-moshimo-navi.vercel.app/install` は 200。
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `/install` は 200、主要導線・manifest・service workerもOK。

## 2026-08-20 追記 95

- ユーザー相談:
  - 「Claudeでデザインを作ってもらうからコード？か何かくれへんか」
- 対応:
  - Claudeにそのまま渡せるデザイン依頼書を作成。
  - ファイル: `review_exports/CLAUDE_DESIGN_REQUEST_oyano_moshimo_navi.md`
- 内容:
  - 親のもしもナビのプロダクト前提。
  - 低頻度・高重要度、家族ボード、対象者ごと管理という設計方針。
  - 改善対象画面:
    - `https://oyano-moshimo-navi.vercel.app/install`
    - `https://oyano-moshimo-navi.vercel.app/start`
  - 現在の `PwaInstallPanel.tsx` のコード。
  - 状況選択画面の主なカード構成。
  - Claudeに求める成果物:
    - デザイン指示書
    - JSX/CSS/React案
  - 守る制約:
    - 高齢者にも分かりやすい
    - AIテンプレ感を避ける
    - どこを押すか迷わない
  - PWA説明を主役にしない
  - 医療/法律/税務判断を断定しない

## 2026-08-20 追記 96

- ユーザー添付:
  - `/Users/ikedatetsuya/Downloads/Codex実装依頼書.md`
- 内容:
  - Claude作成の「家族の手帳」デザイン実装依頼。
  - 対象は `/install` と `/start`。
  - 入口はPWA説明ではなく、アプリを開いた最初の手帳画面として見せる。
  - 状況選択はカード一覧ではなく「もくじ」型にして、行全体を押せることが分かるUIへ寄せる。
- 対応:
  - `apps/web/app/layout.tsx`
    - `next/font/google` で `Noto_Sans_JP` と `Zen_Maru_Gothic` を導入。
    - body font用CSS変数 `--font-body`、見出し/ボタン用 `--font-rounded` を追加。
  - `apps/web/components/PwaInstallPanel.tsx`
    - インストール済み判定で古い完了カードを出す分岐を削除。
    - 「親のもしもナビ / 家族のための備え手帳」のタイトルカードへ変更。
    - 今日のページ、母/父のポラロイド風表示、手帳タスク行、家族ボードCTA、状況追加CTAへ変更。
    - PWA追加説明は補助の一文だけに弱めた。
  - `apps/web/app/start/page.tsx`
    - 古いヒーロー、キャラ、カードグリッドを削除。
    - 「もくじ — 親の状況」形式に変更。
    - 章:
      - これからに そなえる
      - 入院・退院のとき
      - 介護と看取り
      - 亡くなったあと
      - 整理と かたづけ
    - 各行は番号、タイトル、ヒント、選ぶチップ、矢印で構成し、行全体を押す設計。
    - 既存の `createCase(status)` → `/diagnosis?caseId=...&status=...` の処理は維持。
  - `apps/web/app/globals.css`
    - 手帳用トークンを追加。
    - 罫線紙背景、マスキングテープ、破線カード、ポラロイド、押した感、もくじ行、スマホ幅の折り返しを追加。
- 検証:
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `apps/web`: `next build` OK。
  - 初回ビルドは `next/font` が `fonts.googleapis.com` に出られず失敗したが、ネットワーク許可後に成功。
- 注意:
  - Git commit/push/deployまで完了。
  - commit: `cdea227 Apply notebook entry design`
  - push: `main -> origin/main`
  - Vercel production deployment id: `dpl_48jMWtkepYXfV6qWsNSLLaRw1Se2`
  - production URL: `https://oyano-moshimo-navi.vercel.app`
  - preview URL: `https://oyano-moshimo-navi-o3ex6pnjh-dogwoodcommunity1.vercel.app`
  - 最初の `npx vercel --prod --yes` は `Not authorized` で失敗したが、`--scope dogwoodcommunity1` を明示して成功。
  - 本番確認:
    - `curl -I https://oyano-moshimo-navi.vercel.app/install` 200。
    - `curl -I https://oyano-moshimo-navi.vercel.app/start` 200。
    - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 99

- ユーザー指摘:
  - スマホ側で変更がちゃんと表示されていない。
  - ロゴが前のままに見える。
  - デザインもまだ反映が不安定に見える。
- 原因:
  - `apps/web/app/layout.tsx` のcritical inline CSSに、旧ロゴ風の緑四角 `.brand::before` が残っていた。
  - `apps/web/app/globals.css` の通常ヘッダーも、ヘッダー用途に四角背景つき `logo-mark.png` を使っていた。
  - `apps/web/public/sw.js` が `/home` などのHTMLページをキャッシュ優先で返しており、PWA/スマホ側で古い家族ボードが残りやすかった。
- 対応:
  - `apps/web/app/layout.tsx`
    - critical inline CSSの `.brand::before` を `/brand/watch-bird-mark.svg` に変更。
    - CSSが読み込めない/遅れる場合でも旧四角ロゴが出ないようにした。
  - `apps/web/app/globals.css`
    - 通常ヘッダーの `.brand::before` も `/brand/watch-bird-mark.svg` に変更。
    - ヘッダーではアプリアイコン用の四角PNGではなく、見守り鳥単体ロゴを使う方針に統一。
  - `apps/web/public/sw.js`
    - cache versionを `oyano-moshimo-navi-v5` に更新。
    - `/home`、`/`、`/start` などHTMLページを静的cache-first対象から外し、ネットワーク優先に変更。
    - `/brand/watch-bird-mark.svg` をキャッシュ対象へ追加。
  - `apps/web/components/PwaRegister.tsx`
    - Service Worker登録後に `registration.update()` を呼び、更新検知後の `controllerchange` で自動リロードする処理を追加。
- 検証:
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `apps/web`: `next build` OK。
  - ビルド時に既存CSSの autoprefixer warning と Supabase Node 22 推奨警告は出るが、ビルドは成功。
- 注意:
  - この時点ではcommit/push/deploy前。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 98

- ユーザー指摘:
  - `/home` の家族ボードがClaudeデザインと統一されておらず、見た目がしょぼい。
  - 1人目登録済みなのに「1人目を登録する」ボタンが残っている。
  - 統計カードで「3」が2つ並び、意味が重複して見える。
  - 2人目以降で課金するには、1人目のマイページ自体が価値ある管理画面である必要がある。
  - ペッターのマイページのように、対象者ごとのプロフィール、日記、写真、健康チェック、期限、AI相談導線を持たせたい。
- 対応:
  - `apps/web/app/home/page.tsx`
    - 旧「全員を縦に並べる一覧型」家族ボードを廃止。
    - 登録済みの場合は、選択中の対象者の「マイページ」を主画面に表示する構成へ変更。
    - 対象者切り替えタブを追加し、2人目/3人目を切り替えて別々に管理できる見え方に変更。
    - 登録済み時は「1人目を登録する」ボタンを出さず、「今日の記録を書く」「別の人を追加」に変更。
    - 統計を「未完了タスク」「手帳の記録」「写真・資料」に変更し、重複した数字表示を解消。
    - プロフィールカード、今日の健康チェック、日記入力、最近の記録、次の期限、タスク順、写真・資料保管庫、AI相談Plusカードを追加。
    - 健康チェックのボタンを押すと、日記本文へ箇条書きで追記されるようにした。
  - `apps/web/app/globals.css`
    - `/home` 専用の手帳マイページUIを追加。
    - ヒーロー、対象者切替、プロフィール、健康チェック、手帳、タイムライン、写真棚、タスクカードを調整。
    - モバイルでは対象者タブを横スクロールにし、各カードを1カラム表示に変更。
- 検証:
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `apps/web`: `next build` OK。
  - ビルド時に既存CSSの autoprefixer warning と Supabase Node 22 推奨警告は出るが、ビルドは成功。
- 注意:
  - commit/push/deployまで完了。
  - commit: `c41377f Upgrade family board my page`
  - push: `main -> origin/main`
  - Vercel production deployment id: `dpl_2fr1piBiNTG9ged8ukxxvccamVvw`
  - production URL: `https://oyano-moshimo-navi.vercel.app`
  - preview/deployment URL: `https://oyano-moshimo-navi-nfqn37jq1-dogwoodcommunity1.vercel.app`
  - `npx vercel --prod --yes` を一度 `apps/web` から実行して失敗した。
    - 原因: Vercelが `apps/web` 単体で `npm install` し、`workspace:*` を解決できなかった。
    - 対応: repo rootから再実行し、rootの `vercel.json` を読ませて成功。
  - 本番確認:
    - `curl -I https://oyano-moshimo-navi.vercel.app/home` 200。
    - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 99

- ユーザー指摘:
  - 「入口からボタンを押せない」
  - 「全体的にわかりにくい」
  - 「基本、アプリのみでええから」
- 判断:
  - Webサイトからアプリへ誘導する見せ方ではなく、PWA自体をアプリ本体として扱う方針へ変更。
  - `/install` と `/start` はアプリ画面なので、サイトナビを見せず、最初に押す場所を1つに絞る。
- 対応:
  - `apps/web/components/PwaInstallPanel.tsx`
    - 「家族ボード」と「状況を書きたす」の2択をやめ、主CTAを「最初の登録を始める」1つに整理。
    - 既存ユーザー向けに「すでに登録済みの家族ボードを見る」を下部に分離。
    - 文言を「親のことを、このアプリで整理します。」へ変更。
  - `apps/web/app/start/page.tsx`
    - 見出しを「親は今、どの状況に近いですか？」に変更。
    - 「カード全体を押せます」と明記。
    - 各選択肢に短いラベルを追加し、「これを選ぶ」表示へ変更。
  - `apps/web/app/globals.css`
    - `.shell:has(.entry-screen)` と `.shell:has(.notebook-start-page)` でアプリ画面のサイトナビを非表示。
    - 入口CTAに `z-index` を付け、タップできない/押しにくい問題を避ける。
    - `/start` は点線目次よりも、押せるカードであることが分かるUIへ戻した。
- 検証:
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `apps/web`: `next build` OK。
  - Supabase Node 20 deprecation warningは出るがビルド失敗ではない。
- 注意:
  - Git commit/push/deployまで完了。
  - commit: `b8ad4d1 Clarify app-first entry flow`
  - push: `main -> origin/main`
  - Vercel production deployment id: `dpl_9Yoa8pV6X32pqaSApXKEr2iusNCs`
  - production URL: `https://oyano-moshimo-navi.vercel.app`
  - preview URL: `https://oyano-moshimo-navi-lkt4v89cc-dogwoodcommunity1.vercel.app`
  - 本番確認:
    - `curl -I https://oyano-moshimo-navi.vercel.app/install` 200。
    - `curl -I https://oyano-moshimo-navi.vercel.app/start` 200。
    - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
    - `/install` のHTMLに `最初の登録を始める` が反映済み。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 100

- ユーザー指摘:
  - 「アプリ入口いらんやろ」
  - 「基本、アプリのみでええから」
- 判断:
  - `/install` の中間入口ページは廃止。
  - PWA/アプリの最初の画面は `/start` の状況選択に寄せる。
  - 既存リンク・古いブックマーク対策として `/install` は残すが、中身は表示せず `/start` へリダイレクトする。
- 対応:
  - `apps/web/app/page.tsx`
    - LP内容を削除し、`/` から `/start` へリダイレクト。
  - `apps/web/app/install/page.tsx`
    - `PwaInstallPanel` 表示をやめ、`/start` へリダイレクト。
  - `apps/web/app/layout.tsx`
    - ナビから「アプリを開く」「料金」「チェックリスト」を外し、「親を登録」「家族ボード」「読む」「安心」に整理。
    - ブランドリンクを `/start` に変更。
    - フッター末尾を「親を登録する」に変更。
  - `apps/web/app/start/page.tsx`
    - 戻る先を `/install` から `/home` に変更。
  - `apps/web/public/manifest.webmanifest`
    - PWAの `id` と `start_url` を `/start` に変更。
    - ショートカットから `/install` を外し、「親を登録する」へ変更。
  - `apps/web/public/sw.js`
    - 静的キャッシュから `/install` を外し `/start` を追加。
    - キャッシュバージョンを `oyano-moshimo-navi-v3` に更新。
  - `apps/web/app/sitemap.ts`
    - sitemapから `/install` を除外。
  - `apps/web/next.config.mjs`
    - 古い `/` → `/home` リダイレクトが優先されていたため、`/` → `/start` に変更。
- 検証:
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `python3 -m json.tool apps/web/public/manifest.webmanifest` OK。
  - `apps/web`: `next build` OK。
- 注意:
  - 最初に `apps/web` 直下から `npx vercel --prod --yes --scope dogwoodcommunity1` を実行したところ、誤って別Vercelプロジェクト `web` にデプロイされ、`npm install` で失敗した。
  - 正しい本番はリポジトリルートの `.vercel/project.json` に紐づく `oyano-moshimo-navi`。以後デプロイは必ずリポジトリルートから実行する。
  - Git commit/push/deployまで完了。
  - commits:
    - `9cddd6f Remove app entry interstitial`
    - `348d22a Point root route to registration`
  - push: `main -> origin/main`
  - Vercel production deployment id: `dpl_B4NGWD6eUGes9bS6n9Kf7xCcuAt5`
  - production URL: `https://oyano-moshimo-navi.vercel.app`
  - preview URL: `https://oyano-moshimo-navi-25etpjgbf-dogwoodcommunity1.vercel.app`
  - 本番確認:
    - `curl -I https://oyano-moshimo-navi.vercel.app/` 307, `location: /start`。
    - `curl -I https://oyano-moshimo-navi.vercel.app/install` 307。
    - `curl -I https://oyano-moshimo-navi.vercel.app/start` 200。
    - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 101

- ユーザー指摘:
  - 「先頭の漢字アイコンやめてほしい」
  - 「選択項目のデザイン変えて」
- 判断:
  - `/start` の選択カード左側に出していた「入院」「在宅」などの漢字ラベルは硬く、タップ対象としても分かりにくい。
  - 画像を増やすより、表示が軽く崩れにくいCSSピクトで、押せるカード感を強める。
- 対応:
  - `apps/web/app/start/page.tsx`
    - `TocItem.icon` を漢字文字列から `note/chat/bed/home/care/heart/bell/paper/tree/box/check` の種別へ変更。
    - カード説明文を「カード全体をタップできます」とより具体化。
    - 各カード内に小さく「このカードを押す」を追加。
    - 右上チップを「これを選ぶ」から短い「選択」へ変更。
  - `apps/web/app/globals.css`
    - 選択カードを白背景の大きなボタン風に再設計。
    - 左側の漢字アイコンを廃止し、CSSだけで描く簡単なピクトアイコンに変更。
    - カード左端に色バー、影、hover/focus/activeの反応を追加。
    - スマホ幅でもアイコンとタイトルが詰まらないよう寸法を調整。
- 検証:
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `apps/web`: `next build` OK。
- 注意:
  - この時点ではまだcommit/push/deploy前。この追記101以降で実施すること。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 102

- ユーザー方針:
  - 「Web入口」ではなく、PWA/アプリを開いた最初の画面から完結する体験に寄せる。
  - まず1人目を登録し、整理結果をそのまま家族ボードの対象者として管理する。
  - 複数対象者は1回の診断で混ぜず、2人目・3人目として1人ずつ追加する。
  - 今後の進捗更新、変化確認、今やるべきことの提示、有料プラン提案までアプリ内で見せる。
- 対応:
  - `apps/web/app/page.tsx`
    - `/` の `/start` 強制リダイレクトを廃止し、PWA/アプリの初期画面を表示するよう変更。
  - `apps/web/next.config.mjs`
    - `/` → `/start` redirect を削除。
  - `apps/web/components/PwaInstallPanel.tsx`
    - LP/インストール前提の文言から、「親の状況を1人ずつ管理」「1人目を登録する」へ変更。
    - 進捗更新、家族ボード、複数対象者管理、有料プラン導線を追加。
  - `apps/web/app/home/page.tsx`
    - 既存の `../page` 再利用を廃止し、登録済みケースを localStorage から読む家族ボードへ作り直し。
    - 未登録時は「1人目を登録する」。
    - 登録済み時は「1人目/2人目」、状況、確認リスト件数、担当未定件数、次にやること、変化登録導線を表示。
    - Family Plus提案を追加。
  - `apps/web/app/result/[caseId]/page.tsx`
    - 「アプリに保存する」中心の表現をやめ、整理結果を「1人目として家族ボードで管理」する導線へ変更。
    - 結果後に `/home` へ戻って進捗確認できるCTAを追加。
    - 有料プラン提案を追加。
  - `apps/web/app/start/page.tsx`
    - 戻る先を `/home` から `/` に変更。
    - 見出しを「1人目の登録」に変更。
  - `apps/web/app/layout.tsx`
    - ブランドリンクを `/` に変更。
    - ナビ文言を「はじめる」「家族ボード」に整理。
  - `apps/web/app/install/page.tsx`
    - `/install` は `/` へリダイレクト。
  - `apps/web/public/manifest.webmanifest`
    - PWAの `id` と `start_url` を `/` に変更。
  - `apps/web/public/sw.js`
    - cache versionを `v4` に更新し、`/` を静的キャッシュ対象へ追加。
  - `apps/web/app/globals.css`
    - アプリ初期画面のPlus案内、家族ボード、対象者カード、月1確認、モバイル調整を追加。
- 検証:
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `python3 -m json.tool apps/web/public/manifest.webmanifest` OK。
  - `apps/web`: `next build` OK。
  - build時にSupabase JSのNode 22推奨警告が出るが、ビルド自体は成功。
- 注意:
  - Git commit/push/deployまで完了。
  - commit: `ad35d04 Reframe PWA as app-first family board`
  - push: `main -> origin/main`
  - Vercel production deployment id: `dpl_7fC58AaNLDQy6RX2zTEqGqVkfwTP`
  - production URL: `https://oyano-moshimo-navi.vercel.app`
  - preview URL: `https://oyano-moshimo-navi-ksg1e7kro-dogwoodcommunity1.vercel.app`
  - 本番確認:
    - `curl -I https://oyano-moshimo-navi.vercel.app/` 200。
    - `curl -I https://oyano-moshimo-navi.vercel.app/home` 200。
    - `curl -I https://oyano-moshimo-navi.vercel.app/start` 200。
    - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 103

- ユーザー方針:
  - 「家族ボード」はタスク管理だけでは足りない。
  - 父母に固定せず、義父母・親戚など対象者ごとの「手帳」にする。
  - 日々の体調、発言、入院・介護の変化、家族で集まったこと、写真/PDFを記録できるようにする。
  - 記録をもとに、AIが次に確認することや備え方を相談できる状態にしたい。
  - 2人目以降とAI相談は有料版の中心にする。
  - 選択画面の意味が分かりにくい余計なチップ/説明は削る。
- 対応:
  - `apps/web/lib/store.ts`
    - `DiaryEntry` / `DiaryAttachment` 型を追加。
    - localStorage `oyano_diary_entries_v01` に日々の記録を保存する関数を追加。
    - `addDiaryEntry()`、`listDiaryEntries()`、`diaryAdvice()` を追加。
    - `diaryAdvice()` は本番AI導入前の安全なMVPとして、記録本文から医療/認知/お金/実家などの確認アドバイスを返す。
  - `apps/web/app/home/page.tsx`
    - 対象者カード内に「日々の記録」「対象者の手帳」を追加。
    - 本文、変化状態、写真/PDF添付を入力できるようにした。
    - 画像はプレビュー、PDF等はファイル名で表示。
    - 最新記録と、記録内容からの次に確認することを表示。
    - AI相談カードを有料版として追加。
  - `apps/web/app/start/page.tsx`
    - 見出しを「管理する人の、今の状況を選んでください。」へ変更。
    - 父母固定ではなく、義父母・親戚なども後で名前入力できる説明へ変更。
    - `このカードを押す` と右上の `選択` チップを削除し、カード内の自然な文言「この状況で登録する」へ変更。
  - `apps/web/app/plans/page.tsx`
    - 無料=1人目の家族ボード/日々の記録。
    - Family Plus=複数対象者、写真/PDF容量、PDF出力、履歴保存。
    - AI相談=Plus内機能として、対象者プロフィールと日々の記録を踏まえる相談機能へ整理。
  - `apps/web/app/globals.css`
    - 日々の記録、添付ファイル、最新記録、AI相談カードのスタイルを追加。
    - 選択カードの新しい行動文スタイルを追加。
    - mobileで日記入力とAI相談カードが縦積みになるよう調整。
- 検証:
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `apps/web`: `next build` OK。
  - build時にSupabase JSのNode 22推奨警告が出るが、ビルド自体は成功。
  - 変更コミット: `2dd159d Add family diary and paid AI consultation framing`
  - `git push origin main` OK。
  - Vercel production deploy OK。
    - Deployment ID: `dpl_2i6V83Xr9zwcFrmRn2pQYLUpZHpP`
    - Production URL: `https://oyano-moshimo-navi.vercel.app`
    - Deployment URL: `https://oyano-moshimo-navi-lm1haq10a-dogwoodcommunity1.vercel.app`
  - `curl -I https://oyano-moshimo-navi.vercel.app/` 200。
  - `curl -I https://oyano-moshimo-navi.vercel.app/home` 200。
  - `curl -I https://oyano-moshimo-navi.vercel.app/start` 200。
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
- 注意:
  - 写真/PDF保存はまずPWA内localStorage MVP。Supabase Storage永続化は次フェーズ。
  - 本格AI相談はまだUI/設計導線。OpenAI API連携・課金ゲート・要配慮情報同意の再確認が必要。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 104

- ユーザー報告:
  - 本番URL `https://oyano-moshimo-navi.vercel.app` をiPhoneで開くと、トップ画面が素のリンク表示になり、ロゴSVGが巨大表示されて「ちゃんと開かない」状態になった。
  - スクリーンショット上は外部CSSが当たっていない時の表示に見える。
- 調査:
  - `curl -L https://oyano-moshimo-navi.vercel.app/` でHTML内にNext.jsのCSSリンク3本が存在することを確認。
  - 実際のCSS URL:
    - `/_next/static/css/5a114f8ec335e992.css` 200。
    - `/_next/static/css/578954d430ecd175.css` 200。
    - `/_next/static/css/ca0f0e5ebfef9fd8.css` 200。
  - サーバ配信自体は正常。iPhone側のWebView/キャッシュ/一時的なCSS読み込み失敗でもトップが破綻しない対策が必要と判断。
- 対応:
  - `apps/web/app/layout.tsx`
    - `criticalCss` を追加。
    - root layoutの`<head>`に最低限の重要スタイルをインライン出力。
    - body/nav/entry screen/title card/watch bird mark/CTA/footerなどを、外部CSSが遅延・欠落しても読める表示にする。
    - 特に `.watch-bird-mark` を `54-64px` に制限し、巨大SVG表示を防ぐ。
- 検証:
  - `npm run typecheck --workspace apps/web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace apps/web` OK。
  - build時にSupabase JSのNode 22推奨警告が出るが、ビルド自体は成功。
- 次:
  - commit/push/deploy後、本番URLを再確認する。
  - ユーザー側ではiPhoneの共有ブラウザ/アプリ内ブラウザで再読み込み、必要ならタブを閉じて開き直す。
- 反映:
  - 変更コミット: `eec767c Add critical inline styles for PWA entry`
  - `git push origin main` OK。
  - Vercel production deploy OK。
    - Deployment ID: `dpl_7sjHaStTitCvXjJEwbQKDSiQBv7a`
    - Production URL: `https://oyano-moshimo-navi.vercel.app`
    - Deployment URL: `https://oyano-moshimo-navi-p78x23kk7-dogwoodcommunity1.vercel.app`
  - `curl -I https://oyano-moshimo-navi.vercel.app/` 200。
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `curl -L https://oyano-moshimo-navi.vercel.app/ -o /tmp/oyano-root.html` OK。
  - `/tmp/oyano-root.html` 内に `watch-bird-mark{display:block;height:64px` が存在することを確認。

## 2026-08-20 追記 98

- ユーザー添付:
  - `/Users/ikedatetsuya/Downloads/ロゴ実装資料.md`
- 内容:
  - 採用案3c「見守り鳥」を正式ロゴとして実装する資料。
  - SVG基本形、PWA/favicon用アプリアイコン、ロックアップ仕様、禁止事項が指定された。
- 対応:
  - `apps/web/components/PwaInstallPanel.tsx`
    - タイトル札の仮CSS鳥を、資料指定の56px viewBox SVGへ置き換え。
    - 輪郭/目 `#33424A`、帽子 `#4A8FA6`、くちばし `#E8A15D` に統一。
  - `apps/web/app/globals.css`
    - 旧CSS鳥の帽子/目/くちばし用spanスタイルを削除。
    - `.watch-bird-mark` をSVG表示用に整理。
  - `scripts/generate-brand-assets.mjs`
    - 旧「書類+チェック」アイコン生成を廃止。
    - PWA/Expo/通知/スプラッシュ用PNGを見守り鳥ベースで再生成するロジックへ変更。
  - `apps/web/public/brand/`
    - `watch-bird-mark.svg` と `app-icon.svg` を追加。
    - `logo-mark.png`、`pwa-icon-192.png`、`apple-touch-icon.png`、`favicon-32.png`、`favicon-16.png` を生成。
  - `apps/mobile/assets/`
    - `icon.png`、`adaptive-icon.png`、`splash.png`、`notification-icon.png` を見守り鳥ベースで再生成。
  - `apps/web/public/manifest.webmanifest`
    - 16px/32px faviconをiconsへ追加。
  - `apps/web/public/sw.js`
    - 新faviconをキャッシュ対象へ追加。
  - `docs/BRAND_ASSETS.md`
    - 正式ロゴ方針を「見守り鳥」へ更新。
- 検証:
  - `node scripts/generate-brand-assets.mjs` OK。
  - `python3 -m json.tool apps/web/public/manifest.webmanifest` OK。
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `apps/web`: `next build` OK。
  - 最初に `Zen_Maru_Gothic` の900ウェイト追加でGoogle Fonts取得が必要になり、ネットワーク制限下で失敗。ビルド安定を優先し、読み込みウェイトは既存の700に戻した。
- 注意:
  - Git commit/push/deployまで完了。
  - commit: `e4a4a6a Implement watch bird logo assets`
  - push: `main -> origin/main`
  - Vercel production deployment id: `dpl_CFGrU2Co3CcYMbib92RuzZUhErPK`
  - production URL: `https://oyano-moshimo-navi.vercel.app`
  - preview URL: `https://oyano-moshimo-navi-7hjtelfja-dogwoodcommunity1.vercel.app`
  - 本番確認:
    - `curl -I https://oyano-moshimo-navi.vercel.app/install` 200。
    - `curl -I https://oyano-moshimo-navi.vercel.app/brand/logo-mark.png` 200。
    - `curl -I https://oyano-moshimo-navi.vercel.app/brand/favicon-32.png` 200。
    - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 97

- ユーザー添付:
  - `/Users/ikedatetsuya/Downloads/Codex実装依頼書-2.md`
- 内容:
  - 追記96の「家族の手帳」デザインをさらに細かく詰める依頼。
  - 追加の重点:
    - 入口タイトル札に「見守り鳥」ロゴマークを入れる。
    - グラデーションや漢字1文字アイコンを避ける。
    - `/start` はカード感を弱め、章タブ + 点線リーダーの「もくじ」感を強める。
    - 主ボタンは `--primary` のみ、押すと沈む。
    - PWA案内は補助の一文だけに留める。
- 対応:
  - `apps/web/components/PwaInstallPanel.tsx`
    - タイトル札へCSS図形の `watch-bird-mark` を追加。
    - ロックアップに `MOSHIMO NAVI` を追加。
  - `apps/web/app/globals.css`
    - `.paper-bg` を単純な罫線紙背景に変更。
    - タイトル札、テープ、鳥マークを依頼書2寄りに調整。
    - ポラロイドの人物プレースホルダーをグラデーションなしの色地 + 人型シルエットに変更。
    - 主/副ボタンの影とactive沈み込みを調整。
    - `/start` の `toc-row` を枠付きカードから、点線リーダー付きのもくじ行へ調整。
    - 章タブを左に食い込む栞タブ風へ変更。
- 検証:
  - `apps/web`: `tsc --noEmit` OK。
  - `git diff --check` OK。
  - `apps/web`: `next build` OK。
  - ローカル `next start -p 3005` は `listen EPERM` で起動不可。この環境のポート権限問題で、コード/ビルドはOK。
- 注意:
  - Git commit/push/deployまで完了。
  - commit: `90df502 Refine notebook visual system`
  - push: `main -> origin/main`
  - Vercel production deployment id: `dpl_9wzoQfiNA4o7i3pqVTnVPjbA8WfJ`
  - production URL: `https://oyano-moshimo-navi.vercel.app`
  - preview URL: `https://oyano-moshimo-navi-2bv1dthg2-dogwoodcommunity1.vercel.app`
  - 本番確認:
    - `curl -I https://oyano-moshimo-navi.vercel.app/install` 200。
    - `curl -I https://oyano-moshimo-navi.vercel.app/start` 200。
    - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 98

- ユーザー要望:
  - Web診断サイトより、基本はPWA/アプリだけで完結する「家族の管理手帳」に寄せたい。
  - 整理結果が浅く、1人目のマイページ作成を押したくなる価値説明が弱い。
  - 1人目マイページに、対象者のフルネーム、呼び名、関係、生年月日、状態、連絡窓口、病院・施設、薬、書類保管メモなどを入力できるようにしたい。
  - 家族共有はURLだけで誰でも見られる形にせず、招待制/ログイン前提にしたい。2人目以降、家族共有、AI相談はPlus導線にしたい。
- 対応:
  - `apps/web/app/result/[caseId]/page.tsx`
    - 結果画面に「このまま続ける理由」「1人目のマイページでできること」を追加。
    - 結果を単なる診断ではなく、この人専用の管理手帳へつなげる導線に変更。
    - CTAを「1人目のマイページを作る」「この人のマイページへ進む」に寄せた。
  - `apps/web/lib/store.ts`
    - `PersonProfile` を追加。
    - `CaseRecord.personProfile` と `updateCaseProfile()` を追加し、localStorage上でプロフィール更新できるようにした。
  - `apps/web/app/home/page.tsx`
    - 1人目登録後は「お母さん/お父さん等のマイページ」として表示。
    - プロフィール充実度、概要、編集フォーム、今日のチェック、日記、写真/PDF添付、最近の記録、次にやること、家族共有、AI相談を1人ごとにまとめた。
    - 登録済み状態では「1人目を登録する」を出さず、「今日の記録を書く」と「別の人を追加（Plus）」に切り替える。
    - 家族共有カードを「Plus」「招待制」「URLだけでは不可」と明記。
  - `apps/web/app/globals.css`
    - マイページ/結果導線用のスタイルを追加。
    - AIっぽく見える装飾丸を削除し、家族手帳ヒーローのCTAを白系に変更して落ち着かせた。
- 検証:
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。
  - ローカル `http://127.0.0.1:3000/home` をスマホ幅で確認。
  - `/admin` のローカルデモcase作成を使って、登録済みマイページ表示もスマホ幅で確認。
- 注意:
  - 現時点のプロフィール/日記はPWAローカル保存中心。次に本格化するならSupabase `people` / `diary_entries` / `attachments` へ同期する。
  - 家族共有はUI上Plus導線に寄せたが、実際の招待/権限制御の本番接続は次工程で詰める。
  - AI相談は有料機能の位置づけをUIに出した段階。実AI連携は未実装。

## 2026-08-20 追記 99

- ユーザー要望:
  - 「基本アプリのみで完結管理」に寄せる。Web入口/PWA案内っぽい画面はいらない。
  - 1人目の登録後に、もう一度「1人目を登録する」が出るのは混乱する。
  - 2人目以降、家族共有、AI相談は有料プランにしてよい。
  - 家族共有はURLを知っていれば誰でも見られる形ではなく、招待制/ログイン制にする前提。
- 対応:
  - `apps/web/app/page.tsx`
    - `/` をPWA案内ではなく `/home` へリダイレクトするよう変更。
  - `apps/web/app/layout.tsx`
    - ブランドリンクを `/home` に変更。
    - ナビから「はじめる」を削除し、「家族ボード / 読む / 安心」に整理。
    - footer の「1人目を登録する」を「家族ボード」に変更。
  - `apps/web/app/home/page.tsx`
    - 登録済み時の対象者追加カードを `/plans` へ変更し、`Plus / 2人目以降` と明記。
    - 未登録時の空カードから重複する「1人目を登録する」ボタンを削除。
    - 登録後に使える機能を「プロフィール / 日記 / 写真・PDF / 期限タスク」として表示。
  - `apps/web/app/result/[caseId]/page.tsx`
    - 家族共有ボタンを直接共有ではなく「家族共有はPlusで設定」へ変更。
  - `apps/web/app/globals.css`
    - Plus追加カードと未登録機能チップの見た目を調整。
- 検証:
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。
  - `node scripts/smoke-web.mjs http://127.0.0.1:3005` OK。
  - `/` は `307` で `/home` に寄ることを確認。
  - Browserプラグインで `390x844` 幅の `/home` を確認。
    - 登録済み状態で `1人目を登録する` の表示は0件。
    - ナビに「はじめる」は出ない。
    - 2人目追加は `Plus + 追加 2人目以降` として表示。
- 注意:
  - まだSupabase同期ではなくローカル保存のPWAプロトタイプ。次は `people` / `diary_entries` / `attachments` のDB保存と、Plus判定を本番実装する。
  - Git commit/push/deployまで完了。
  - commit: `d9b9c7b Refine family notebook onboarding`
  - push: `main -> origin/main`
  - Vercel production deployment id: `dpl_J315ZmW4xQfPLoJHSkCc3uUbdxvd`
  - production URL: `https://oyano-moshimo-navi.vercel.app`
  - preview URL: `https://oyano-moshimo-navi-hdxbj6pfx-dogwoodcommunity1.vercel.app`
  - 本番確認:
    - `curl -I https://oyano-moshimo-navi.vercel.app/` 307。
    - `curl -I https://oyano-moshimo-navi.vercel.app/home` 200。
    - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。

## 2026-08-20 追記 100

- ユーザー要望:
  - 1人目の登録後に「これは使える」と思えるマイページにしたい。
  - 対象者ごとにプロフィール、日記、写真/PDFメモ、タスク、家族共有、AI相談導線を持たせたい。
  - 父母に固定せず、義父母・親戚なども1人ずつ管理できる前提にしたい。
  - 日々の記録を蓄積し、将来AI相談の文脈として使えるようにしたい。
- 対応:
  - `supabase/schema.sql`
    - `people.profile jsonb` と `profile_updated_at` を追加。
    - `timeline_events.mood` / `attachments jsonb` / `metadata jsonb` を追加。
  - `supabase/person_notebook_hardening.sql`
    - 既存DB向けに上記カラム、mood check制約、indexを追加する個別SQLを新規作成。
  - `supabase/create_initial_family_person.sql`
    - アプリ単体で1人目を作るRPCに `profile` 初期値を保存するよう変更。
  - `supabase/handoff_consume_rpc.sql`
    - Web診断から引き継いだケースも `people.profile` に初期情報を保存。
  - `supabase/production_pending_hardening.sql`
    - 本番一括hardeningにもプロフィール/日記カラム、index、consume RPC更新を反映。
  - `supabase/indexes.sql` / `verify_setup.sql` / `verify_compact.sql`
    - person notebook系のindex/column確認を追加。
  - `docs/PRODUCTION_CHECKLIST.md`
    - 個別投入SQLとして `supabase/person_notebook_hardening.sql` を追加。
  - `apps/mobile/lib/mobileData.ts`
    - `MobilePersonProfile`、`MobileTimelineEntry`、プロフィール更新、日記取得/追加関数を追加。
    - Supabase接続時は空データにデモデータを混ぜないよう変更。
  - `apps/mobile/app/people/[id]/index.tsx`
    - 対象者詳細を「管理手帳」に刷新。
    - プロフィール編集、充実度、今日の記録、未完了/担当未定/記録数、Plus導線、各機能への入口を追加。
  - `apps/mobile/app/people/[id]/timeline.tsx`
    - デモ表示のみから、今日の記録を保存できる日記帳へ変更。
    - 変化なし/変化あり/急ぎの印、定型メモ、写真/PDFメモ、過去記録一覧を追加。
  - `apps/mobile/app/people/new.tsx`
    - 登録後の遷移先をタスク一覧ではなく、その人の管理手帳に変更。
  - `apps/mobile/app/(tabs)/dashboard.tsx`
    - 対象者カードの遷移先をタスク一覧から管理手帳へ変更。
- 検証:
  - `npm run typecheck --workspace mobile` OK。
- 注意:
  - 写真/PDFは今回「日記上の添付メモ」まで。実ファイル選択/アップロードは次工程で `expo-image-picker` / `expo-document-picker` 等を入れて実装する。
  - 本番Supabaseへは新規DB差分の投入が必要。個別なら `supabase/person_notebook_hardening.sql`、一括なら更新済み `supabase/production_pending_hardening.sql`。
  - `review_exports/` は未追跡のまま残っている。

## 2026-08-20 追記 101
- 実施:
  - 追記100の「1人目の管理手帳・日記基盤」実装をコミットし、GitHub `main` にpushした。
- GitHub:
  - commit: `e59ba96 Build person notebook and diary foundation`
  - remote: `https://github.com/dogwoodcommunity/oyano-moshimo-navi.git`
  - branch: `main`
- 検証済み:
  - `npm run typecheck --workspace mobile` OK。
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - root `npm run typecheck` は環境に `pnpm` がなく `sh: pnpm: command not found` で失敗。web/mobile個別は通っている。
- 次候補:
  - 本番Supabaseに `supabase/person_notebook_hardening.sql` を投入して、`verify_setup.sql` または `verify_compact.sql` で全true確認。
  - 日記の写真/PDFを「メモ」から実ファイルアップロードへ拡張する。
  - 1人目管理手帳の画面を実機で確認し、文字サイズ・余白・CTAのわかりやすさを磨く。

## 2026-08-20 追記 102

- ユーザー要望:
  - 基本はWeb入口ではなく、PWA/アプリだけで完結する体験に寄せる。
  - 1人目の整理結果から「この人の管理手帳を作りたい」と思える内容にする。
  - 1人目のマイページを、プロフィール・日記・写真/PDF・期限・家族共有・AI相談の価値が伝わる画面にする。
  - 2人目以降、家族共有、AI相談はPlus導線にしてよい。
  - スマホで押したあと反応が遅く見える問題も確認する。
- 対応中:
  - `apps/web/app/diagnosis/DiagnosisForm.tsx`
    - 診断送信後を `router.push` ではなく `window.location.assign` に変更し、スマホ/PWAでも結果ページへ確実に遷移させる。
    - 送信失敗時のエラー表示を追加。
  - `apps/web/app/result/[caseId]/page.tsx`
    - 結果後の導線を「この結果を、対象者の管理手帳に残す」に変更。
    - 無料の1人目、日記で変化を残す、Plusで2人目/家族招待/AI相談へ広げる、の3カードを追加。
    - CTAを「無料でこの人の手帳を作る」「この人の管理手帳へ進む」に変更。
  - `apps/web/app/home/page.tsx`
    - 登録済みの家族ボードに「この人のマイページ」カード群を追加。
    - プロフィール、日記、写真/PDF、期限、家族共有、AI相談の管理価値を上部で説明。
    - 登録済み時は「1人目の管理手帳」ではなく「この人の管理手帳」と表示。
    - 対象者切替の先頭表示を「無料枠」に変更して、登録ボタンとの混同を減らす。
  - `apps/web/app/globals.css`
    - 管理手帳カード、結果保存カード、送信エラー表示のスタイルを追加。
  - `apps/web/public/sw.js`
    - PWAキャッシュ更新用に `CACHE_VERSION` を `oyano-moshimo-navi-v8` に更新。
- 次にやること:
  - `npm run typecheck --workspace web`
  - `git diff --check`
  - `npm run build --workspace web`
  - スマホ幅で `/home` と診断→結果→家族ボードの表示確認。

## 2026-08-20 追記 103

- ユーザー要望:
  - 1人目登録後の誘導とマイページを、使いたくなる「管理手帳」に寄せる。
  - 入口カードを押しても反応しない/遅く見える問題を確認する。
  - 1人目登録済みなのに、再度「1人目を登録する」が出る状態をなくす。
- 追加対応:
  - `apps/web/lib/store.ts`
    - `createLocalId()` を追加し、`crypto.randomUUID()` が使えないブラウザ/埋め込み環境でもID生成できるようにした。
    - localStorageが使えない環境でも現在セッション内ではケース/日記を保持できるよう、メモリフォールバックを追加。
    - `createCase()`、日記作成、ローカルデモcase作成を安全なID生成に変更。
  - `apps/web/app/start/page.tsx`
    - 入口カードの作成処理で例外が起きても無言で止まらないよう、エラーメッセージと状態復帰を追加。
  - `apps/web/app/diagnosis/DiagnosisForm.tsx`
    - `caseId` 生成を安全な `createLocalId()` に変更。
    - 結果ページへの遷移をアプリ内遷移に戻し、PWA/スマホで押した後の体感を軽くした。
  - `apps/web/app/result/[caseId]/page.tsx`
    - ローカルケース読み込み前に `お母さん / 元気・準備中` へ落ちる問題を修正。
    - ケースが読めるまでローディング、見つからない時は再登録案内を出す。
- ローカル実機相当確認:
  - 開発サーバーを再起動して、古い `.next` チャンク混入による `Cannot find module './9303.js'` を解消。
  - Browserプラグインを `390x844` 幅にして `/start -> /diagnosis -> /result/[caseId] -> /home` を通した。
  - `入院した` から診断画面に遷移することを確認。
  - `お父さん` / `長期入院中...` で送信し、結果画面に `お父さんの整理結果` と入院系結果が出ることを確認。
  - 結果から家族ボードへ進み、`お父さんの管理手帳`、プロフィール、日記、AI相談導線が出ることを確認。
  - 登録済み状態で `1人目を登録する` は表示されないことを確認。
  - `390px` 幅で横はみ出しなし。
- 検証:
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。
  - build時にSupabase JSのNode 20非推奨警告は出るが、ビルド自体は成功。
- 注意:
  - `review_exports/` は未追跡のまま残している。
  - 本番反映後、iPhone/PWAで古い表示が残る場合はService Workerキャッシュ更新のため、`?v=20260820-103` 付きURLで開く。

## 2026-08-20 追記 104

- ユーザー指摘:
  - `/plans` の下部に出ていた `Business policy` / 「信頼を失わずに、ちゃんと儲けるための線引き。」カードは必要か確認。
  - 家族向けUIに内部の収益方針が出ると、売り込み感が強く見える。
- 判断:
  - このカードはユーザー向け画面には不要。
  - 料金/Plusページでは「無料で何が使えるか」「Plusで何が増えるか」「AI相談はPlus内機能」だけを見せる。
  - 事業上の課金方針は内部資料やレビュー資料に残し、アプリ/PWA画面からは外す。
- 対応:
  - `apps/web/app/plans/page.tsx`
    - `revenueRules` と `revenue-panel` セクションを削除。
  - `apps/web/public/sw.js`
    - PWAキャッシュ更新用に `CACHE_VERSION` を `oyano-moshimo-navi-v9` に更新。
- 次にやること:
  - 次は、1人目マイページをさらに商品価値のある画面へ磨く。
  - プロフィール編集、日記、写真/PDF、期限、家族共有、AI相談導線の深さを上げる。
- 検証:
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。
  - 本番 `/plans?v=20260820-104` で `Business policy` と「信頼を失わずに」文言が消えていることをブラウザ確認。
  - 本番 `sw.js` が `oyano-moshimo-navi-v9` になっていることを確認。
- GitHub/Vercel:
  - commit: `17ce26f Remove internal policy copy from plans`
  - pushed to `origin/main`
  - Vercel production: `https://oyano-moshimo-navi.vercel.app`
  - deployment id: `dpl_4pvoYBYpDAZon37Czt1R6gV795zG`

## 2026-08-20 追記 105

- ユーザー指摘:
  - 1人目登録済みなのに、`読む` や `安心` 画面に似たような「状況整理チェックへ」ボタンがあり、飛び先も `/start`、`/diagnosis`、`/home` でバラバラに見える。
  - `安心` 画面末尾の `Payment boundary` / `Web入口とExpoアプリの役割を分ける` は、ユーザー向け画面には不要ではないか。
- 判断:
  - 登録後の体験は `家族ボード` を本体にする。
  - `読む` と `安心` は補助情報ページにし、新規診断へ戻すCTAは置かない。
  - 内部設計・決済境界・Web/Expo分担の説明はレビュー資料や内部メモに残し、PWAの通常画面からは外す。
- 対応:
  - `apps/web/app/guides/page.tsx`
    - 下部の `読むだけで終わらせず...` CTA帯を削除。
  - `apps/web/app/checklists/page.tsx`
    - ヒーローCTAを `家族ボードへ戻る` に変更。
    - 各チェックリストカードの `この状況でリスト化する` を削除。
    - 下部の保存/共有CTA帯を削除。
  - `apps/web/app/guides/[slug]/page.tsx`
    - 詳細ページ末尾CTAを `家族ボードへ戻る` に統一。
    - `/diagnosis?status=...` へ戻す導線を削除。
  - `apps/web/app/safety/page.tsx`
    - ヒーローCTAを `家族ボードへ戻る` に変更。
    - `Payment boundary` セクションとWeb/Expo分担の説明を削除。
    - 収益方針っぽい文言を、ユーザー向けの「必要になってから機能を増やす」に変更。
  - `apps/web/public/sw.js`
    - PWAキャッシュ更新用に `CACHE_VERSION` を `oyano-moshimo-navi-v10` に更新。
- 次にやること:
  - 次は、1人目マイページの中身を商品価値ある画面へ磨く。
  - プロフィール、日記、写真/PDF、期限、家族共有、AI相談の見せ方と編集導線を強化する。
- 検証:
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。
  - 本番ブラウザで `/guides`、`/checklists`、`/safety`、`/guides/hospitalized` を確認。
  - `状況整理チェックへ`、`無料で状況を整理する`、`この状況でリスト化する`、`自分の状況に合わせて整理する`、`Payment boundary`、`Web入口とExpo` が表示されないことを確認。
  - `/checklists`、`/safety`、guide詳細は `家族ボードへ戻る` に統一。
- GitHub/Vercel:
  - commit: `e140a64 Unify registered user content navigation`
  - pushed to `origin/main`
  - Vercel production: `https://oyano-moshimo-navi.vercel.app`
  - deployment id: `dpl_ALhYr43eZgJi48QmMg262QayoLaJ`

## 2026-08-20 追記 106

- ユーザー指摘:
  - 「進めてくれ。俺が言いたいことわかるやろ。全部見直してくれ」
  - 基本方針はPWA/アプリのみで完結。`Web入口 -> アプリ` の説明や、内部の事業方針っぽい表示はいらない。
  - 1人目登録済みなのに、また1人目登録ボタンが出る/似た導線がバラバラに出ると混乱する。
  - 登録後はLPではなく、その人の管理手帳・マイページとして見せるべき。
- 判断:
  - `/home` をPWA/アプリ本体の家族ボードとして扱う。
  - 未登録時だけ「1人目の手帳を作る」を見せる。
  - 登録済み時は「今日見るところ」「今日の記録」「期限」「本人情報」を最初に見せ、登録導線・プロダクト説明カードは隠す。
  - `/result/[caseId]` はサポート販売ページではなく、整理結果から管理手帳へ戻す画面にする。
  - `/plans`、`/safety`、`/support-pack`、`/admin/cases` の古い `Web入口` / 内部方針っぽい文言をユーザー向け表現へ寄せる。
- 対応:
  - `apps/web/app/home/page.tsx`
    - 登録済み状態に `has-active-case`、未登録状態に `is-empty-case` を付与。
    - 登録済みではロゴ付き説明カードを非表示。
    - `1人目を登録する` を `1人目の手帳を作る` に変更。
    - 登録済みでは対象者切り替えを複数人がいる時だけ表示。
    - 登録済みでは「今日見るところ」を数字カードより上に移動。
    - 「今日あったことを書く」「期限」「本人情報」の3カードを最初の操作にした。
    - 2人目以降の追加は登録済みサイドカードに移し、Plusの補助導線として表示。
  - `apps/web/app/globals.css`
    - 登録済みヒーローを濃緑LP風から、白い手帳カード風に変更。
    - スマホ登録済みではヒーロー内プレビューを非表示にし、操作カードが上に来るよう調整。
    - 先頭の緑四角に見えるロゴ枠を廃止し、鳥ロゴをそのまま表示。
    - 今日の操作カードと健康チェックカードに押下フィードバック/touch-actionを追加。
    - 健康チェックの漢字アイコンを廃止し、色面+小さなドットの抽象アイコンに変更。
  - `apps/web/app/result/[caseId]/page.tsx`
    - 見つからない時は `/home` へ戻す。
    - 「管理手帳に保存済み」「この人の手帳を開く」へ変更。
    - 結果画面下部の発動サポートパック申込ブロックとFamily Plus帯を削除。
  - `apps/web/app/plans/page.tsx`
    - `無料ポータル`、`課金方針` の表現を削除。
    - FreeのCTAを `/home` へ統一。
  - `apps/web/app/safety/page.tsx`
    - `課金の線引き` をユーザー向けの `共有するときの守り方` に変更。
  - `apps/web/app/support-pack/SupportPackClient.tsx`
    - 直接アクセス時の文言を「整理結果」起点から「この人の管理手帳」起点に変更。
  - `apps/web/app/admin/cases/page.tsx`
    - `Web入口` を `PWA/アプリ` に変更。
  - `apps/web/app/start/page.tsx`
    - 戻る先を `/home` に変更。
  - `apps/web/components/PwaInstallPanel.tsx`
    - `1人目を登録する` を `1人目の手帳を作る` に変更。
  - `apps/web/public/sw.js`
    - PWAキャッシュ更新用に `CACHE_VERSION` を `oyano-moshimo-navi-v12` に更新。
- 確認:
  - ローカル `http://localhost:3010/home` を起動して、登録済みスマホ幅で表示確認。
  - 登録済み状態では、最初に `今日見るところ`、`今日あったことを書く`、`期限`、`本人情報` が見える。
  - 登録済み状態では `1人目を登録する` や重複する大きな登録CTAは表示されない。
  - `rg` で `1人目を登録`、`Payment boundary`、`Business policy`、`Web入口`、`この人のマイページ`、`内容を確認して申し込む`、`状況整理チェックへ`、`課金方針`、`課金の線引き`、`Web入口とExpo` が `apps/web` に残っていないことを確認。
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。
  - build時にSupabase JSのNode 20非推奨警告は出るが、ビルド自体は成功。
- 注意:
  - `review_exports/` は未追跡のまま残している。今回の変更には含めない。
  - 実装commit: `4e1ae55 Refine PWA family notebook experience`
  - `origin/main` へpush済み。
  - Vercel production deploy済み。
    - Production: `https://oyano-moshimo-navi.vercel.app`
    - Deployment URL: `https://oyano-moshimo-navi-3ovkx2j10-dogwoodcommunity1.vercel.app`
    - Deployment ID: `dpl_B5nH6ZCaZvzv59MsPrV7Ve8igSpC`
  - `curl -I https://oyano-moshimo-navi.vercel.app/home` でHTTP 200確認済み。

## 2026-08-20 追記 107

- ユーザー指摘:
  - 「プロフィールどうやって変更できるねん」
  - 「過去の記録はどうやって見れるんや」
  - その日その日の記録から、AI診断予測・過去記録のまとめ・アラートが出る、本当の手帳のような体験にしたい。
  - Petterの「私のうちの子ログ」のように、対象者ごとの日記・写真・PDF・振り返りが価値になる画面へ寄せたい。
- 判断:
  - `/home` は登録済みユーザーの「対象者ごとの管理手帳」として磨く。
  - プロフィールは表示だけでなく、同じ画面で編集できることを明示する。
  - 今日の記録は書きっぱなしではなく、過去の手帳・月別一覧・絞り込み・記録からの気づきへつなげる。
  - AI風の出力は、医療・法律・税務判断を断定せず、「次に確認する観点」「先回りメモ」として安全に表現する。
- 対応:
  - `apps/web/app/home/page.tsx`
    - プロフィールカードに `プロフィール変更はここでできます` の案内を追加。
    - プロフィール編集フォームを上部へ移動し、`編集欄 / ここをタップして変更します` として明示。
    - 今日見るところに `過去の記録を見る` カードを追加。
    - 今日の記録説明を、下の `過去の手帳` と `記録からの気づき` に反映される説明へ変更。
    - `記録からの気づき` セクションを追加。
      - 記録数、変化・急ぎ、写真・資料、最新日を集計。
      - `AIメモ` として記録本文から傾向を要約。
      - `先回りメモ` として次に起きやすい確認事項を提示。
      - 急ぎ記録、近い期限、プロフィール不足、記録間隔の空きなどをアラート表示。
      - `次に聞くとよいこと` をプロフィール不足や日記キーワードから生成。
    - `過去の手帳` セクションを追加。
      - 月別グループ、変化件数、写真・資料件数を表示。
      - `すべて` / `変化・急ぎ` / `写真・PDF` の絞り込みを追加。
      - 各記録に、その日のメモからの助言を表示。
    - `今日のチェック` という古い表現を `今日の記録` / `今日あったことを書く` に統一。
  - `apps/web/app/globals.css`
    - プロフィール編集案内、編集フォーム、記録インサイト、先回りメモ、アラート、月別手帳、絞り込みタブのスタイルを追加。
    - スマホ幅で編集案内・集計カード・過去記録が崩れないようレスポンシブ調整。
  - `apps/web/public/sw.js`
    - PWAキャッシュ更新用に `CACHE_VERSION` を `oyano-moshimo-navi-v13` に更新。
- 確認:
  - ローカル `http://localhost:3010/home` をスマホ幅 390x844 で確認。
  - DOM上で `プロフィール変更はここでできます`、`編集欄`、`ここをタップして変更します`、`過去の記録はここで見返せます`、`記録からの気づき`、`先回りメモ` が表示されることを確認。
  - プロフィール編集欄にフルネーム、呼び名、関係、生年月日、いまの状態、主な連絡窓口、病院・施設・ケア先、薬・注意点、書類・鍵などの保管メモが表示されることを確認。
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。
  - build時にSupabase JSのNode 20非推奨警告は出るが、ビルド自体は成功。
- 注意:
  - `review_exports/` は未追跡のまま残している。今回の変更には含めない。
  - 実装commit: `d203712 Improve family notebook records and profile editing`
  - `origin/main` へpush済み。
  - Vercel production deploy済み。
    - Production: `https://oyano-moshimo-navi.vercel.app`
    - Deployment URL: `https://oyano-moshimo-navi-o5injjh2y-dogwoodcommunity1.vercel.app`
    - Deployment ID: `dpl_A5iRS1uMFcFT9dFu3so5GZujphHS`
  - `curl -I https://oyano-moshimo-navi.vercel.app/home` でHTTP 200確認済み。

## 2026-08-20 追記 108

- ユーザー依頼:
  - 「ちょっとclaudデザインにデザイン見直してもらうから資料くれ」
- 対応:
  - Claudeに渡す最新版のデザインレビュー依頼書を作成。
  - ファイル: `docs/CLAUDE_DESIGN_REVIEW_REQUEST_2026-08-20.md`
  - Claudeアップロード用ZIPも作成。
  - ZIP: `review_exports/claude-design-review-oyano-2026-08-20.zip`
- 資料の前提:
  - 旧方針のWeb入口/診断LPではなく、PWA/アプリ本体の `/home` をレビュー対象にした。
  - 「1人ずつ管理手帳」「プロフィール編集」「今日の記録」「過去の手帳」「AIメモ/先回りメモ」「確認リスト」「写真/PDF」「有料導線」を中心に整理。
  - ユーザー不満として、AIテンプレ感、しょぼさ、ボタン/導線の不整合、プロフィール変更の分かりにくさ、過去記録の見返しにくさを明記。
  - Petterの「私のうちの子ログ」のように、日々の記録がマイページ価値になる方向を明記。
- ZIPに含めたもの:
  - `docs/CLAUDE_DESIGN_REVIEW_REQUEST_2026-08-20.md`
  - `apps/web/app/home/page.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/public/brand/watch-bird-mark.svg`
  - `apps/web/public/brand/app-icon.svg`
  - `apps/web/public/brand/logo-mark.png`
- 次の想定:
  - ユーザーがClaudeに資料/ZIPを渡す。
  - Claudeから返ってきたデザイン指示または実装依頼書を受け取り、Codexが `/home` を再実装する。

## 2026-08-21 追記 109

- ユーザー共有レビュー:
  - 「今の設計では課金しない。親の一生の記録を預けていい信頼の器がまだ無い」
  - 最重要指摘は `localStorage` 単独保存の危険性。Safariデータ削除、ITP、機種変更で手帳が消えると、この領域では信頼が戻らない。
  - 「AI相談」が実体としてキーワードマッチなら、課金の柱としてAIと呼ぶべきではない。
  - 家族共有をPlusの壁に置くと、無料ユーザーが価値を体験する前に課金要求になり、招待による拡散も殺す。
- 判断:
  - デザイン磨きより先に「記録が消えない」土台を優先。
  - 当面は「AI相談」という売り文句を封印し、画面では `相談メモ` / `長期相談` と表現する。
  - 家族共有は無料枠を残す前提のコピーに戻し、Plusの課金理由は `2人目以降の対象者`、`容量拡張`、`月まとめ/PDF`、`本物の長期相談` に寄せる。
- 対応:
  - `apps/web/lib/browserSupabase.ts` を追加。
    - ブラウザ側Supabase clientを作成。
    - Magic Link / PKCE callbackを `/home?cloud=1` で完了できるようにした。
    - 本人確認メール送信を `sendNotebookMagicLink(email)` に集約。
  - `apps/web/app/api/notebook/sync/route.ts` を追加。
    - Supabase access tokenを `Authorization: Bearer ...` で受け、`supabase.auth.getUser(token)` で本人確認。
    - `profiles` / `families` / `family_members` を準備し、端末内の手帳をSupabaseへ同期。
    - `people` に対象者、`tasks` に確認リスト、`timeline_events` に日記を保存。
    - GETでクラウド控えを端末へ復元できる形に再構成。
  - `apps/web/lib/store.ts`
    - `exportNotebookData()` を追加し、手帳データをJSON控えとしてダウンロード可能にした。
    - `replaceLocalNotebook()` を追加し、クラウド復元時にローカル手帳へ戻せるようにした。
  - `apps/web/app/home/page.tsx`
    - `大事な記録を消さない` セクションを追加。
    - メール確認、クラウド保存、クラウド復元、JSON控えダウンロードを追加。
    - 「AI相談」表現を `相談メモ` / `長期相談` に変更。
    - 家族2人まで無料共有の前提に合わせてPlusコピーを修正。
  - `apps/web/app/plans/page.tsx` / `apps/web/app/result/[caseId]/page.tsx` / `apps/web/app/safety/page.tsx`
    - AI相談の売り文句を削除。
    - 家族共有をPlus専用に見せる文言を緩和。
  - `apps/web/public/sw.js`
    - PWAキャッシュ更新のため `CACHE_VERSION` を `oyano-moshimo-navi-v17` に更新。
- 確認:
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。
  - `git diff --check` OK。
  - 実装commit: `1c85bc3 Add cloud backup for family notebook`
  - `origin/main` へpush済み。
  - GitHub CI: run `32438702418` success。
  - build時にSupabase JSのNode 20非推奨警告は出るが、ビルド自体は成功。後日Node 22へ上げる。
- 未完了:
  - 本物のLLM相談は未実装。Plusの本命として別フェーズで実装する。
  - 危機モード（入院した夜・危篤と言われた・亡くなった直後の即答体験）は未実装。
  - 家族共有2名無料のUXと招待導線の最終調整は未実装。
  - 本番環境で `/api/notebook/sync` の実データ同期、Magic Link復元、JSONエクスポートの実機確認が必要。
  - Vercel CLIで `npx vercel --prod --yes` を実行したが、`Not authorized` で失敗。`~/.vercel` と `VERCEL_TOKEN` も無いため、production反映にはVercel再ログインまたはtoken設定が必要。
  - `https://oyano-moshimo-navi.vercel.app/home` はHTTP 200だが、確認時点では古いVercel cacheが返っており、今回のクラウド控えUIはまだ本番未反映。

## 2026-08-21 追記 110

- 経緯:
  - Codexが利用制限に達したため、Claude Code側で実装を引き継いだ。
  - 追記109の未完了リストのうち、ユーザー選択により `危機モード` を最優先で実装した。
- 判断:
  - 危機モードは「読み物」ではなく「即答」にする。登録・入力・ログインなしで、いま必要な手順だけを順番に出す。
  - パニック時に効くのは、やることの提示だけでなく `いまはやらなくていいこと` の明示だと考え、全シナリオに入れた。
  - 深夜の病院・葬儀の場で通信が不安定でも開ける必要があるため、PWAでプリキャッシュする対象にした。
  - 医療・法律・税務の結論は断定しない方針を維持。相続放棄3か月・相続税10か月・死亡届7日は「一般的な目安」として示し、個別判断は専門家へ寄せた。
- 対応:
  - `apps/web/lib/crisis.ts` を追加。
    - 3シナリオを定義。`hospital-night`（救急・入院になった）、`critical`（危篤・看取りと言われた）、`just-died`（亡くなった直後）。
    - 各シナリオを `いま5分でやること` / `今夜・今日のうちに` / `明日以降で間に合うこと` の3段に分割。
    - `いまはやらなくていいこと`、`病院・葬儀社・役所から聞かれやすいこと`、`捨てない・消さないもの`、`家族への第一報テンプレート` を追加。
    - `CRISIS_EMERGENCY_NOTE`（命に関わる状態なら119番）と `CRISIS_SAFETY_NOTE`（断定しない旨）を共通定数化。
  - `apps/web/app/crisis/page.tsx` を追加。
    - 119番の案内を最上部に置き、3つの状況を大きなボタンで選ばせる入口。
  - `apps/web/app/crisis/[key]/page.tsx` を追加。
    - `generateStaticParams` / `generateMetadata` 対応。ビルド時に3ページを静的生成。
    - ステップ、第一報テンプレート、やらなくていいこと、聞かれること、捨てないもの、関連ガイド導線を表示。
  - `apps/web/components/CrisisSteps.tsx` を追加。
    - ステップのチェック状態を `oyano_crisis_progress_v01` としてlocalStorageに保持。
    - `いますぐの項目 n / m 済み` を表示し、全部済んだら「ここから先は明日でも間に合います」に切り替え。
    - `今日の記録に残す` で、済んだこと／まだのことを本文にした日記エントリ（mood: urgent）を手帳へ追加。
    - 手帳未作成の場合は `/start` への導線に切り替え。
    - 第一報テンプレートのコピー。クリップボードAPIが使えない端末では長押し選択を案内する。
  - `apps/web/app/home/page.tsx`
    - 手帳表紙の直下に `いま、急なことが起きている` の緊急バナーを追加（手帳あり・なし両方で表示）。
  - `apps/web/app/layout.tsx`
    - ヘッダーnavに `急なとき` を追加。critical CSSにも `.nav-crisis` を入れて初期表示の崩れを防止。
  - `apps/web/public/sw.js`
    - `CACHE_VERSION` を `oyano-moshimo-navi-v18` に更新。
    - `PRECACHE_PAGE_URLS` を追加し、危機モード4URLをinstall時に先読みキャッシュ。未訪問でもオフラインで開ける。
    - オフライン時のフォールバックを修正。従来は常に `/offline` を返していたが、まずリクエスト自身のキャッシュを返すようにした。
  - `apps/web/app/sitemap.ts`
    - `/crisis` と3シナリオを追加。
  - `apps/web/app/globals.css`
    - `.crisis-*` を追加。片手・大きめタップ領域・390px幅前提。
- 確認:
  - `pnpm --filter web run typecheck` OK。
  - `pnpm --filter web run build` OK。`/crisis/[key]` が3ページSSGされることを確認。
  - `next start -p 3010` + Chromium 390x844 で確認。
    - `/crisis`、`/crisis/hospital-night`、`/crisis/critical`、`/crisis/just-died` が200、存在しないkeyは404。
    - ステップのチェックがリロード後も保持されることを確認。
    - 手帳なし → `まず手帳を作る`、手帳あり → `今日の記録に残す` に切り替わることを確認。
    - 記録実行後、`oyano_diary_entries_v01` に mood=urgent のエントリが1件入り、本文に済んだこと／まだのことが入ることを確認。
    - 第一報テンプレートのコピーが成功し、ボタンが `コピーしました` に変わることを確認。
    - `/home` の緊急バナーが表示され、タップで `/crisis` へ遷移することを確認。
    - 3ページとも横スクロールが発生しないことを確認。
    - JSエラー・consoleエラーなし。
  - オフライン確認:
    - `/home` でSW（v18）がactiveになった後にネットワークを切り、未訪問の `/crisis/just-died` と `/crisis` が実コンテンツで開くことを確認。
- 注意:
  - `pnpm --filter web run lint` は ESLint未設定の対話プロンプトが出て失敗する。今回の変更とは無関係の既存状態。typecheckとbuildで代替した。
- 未完了（追記109から継続）:
  - 本物のLLM相談は未実装。
  - 家族共有2名無料のUXと招待導線の最終調整は未実装。
  - 本番環境で `/api/notebook/sync` の実データ同期、Magic Link復元、JSONエクスポートの実機確認が必要。
  - Vercelのproduction反映は `Not authorized` のまま。Vercel再ログインまたは `VERCEL_TOKEN` 設定が必要。今回の危機モードも本番未反映。

## 2026-08-21 追記 111

- 経緯:
  - 追記110に続き、未完了リストの `本物のLLM相談` を実装した。
- 判断:
  - キーワードマッチをやめ、Claude API（`claude-opus-5`）で手帳の記録を前提にした整理を返す。
  - ただし「AIが答える」ではなく「家族が次に動くための整理メモ」に徹する。診断名、治療方針、余命、介護度、相続の分け方、税額、法的結論は断定させない。
  - この領域で外部AIに情報を送る以上、`送る情報`と`送らない情報`を画面で先に見せてから同意を取る。同意なしでは送信ボタンを押せない。
  - 氏名、生年月日そのもの、連絡先、書類・鍵の保管場所は、そもそもリクエストに含めない。記録本文の中の電話番号・メール・口座番号らしき数字はサーバー側で自動的に伏字にする。
  - Vercelの実行時間内に収めるため `output_config.effort` は `medium`、`maxDuration` は 60 とした。
- 対応:
  - `apps/web/package.json` に `@anthropic-ai/sdk` を追加。
  - `apps/web/lib/consult.ts` を追加。
    - `redactSensitive()`。暗証番号の近くの数字、カード番号形式、電話番号形式、10桁以上の数字、メールアドレスを伏字にする。日付や体温などの短い数値は残す。
    - `buildConsultPrompt()`。送る項目をここで固定する。この関数を通らない情報はAPIへ渡らない。生年月日は `80代` のような年代へ変換する。
    - `CONSULT_SENT_FIELDS` / `CONSULT_WITHHELD_FIELDS`。UIの開示表示と実装を同じ定義から出す。
    - `CONSULT_SYSTEM_PROMPT` と `CONSULT_TOOL`（strict tool use）。出力形式を強制し、自由文で医療・法律の結論が出ないようにする。
    - `normalizeConsultAnswer()` で不正な形を弾き、`consultAnswerToDiaryBody()` で手帳へ残す本文を組み立てる。
  - `apps/web/app/api/consult/route.ts` を追加。
    - `checkPublicRateLimit` で 1時間12回に制限。
    - `ANTHROPIC_API_KEY` 未設定なら503を返し、手帳の他機能には影響させない。
    - `stop_reason === "refusal"` を422で返す。RateLimit / Auth / Timeout / APIError を型付きで分岐。
  - `apps/web/components/ConsultPanel.tsx` を追加。
    - 手帳がなければ `/start` へ誘導。複数手帳があれば切り替えタブ。
    - 送る情報・送らない情報の開示と同意チェック（`oyano_consult_consent_v01`）。
    - 相談例のチップ、入力欄、結果表示（いまの状況 / 次に確認すること / 窓口で聞くこと / 相談先の候補 / 気をつけること / 次に残すこと）。
    - `この相談メモを手帳に残す` で日記へ保存。
  - `apps/web/app/consult/page.tsx` を追加。
  - `apps/web/app/home/page.tsx` に `長期相談` セクションを追加。
  - `apps/web/app/plans/page.tsx` の長期相談プランを実機能に合わせて修正し、CTAを `/consult` へ。
  - `apps/web/app/legal/privacy/page.tsx` に `生成AIへの送信（長期相談）` の節を追加。送る項目・送らない項目・自動伏字・学習に使わない旨を明記。
  - `apps/web/app/safety/page.tsx` に `生成AIへ送るものを、先に見せる` を追加。
  - `docs/ENVIRONMENT_MATRIX.md`、`apps/web/.env.example`、`apps/web/app/api/admin/env-check/route.ts` に `ANTHROPIC_API_KEY` を追加。
  - `apps/web/app/sitemap.ts` に `/consult` を追加。
  - `apps/web/app/globals.css` に `.consult-*` を追加。
- 確認:
  - `pnpm --filter web run typecheck` OK。`pnpm --filter web run build` OK。
  - `lib/consult.ts` を単体で実行し、伏字処理を確認。
    - `口座は1234567890123です` / `カードは1234 5678 9012 3456` / `暗証番号は1234です` / `test@example.com` / `090-1234-5678` / `03-1234-5678` / `0120-000-111` はすべて伏字。
    - `2026-08-21に受診、37.2度` や `会議は10-15時` は伏字にならないことを確認。
  - モックのAnthropicエンドポイント（`ANTHROPIC_BASE_URL` で差し替え）を立てて、実際に送信される本文を検証。
    - 氏名 `テスト母`、生年月日 `1945-03-02`、連絡先 `090-1111-2222`、保管場所メモ `仏壇` がいずれも含まれないことを確認。
    - 記録本文中の `090-1234-5678` が伏字になっていることを確認。
    - `model: claude-opus-5`、`output_config.effort: medium`、`tools[0].strict: true` で送られることを確認。
  - Chromium 390x844 で `/consult` を確認。
    - 手帳なし → `先に1人分の手帳を作ってください`。
    - 同意前は送信ボタンが無効、同意後に有効。
    - 相談例チップで入力欄が埋まる。
    - 結果が6ブロックで表示され、手帳へ保存できることを確認。日記が1件増える。
    - 同意状態がリロード後も保持されることを確認。
    - 横スクロールなし、JSエラーなし。
  - エラー系:
    - 4文字未満 → 400、600文字超 → 400。
    - `stop_reason: refusal` → 422。
    - `ANTHROPIC_API_KEY` 未設定 → 503。
- 未確認:
  - 実際のClaude APIへの疎通は未実施。この環境に `ANTHROPIC_API_KEY` が無いため、モックでの検証にとどまる。本番キー設定後に、実際の応答品質と所要時間の確認が必要。
  - `output_config.effort` を `medium` にしているが、実応答を見て `high` へ上げるか判断する。

## 2026-08-21 追記 112

- 経緯:
  - 追記111に続き、未完了リストの `家族共有2名無料のUXと招待導線` を実装した。
- 判断:
  - SQL側には `create_family_invite` / `accept_family_invite` が既にあり、無料枠（オーナー以外に2人）とメール一致チェックも実装済みだった。欠けていたのはWeb側の導線だけだったので、RPCはそのまま使い、Web APIとUIを足す方針にした。
  - 招待系RPCは `auth.uid()` を見る `security definer` のため、service roleクライアントでは通らない。利用者のアクセストークンで動くクライアントを別に用意した。
  - コピーは実装に合わせて `あなたのほかに2人まで無料` とした。SQLが数えているのはオーナー以外の人数なので、`家族2人まで` という言い方だと実際の挙動とずれる。
- 対応:
  - `apps/web/lib/serverSupabase.ts`
    - `getUserSupabase(accessToken)` を追加。anon key + `Authorization: Bearer` で作り、RPCの `auth.uid()` を効かせる。
    - **バグ修正**: Next.jsのData CacheがRoute Handler内のGET fetchを既定でキャッシュしていた。Supabaseクライアントに `cache: "no-store"` の fetch を差し込んで無効化。
  - `apps/web/lib/family.ts` を追加。
    - `resolveFamilyContext()` でトークン検証とクライアント生成。
    - `getOrCreateFamilyId()` はクラウド控えと同じ考え方で家族を1つに決める。
    - RPCの例外名を日本語メッセージへ変換する `messageForRpcError()`。
  - `apps/web/app/api/family/route.ts`（GET）。メンバー、招待中、残り枠、プランを返す。
  - `apps/web/app/api/family/invite/route.ts`（POST）。メール形式、自分あて招待を弾く。枠オーバーは402。
  - `apps/web/app/api/family/invite/accept/route.ts`（POST）。
  - `apps/web/components/FamilyShare.tsx`、`apps/web/app/family/page.tsx` を追加。
  - `apps/web/components/InviteAccept.tsx` を追加し、`/invite/[token]` を実際に受け取れるページへ変更。従来はアプリへのdeep linkだけで、Webからは参加できなかった。
  - `apps/web/lib/browserSupabase.ts` に `sendMagicLink(email, redirectPath)` を追加。招待ページへ戻す確認メールを送れるようにした。
  - `apps/web/app/home/page.tsx` に `家族共有` セクションを追加。`apps/web/app/sitemap.ts` に `/family` を追加。
  - `apps/web/app/globals.css` に `.family-*` と `.invite-card` を追加。プレースホルダが入力済みに見えないよう色も調整。
- 確認:
  - `pnpm --filter web run typecheck` OK。`pnpm --filter web run build` OK。
  - Supabaseが無い環境では、API 3本が503、`/family` と `/invite/[token]` は `家族共有はまだ使えません` を表示することを確認。
  - PostgREST/GoTrue互換のモックを立てて、SQLのRPC挙動（無料枠2人、メール一致、オーナーのみ招待可）を再現し、以下を確認。
    - `/api/family` を2回叩いても家族が1つしか作られない（Data Cacheのバグ修正後）。修正前は毎回新しい家族が作られていた。
    - 招待作成 → 残り枠が2→1へ、招待中として表示。
    - 招待されていない人が受け取ろうとすると拒否。招待された本人は参加でき、メンバーに追加される。
    - 3人目の招待は402で `無料で共有できるのは、あなたのほかに2人までです`。
    - オーナー以外が招待しようとすると `招待できるのは、手帳を作った人だけです`。
    - 自分あて招待、メール形式不正、トークン無しをそれぞれ400/401で拒否。
  - Chromium 390x844 で確認。
    - 未ログイン時は確認メール送信フォーム。
    - ログイン時はメンバー一覧、残り枠、招待フォームを表示。招待作成後にリンクとコピーボタンが出て、枠表示が更新される。
    - 枠が埋まっている時は招待ボタンが無効になり、Plusへの案内が出る。
    - `/invite/[token]` で、違うアドレスの人はエラー、招待された本人は `参加しました` まで到達。
    - 横スクロールなし、JSエラーなし。
- 注意:
  - 実際のSupabaseでの疎通は未実施。この環境にSupabaseが無いためモックでの検証にとどまる。本番キー設定後に、実DBでの招待・参加の確認が必要。
  - Next.jsのData Cacheの件は、既存の `/api/notebook/sync` のGET（クラウド復元）にも同じ影響があったはずで、今回の修正で一緒に直っている。

## 2026-08-21 追記 113

- 経緯:
  - 未完了リストの `本番でのクラウド控えの実機確認` に着手した。本番へアクセスできないため、確認を実行できる形にして渡す。
- 対応:
  - `scripts/smoke-notebook-sync.mjs` を追加。
    - 既定は読み取りのみ。`--write` を付けた時だけ、確認用の手帳を1件書き込んで往復を検証する。
    - トークン無しGETが401、トークン付きGETが200、POSTの同期件数、プロフィール・確認リスト・日記が戻ること、2回目のPOSTで重複しないことを確認する。
    - 本番で `--write` した場合に残るデータの目印（`profile->>localCaseId`）と削除方法を最後に表示する。
  - `package.json` に `smoke:notebook-sync` を追加。
  - `docs/CLOUD_BACKUP_VERIFICATION.md` を追加。
    - 前提の環境変数とSupabaseのRedirect URL設定。
    - アクセストークンの取り方。
    - 自動チェックの実行方法。
    - 手で確認する9項目。特に「Safariのサイトデータ消去後に復元できること」を最重要とした。ここが通らない限り、記録が消えないとは言えない。
    - 家族共有の確認6項目。
    - 確認用データの削除SQL。
    - 既知の注意点（localCaseIdでの突き合わせ、添付のデータURL同期、Data Cacheを外していること）。
  - `scripts/smoke-web.mjs` に `/crisis` 3ページ、`/crisis`、`/consult`、`/family`、`/api/family`、`/api/consult` を追加。
- 確認:
  - PostgREST互換モックを `people` / `tasks` / `timeline_events` / `profiles` とPATCH・upsert・`in`・`->>`フィルタまで拡張し、`smoke-notebook-sync` を `--write` で実行して12/12成功。
    - クラウド控えの往復（対象者、プロフィール、確認リスト、日記の本文）が一致することを確認。
    - 2回目のPOSTで対象者も日記も増えないことを確認。
  - `scripts/smoke-web.mjs` をローカルに対して実行し、37件すべて成功、失敗0。
- 未確認:
  - 本番Supabaseに対する実行は未実施。上記手順書に沿って、本番キーを持っている人の実行が必要。

## 2026-08-21 追記 114

- 経緯:
  - 未完了リストの `Vercel production反映` について、この環境からはVercelの認証情報が無いため実行できない。代わりに、反映手段を選べる形にした。
- 判断:
  - 追記109で `npx vercel --prod --yes` が `Not authorized` になったのは、CLIのログインが切れていたため。VercelのGit連携が有効なら、そもそもCLIは要らず `main` へのpushで反映される。
  - 自動デプロイのワークフローをpushトリガーで足すのは、本番へ勝手に反映されることになるので避けた。手動実行（workflow_dispatch）だけにしている。
- 対応:
  - `.github/workflows/deploy-vercel.yml` を追加。
    - `workflow_dispatch` のみ。preview / production を選んで実行する。
    - `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` が無い場合は、最初のステップで理由を出して止まる。
    - デプロイ後に `scripts/smoke-web.mjs` を自動で流す。
  - `docs/DEPLOYMENT.md` に「本番へ反映する3つの方法」を追加。Git連携、手動Actions、ローカルCLIの順。
    - PWAのService Workerキャッシュで古く見える場合の対処（`CACHE_VERSION` を上げる）も明記。
- 未完了:
  - 本番反映そのものは未実施。次のいずれかが必要。
    - VercelのGit連携が有効なら、このブランチをmainへマージする。
    - 有効でないなら、`VERCEL_TOKEN` などのシークレットを設定して手動ワークフローを実行する。

## 2026-08-21 追記 115

- ユーザー方針の確認:
  - 「WEBはイメージしてない」。本体はアプリ（Expo）で、Webは入口だけ、という前提を確認した。
  - これにより、追記110〜112でWebに実装した機能は「Webだけにある」状態が問題になる。まず一番強い危機モードをアプリへ移した。
  - あわせて、追記114で検討していたWeb Pushは作らない方針にした。通知は既存のExpo pushを使う。
- 判断:
  - 危機モードの定義をWeb専用の `apps/web/lib/crisis.ts` に置いたままだと、WebとアプリでZ文言がずれる。`packages/shared` へ移して1か所にした。
  - 危機モードはログイン前でも開ける必要がある。深夜に病院から連絡が来た人が、その場で会員登録するとは考えにくい。そのため `(tabs)` の外に置き、welcome画面からも直接開けるようにした。
  - 第一報テンプレートは、Webではクリップボードコピーだが、アプリでは `Share` の共有シートにした。LINEやSMSへそのまま送れるほうが速い。
- 対応:
  - `apps/web/lib/crisis.ts` を `packages/shared/src/crisis.ts` へ移動し、`packages/shared/src/index.ts` から再エクスポート。
  - Web側の4ファイルの import を `@oyano/shared` に貼り替え。
  - `apps/mobile/app/crisis/index.tsx` を追加。119番の案内と3つの状況。
  - `apps/mobile/app/crisis/[key].tsx` を追加。
    - ステップのチェックを AsyncStorage（`oyano_crisis_progress_v01`）で保持。
    - `いますぐの項目 n / m 済み` を表示。
    - `今日の記録に残す` で `addTimelineEntry` にmood=urgentで書き込む。対象者が無い場合はダッシュボードへ誘導（未ログインならwelcomeへリダイレクトされる）。
    - 第一報テンプレートは `Share.share()` で共有。
    - やらなくていいこと / 聞かれやすいこと / 捨てないもの を表示。
  - `apps/mobile/app/_layout.tsx` に2ルートを登録。
  - `apps/mobile/app/(tabs)/dashboard.tsx` に緊急バナーを追加（空状態と通常状態の両方）。
  - `apps/mobile/app/(auth)/welcome.tsx` に「急なとき」を追加。登録前でも開ける。
- 確認:
  - `pnpm --filter mobile run typecheck` OK。
  - `pnpm --filter web run typecheck` OK、`pnpm --filter web run build` OK。共有パッケージへ移した後も `/crisis/[key]` は3ページSSGされる。
- 未確認:
  - アプリの実機表示は未確認。この環境にシミュレータもExpo Goも無いため、型と構成の確認にとどまる。EAS buildまたは `expo start` での目視確認が必要。

## 2026-08-21 追記 116

- 経緯:
  - レビューで指摘した `/api/consult` のコスト無防備を塞いだ。
  - 実装当初はIP+UAハッシュで12回/時のみ。IPを変えれば実質無制限に外部APIを叩けた。
- 判断:
  - 上限は2段構えにする。利用者ごとの1日上限だけでは、IPを変えられると意味がない。サービス全体の1日上限を置いて、費用の最大値を確定させる。
  - 手帳の実体がないリクエストは断る。記録もプロフィールも無い状態では一般論しか返せず、費用だけがかかる。これは費用対策であると同時に「先に記録を書く」という本来の順番へ戻す導線でもある。
  - 検証で弾いたリクエストは枠を消費させない。最初の実装では順番が逆で、記録を書き忘れた人が一度も相談できないまま1日の枠を使い切る状態だった。
- 対応:
  - `apps/web/lib/publicRateLimit.ts`
    - 共通処理を `consume()` に切り出し、`checkServiceRateLimit()` を追加。利用者ごとではなく固定キーで数える。
    - Supabase未設定時はプロセス内カウンタに落ちるため、サーバーレスでは上限が効かない旨をコメントに明記。
  - `apps/web/lib/consult.ts`
    - `hasNotebookSubstance()` を追加。4文字以上の記録が1件あるか、プロフィールが2つ以上埋まっているかで判定する。
  - `apps/web/app/api/consult/route.ts`
    - 上限を「利用者ごと5回/日」「サービス全体200回/日」に変更（環境変数で調整可）。
    - 手帳の実体チェックを追加し、無い場合は422。
    - 上限の消費を、すべての検証を通過した後へ移動。
  - `apps/web/components/ConsultPanel.tsx`
    - 記録が無い場合は送信ボタンを無効にし、記録を書く導線を出す。サーバーで弾く前に画面で止める。
  - `docs/ENVIRONMENT_MATRIX.md` と `apps/web/.env.example` に `CONSULT_CLIENT_DAILY_LIMIT` / `CONSULT_DAILY_LIMIT` を追加。
- 費用の目安:
  - 1回あたり入力2〜3k、出力1.5〜3kトークン程度。Claude Opus 5 は入力$5 / 出力$25 per MTok なので、おおよそ$0.05〜0.1/回。
  - 既定の全体200回/日なら、最大でも1日$10〜20、月$300〜600で頭打ちになる。公開規模に応じて `CONSULT_DAILY_LIMIT` を決めること。
- 確認:
  - `pnpm --filter web run typecheck` OK、`pnpm --filter web run build` OK。
  - モックのAnthropicエンドポイントを立てて、上限3回/クライアント・4回/全体に設定して検証。
    - 記録もプロフィールも無いリクエストを5回連続 → すべて422。そのあと正しいリクエストが3回通ることを確認（弾いた分は枠を消費していない）。
    - 同一クライアントの4回目 → 429。
    - 別クライアントで1回通ったあと、全体上限に達して503。
- 注意:
  - サービス全体の上限はSupabaseの `check_public_api_rate_limit` に依存する。Supabase未設定の本番では上限が効かないため、必ず設定すること。

## 2026-08-21 追記 117

- 経緯:
  - 追記115に続き、長期相談をアプリへ移した。これでWebにしかない機能は残っていない（家族共有はアプリ側に元からある）。
- 判断:
  - 相談の入口はWebの `/api/consult` に集約したままにする。送る内容の絞り込みと伏字処理をサーバー1か所で完結させるため。アプリ側に同じ処理を置くと、片方だけ直して食い違う。
  - 型・開示リスト・実体チェック・結果の正規化は両方で使うので `packages/shared/src/consult.ts` へ移した。
  - システムプロンプトとツール定義、伏字処理、プロンプト組み立ては `apps/web/lib/consult.ts` に残す。アプリのバンドルに載せる必要がなく、載せるべきでもない。
- 対応:
  - `packages/shared/src/consult.ts` を追加。型、`CONSULT_SENT_FIELDS` / `CONSULT_WITHHELD_FIELDS`、`hasNotebookSubstance`、`normalizeConsultAnswer`、`consultAnswerToDiaryBody` を移動。
  - `apps/web/lib/consult.ts` はサーバー専用部分だけになった。route と ConsultPanel の import を `@oyano/shared` へ貼り替え。
  - `apps/mobile/lib/consult.ts` を追加。同意の保存（AsyncStorage）と `EXPO_PUBLIC_WEB_BASE_URL` 経由のAPI呼び出し。
  - `apps/mobile/app/consult.tsx` を追加。開示と同意、相談例、入力、結果表示、タイムラインへの保存。
  - `apps/mobile/app/_layout.tsx` にルート登録、`(tabs)/dashboard.tsx` に相談カードを追加。
- 確認:
  - `pnpm --filter mobile run typecheck` OK、`pnpm --filter web run typecheck` OK、`pnpm --filter web run build` OK。
  - 共有パッケージへ切り出した後もWeb側が壊れていないことを、Chromiumで `/consult` の往復（同意 → 相談 → 結果6ブロック → 手帳へ保存）まで再確認。
  - `scripts/smoke-web.mjs` 37件すべて成功、失敗0。
- 未確認:
  - アプリの実機表示は未確認（シミュレータが無いため）。
  - アプリからの相談は `EXPO_PUBLIC_WEB_BASE_URL` が本番を指している必要がある。未設定だと「相談の接続先が設定されていません」を返す。

## 2026-08-21 追記 118

- 経緯:
  - レビューで「計測ツールが何も入っていないので、出しても何も分からない」と指摘した件。
  - 本体がアプリになったため、Web入口とアプリの間で匿名IDが切れる。ここは追えないと割り切り、両方の数字を別々に見る設計にした。
- 判断:
  - イベントは5つに絞る。`crisis_opened` / `crisis_saved` / `person_created` / `record_written` / `consult_asked`。増やすほど何を見ればよいか分からなくなる。
  - 外部の計測サービスは入れない。このプロダクトの姿勢と合わないため、自前の最小構成にした。個人情報は持たず、端末ごとの匿名IDとイベント名と時刻だけ。
  - 集計はSQL側の `funnel_summary` に置く。管理画面は表示だけにする。
- 対応:
  - `supabase/funnel_events.sql` を追加。テーブル、索引、`funnel_summary(p_days)` を定義。RLSは有効のままポリシーを作らず、service roleからのみ書き込む。
  - `packages/shared/src/funnel.ts` を追加。イベント名と集計の型、割合の表示。
  - `apps/web/app/api/events/route.ts` を追加。イベント名の許可リストと匿名IDの長さだけを見る。失敗しても200を返す（計測の失敗が利用者の操作を止めてはいけない）。
  - `apps/web/lib/funnel.ts` / `apps/mobile/lib/funnel.ts` を追加。匿名IDはlocalStorage / AsyncStorageに保存。
  - 発火箇所:
    - Web: `CrisisSteps`（開いた・記録に残した）、`store.createCase`（対象者）、`store.addDiaryEntry`（記録）、`ConsultPanel`（相談）。
    - アプリ: `crisis/[key]`（開いた・記録に残した）、`mobileData.createPersonForFamily` / `createInitialFamilyPerson`（対象者）、`addTimelineEntry`（記録）、`consult`（相談）。
    - `record_written` はデータ層の1か所だけで発火する。画面側にも書いていて二重計上していたのを修正した。
  - `apps/web/app/api/admin/funnel/route.ts` と `apps/web/app/admin/funnel/page.tsx`、`components/AdminFunnel.tsx` を追加。直近7/30/90日を切り替えられる。
  - `apps/web/app/legal/privacy/page.tsx` に「利用状況の計測」の節を追加。
- 確認:
  - `pnpm --filter web run typecheck` OK、`pnpm --filter mobile run typecheck` OK、`pnpm --filter web run build` OK。
  - モックSupabaseに `funnel_summary` を実装して検証。
    - 3人が危機モードを開き、2人が対象者を登録、うち1人が7日以内に2件書いた状態を作り、`crisisOpened 3 / personCreated 2 / returnedWithin7Days 1` が返ることを確認。
    - 許可リストに無いイベント名、8文字未満の匿名IDは保存されないことを確認。
    - 管理APIは認証なしで401。
  - Chromiumで `/admin/funnel` を確認。`3 / 危機モードを開いた（アプリ2・Web1）`、`2 / 対象者を登録した（66.7%）`、`1 / 7日以内に2件目を書いた（33.3%）` が表示され、期間の切り替えも動く。JSエラーなし。
- 本番で必要な作業:
  - `supabase/funnel_events.sql` を本番Supabaseへ適用する。適用前は `/admin/funnel` が「適用してください」を出す。

## 2026-08-21 追記 119

- 経緯:
  - 「本体はアプリ、Webは入口」の方針に合わせ、Web側の入口を整理した。
  - 調べたところ、App Store / Google Play / TestFlight のURLがコードのどこにも無かった。つまり現状のWebには、アプリへ送る先が存在しない。
- 判断:
  - ストアURLは環境変数にして、未設定の間はアプリ導線そのものを出さない。押しても何も起きないボタンを置くほうが、置かないより悪い。
  - `/start` の11択は、消すのではなく前に出す数を減らす。急ぎの3状況は登録より先に危機モードへ送り、残りは主要4つ＋折りたたみにした。11の状況で登録できること自体は維持している。
- 対応:
  - `apps/web/lib/appLinks.ts` と `apps/web/components/AppInstallBand.tsx` を追加。
    - `NEXT_PUBLIC_IOS_APP_URL` / `NEXT_PUBLIC_ANDROID_APP_URL` が設定されていればストアへのボタン、無ければ「アプリは準備中です。いまはこの画面のまま使えます」とWebの手帳への導線を出す。
  - `apps/web/app/crisis/[key]/page.tsx` の末尾にアプリ導線を追加。危機モードを使い終えた直後が、続ける場所を伝える一番よい位置と判断した。
  - `apps/web/app/start/page.tsx` を再構成。
    - 上部に「いま起きている場合は、登録より先にこちら」として3行（入院・危篤・亡くなった直後）を置き、`/crisis/[key]` へ直接送る。
    - 登録は「これから備える」4件を表示し、残り7件は `ほかの状況から選ぶ` の折りたたみに入れた。
    - 行の描画を `StatusRow` に切り出した。
  - `apps/web/app/globals.css` に `.start-urgent` / `.toc-more` / `.app-band` を追加。
  - `docs/ENVIRONMENT_MATRIX.md` と `apps/web/.env.example` にストアURLを追加。
- 確認:
  - `pnpm --filter web run typecheck` OK、`pnpm --filter web run build` OK。
  - Chromium 390x844 で確認。
    - 急ぎの3行が表示され、押すと `/crisis/hospital-night` へ遷移する。
    - 最初に見える登録は4件、折りたたみは閉じた状態で7件。開くと11件すべて表示される。
    - 登録を押すと従来どおり `/diagnosis` へ進む。
    - ストアURL未設定時、アプリ導線が「準備中」の表示になることを確認。
    - 横スクロールなし、JSエラーなし。
  - `scripts/smoke-web.mjs` 37件すべて成功。
- 注意:
  - `/crisis/[key]` は静的生成のため、ストアURLはビルド時に埋め込まれる。公開後に環境変数を設定したら、再デプロイが必要。

## 2026-08-21 追記 120

- 経緯:
  - レビューで最優先に挙げた「課金導線が閉じている」件。`/plans` のFamily PlusのCTAが `/plans` 自身を指しており、押しても同じページに戻る状態だった。価格は「準備中」、Stripe側にもsubscriptionのコードが無かった。
- 判断:
  - 本体がアプリになったため、この経路は「Webで契約する人向け」に限る。iOSアプリ内から同じものを売る場合はApp内課金の対象になり、Stripeは使えない。IAPの導入は別途判断が必要。
  - price IDが未設定の間は受付を開かない。価格表示も環境変数にして、決まるまで「準備中」のままにする。
  - Plusは家族単位で持つ。誰が払ったかではなく、どの家族が広がるかで管理する。
  - 解約・失敗で `families.plan` を戻す経路を必ず入れる。入れないと返金後もPlusのままになる。
- 対応:
  - `apps/web/app/api/stripe/plus-checkout/route.ts` を追加。Supabaseのアクセストークンで家族を特定し、`mode=subscription` のCheckout Sessionを作る。すでにPlusなら409。
  - `apps/web/app/api/stripe/webhook/route.ts`
    - `persistFamilyPlan()` を追加。`checkout.session.completed`（subscription）と `customer.subscription.updated` / `deleted` を処理する。
    - `subscriptions` テーブルへ記録し、`families.plan` を `plus` / `free` に切り替える。
    - 既存のサポートパック（単発決済）の処理とは、`mode` と `metadata.familyId` で分岐する。
  - `apps/web/components/PlusUpgrade.tsx` を追加。本人確認 → 決済画面へ、の2段。成功・取消の戻りも表示する。
  - `apps/web/app/plans/page.tsx`
    - CTAの遷移先を自分自身から `#plus` へ修正。
    - 価格表示を `NEXT_PUBLIC_PLUS_PRICE_LABEL` から読むようにした。
  - 環境変数に `STRIPE_PLUS_PRICE_ID` と `NEXT_PUBLIC_PLUS_PRICE_LABEL` を追加。
- 確認:
  - `pnpm --filter web run typecheck` OK、`pnpm --filter web run build` OK。
  - price ID未設定で `/api/stripe/plus-checkout` が503を返すことを確認。
  - Chromium 390x844 で `/plans` を確認。CTAが `#plus` へ移動し、受付ブロックが本人確認のフォームを出すことを確認。JSエラーなし。
- 未確認・未決定:
  - 実際のStripeでの決済は未実施。price ID設定後にテストモードでの確認が必要。
  - webhookの `customer.subscription.*` はStripe側でイベントを有効にする必要がある。
  - **iOSのApp内課金は未対応**。アプリ内からPlusを売るなら `expo-in-app-purchases` か RevenueCat の導入が必要で、手数料15〜30%がかかる。画面には「iPhoneのアプリの中からは、Appleの規約により同じ手続きはご利用いただけません」と明記してある。
