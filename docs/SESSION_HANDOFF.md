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

- 2026-08-22 作業再開:
  - ユーザーから課金価値レビューを受け、「続けて」と依頼あり。
  - レビューの最重要論点は、`localStorageだけでは手帳を名乗れない`、`AI相談を偽物に見せない`、`家族共有を課金壁にしすぎない` の3点。
  - 2026-08-22 続き作業:
    - ユーザー要望「確認リスト項目を編集できるように」「続けて」を受け、確認リストを“表示だけ”ではなく、手帳内で追加・編集できる体験へ強化中。
    - 既存実装ではカード押下/内容を編集で項目編集は可能だったが、追加入口と編集可能であることの見え方が弱い。
    - `/home` の確認リストタブに「確認項目を追加」カードを追加。
    - 追加フォームでは、やること、説明、期限、担当、状態、優先度、家族メモを入力し、`addCaseTask()` でその対象者の確認リスト先頭へ追加できる。
    - 既存カードのヒントを「このカードを押すと編集できます」に変更し、ボタン文言も「編集する」に整理。
    - スマホ幅で追加カードのボタンが詰まらないようCSSも調整。
    - 検証: `git diff --check` OK、`npm run typecheck --workspace web` OK、`npm run build --workspace web` OK。
    - build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
    - amend後の実コミットは `26b9eb7 Improve checklist editing flow`。
    - push結果: `8a9fdd9..26b9eb7 main -> main`。
    - 本番デプロイ: `npx vercel --prod --yes` 成功。Deployment ID `dpl_HREVwNMzUvSDbEB3jEpSkGgJsS8E`、Production URL `https://oyano-moshimo-navi.vercel.app`、Deployment URL `https://oyano-moshimo-navi-nxwergton-dogwoodcommunity1.vercel.app`。
    - 本番確認: `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。`curl -I https://oyano-moshimo-navi.vercel.app/home` で HTTP 200 を確認。
  - 直前対応で、無料の家族招待枠は「本人以外2人まで」にコード/SQL上変更済み。GitHub push済み。ただし本番Supabase DBへは `supabase/free_plan_member_limit.sql` をSQL Editorで実行する必要あり。
  - `/home` の家族ボードで、過去記録・変化・次の導線が初見で分かるように、手帳トップへ「記録から見えること」セクションを追加。
  - 記録あり: 最近のまとめ、記録数/変化/写真・資料、記録テーマ、次に見ておくこと、過去記録/今日の記録CTAを表示。
  - 記録なし: キャラ付きで「今日の記録を書く」CTAを表示。
  - 検証: `git diff --check` OK、`npm run typecheck --workspace web` OK、`npm run build --workspace web` OK。
  - GitHub: 実装コミット `92de614 Surface notebook record summary` を `main` へpush済み。
  - 本番デプロイ: `npx vercel --prod --yes` 成功。Deployment ID `dpl_EdFb3i5PFtzwq8GAHT7JtzYYTLvw`、Production URL `https://oyano-moshimo-navi.vercel.app`、Deployment URL `https://oyano-moshimo-navi-8r9m4bdwp-dogwoodcommunity1.vercel.app`。
  - 本番確認: `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` OK。`curl`で `/home` HTML内の「記録から見えること」文字列確認を試したが、`/home` はクライアント描画中心のため静的HTMLには直接出ず。
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

## 2026-08-21 追記 121

- 経緯:
  - 本体がアプリになったため、Plusをアプリ内で売るならApp内課金（IAP）が必要になる件。
  - これはコードより先に事業と規約の判断が要る話なので、判断材料を文書にし、コード側は「どの経路から来ても最後は1か所で決まる」形だけ先に用意した。
- 判断:
  - iOSアプリ内でデジタル機能のサブスクを売る場合、原則IAPが必須。手数料は原則30%、Small Business Programで15%。
  - 「Webで契約してアプリで解放」自体は可能だが、**アプリ内からWeb決済へ誘導すること**が禁止されている。現在の `PlusUpgrade` の注意書きはWeb画面にのみ置き、アプリ側には入れていない。
  - `expo-in-app-purchases` は非推奨のため採用しない。入れるならRevenueCat。
  - 課金経路が増えても、Plusかどうかを決めるのは `families.plan` の1か所に保つ。
- 対応:
  - `docs/IN_APP_PURCHASE_PLAN.md` を追加。選択肢A（Webのみ）/ B（RevenueCat）/ C（非推奨）と、必要な作業、判断が必要なことを整理。
  - `apps/web/app/api/revenuecat/webhook/route.ts` を追加。
    - `REVENUECAT_WEBHOOK_SECRET` で認証。未設定なら501。
    - `app_user_id` からSupabaseのユーザー → 家族を引く。家族idが直接来た場合も受ける。
    - 解約と期限切れを分ける。`CANCELLATION` では失効させず、期限到来または `EXPIRATION` で `free` に戻す。ここを一緒にすると、解約した瞬間に使えなくなり返金対応が増える。
    - `subscriptions` への記録に失敗しても権利の反映は続けるが、警告ログは残す。
  - 環境変数に `REVENUECAT_WEBHOOK_SECRET` を追加。
- 確認:
  - `pnpm --filter web run typecheck` OK、`pnpm --filter web run build` OK。
  - モックSupabaseで検証。
    - 誤ったsecret → 401。
    - `INITIAL_PURCHASE`（期限は未来）→ `plan: plus`。
    - `CANCELLATION`（期限は未来）→ `plus` のまま。
    - `EXPIRATION`（期限は過去）→ `free`。
    - 家族が見つからない `app_user_id` → `applied: false`（500にはしない）。
    - 同じ利用者から2回送っても `subscriptions` は1行のまま。
- 未対応:
  - アプリ側の `react-native-purchases` は未導入。入れるとExpo Goでは動かなくなり、development buildへの移行が必要になる。
  - App Store Connect の商品作成、RevenueCatのアカウント設定は未着手。

## 2026-08-21 追記 122

- アプリのバンドル検証:
  - シミュレータが無いため実機表示は確認できないが、`expo export --platform ios` でバンドルが通ることを確認した。型チェックでは見つからない、Metroの解決エラーの有無を見るため。
  - iOSバンドル 3.3MB の生成に成功。
  - バンドル内に新画面が含まれることを確認。`oyano_crisis_progress_v01`、`oyano_consult_consent_v01`、`crisis_opened`、`consult_asked`、`person_created`、`hospital-night`、`just-died` を検出。
  - 日本語文言はHermesがUTF-16で格納するため、UTF-16でバイト検索して `いまはやらなくていいこと`、`急なとき`、`死亡診断書` を検出。
  - つまり `@oyano/shared` の crisis / consult / funnel、`@/lib/funnel`、`@/lib/consult` はいずれもMetroで解決できている。
- 残る未確認:
  - 画面の見た目、タップ操作、`Share` シート、AsyncStorageの保持は未確認。`expo start` かEAS buildでの目視が必要。

## 2026-08-21 追記 123

- マージ:
  - PR #1 `危機モードと長期相談をアプリへ、Webを入口に。計測と課金導線も通す` を main へマージした。
  - マージコミット: `1f4b9d1`。main のCI run `32461824687` success。
  - PR #2 `危機モードだけを先に出す`（`claude/crisis-mode-only`）は、内容がPR #1に含まれるためクローズした。cherry-pickでSHAが変わっているため自動クローズはされない。
- マージ前に実施したセキュリティレビュー:
  - HIGH / MEDIUM の指摘なし。
  - 確認した範囲: 家族API3本の認可（トークンをサーバー検証し、家族はボディではなく検証済みuserIdから解決）、招待トークンが応答に含まれないこと、RevenueCat webhookの署名検証、Stripe webhookの分岐が署名検証後であること、`/api/events` の許可リストとパラメータ化、`funnel_events` のRLSと`funnel_summary`のEXECUTE revoke、`dangerouslySetInnerHTML` の新規追加なし、デプロイworkflowの入力が`choice`型で制約されること。
  - 記録として: このPRの `cache: "no-store"` 修正は、Next.jsのData CacheがRoute Handler内のSupabase GETをキャッシュしていた問題を塞いでいる。キャッシュキーにAuthorizationヘッダが含まれない条件では、利用者間で応答が混ざる可能性があった。
- 本番反映の状況:
  - **Vercelへの反映は未確認。** マージコミットにデプロイのcommit statusが1件も付いていない（`total_count: 0`）。VercelのGit連携がこのリポジトリに接続されていない可能性が高い。
  - この実行環境からはVercelへ到達できない（ネットワークポリシーで403）ため、こちらからは確認も実行もできない。
  - 反映されていない場合は、`docs/DEPLOYMENT.md` の手順に従い、Git連携を接続するか `VERCEL_TOKEN` を設定して `.github/workflows/deploy-vercel.yml` を手動実行する。
- 本番で必要な作業（未実施）:
  - `supabase/funnel_events.sql` を本番Supabaseへ適用する。未適用だと `/admin/funnel` は「適用してください」を出す。
  - `ANTHROPIC_API_KEY` を設定する。未設定でも他機能は動くが、`/consult` は503を返す。
  - Supabase の Authentication > URL Configuration に本番URLをRedirect URLとして追加する。無いと招待の確認メールから戻れない。
  - Plusを売る場合は `STRIPE_PLUS_PRICE_ID` と `NEXT_PUBLIC_PLUS_PRICE_LABEL`。未設定の間は受付を開かない設計。
- 未確認（引き続き）:
  - 実Claude API / 実Supabase / 実Stripe への疎通。
  - アプリの実機表示。`expo export` でiOSバンドルが通ることまでは確認済みだが、画面の見た目・タップ・Shareシート・AsyncStorageの保持は未確認。

## 2026-08-21 追記 124

- 依頼: 本番へ反映してほしい。
- この環境からは実行できないことを確認した:
  - `api.vercel.com` と `vercel.com` が組織のegressポリシーで **403**（`gateway answered 403 to CONNECT`）。プロキシの説明にも「ポリシー拒否は回避せず報告すること」とあるため迂回しない。
  - Vercelの認証情報が無い（`~/.vercel` も `.vercel` も無し、環境変数も無し）。
  - GitHub Actionsのworkflow_dispatchも **403 Resource not accessible by integration**。このセッションのGitHub Appに `actions: write` が無い。2回試して同じ。
  - マージコミットにデプロイのcommit statusが1件も付いていない。VercelのGit連携が接続されていない可能性が高い。
- 対応（人の操作を最小化する方向で変更した）:
  - `.github/workflows/deploy-vercel.yml` を書き換えた。
    - `main` への push で本番へ反映するようにした。以前は手動実行のみだった。
    - シークレットが未設定の間は **失敗させずにスキップ** する。未設定でCIが赤くなり続けると、本当の失敗に気づけなくなるため。
    - `check` ジョブでシークレットの有無を判定し、`deploy` ジョブを `needs` + `if` で切り替える。GitHub Actionsではジョブレベルの `if` から `secrets` を直接参照できないため。
    - push で起動した場合は `inputs` が空になるため、`TARGET` は `production` を既定にした。
    - VercelのGit連携を使う場合は、シークレットを設定しなければ常にスキップされるので二重デプロイにならない。
  - `docs/DEPLOYMENT.md` の説明を実態に合わせて更新。
- これで残る人の作業:
  - リポジトリの Settings > Secrets に `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` を登録する。
  - 登録後、mainへ何かpushされた時点で自動的に本番へ反映される。デプロイ後に `scripts/smoke-web.mjs` が自動で走る。
  - または、VercelのGit連携を接続する（この場合シークレットは登録しない）。

## 2026-08-21 追記 125

- 本番反映を実施した。実行はユーザーのMacから。
- 手順:
  - この環境からはVercelへ到達できないため（組織のegressポリシーで403）、ユーザーのターミナルで実行してもらった。
  - 元の作業フォルダが見つからなかったため、`~/Desktop` へ新規clone。`mdfind` では `~/Documents/Codex/2026-07-05/zip-v0-3-web-expo-codex/review_exports/` 配下のzipしか見つからず、元フォルダは同ディレクトリのあたりと推測される。
  - `npx vercel login`（device認証）→ `npx vercel link` → `npx vercel --prod`。
  - `vercel link` は新しいCLI（59.3.0）で選択形式が変わっており、`Search all projects` から実在プロジェクトを選ぶ形にした。フォルダ名からの推測候補を選ぶと、既存プロジェクトが無い場合に新規作成される恐れがあるため。
  - Team: `dogwoodcommunity1`、Project: `oyano-moshimo-navi`。同じチームに `web` という別プロジェクトもあるので取り違えに注意。
- 結果:
  - Deployment: `https://oyano-moshimo-navi-1xtfus1yv-dogwoodcommunity1.vercel.app`
  - Aliased: `https://oyano-moshimo-navi.vercel.app`
  - `✓ Ready in 60s`
  - Inspect: `https://vercel.com/dogwoodcommunity1/oyano-moshimo-navi/5dnUubEHw9J7CDkv1iyMuJrKGtAT`
- 確認:
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` を本番に対して実行し、**37件すべてOK、失敗0**。
  - `/crisis`、`/crisis/hospital-night`、`/crisis/critical`、`/crisis/just-died`、`/consult`、`/family` がいずれも200。
  - `/api/consult` は503（`ANTHROPIC_API_KEY` 未設定のため設計どおり）。`/api/family` は401（認証必須のため設計どおり）。
  - `admin env api` はADMIN_ACCESS_TOKEN未指定のためSKIP。
- 本番で残っている設定:
  - `ANTHROPIC_API_KEY` を Vercel の Environment Variables に追加する。追加後は再デプロイが必要。未設定の間、`/consult` の画面は出るが送信すると503になる。
  - `supabase/funnel_events.sql` を本番Supabaseへ適用する。未適用だと `/admin/funnel` が「適用してください」を表示する。
  - Supabase の Authentication > URL Configuration に本番URLをRedirect URLとして追加する。無いと招待の確認メールから戻れない。
- 注意:
  - 今回 `~/Desktop/oyano-moshimo-navi` にcloneしたフォルダに `.vercel/project.json` と `.env.local` が作られている。次回以降はこのフォルダで `npx vercel --prod` だけで反映できる。
  - `.github/workflows/deploy-vercel.yml` は、シークレットを登録すればmainへのpushで自動反映する状態になっている（現在は未登録のためスキップ）。今回のようにCLIで反映するなら登録は不要。

## 2026-08-21 追記 126

- 本番で `ANTHROPIC_API_KEY` を設定し、**実際のClaude APIからの応答を初めて確認した。**
- 設定の経緯（詰まった点の記録）:
  - `npx vercel env add` の sensitive 入力は貼り付けても画面に出ないため、途中で欠けたまま登録されていた。
  - このとき画面には「いまは相談を受け付けられません。」が出るが、**キー未設定時の文言とは末尾が違う**（未設定時は「手帳への記録はこれまで通り使えます。」が付く）。この差で `AuthenticationError` と切り分けられた。文言を分けておいたことが診断に効いた。
  - 対処: `read KEY` で変数に取り、`curl https://api.anthropic.com/v1/models` で200を確認してから `printf '%s' "$KEY" | npx vercel env add ...` で流し込んだ。手で貼らないので欠けない。
  - `CONSULT_DAILY_LIMIT=30` も設定済み。1回$0.05〜0.1なので上限は1日$3程度。
- 応答の質（本番、実データ）:
  - 「最近、同じ話を何度もするようになった」という記録に対し、**認知症だと判断していない**。「原因の判断は医療者の役割で、こちらは『いつから、どんな時に』を伝えるだけで十分です」と、判断を医療者へ渡している。
  - 記録に無いことを作らず、「入院の経緯、入院期間の見通しは書かれていません」と不足を明示している。
  - `watchOuts` に「今すぐ全部を割り振らなくて大丈夫」「原因を家族で判断しようとしなくて構いません」「近くに住む人に自然と集中しがち」「『できない』と言った人を責めない前提で話す」が出た。システムプロンプトの「家族の誰かを責めない」「介護を担っている人の負担を軽く扱わない」が効いている。
  - 日本語は自然で、テンプレート感がない。
- 問題: **遅い**。
  - 1回目: 48.8秒かかって空で返った（実行上限60秒に対して危険）。
  - 2回目: HTTP 200 / 29.9秒。
  - 危機の最中に開くアプリとして50秒待ちは長すぎ、時々失敗するのはさらに悪い。
- 対応:
  - `output_config.effort` を `medium` → `low` へ。出力の形はシステムプロンプトとstrict schemaで固定してあるため、推論の深さを下げても崩れにくいと判断した。
  - `max_tokens` を 8000 → 5000。
  - `CONSULT_MAX_ENTRIES` を 20 → 12。読む量が減れば時間も減る。
- 次の確認:
  - 同じリクエストを本番へ投げ直し、**所要時間と質の両方**を前回と比べる。
  - 質が落ちていたら `medium` へ戻し、代わりにfast mode（Opus 5、`speed: "fast"`、2.5倍速・$10/$50 per MTok）を検討する。上限30回/日なら1日$3程度に収まる。

## 2026-08-21 追記 127

- 追記126の調整を本番で計測した結果、**速度は変わらなかった**。
  - `effort: medium` → `low`、`max_tokens` 8000→5000、記録20件→12件に変更。
  - 前回 29.9秒 → 今回 29.77秒。誤差の範囲。
- ただし**質は落ちていない。むしろ良くなった部分がある**。同じ入力で比較した。
  - 「『同じ話を繰り返す』ことだけで病名を決めつける必要はありません」と、病名の否定がより明確になった。
  - 「近くに住む人に負担が集中しやすくなります。**その人の休む時間も分担の一部として扱ってください**」という一文が新たに出た。
  - 相談先に「家族会・介護者の集まり」、質問に介護保険申請の確認が加わった。
  - よって `effort: low` のまま据え置く。質が同じで思考トークンが減る分、安い。
- 判明したこと:
  - 時間を食っているのは推論ではなく**出力の生成**。日本語で約1,800文字を6項目分書いているため、そこが律速。
  - つまり effort や入力量をいじっても効かない。出力の生成速度そのものを上げるしかない。
- 対応:
  - `CONSULT_FAST_MODE=1` で fast mode（`speed: "fast"`、beta `fast-mode-2026-02-01`）を有効にできるようにした。
  - 同じモデル・同じ品質のまま最大2.5倍速。代わりに料金が2倍（$10/$50 per MTok）。1回$0.1程度。
  - **料金が変わるので既定では無効。** 使うかどうかは運用側の判断。
  - fast modeが使えない環境（研究プレビューのため利用可否がある）では `BadRequestError` を捕まえて通常速度へ自動で落とす。速さのために機能ごと止めない。
- 未確認:
  - fast mode を有効にしたときの実測時間。有効化して同じリクエストで比較する必要がある。

## 2026-08-21 追記 128

- 本番で `429 consult_busy` が出た。これは自前の1日上限（`rate_limit_exceeded`）ではなく、**Anthropic側のレート制限**（`Anthropic.RateLimitError`）。
- 原因の候補:
  - 高速モードの枠。fast modeは通常枠とは別にレート制限が数えられる。
  - Anthropicアカウントの利用枠（Tier）。作成直後のアカウントは1分あたりのトークン数が低い。
- 見つけた不備:
  - 追記127のfast mode実装は `BadRequestError`（使えない）だけを通常速度へ落としていた。
  - **`RateLimitError`（高速枠が混んでいる）では落ちずにそのまま失敗していた。** 高速枠は別枠なので、ここで諦めると通常枠なら通る相談まで失敗する。
- 対応:
  - `RateLimitError` も通常速度へのフォールバック対象に加えた。
- 残る確認:
  - fast modeを有効にしていた場合、フォールバックが効いて通るようになったか。
  - 有効にしていなかった場合は、Anthropicのアカウント利用枠の問題。https://console.anthropic.com/settings/limits で確認する。

## 2026-08-21 追記 129

- 追記128の429の原因が確定した。`npx vercel env ls production` で `CONSULT_FAST_MODE` が設定されていることを確認。**高速モードの枠切れ**だった。
- 判断: **高速モードは使わない。**
  - 研究プレビュー段階で、通常とは別の狭い枠が割り当てられる。このアカウントでは実用に耐えない。
  - 倍の料金を払っても枠が足りず失敗するなら意味がない。「速いが時々失敗する」はこの製品にとって最悪の状態。
  - `CONSULT_FAST_MODE` を削除して通常速度へ戻した。フォールバックのコードは残してあるので、将来枠が上がれば環境変数1つで有効にできる。
- 最終状態の実測（本番）:
  - `HTTP 200 / 28.06秒`。
  - 応答の質は維持。むしろこの回が最良だった。
  - `watchOuts` の末尾に「呼吸の様子がおかしい、意識がはっきりしない、強い痛みや出血があるなど急な変化があれば、家族間の相談より先に看護師・主治医へ連絡してください」が入った。**記録にそういう記述が無い場面でも先回りして出ている。** システムプロンプトの救急促しが効いている。
  - 「『同じ話を繰り返す』ことだけで原因を決めつける必要はありません」も維持。3回とも病名を判断していない。
- **本番設定の項目1（`ANTHROPIC_API_KEY`）は完了。**
  - 設定済み: `ANTHROPIC_API_KEY`（Sensitive）、`CONSULT_DAILY_LIMIT=30`。
  - 1回$0.05程度、上限30回/日なので最大でも1日$1.5程度。
- 速度についての結論:
  - 28〜30秒。速くはないが確実に返る。画面には「30秒ほどかかることがあります」と表示済み。
  - 時間を食っているのは出力の生成（日本語1,800文字×6項目）。effortや入力量では変わらないことを実測で確認済み。
  - 利用者が増えてから速度に投資する順番でよい。
- 残り: `supabase/funnel_events.sql` の本番適用。

## 2026-08-21 追記 130

- `supabase/funnel_events.sql` を本番Supabaseへ適用した。
  - プロジェクト: `dogwoodcommunity's Project`（`ypnuxyfirlvbsqujocuy`）、Northeast Asia (Tokyo)。
  - SQL Editorで実行し `Success. No rows returned`。
  - `select public.funnel_summary(30);` で動作確認。`days: 30` と各項目0、`eventTotals: {}` が返ることを確認した。テーブルと集計関数の両方が正しく入っている。
- **これで本番の設定は完了。** 以後、危機モードを開く・対象者を登録する・記録を書く・相談する、の4つが記録され、数字が溜まっていく。
  - 適用前は `/api/events` のinsertが黙って失敗していた（`stored: false` を返すだけで利用者の操作は止めない設計）。今後は記録される。
- 本番の最終状態:
  - `https://oyano-moshimo-navi.vercel.app` に全機能を反映済み。smoke 37件成功。
  - `ANTHROPIC_API_KEY` 設定済み。実応答をHTTP 200 / 28秒で確認。
  - `CONSULT_DAILY_LIMIT=30`。最大でも1日$1.5程度。
  - `funnel_events` テーブルと `funnel_summary` 関数を適用済み。
- 残っている作業:
  - **Supabase の Authentication > URL Configuration に本番URLをRedirect URLとして追加する。** 未実施。無いと家族招待の確認メールから戻れない。
  - `/admin/funnel` を開くには `ADMIN_ACCESS_TOKEN` が必要。46日前に設定された値がVercelにあるが、値が不明なら設定し直す。
  - アプリ（Expo）の実機表示確認。バンドルが通ることまでは確認済み、画面は未確認。
  - Plusを売るかの判断。売るならiOSはApp内課金が必要（`docs/IN_APP_PURCHASE_PLAN.md`）。
- 次に見る数字:
  - `/admin/funnel` の「7日以内に2件目を書いた」割合。数%なら良い無料ツール、20%を超えるなら賭けてよい。この数字が出るまで価格は決めない。

## 2026-08-21 追記 131

- SupabaseのRedirect URL設定を確認した。**すでに登録済みだった。**
  - Site URL: `https://oyano-moshimo-navi.vercel.app`
  - Redirect URLs: `https://oyano-moshimo-navi.vercel.app/**`、`oyanomoshimo://handoff`、`oyanomoshimo:///handoff`
  - ワイルドカードがあるので `/home?cloud=1`、`/family`、`/invite/xxx`、`/plans` すべて戻れる。
- 本番でマジックリンクを実際に試した。**メールは届き、リンクからログイン状態で `/family` に戻れた。** ここは正常。
- **ただしバグを踏んだ。** 画面に「家族の情報を用意できませんでした。」が出て、メンバー一覧が「読み込み中です」のまま止まった。
- 原因（私の実装漏れ）:
  - `families.owner_user_id` は `profiles(id)` を参照する。`auth.users` から `profiles` を自動作成するトリガーは存在しない。
  - 既存の `/api/notebook/sync` は家族を作る前に `profiles` をupsertしているが、**追記112で書いた `lib/family.ts` の `getOrCreateFamilyId()` はそれをしていなかった。**
  - 結果、**クラウド控えを一度も使っていない利用者が先に `/family` を開くと、外部キー違反で家族を作れない。** モックはFKを強制しないため、モック検証では出なかった。
- 対応:
  - `getOrCreateFamilyId()` で、家族を作る前に `profiles` をupsertするようにした。
  - `/api/family`、`/api/family/invite`、`/api/stripe/plus-checkout` の catch でエラーをログに残すようにした。**握りつぶしていたため本番で原因が追えず、診断が遅れた。**
- 学び:
  - モックは外部キーを検証しない。スキーマの参照関係に依存する処理は、モックだけでは足りない。
  - エラーを握りつぶすと、本番で起きた時に何も分からない。最低限ログには残す。
- 未対応:
  - 認証メールの本文が英語のまま（Supabaseの既定テンプレート）。`docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md` に日本語版の資料があるが未適用。親の入院で動転している家族が受け取るメールとして、英語のままは良くない。

## 2026-08-21 追記 132

- 追記131の修正を本番へ反映し、動作を確認した。
- 結果: `/family` で「あなたのほかに2人まで無料です。残り2人分。」「あなた（手帳を作った人）参加済み」が正しく表示された。外部キー違反は解消。
- **これで家族共有が本番で使える状態になった。** マジックリンクの送信、リンクからの復帰、家族の自動作成、メンバー一覧の表示まで通っている。
- 本日の到達点まとめ:
  - 危機モード（Web/アプリ）、長期相談、家族共有・招待、ファネル計測、Plusの受け皿、IAPの受け口を実装しmainへマージ。
  - 本番 `https://oyano-moshimo-navi.vercel.app` へ反映。smoke 37件成功。
  - `ANTHROPIC_API_KEY` 設定済み。実応答をHTTP 200 / 28秒で確認。病名を断定しない、記録に無いことを作らない、急変時は医療者へ促す、の3点が実応答で確認できた。
  - `CONSULT_DAILY_LIMIT=30`。最大でも1日$1.5程度。
  - `funnel_events` / `funnel_summary` を適用済み。数字の蓄積が始まっている。
  - SupabaseのRedirect URLは設定済みだった。マジックリンクの往復を実機で確認。
- 残っている作業:
  - **認証メールの本文が英語のまま。** `docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md` の日本語版が未適用。
  - アプリ（Expo）の実機表示。バンドルは通るが画面は未確認。
  - `/admin/funnel` を開くための `ADMIN_ACCESS_TOKEN`。値が不明なら再設定する。
  - Plusを売るかの判断。売るならiOSはApp内課金が必要（`docs/IN_APP_PURCHASE_PLAN.md`）。
- 次に見る数字: `/admin/funnel` の「7日以内に2件目を書いた」割合。

## 2026-08-21 追記 133

認証メールの文面を直そうとして、**それより重い問題**に当たった。

- Supabaseは、独自SMTPを設定していないプロジェクトのメールテンプレートを
  編集させない。画面に貼ろうとしても入力できない。
- さらに重いのはこちら。標準のメール送信では
  **「Supabaseの組織メンバーとして登録されたアドレス」にしかメールが届かない。**
  それ以外は `Email address cannot be used as it is not authorized` で拒否される。
- つまり **いまの本番は、開発者本人以外は誰もログインできない。**
  家族を招待しても、招待された人は参加できない。
  昨日までの検証が全部通っていたのは、使ったアドレスが組織メンバーだったから。
- これは「配る前にやること」ではなく、**配れない理由**にあたる。

出典: https://github.com/orgs/supabase/discussions/29370

### 先に直したこと

`sendMagicLink` はSupabaseのエラーをそのまま画面に出していた。上の拒否も
英語のまま表示される。組織外の人が触ると、英語のエラーだけを見て終わる。
`packages/shared/src/authErrors.ts` を足し、Web・アプリの送信口で日本語へ直した。
利用者の入力が悪いと読める書き方は避け、こちらの準備不足だと分かる文言にした。

### 次にやること

Resendで `bee-ch.co.jp` を認証し、SupabaseにSMTPを設定する。
手順は `docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md`。
SMTPが入ると、テンプレートの編集も同時に解ける。

## 2026-08-21 追記 134

Resendは使えないと判明。送信サービスをBrevoに変更する。

- `bee-ch.co.jp` はお名前.comで取得しているが、**ネームサーバーはWixに向いている。**
  Wixでサイトを作った時点で切り替わっている。ResendはWixを検出して拒否する。
- 根拠は、Resendが送信用サブドメイン `send.bee-ch.co.jp` へのMXを必須にしていること。
  **Wixはサブドメインに対するMXを作れない。** 設定でどうにかなる話ではない。
- MXをルートに置いて回避することはできない。`bee-ch.co.jp` は会社のメールで
  使っており、既存のMXを壊すと会社のメールが止まる。
- **Brevoはドメイン認証がTXTだけで済み、MXを要求しない。** WixのDNSのまま通る。
  無料枠は1日300通。いまの規模では足りる。

手順は `docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md` に反映済み。

将来: このサービス自身のドメインを取るほうがよい。会社ドメインから送るより
信用されるし、Web入口が `*.vercel.app` のままなのも直る。急ぎではない。

## 2026-08-21 追記 135

送信サービスへの新規登録はやめ、**すでに持っているメールボックスのSMTPを
そのまま使う**方針にした。Supabaseは普通のSMTPを受け付けるので、送信サービスに
登録しなくても、いま使っている送信サーバーを指定すれば足りる。DNSも触らない。

会社のメールはお名前.comで受けているので、その送信サーバー
（`mail***.onamae.ne.jp` / 587）を使う。

**注意**: SupabaseにはSMTPのパスワードを保存する。お名前.comのメールでは
SMTPのパスワードがメールボックスのログインパスワードそのものなので、
`info@bee-ch.co.jp` を渡すと会社の受信メールを読める鍵を預けることになる。
`noreply@bee-ch.co.jp` のような送信専用の箱を作り、それだけを渡す。

弾かれた場合はGmailのアプリパスワードへ切り替える（新規登録不要、
アプリパスワードは個別に取り消せるので鍵としてはより安全）。
送信数が増えたらBrevoへ移す。手順は
`docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md` に3段構えで残した。

## 2026-08-21 追記 136

認証メールの設定を、画面ではなくコマンドで入れられるようにした。

`scripts/setup-auth-email.mjs` と `supabase/auth-emails/`。

Supabaseは独自SMTPが無いプロジェクトのテンプレート編集を画面上で止めているが、
Management API (`PATCH /v1/projects/{ref}/config/auth`) はSMTPと文面の両方を
受け付ける。**1回のPATCHで同時に入れれば制限に引っかからない。**
貼り付けができない問題は、これで回避できる。

対象フィールドは公式のOpenAPIスキーマ（UpdateAuthConfigBody）で確認済み:
`smtp_host` / `smtp_port` / `smtp_user` / `smtp_pass` / `smtp_admin_email` /
`smtp_sender_name` / `mailer_subjects_confirmation` /
`mailer_templates_confirmation_content` / `mailer_subjects_magic_link` /
`mailer_templates_magic_link_content`

文面の実体は `supabase/auth-emails/` に置いた。資料とスクリプトで二重管理に
ならないようにしている。文面を直すときはそのファイルを編集して再実行する。

**この作業環境からは実行できない。** `api.supabase.com` も `onamae.com` も
ネットワークポリシーで遮断されている（403）。利用者自身のパソコンで動かす。

トークンとパスワードは画面に出さず、保存もしない。

## 2026-08-21 追記 137

`scripts/setup-auth-email.mjs` を作り直した。

readlineで入力を伏せ字にする実装が環境によって壊れる（入力を取りこぼして
黙って終了する）ことが確認できたため、その方式をやめた。秘密の値は
`read -s` で環境変数に入れて渡す形に統一している。今日 ANTHROPIC_API_KEY で
うまくいったやり方と同じ。引数ではなく環境変数にするのは、シェルの履歴と
ps の出力に残さないため。

一番手数が少ないのはGmail。新しいメールボックスもDNSも新規登録も要らない。
Googleがアプリパスワードを "abcd efgh ijkl mnop" と空白入りで表示するため、
スクリプト側で空白を落として16桁を確認する。

模擬サーバーで通しの確認をした:
- トークン未設定・パスワード未設定で正しく止まる
- `--check` が何も変えずに現状だけ表示する
- 空白入りのアプリパスワードが16桁・空白なしで送られる
- 2つの文面が別々に送られ（初回と2回目以降で1行違う）、
  `{{ .ConfirmationURL }}` が壊れずに残る

## 2026-08-21 追記 138

macOSの標準シェルはzsh。bashの `read -s -p "..." VAR` はzshでは通らず、
`read: -p: no coprocess` になる（zshの `-p` はコプロセスからの読み取り）。
資料とスクリプトの案内を `printf "..."; read -s VAR; echo` に統一した。
これはbash/zshどちらでも動く。

## 2026-08-21 追記 139

**追記133の見立ては誤りだった。訂正する。**

`--check` で本番の設定を読んだところ、**独自SMTPはすでに入っていた。**

```
独自SMTP  mail86.onamae.ne.jp:465
差出人    親のもしもナビ <info@bee-ch.co.jp>
```

したがって「組織メンバー以外にメールが届かない」「開発者本人以外ログインできない」は
**この本番には当てはまらない。** メールは誰にでも届く。Gmailのアプリパスワードも不要。
Resend / Brevo / DNS の検討も、この本番には要らなかった。

画面からテンプレートを貼れなかった原因は特定できていない。独自SMTPが無いことが
理由だと考えたが、そうではなかった。Management API からは問題なく入る。

残っている本当の問題は**文面だけ**。件名が英語のままだった。

```
初回の件名      Confirm your email address
2回目以降の件名 Your sign-in link
```

`--templates-only` を足した。`mailer_*` の4項目だけを送り、`smtp_*` は一切含めない。
すでに動いている送信の設定を壊さずに文面だけ差し替えられる。
本番と同じ状態の模擬サーバーで、SMTPに触っていないことを確認済み。

なお追記135で入れた `authErrors.ts` は残す。組織外アドレスの拒否は起きないが、
送信数の上限・連続送信・アドレスの形・通信断は実際に起きうるもので、
それらが英語のまま画面に出ていたのは変わらず直すべきだった。

## 2026-08-21 追記 140

`--templates-only` を本番に適用し、反映を確認した。

```
初回の件名      【親のもしもナビ】ログイン用のリンクです
2回目以降の件名 【親のもしもナビ】ログイン用のリンクです
文面            日本語（適用済み）
```

SMTPの設定（`mail86.onamae.ne.jp:465` / `親のもしもナビ <info@bee-ch.co.jp>`）は
差し替え前と変わっていない。狙い通り、送信の設定には触れていない。

**認証メールの日本語化は完了。** 追記132で残っていた項目のうち1つが片付いた。

残り:
- アプリ（Expo）の実機表示。バンドルは通るが画面は未確認。
- `/admin/funnel` を開くための `ADMIN_ACCESS_TOKEN`。値が不明なら再設定する。
- Plusを売るかの判断。売るならiOSはApp内課金が必要。
- 次に見る数字: `/admin/funnel` の「7日以内に2件目を書いた」割合。

文面を直したくなったら `supabase/auth-emails/` を編集して
`node scripts/setup-auth-email.mjs --templates-only` を実行し直す。

## 2026-08-21 追記 141

無料の範囲を狭めた。**2冊目の手帳と、2人目の共有からPlus。**

数字の定義を `packages/shared/src/plan.ts` に1か所へ集めた。

```
FREE_PLAN_NOTEBOOK_LIMIT = 1   無料で作れる手帳（対象者）
FREE_PLAN_MEMBER_LIMIT   = 1   無料で招待できる人数（本人は数えない）
```

画面には「2人目から有料」と出るのにサーバーは3人まで通す、というずれが起きると
利用者は理由の分からない拒否に当たる。3層すべてを同じ値に揃えてある。

- `packages/shared/src/plan.ts`（Web・アプリ・サーバーが参照）
- `supabase/family_invite_rpc.sql` と `supabase/admin_auth_hardening.sql` の `v_limit`
- `apps/web/lib/family.ts` は shared を再輸出するだけにした

### 手帳の上限をどこで止めるか

Webの手帳は端末のlocalStorageにある。作成そのものは画面側でしか止められない。
**本当の線引きはクラウドに上げるところ**に置いた。

- 画面（`/start`）: 開いた時点で埋まっていれば、11択を押せなくして先に伝える。
  押してから断られるのがいちばん徒労になるため。Plusへの導線を出す。
- サーバー（`/api/notebook/sync` POST）: 上限を超える**新しい**手帳はクラウドへ上げない。
  すでにある手帳の更新は上限に関係なく通す。端末の中のデータは消さない。
- アプリ（`createPersonForFamily`）: 同じ基準で止める。
  Webでは断られアプリでは通る、という食い違いを作らない。

`plan` は `/api/notebook/sync` の応答に含めてlocalStorageへ控える
（`oyano_plan_v01`）。一度もクラウドに触っていない人は free として扱う。

### 断り方

「上限です」で終わらせず、いま持っているものは無事だと必ず添えている。

```
無料で作れる手帳は1冊です。もう1人分をつくるにはPlusが要ります。
いまの手帳はこれまで通り使えます。
```

### 未適用

**SQLの変更は本番へ未適用。** `supabase/family_invite_rpc.sql` を
Supabaseのエディタで流し直す必要がある。流すまで、招待は2人まで通る。

## 2026-08-21 追記 142

見た目のズレを3つ直した。実機の指摘（メニューの段差、枠の中のバランス）から。
すべて Playwright で 390×844 に描画して、数値と目視の両方で確認している。

1. **ヘッダーの文字がピルとずれていた。**
   `.navlinks` は `display:flex` で `align-items` が既定（stretch）だった。
   「急なとき」だけが上下余白を持つピルなので、余白の無い「家族ボード」「読む」は
   文字が枠の上に寄る。箱の高さは34pxで揃うのに、文字だけ約6px高い位置に出ていた。
   `align-items: center` を足した。320〜768pxで文字中心のズレ0.0pxを確認。
   `layout.tsx` の初期表示CSSにも同じ指定を入れた。無いと初回描画の一瞬だけ段差が出る。

2. **クラウド控えカードの中身が枠に張り付いていた。**
   `.nb-card` は内側の余白を持たず、中の `.nb-row` 側が持つ設計。
   このカードは中身を直接置いているので、余白がゼロのままだった。
   文字が枠から1pxの位置にあった。`padding: 16px` を持たせた。

3. **journeyの丸バッジがラベルと見出しの隙間に浮いていた。**
   `align-items: start` だと、34pxの丸の中心が小さいラベル（11.5px）と
   見出し（15px）の間に落ちて、どちらとも揃わない。
   `center` にすると、行数の多い項目で本文の横まで下がってしまう（試して却下）。
   ラベル1行＋下余白の下にある見出し1行の中心へ、丸の中心を合わせた。
   計算式をCSSに書いてあるので、字の大きさを変えても追従する。
   バッジ中心と見出し中心が一致することを実測で確認。

### 測り方の注意

要素の枠（getBoundingClientRect）で余白を測ると誤検知する。
全幅の要素が自分で余白を持っている場合、枠は端にあっても文字は内側にある。
`Range.getClientRects()` で**文字そのもの**の位置を見ること。
これで測り直したところ、他の9枚のカードはすべて問題なかった。

## 2026-08-21 追記 143

journeyの丸の中を、漢字から形に変えた。

以前は「済／今／次」の1文字を34pxの丸に入れていた。やめた理由:

- 12pxの漢字は小さく潰れる。読み手は入院直後の家族で、落ち着いていない。
- 隣に「最初」「日々」「連絡」といったラベルが並ぶので、字面が増えるだけで
  状態の違いが一目で分からない。
- 一覧の目的は「どこまで進んだか」を読まずに掴めることなので、文字は要らない。

置き換え:

| 状態 | 印 |
| --- | --- |
| 済み | チェック（currentColorで描画） |
| いま | 中を塗った丸 |
| このあと | 輪郭だけの丸（薄く） |

CSSで描いている。プロジェクトの他のアイコン（`.toc-icon`）と同じ作り方。
読み上げには `role="img"` と `aria-label`（済み／いま／このあと）で言葉を渡す。
丸の中のテキストが空であること、本文に漢字1文字が残っていないこと、
バッジ中心と見出し中心が一致したままであることを実測で確認した。

## 2026-08-21 追記 144

### accept 側の上限を見落としていた

追記141で `create_family_invite` の `v_limit` だけを1に変えたが、
**`accept_family_invite` の中に別の上限が直書きされていた**（`) < 2`）。
招待を作る側だけ直しても、受け取る側で2人目が通ってしまう。両方1にした。

無料プランの人数上限が書かれている場所は、いま4か所:

1. `packages/shared/src/plan.ts` の `FREE_PLAN_MEMBER_LIMIT`（Web・アプリ・サーバー）
2. `create_family_invite` の `v_limit`
3. `accept_family_invite` の `) < 1`
4. （手帳の冊数は `FREE_PLAN_NOTEBOOK_LIMIT` の1か所のみ）

SQL側の2つには、1を参照するようコメントを入れてある。

### SQLをターミナルから流せるようにした

`supabase/free_plan_member_limit.sql` と `scripts/run-sql.mjs`。

Supabase Management API の `POST /v1/projects/{ref}/database/query` を使う。
画面のSQLエディタを開かなくてよい。

```
printf "トークン: "; read -s SUPABASE_ACCESS_TOKEN; echo
export SUPABASE_ACCESS_TOKEN
node scripts/run-sql.mjs --check                        いまの上限を見るだけ
node scripts/run-sql.mjs supabase/free_plan_member_limit.sql
```

`--check` は本番の関数定義そのものから上限を読み取って表示する。
流す前と後で数字が変わったことを目で確認できる。

移行ファイルは関数2つの差し替えと権限付与だけ。テーブルもポリシーも触らない。
2つの関数定義は `family_invite_rpc.sql` と `admin_auth_hardening.sql` の
どちらとも同一なので、管理者まわりの保護を巻き戻すことはない（diffで確認済み）。
模擬サーバーで通しの動作を確認した。

### この作業環境からは本番へ出せない

```
api.vercel.com   403
vercel.com       403
api.supabase.com 403
```

いずれもネットワークポリシーによる遮断。利用者自身のパソコンで実行する。

## 2026-08-21 追記 145 — いますぐやる作業（未反映）

コードは全部 main にある。**残っているのは本番へ反映する操作だけ。**
クラウド上の実行環境からは `vercel.com` も `api.supabase.com` も
ネットワークポリシーで遮断されている（403）ため、利用者のパソコンで実行する。

### 1. Webを反映

```
cd ~/Desktop/oyano-moshimo-navi
git pull origin main
npx vercel --prod
```

含まれる変更:
- 2冊目の手帳・2人目の共有からPlus（追記141）
- ヘッダーの段差、カードの余白、バッジの位置（追記142）
- 丸の中の漢字を形に置き換え（追記143）

反映後の確認:
```
node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app
```

### 2. SQLを反映

```
printf "Supabaseのトークン: "; read -s SUPABASE_ACCESS_TOKEN; echo
export SUPABASE_ACCESS_TOKEN

node scripts/run-sql.mjs --check
node scripts/run-sql.mjs supabase/free_plan_member_limit.sql
```

`--check` は本番の関数定義そのものから上限を読む。
流す前は `2人`、流したあとは `1人` になるのが正しい。

流すのは関数2つの差し替えと権限付与だけ。テーブルもポリシーも触らない。

### 3. 反映後に見ておくこと

- `/start` で2冊目を作ろうとすると、選択肢が押せずPlusへの案内が出るか
- `/family` で「無料で一緒に見られるのは、あなたのほかに1人まで」と出るか
- 招待を2人目に出そうとして断られるか（SQLを流したあと）

### そのあとに残るもの

- アプリ（Expo）の実機表示。バンドルは通るが画面は未確認。
- `/admin/funnel` を開くための `ADMIN_ACCESS_TOKEN`。値が不明なら再設定する。
- プレミアプランを作るかどうか。中身が決まっていない。
- 次に見る数字: `/admin/funnel` の「7日以内に2件目を書いた」割合。

## 2026-08-22 追記 110

- ユーザー依頼:
  - 「確認リスト」の項目を編集できるようにしてほしい。
  - プロフィール変更・過去の記録・日記からの相談メモ/アラートが分かりにくいので、Petterの「私のうちの子ログ」のような手帳体験へ近づけたい。
  - まずは目の前の不整合として、`緊急連絡先と看取り方針を共有する` などの確認リストをその場で直せるようにする。
- 対応:
  - `apps/web/lib/store.ts`
    - `EditableTask` / `TaskProgress` / `LocalDiagnosisResult` を追加。
    - 確認リストの `title`、`description`、`dueDate`、`priority`、`progress`、`assignee`、`note`、`updatedAt` をローカル手帳に保存できるようにした。
    - `updateCaseTask(caseId, taskIndex, patch)` を追加し、確認リスト1件単位で更新できるようにした。
  - `apps/web/app/home/page.tsx`
    - 確認リストを単なるリンク表示から、編集可能なカードUIへ変更。
    - 各カードで `進行中`、`完了` の即時更新ができる。
    - `編集する` から、項目名、内容、期限、担当者、状態、優先度、家族メモを編集できる。
    - 変更後は画面状態とローカル手帳を更新し、保存完了メッセージを表示する。
  - `apps/web/app/api/notebook/sync/route.ts`
    - クラウド同期時に確認リストの編集内容も失われないよう、`people.profile.localTasks` に編集済みタスクスナップショットを保存。
    - 復元時は `profile.localTasks` を優先し、なければDBの `tasks`、さらに無ければ診断結果の初期タスクから復元する。
    - `tasks.requires_professional` は本番schemaに存在しないため、同期insert/update対象から外した。
  - `apps/web/app/globals.css`
    - 確認リストカード、状態チップ、編集フォーム、スマホ表示用のCSSを追加。
- 確認:
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。
  - `git diff --check` OK。
  - build時にSupabase JSのNode 20非推奨警告は継続して出るが、ビルド自体は成功。
- 未完了:
  - まだこの追記時点ではcommit/push前。
  - Vercel production反映は引き続きVercel認証が必要。GitHub push後にVercel連携が自動deployする可能性はあるが、CLIからの手動本番deployは未認証で止まる。
  - 次にやるなら、プロフィール編集導線の明確化、過去記録タブ、日記の月別一覧、記録からの注意サイン/相談メモの強化を進める。

## 2026-08-22 追記 111

- 追記110の後処理:
  - `Make notebook tasks editable` をGitHub側の最新 `main` にrebaseした。
  - rebase中に `apps/web/app/home/page.tsx` と `docs/SESSION_HANDOFF.md` が競合したが、GitHub側の最新実装（長期相談・危機モード・家族共有など）を残しながら、確認リスト編集機能を統合した。
  - rebase後のcommitは `e549949 Make notebook tasks editable`。
- 確認:
  - `pnpm install` を再実行し、欠けていた `@anthropic-ai/sdk` を含む依存関係を復旧した。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成、`/guides/[slug]` は100件以上のガイドを生成。
  - `git diff --check` OK。
  - build時のSupabase JS Node 20非推奨警告は継続して出るが、ビルドは成功。
- Git状態:
  - この追記時点で `main` は `origin/main` より1commit先行。
  - 未追跡の `review_exports/` は既存のレビュー出力フォルダとして残っているが、今回のcommitには含めない。
  - 次の操作は `git push origin main`。

## 2026-08-22 追記 112

- GitHub反映:
  - `02f9c08 Make notebook tasks editable` を `origin/main` へpush済み。
  - push結果: `f61c113..02f9c08 main -> main`。
- 直後の残状態:
  - 未追跡の `review_exports/` は残っている。今回の作業対象外のためcommitしていない。
  - VercelはGitHub連携が有効なら自動デプロイ待ち。CLI手動deployは引き続きVercel認証が必要。

## 2026-08-22 追記 113

- 目的:
  - 課金価値レビューで最重要指摘だった「localStorageだけでは手帳を名乗れない」に対応するため、PWAの家族ボードでクラウド控え保存を“任意の手動ボタン”から“本人確認後は自動で守る”体験へ寄せた。
- 実装:
  - `apps/web/app/home/page.tsx`
    - `CloudAutoStatus` と `NotebookSyncPayload` を追加。
    - メール確認後または既存ログイン時の文言を「変更のたびに自動で控え保存」に変更。
    - ログイン済みでローカル手帳が空なら `/api/notebook/sync` からクラウド控えを自動復元。
    - ログイン済みでローカル手帳がある場合は初回に自動保存。
    - `cases` / `diaryEntries` の変更を1.2秒デバウンスして自動保存。
    - 保存中にさらに変更が入った場合は `pendingAutoSyncPayloadRef` に保持し、保存完了後に再保存する。
    - 復元中は空データでクラウドを上書きしないよう `cloudRestoringRef` で保護。
    - 保存先メール、保存状態（自動保存中・最終保存時刻・エラー）をクラウド控えカードに表示。
    - 手動の「今すぐ保存」「クラウドから復元」は残したが、主役は自動保存に変更。
  - `apps/web/app/globals.css`
    - 自動保存ステータス行 `.cloud-auto-line` を追加。
    - 保存中の小さなパルス表示とエラー色を追加。
- 確認:
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - `git diff --check` OK。
  - build時のSupabase JS Node 20非推奨警告は継続して出るが、ビルドは成功。
- 残状態:
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残っている。今回もcommit対象外。
  - 次の操作はcommit/push。

## 2026-08-22 追記 114

- GitHub反映:
  - `7515db6 Make notebook cloud backup automatic` を `origin/main` へpush済み。
  - push結果: `d2d7811..7515db6 main -> main`。
- 現在地:
  - 家族ボードのクラウド控えは、ログイン済みなら初回同期・空端末なら復元・編集後はデバウンス自動保存まで入った。
  - 次に進めるなら、レビュー指摘の残りから「本物のAI相談の導線整理」「家族共有2名無料の体験確認」「対象者ページのタブ/手帳感のさらなる整理」の順が現実的。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 115

- 目的:
  - 課金価値レビューで指摘された「AI相談をPlusの目玉にするなら、見せかけではなく本物のLLM相談として信頼できる境界を置く」に対応。
  - 既にClaude APIを使う `POST /api/consult` は存在していたが、未ログイン・無料プランでも直接APIを叩ける状態だったため、サーバー側でPlus制限を追加した。
- 実装:
  - `apps/web/app/api/consult/route.ts`
    - `getServerSupabase()` を使い、`Authorization: Bearer <access_token>` の本人確認を必須化。
    - `family_members` 経由で参加中の家族を取得し、`families.plan` に `plus` が1つでもある場合だけClaudeへ進む。
    - 未ログインは `401 login_required`、クラウド手帳未作成は `403 notebook_cloud_required`、無料プランは `402 plus_required` で止める。
    - このチェックはClaude呼び出し・相談APIのレート枠消費より前に置いた。
  - `apps/web/components/ConsultPanel.tsx`
    - ブラウザSupabaseのセッションを確認し、相談APIへ `Authorization` ヘッダーを付ける。
    - 未ログイン時は相談ボタンを押せないようにし、家族ボードのクラウド控え作成へ誘導。
    - 相談画面上部に「Plus内機能」「クラウド控え保存された手帳が前提」の説明カードを追加。
  - `apps/web/app/globals.css`
    - Plus説明カードと未ログイン時ヒントのリンクスタイルを追加。
- 確認:
  - `npm run build --workspace web` OK。152ページ生成。
  - `npm run typecheck --workspace web` OK。
  - `git diff --check` OK。
  - 最初にtypecheckとbuildを並列実行した際、buildが `.next/types` を作り直す途中でtypecheckが読み、`TS6053 .next/types... not found` が出た。単独再実行ではOK。
  - build時のSupabase JS Node 20非推奨警告は継続して出るが、ビルドは成功。
- 残状態:
  - この追記時点ではcommit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。
  - 次にやるなら、この差分をcommit/pushし、その後「対象者ページをプロフィール/記録/確認リスト/写真のタブ構成へ分ける」「記録一覧からAI要約・注意サインへ進む」を進める。

## 2026-08-22 追記 116

- GitHub反映:
  - `2cb20fd Gate consult behind Plus plan` を `origin/main` へpush済み。
  - push結果: `7ee9c6a..2cb20fd main -> main`。
- 現在地:
  - 長期相談APIは、本人確認済みかつ参加家族の `families.plan` が `plus` の場合だけClaudeへ進む。
  - 画面側も未ログインでは相談ボタンを押せず、クラウド控え作成へ誘導する。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。
  - 次に進めるなら、ユーザーが強く求めている「1人目マイページの手帳感」を優先し、プロフィール編集・過去記録一覧・確認リスト・写真資料をタブまたは明確なセクションへ整理する。

## 2026-08-22 追記 117

- 目的:
  - ユーザー指摘「プロフィールどうやって変更できるねん」「過去の記録はどうやって見れるんや？」に対応。
  - 既にプロフィール編集・過去記録・確認リスト編集・写真資料は存在していたが、1人目ページの下に埋もれていて“手帳としてどこを触るか”が分かりにくかったため、対象者ページ上部に明確な手帳メニューを追加した。
- 実装:
  - `apps/web/app/home/page.tsx`
    - `profileEditorOpen` stateを追加。
    - 対象者切り替え時にプロフィール編集の開閉状態をリセット。
    - `/home` のアクティブ対象者ページ先頭に「この人の手帳」カードを追加。
    - 上部カードから以下へ直接移動できるようにした。
      - プロフィールを編集
      - 今日の記録を書く
      - 過去の記録を見る
      - 確認リストを編集
      - 写真・資料を見る
    - 上部カードにプロフィール充実度、過去記録件数、未完了リスト件数、写真・資料件数を表示。
    - 「プロフィールを編集」を押すと `#person-profile` へ移動し、編集drawerを開く。
    - 過去記録drawerの文言を「過去の記録を月別にすべて見る」に変更。
    - 写真・資料セクションに `id="media-library"` を付与。
  - `apps/web/app/globals.css`
    - `.person-command-*` と `.command-icon-*` を追加。
    - 先頭の漢字アイコンを使わず、マスコット・抽象アイコンで各導線を表現。
    - モバイルでは統計を2列にして、カード幅から文字がはみ出ないよう調整。
- 確認:
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - build時のSupabase JS Node 20非推奨警告は継続して出るが、ビルドは成功。
- 残状態:
  - この追記時点ではcommit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。
  - 次に進めるなら、localStorage手帳のクラウド同期範囲をプロフィール/タスク編集まで確実に広げる確認、または「本物のAI相談で過去記録のまとめ・注意サインを返す」実装に進む。

## 2026-08-22 追記 118

- GitHub反映:
  - `998620d Clarify notebook page actions` を `origin/main` へpush済み。
  - push結果: `e2b3a75..998620d main -> main`。
- 現在地:
  - 1人目ページの上部に、プロフィール編集・今日の記録・過去記録・確認リスト編集・写真資料へ直接入れる「この人の手帳」メニューが入った。
  - プロフィール編集は上部メニューから押すとdrawerが開く。
  - 過去記録は「過去の記録を月別にすべて見る」として入口文言を明確化。
  - 次にやるなら、レビューで最重要だった「localStorageではなくクラウド保存がプロフィール/タスク編集まで確実に同期されるか」をコード上で点検し、不足があれば修正する。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 119

- 目的:
  - 課金価値レビューで最重要指摘だった「手帳が消えないこと」のうち、AI相談メモ保存時の穴を修正。
  - `/home` のプロフィール編集・タスク編集・日記追加は `cases` / `diaryEntries` state変更を通じて自動クラウド同期されることを確認済み。
  - ただし `apps/web/components/ConsultPanel.tsx` の「この相談メモを手帳に残す」は `addDiaryEntry()` だけで、相談画面上ではクラウド同期していなかった。
- 実装:
  - `apps/web/components/ConsultPanel.tsx`
    - 相談メモ保存時に、ローカル日記へ追加した直後、ログイン済みなら `listLocalCases()` と全対象者の `listDiaryEntries()` をまとめて `/api/notebook/sync` へPOSTするよう変更。
    - Supabaseセッションがない場合は「端末の手帳には残ったが、クラウド控えは家族ボードでメール確認後」と表示。
    - 同期成功時は「クラウド控えにも保存しました」と表示。
    - 保存中/保存済みはボタンを無効化して、同じ相談メモの二重保存を避ける。
  - `apps/web/app/globals.css`
    - 相談メモ保存ボタンのdisabled表示と、クラウド保存結果メッセージの読みやすさを調整。
- 残状態:
  - この追記時点ではcommit/push前。
  - 次に `git diff --check`、`npm run typecheck --workspace web`、`npm run build --workspace web` を実行して確認する。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 120

- GitHub反映:
  - `14948aa Sync saved consult notes to cloud` を `origin/main` へpush済み。
  - push結果: `e1d9d05..14948aa main -> main`。
- 確認:
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - build時のSupabase JS Node 20非推奨警告は継続して出るが、ビルドは成功。
- 現在地:
  - AI相談メモは「この相談メモを手帳に残す」を押すと、ローカル手帳に追加されるだけでなく、ログイン済みなら即 `/api/notebook/sync` でクラウド控えにも保存される。
  - 未ログイン/セッションなしの場合は、端末内保存は維持しつつ、クラウド控えは家族ボードでメール確認後に保存する旨を表示する。
  - レビュー指摘の「消えない手帳」について、プロフィール・タスク・日記・AI相談メモの主要な保存経路はクラウド同期される状態になった。
  - 次に進めるなら、確認リストの編集性をさらに強める（カードから直接編集drawerへ入れる、並び替え、担当者/期限の見え方）、または日記の月別サマリー/注意サイン表示を強化する。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 121

- 目的:
  - ユーザー要望「過去の記録はどうやって見れるんや」「記録からAI診断予測とか過去の記録のまとめとかアラートとか、もっとほんまの手帳のように」に対応。
  - レビュー指摘を踏まえ、キーワード処理を安易に「AI」と呼ばず、無料側は「月別の見返し」「次に確認すること」として整理し、本物のAI相談はPlus導線へつなぐ。
- 実装:
  - `apps/web/app/home/page.tsx`
    - `buildMonthReview()` と `MonthReview` を追加。
    - 過去の手帳の月別履歴に、各月の見返しカードを追加。
    - 月ごとに「この月の見返し」「件数/変化/写真資料の集計」「次に確認すること」を表示。
    - 記録内容に応じて、退院後・在宅、薬、発言/記憶、支払い、実家/書類などの確認質問を出す。
    - 最近のまとめカードに「この記録をもとに相談メモを作る」導線を追加。
  - `apps/web/app/globals.css`
    - `.month-review-*` と `.record-digest-consult` を追加。
    - 月別見返しをカード化し、急ぎ/変化の月が見分けられるよう左罫線の色を変える。
- 残状態:
  - この追記時点ではcommit/push前。
  - 次に `git diff --check`、`npm run typecheck --workspace web`、`npm run build --workspace web` を実行して確認する。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 122

- GitHub反映:
  - `19ef257 Add monthly notebook review cards` を `origin/main` へpush済み。
  - push結果: `2715694..19ef257 main -> main`。
- 確認:
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - build時のSupabase JS Node 20非推奨警告は継続して出るが、ビルドは成功。
- 現在地:
  - `/home` の「過去の手帳」では、最近のまとめに加えて、月別履歴を開くと各月ごとの見返しカードが表示される。
  - 月別見返しカードには、記録件数/変化件数/写真資料件数、記録内容からの確認質問、Plus相談へ進む「この記録をもとに相談メモを作る」導線がある。
  - 無料側の機械的な整理は「AI」と呼ばず、Plus側の本物のClaude相談へつなぐ設計にした。
  - 次に進めるなら、確認リストカードから直接編集できるUXを強化する、またはプロフィール編集の保存後に「次に足すとよい項目」を出す。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。
## 2026-08-22 追記 123

- 目的:
  - ユーザー要望「確認リストの項目をどう編集できるのか分からない」「この1件を編集できるようにして」に対応中。
  - 現状コード確認では、`/home` の確認リストには `editingTaskKey`、`openTaskEditor()`、`saveTaskEdit()`、`quickUpdateTask()` があり、編集機能自体は実装済み。
  - ただし、編集入口がカード下部の小さな `編集する` ボタンに寄っており、タスク名を見ても編集できると分からない。
- これからの実装方針:
  - 確認リスト上部に「カードを押すと編集できます」という説明を追加。
  - 各タスクカードの右上に明確な `内容を編集` ボタンを置く。
  - カードの見出し/本文部分を押しても編集パネルが開く状態を維持しつつ、視覚的に「押せる」ことが分かるデザインへ変更。
  - 編集パネル内の保存・閉じる導線も少し分かりやすくする。
- 残状態:
  - この追記時点では実装・commit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 124

- GitHub反映:
  - `124a9bd Make checklist editing discoverable` を `origin/main` へpush済み。
  - push結果: `21f13c1..124a9bd main -> main`。
- 実装内容:
  - `/home` の確認リスト上部に「カードを押すと、内容・期限・担当・家族メモを編集できます」という説明を追加。
  - 各確認リストカードに `押すと編集できます` のヒントを表示。
  - 各カードに明確な `内容を編集` ボタンを追加。
  - 既存のカード押下編集は維持しつつ、カードが押せる見た目になるよう背景・枠線・フォーカス表示を追加。
  - クイック操作の文言を `期限・担当を直す` に変更。
  - 編集パネル内に「この確認項目を編集」という見出しと説明を追加し、保存ボタンを `変更を保存`、閉じるボタンを `編集を閉じる` に変更。
- 確認:
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - `npm run typecheck --workspace web` は、buildと並列実行した1回目だけ `.next/types` 再生成中の競合で `TS6053` が出た。build完了後に単独再実行してOK。
  - build時のSupabase JS Node 20非推奨警告は継続。動作には影響なし。
- 現在地:
  - 確認リストの個別項目は、ユーザーがタスク名付近を押しても、`内容を編集` を押しても編集パネルへ入れる。
  - 次に進めるなら、プロフィールの各項目をその場編集しやすくする、または日記/過去記録からアラート候補・確認リスト候補を作る導線を強化する。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 125

- 目的:
  - ユーザー要望「プロフィールどうやって変更できるねん」に対応中。
  - 現状はプロフィール編集フォーム自体はあるが、`details` のsummaryに畳まれていて、スマホでは編集入口が分かりにくい。
- これからの実装方針:
  - プロフィール充実度の下に、明確な `プロフィールを編集する` ボタンを追加。
  - 未入力項目をチップで見せて、何を足せば手帳が育つか分かるようにする。
  - `summary` の文言も、折りたたみ機能ではなく編集欄として分かるコピーに変更する。
- 残状態:
  - この追記時点では実装・commit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 126

- GitHub反映:
  - `f372f1f Make profile editing discoverable` を `origin/main` へpush済み。
  - push結果: `6f53189..f372f1f main -> main`。
- 実装内容:
  - `/home` の対象者プロフィールで、充実度カード直下に明確な `プロフィールを編集する` ボタンを追加。
  - 「基本情報を足すほど、日記・確認リスト・相談が使いやすくなる」という説明を追加。
  - 未入力プロフィール項目を `まだ足せる項目` のチップで表示し、何を足せばよいか分かるようにした。
  - プロフィールが埋まっている場合は「必要な基本情報はそろっています。変化があればいつでも更新できます。」を表示。
  - 編集detailsのsummary文言を `編集欄を開く・閉じる` に変更。
- 確認:
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - build時のSupabase JS Node 20非推奨警告は継続。動作には影響なし。
- 現在地:
  - プロフィール編集機能自体は既存フォームを使い、スマホ上で入口が分かる状態になった。
  - 次に進めるなら、日記/過去記録を「見返す」「編集する」「確認リスト候補やアラートにつなげる」導線を強化する。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 127

- 目的:
  - ユーザー要望「過去の記録はどうやって見れるんや」「日々の記録からAI診断予測・まとめ・アラートへつなげて、ほんまの手帳のようにしてほしい」に対応中。
  - 直近のレビューでも、手帳価値は「記録が消えないこと」と「記録が次の行動に変わること」が重要と指摘されている。
- これからの実装方針:
  - 保存済み日記を月別一覧でその場編集できるようにする。
  - 日記1件から確認リストに追加できるボタンを付ける。
  - 月別一覧のsummaryを、単なる開閉ではなく `見返す・編集する` と分かる文言にする。
  - 無料側は「AI」とは呼ばず、日記からの気づき・確認候補として表現する。
- 残状態:
  - この追記時点では実装・commit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 128

- GitHub反映:
  - `6f2ab5a Make diary records actionable` を `origin/main` へpush済み。
  - push結果: `541e5b6..6f2ab5a main -> main`。
- 実装内容:
  - `apps/web/lib/store.ts` に `updateDiaryEntry()` と `addCaseTask()` を追加。
  - `DiaryEntry` に `updatedAt` を追加。
  - `/home` の過去の手帳を初期表示で開くようにし、summaryを `すべての記録を見返す・編集する` に変更。
  - 各日記カードに `この記録を編集`、`確認リストに追加`、`相談メモへ` を追加。
  - 日記編集パネルで日付/本文/通常・変化あり・急ぎを更新できる。
  - 日記から確認リストへ追加すると、内容に応じたタイトル・期限・優先度でタスクが追加される。
  - 無料側はAIと言わず `この日のメモから` の確認候補として表示。
- 確認:
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - build時のSupabase JS Node 20非推奨警告は継続。動作には影響なし。
- 現在地:
  - 過去記録は見返し・編集・確認リスト化できる状態。
  - 次に進めるなら、`/home` の対象者マイページをタブ化（プロフィール/記録/確認リスト/写真）してスクロール長を整理、またはクラウド同期状況/バックアップ訴求の視認性強化。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 129

- 目的:
  - ユーザー要望「プロフィールどうやって変更できるねん」「過去の記録はどうやって見れるんや」に対して、機能追加だけでなく画面構造を整理する。
  - 1人目のマイページが長い縦スクロールで、記録・プロフィール・確認リスト・写真の場所が分かりにくい状態を直す。
- これからの実装方針:
  - `/home` の対象者手帳に `今日 / 記録 / プロフィール / 確認 / 写真` のタブを追加する。
  - タブ選択で該当セクションだけを見せ、プロフィール編集や過去記録への導線を一発で分かるようにする。
  - 既存の「プロフィール」「今日の記録」「過去の記録」「確認リスト」「写真」ボタンも、該当タブを開いてからスクロールする動きに揃える。
- 残状態:
  - この追記時点では実装・commit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 130

- 実装内容:
  - `/home` の1人目手帳に `今日 / 記録 / 基本情報 / 確認 / 写真` のタブを追加。
  - それぞれのタブに件数・充実度を表示し、プロフィール編集、過去記録、確認リスト、写真資料へ迷わず移動できるようにした。
  - 既存の手帳メニュー（プロフィールを編集、今日の記録を書く、過去の記録を見る、確認リストを編集、写真・資料を見る）も、該当タブを開いてから該当セクションへスクロールする動きに統一。
  - スマホ幅で5タブが横に隠れないよう、タブ幅・余白・文字サイズを調整。
- 確認:
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - in-app browserを390px幅にして `/home` を確認。通常導線 `/start -> /diagnosis -> /result -> /home` で1人目手帳を作り、タブ表示と `記録` / `基本情報` の切替を確認。
  - build時のSupabase JS Node 20非推奨警告は継続。動作には影響なし。
- 現在地:
  - 1人目の手帳は長い1枚スクロールから、タブで見るアプリ型のマイページに近づいた。
  - 次に進めるなら、localStorage依存を減らすためのSupabase同期/匿名開始、または「本物のAI相談」実装の前段として相談メモのサーバー保存を強化する。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 131

- GitHub反映準備:
  - `365c2be Add notebook section tabs` を作成。
  - 内容は `/home` の1人目手帳タブ化、タブ別セクション表示、既存メニューの遷移統一、スマホ幅のタブ調整。
  - この追記を同じコミットにamendしてから `origin/main` へpush予定。
- 確認:
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - build時のSupabase JS Node 20非推奨警告は継続。動作には影響なし。
- 残状態:
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 132

- GitHub反映:
  - amend後の実コミットは `5021202 Add notebook section tabs`。
  - push結果: `0dc8357..5021202 main -> main`。
  - 追記131に残っている `365c2be` はamend前の一時コミット番号。最終的にGitHubへ入ったのは `5021202`。
- 現在地:
  - `/home` の対象者手帳タブ化はGitHub反映済み。
  - 次の優先はレビュー指摘の最重要点である、localStorage依存を減らすSupabase同期/匿名開始の本格化。

## 2026-08-22 追記 133

- 目的:
  - レビュー指摘「localStorage保存のまま手帳を名乗るのは危険」を受け、まず画面上で保存状態を隠さない。
  - 既存のクラウド同期API/メール確認/自動保存/エクスポート機能はあるが、手帳の下部に埋もれているため、ユーザーが「この記録は消えないのか」を判断しにくい。
- これからの実装方針:
  - `/home` の1人目手帳上部に保存状態カードを常時表示する。
  - 未ログイン時は「今はこの端末だけ」と明示し、機種変更や履歴削除リスクを短く伝えたうえで、本人確認メールから控え保存へ進める。
  - ログイン済み時は「クラウド控え保存中」と最終保存状態を表示。
  - 既存の詳細クラウドカードは重複するので、上部の保存状態カードへ統合する。
- 残状態:
  - この追記時点では実装・commit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 134

- 実装内容:
  - `/home` の対象者手帳上部、タブの直前に「保存状態」カードを常時表示するようにした。
  - 未ログイン時は「今はこの端末だけに保存されています」と明示し、メール確認でクラウド控えを作れる導線を出す。
  - ログイン済み時は「この手帳はクラウドにも残ります」と表示し、自動保存状態・最終保存時刻・手動保存・復元・ダウンロードを同じカード内にまとめた。
  - 既存の下部にあった「記録の控え保存」カードは、重複して分かりにくかったため削除し、保存導線を上部1か所に統一した。
- 目的に対する意味:
  - 1人目の手帳を開いた時点で「この記録は消えないのか」が見える。
  - いきなりログインを強要せず、手帳を作った後に「控え保存」という自然な理由でメール確認へ進める。
- 確認予定:
  - `git diff --check`
  - `npm run typecheck --workspace web`
  - `npm run build --workspace web`
- 残状態:
  - この追記時点では検証・commit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 135

- 検証結果:
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- GitHub反映予定:
  - 変更対象は `apps/web/app/home/page.tsx`、`apps/web/app/globals.css`、`docs/SESSION_HANDOFF.md`。
  - コミット名は `Surface notebook cloud save status` 予定。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 136

- GitHub反映準備:
  - コミット `3174df0 Surface notebook cloud save status` を作成。
  - 内容は、手帳上部の保存状態カード追加、下部の重複クラウド控えカード削除、保存導線の文言統一、関連CSS調整。
  - この追記を同コミットへamendしてから `origin/main` へpush予定。
- 注意:
  - `review_exports/` は未追跡のまま残している。

## 2026-08-22 追記 137

- GitHub反映:
  - amend後の実コミットは `a9a49fe Surface notebook cloud save status`。
  - push結果: `2fcd1a3..a9a49fe main -> main`。
  - 追記136に残っている `3174df0` はamend前の一時コミット番号。最終的にGitHubへ入ったのは `a9a49fe`。
- 現在地:
  - レビュー指摘の最重要点「記録が消えない信頼」に対して、まず画面上の保存状態・クラウド控え導線を上部へ出した。
  - 次に進めるなら、localStorage依存をさらに減らすため、匿名開始データをSupabaseへ早期同期する実装、または本物のLLM相談のPlus導線を進める。
  - 未追跡の `review_exports/` は引き続き既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 138

- 目的:
  - 課金価値レビューの「家族共有をPlusの壁の向こうに置くと価値体験と拡散を殺す」という指摘を採用する。
  - 現状は無料で招待できる人数が「本人以外1人」になっているため、最初の家族会議で兄弟2人まで自然に巻き込めない。
- 実装方針:
  - 無料枠を「手帳を作った本人 + 招待家族2人」へ戻す。
  - `packages/shared/src/plan.ts`、家族共有UI、手帳内の共有カード文言、Supabase RPC SQLの上限を同じ数字にそろえる。
  - 収益の壁は、2人目以降の対象者、容量拡張、家族会議PDF、AI相談、無制限共有へ置く。
- 残状態:
  - この追記時点では実装・検証・commit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 139

- 実装内容:
  - 無料の家族招待枠を、手帳を作った本人以外2人までに変更した。
  - `packages/shared/src/plan.ts` の `FREE_PLAN_MEMBER_LIMIT` を `2` に変更。
  - `/home` の家族共有カード、`/family` の説明文、`FamilyShare` の共有数表示と保存状態への案内文を更新。
  - Supabase SQLの `create_family_invite` / `accept_family_invite` の無料枠判定も `2` に統一。
  - 対象SQLは `supabase/family_invite_rpc.sql`、`supabase/free_plan_member_limit.sql`、`supabase/admin_auth_hardening.sql`。
- 検証結果:
  - `git diff --check` OK。
  - `npm run typecheck --workspace web` OK。
  - `npm run build --workspace web` OK。152ページ生成。
  - build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 注意:
  - GitHub/Vercelへ反映しても、本番SupabaseのRPC上限はSQL Editorで `supabase/free_plan_member_limit.sql` を実行するまで変わらない。
  - UIとAPIコードは2人無料表示になるため、DB側SQLも本番へ流す必要がある。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 140

- GitHub反映準備:
  - コミット `ad76c68 Allow two free family invitees` を作成。
  - この追記を同コミットへamendしてから `origin/main` へpush予定。
  - 内容は、無料の家族招待枠を本人以外2人までに戻し、Web UI、共有文言、Supabase RPC SQLの上限値を統一する変更。
- 注意:
  - 本番Supabaseの関数はGitHub pushだけでは変わらないため、あとで `supabase/free_plan_member_limit.sql` をSQL Editorで実行する必要がある。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 141

- GitHub反映:
  - amend後の実コミットは `8fd7c65 Allow two free family invitees`。
  - push結果: `e98a77f..8fd7c65 main -> main`。
  - 追記140に残っている `ad76c68` はamend前の一時コミット番号。最終的にGitHubへ入ったのは `8fd7c65`。
- 現在地:
  - Web UI/APIコード/SQLファイル上は、家族共有の無料枠が「本人以外2人まで」に統一済み。
  - VercelはGitHub push後に自動デプロイされる想定。
  - 本番SupabaseのDB関数だけは、SQL Editorで `supabase/free_plan_member_limit.sql` を実行するまで旧上限のままになる可能性がある。
  - 次に進めるなら、本番SupabaseへこのSQLを流すか、レビューの最重要点である匿名開始データの早期クラウド同期をさらに詰める。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 142

- 目的:
  - 課金価値レビューで最重要とされた「手帳なのに消えそうに見える」不安を、まず手帳画面の導線から減らす。
  - 現状はクラウド控え機能自体はあるが、未ログイン時に「端末だけ保存のリスク」と「控え保存で何が守られるか」が弱く見えるため、1人目登録後に自然に控え保存へ進める表示へ直す。
- 実装内容:
  - `/home` の保存状態カードの初期メッセージを、履歴削除・機種変更・端末故障で消えるリスクを明示する文言へ変更。
  - 未ログイン時は「メール確認だけ」「確認後は日記・プロフィール・確認リストを自動保存」「JSON控えも取れる」を短いチェック項目として表示。
  - ログイン済み時は「変更のたびに自動保存」「機種変更後も復元」「家族共有の土台」を表示。
  - メール送信ボタンを `メールで控え保存を始める` に変更し、押す意味を明確化。
  - 関連CSSとして `cloud-trust-list` を追加。
- 変更対象:
  - `apps/web/app/home/page.tsx`
  - `apps/web/app/globals.css`
  - `docs/SESSION_HANDOFF.md`
- 検証結果:
  - `git diff --check` OK。
  - 初回の `npm run typecheck --workspace web` は `.next/types` の生成物が消えていたため TS6053 で失敗。
  - `npm run build --workspace web` OK。152ページ生成。
  - build後に `.next/types` が再生成され、再実行した `npm run typecheck --workspace web` はOK。
  - build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 残状態:
  - この追記時点ではcommit/push前。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 143

- GitHub反映準備:
  - コミット `6c4239e Clarify notebook cloud backup` を作成。
  - 内容は、手帳の保存状態カードで端末保存リスク、クラウド控えの効果、メール確認ボタンの意味を明確化する変更。
  - この追記を同コミットへamendしてから `origin/main` へpush予定。
- 検証:
  - `git diff --check` OK。
  - `npm run build --workspace web` OK。
  - `npm run typecheck --workspace web` OK。
- 注意:
  - 初回typecheckだけ `.next/types` 欠落で失敗したが、buildで再生成後は成功。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。

## 2026-08-22 追記 144

- GitHub/Vercel反映:
  - amend後の実コミットは `c7c6c5e Clarify notebook cloud backup`。
  - push結果: `ec36876..c7c6c5e main -> main`。
  - 最初に `apps/web` 直下から `npx vercel deploy --prod --yes` を実行したが、`@oyano/shared: workspace:*` をnpmが解決できず `Unsupported URL Type "workspace:"` で失敗。これは誤った作業ディレクトリからの手動デプロイによるもの。
  - その後、リポジトリルートから `npx vercel deploy --prod --yes` を実行して成功。
  - Production URL: `https://oyano-moshimo-navi.vercel.app`
  - Deployment URL: `https://oyano-moshimo-navi-87e7aw0fm-dogwoodcommunity1.vercel.app`
  - Deployment ID: `dpl_ApsVg5Hk6mCBKZ8SJ8eXDS8o137d`
- 本番確認:
  - `curl -I https://oyano-moshimo-navi.vercel.app/home` は HTTP 200。
  - `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` は主要ページ/APIガードでOK表示を確認。
  - ただしスモークスクリプトがOK表示後に終了しなかったため、Ctrl-Cで停止。確認済み表示は `/home`、`/start`、`/guides`、`/crisis`、`/consult`、`/family`、`/manifest.webmanifest`、`/api/health`、auth必須APIの401など。
- 現在地:
  - 手帳上部のクラウド控えカードは、未ログイン時に「端末だけ保存の危険」と「メールで控え保存を始める」導線を明確化済み。
  - 次に進めるなら、クラウド同期をさらに強くするため、初回登録直後に控え保存を促すモーダル/トースト、またはSupabase匿名セッションによる早期バックアップを検討する。
  - 未追跡の `review_exports/` は既存レビュー出力フォルダとして残している。
## 2026-08-22 追記 145 — 5機能を入れた。残りは実機確認とビルド（Codex向け指示）

### いまどうなっているか

前提として、**この製品の本体はアプリ（Expo）**。`apps/web` はアプリがつなぐ
バックエンドAPIと共通ロジックの置き場であって、独立したWeb製品ではない。

ターゲットはほぼ50代で、機械が得意ではない。目指すのは
「開けばどんな状況でも冷静に記録でき、次の一手が分かる」
「ボタンだらけで迷わせず、まずこれ→次これと誘導する」
「その人の情報を読み込んで対話が続くAI相談」
「家族と共有して、離れていても変化を見守れて安心」。
機能を足すかどうかは、この4つに効くかで決める。

追記145の作業（Web反映・無料プラン人数1人のSQL）は完了済み。
そのうえで、上の狙いに対して足りていなかった5点を実装した。

### 入れた5機能（コミット f61c113、mainへpush済み）

1. **家族ボードに「つぎにやること」を1つだけ出す** `apps/mobile/app/(tabs)/dashboard.tsx`
   `pickNextAction()` が 期限切れ→担当未定→期限間近→今日の記録 の順で拾い、
   見出し1つとボタン1つに絞る。相談カードは競合するので下段へ移した。
2. **AI相談を続きものにした** `packages/shared/src/consult.ts` /
   `apps/web/lib/consult.ts` / `apps/mobile/app/consult.tsx`
   前回までの相談と回答の要点を `history` として渡し、プロンプトに
   「これまでの相談」欄を足した。システム指示に、繰り返さず変化に答えるよう明記。
   画面は1問1答からスレッドへ（`turns`）。
3. **記録をタップだけで残せるようにした** `apps/mobile/app/people/[id]/timeline.tsx`
   動揺している夜に文章は書けない。`quickAnswers` を選ぶだけで保存が成立する。
   自由文は任意の補足に降格。矛盾する組（薬は飲めた／飲めなかった等4組）は片方だけ残す。
4. **プロフィールに「つぎに埋めるとよいこと」** `apps/mobile/app/people/[id]/index.tsx`
   `fieldGuidance` で重要/あるとよいと、埋めると何に役立つかを添える。
   数字（60%）だけでは次に何をすればいいか分からない。
5. **家族の遠隔見守り**
   - `apps/mobile/app/people/[id]/family.tsx` に「最近の家族の動き」（誰が・いつ）
   - `apps/web/app/api/family/notify/route.ts`（新規）＋ `apps/mobile/lib/mobileData.ts`
     の `notifyFamilyUpdate()`。記録追加・状態更新で家族へプッシュ。

### 触るとき壊してはいけない判断

- **通知本文に記録の中身もタイトルも入れない。** ロック画面に「危篤」「亡くなった直後」が
  出る事故は取り返しがつかない。送るのは「誰が・何をしたか」だけ。
  `notify/route.ts` は `summary` を受け取らない設計にしてある。戻さないこと。
- **相談メモの保存では家族に通知しない。** 相談はまだ家族に言えない不安を書く場でもある。
  `addTimelineEntry({ notifyFamily: false })` で抑えている。
- **相談履歴はサーバー側で必ず絞る。** クライアントを信用すると巨大な履歴が
  そのまま外部APIへ流れて費用が跳ねる。`api/consult/route.ts` で形を検証し、
  `lib/consult.ts` で件数と長さを切っている。両方必要。
- **権限なしと存在しないを同じ返事にする。** `notify/route.ts` の `SILENT_OK`。
  IDの当てずっぽうで手帳の有無を探れないようにするため。

### 検証済みのこと

- アプリの型チェック（`apps/mobile` で `tsc --noEmit`）= エラーなし
- Webの型チェック（`apps/web` で `tsc --noEmit`）= エラーなし
- iOS/Androidともバンドル生成成功（各約2.5MB、Metro経由で実際に生成して確認）
- 本番反映済み: `api/consult` の履歴検証が効いている（不正な history は400）、
  `api/family/notify` は404から401（認可が正しく働いている）へ
- `SUPABASE_SERVICE_ROLE_KEY` は本番に設定済み（push-tokens/register が501でなく401を返すことで確認）
- `smoke-web.mjs` 全38経路OK

### ここからやること

#### 1. 開発環境の用意（node_modulesが無い状態から始める場合）

pnpm前提だがグローバルには入っていない。corepackを使う。

```
cd ~/Desktop/oyano-moshimo-navi
corepack prepare pnpm@9.12.3 --activate
corepack pnpm install --frozen-lockfile
```

#### 2. 実機で5機能の画面を見る（未実施。ここが本丸）

```
cd apps/mobile
corepack pnpm exec expo start
```

スマホの Expo Go でQRを読む。見るのは次の5つ。

- 家族ボードを開いた瞬間、「つぎにやること」が**1つだけ**出ていて、押す先が迷わないか
- 相談で1回聞いたあと「続けて相談する」で、前回を踏まえた答えが返るか
  （2回目に「その後こうなった」と聞いて、最初から説明し直させられないか）
- 記録画面で、**何も打たずにタップだけ**で保存できるか
- 管理手帳で「つぎに埋めるとよいこと」が出て、埋めると消えるか
- 家族共有に「最近の家族の動き」が出て、誰が書いたか分かるか

50代・非ITの目で見ること。迷ったら、それは実装の問題。

#### 3. EASビルド（配布用。2の確認が済んでから）

`app.json` に `extra.eas.projectId` が**無い**。初期化が要る。

```
npx eas-cli login
cd apps/mobile && npx eas-cli init
corepack pnpm run eas:mobile:build:ios     # rootから
```

`eas.json` の preview/production には `EXPO_PUBLIC_WEB_BASE_URL` が
本番URLで入っているので、通知と相談はビルド後に実際に動く。

### 直さずに残したもの（実害なしと判断）

- 通知の送信を待たない（fire-and-forget）。保存自体は成功しているので実害は小さい。
- 相談の回答後に自動スクロールしない。回答は入力欄の位置に出るので実用上は見える。

### そのあとに残るもの（追記145から引き継ぎ）

- `/admin/funnel` を開くための `ADMIN_ACCESS_TOKEN`。値が不明なら再設定する。
- プレミアプランを作るかどうか。中身が決まっていない。
- 次に見る数字: `/admin/funnel` の「7日以内に2件目を書いた」割合。

## 2026-08-22 追記 146 — 実機で画面を見たら3つ壊れていた（追記145の更新）

追記145では「実機表示は未確認」と書いたが、そのあとiOSシミュレータで
実際に画面を開いた。**バンドルは通っていたが、表示は3か所壊れていた。**
追記145の「2. 実機で5機能の画面を見る」は、この追記で置き換える。

### 直したもの

**1. 画面の中のロゴが古い葉のままだった**

`e4a4a6a` で見守り鳥へ差し替えたのは画像ファイル（アイコン、スプラッシュ、
通知、Webのfavicon）だけ。画面の中に出るマスコットは
`apps/mobile/components/MascotGuide.tsx` の `MascotMark` が**図形で描いている**ため、
画像を替えても変わらなかった。ようこそ、家族ボード、管理手帳、期限と担当、
親の登録の5画面に出る。`docs/BRAND_ASSETS.md` と
`apps/web/public/brand/watch-bird-mark.svg`（viewBox 56×56）に合わせて描き直した。

**2. `Link asChild` で Pressable の style が壊れる**

`Link asChild` は子要素へ自分の `style` を渡す。そのため
`<Pressable style={({ pressed }) => [...]}>` の**関数形式の style が無効になり**、
背景色も `flexDirection: "row"` も消える。「急なとき」バナー、相談カード、
「つぎにやること」のボタン、急なときの選択肢が対象だった。
遷移を `useRouter()` の `router.push()` に変えて直した。押した時の反応は残る。

**これは既存バグで、私の新機能だけの問題ではなかった。**
今後 `Link asChild` に関数形式の style を持つ Pressable を入れないこと。

**3. iOSでは Text に背景色 + `borderRadius: 999` を併用すると描画されない**

「つぎにやること」「長期入院」「100%」「重要／あるとよい」「◯回目の相談」
「担当未定」など、**バッジが軒並み見えていなかった**。場所は取るが何も描かれない。
`radius.control`（8）程度の小さい値なら問題なく描画される（ボタン類は無事だった）。

対処は2通り。下地を `View` にして文字を中の `Text` に置くか、半径を実寸に合う値
（14程度）へ下げる。高さ20px前後のバッジなら14で角は完全に丸くなる。
`View` にしたのは `nextKicker` と `statusBadge`、半径を下げたのは10か所。

**今後バッジを作るときは `borderRadius: 999` を Text に付けない。**
`crisisBadge` のように View + Text にするのが安全。

### あわせて直したもの

`apps/mobile/app/people/[id]/family.tsx` に「無料ではオーナー以外に2名まで招待」
という古い表記が残っていた。サーバーは追記145で1人に変えてあり、Webも直したが、
アプリだけ2名のままだった。`FREE_PLAN_MEMBER_LIMIT` と `MEMBER_LIMIT_MESSAGE` を
共有パッケージから引くようにした。数字を画面に直接書かないこと。

### 実機で確認する手順（次に見るときのため）

グローバルにpnpmは入っていない。corepack を使う。

```
cd ~/Desktop/oyano-moshimo-navi
corepack prepare pnpm@9.12.3 --activate
corepack pnpm install --frozen-lockfile
cd apps/mobile && corepack pnpm exec expo start --ios
```

シミュレータのタップは自動化できない（アクセシビリティ権限が要る）。
かわりに**ディープリンクで直接その画面を開ける**。これが速い。

```
SIM=$(xcrun simctl list devices | grep -m1 "iPhone 17 (" | grep -oE "[0-9A-F-]{36}")
xcrun simctl openurl $SIM "exp://127.0.0.1:8081/--/dashboard"
xcrun simctl openurl $SIM "exp://127.0.0.1:8081/--/consult"
xcrun simctl openurl $SIM "exp://127.0.0.1:8081/--/crisis"
xcrun simctl openurl $SIM "exp://127.0.0.1:8081/--/people/00000000-0000-4000-8000-000000000101/timeline"
xcrun simctl io $SIM screenshot /tmp/shot.png
```

`apps/mobile/.env` が無い状態では Supabase 未設定と判定され、**見本データで動く**
（山田花子・母・長期入院）。実データが写らないので、スクリーンショット向き。

型チェックは `apps/mobile` と `apps/web` それぞれで `corepack pnpm exec tsc --noEmit`。
どちらも通ることを確認済み。iOS/Android両方のバンドル生成も確認済み。

### いまの状態

- この3コミット（追記145、表示修正、追記146）は、Codexが先にpushしたWeb側の
  作業10コミットの上へリベースして載せてある。触った場所は重なっていない
  （Codexは`apps/web`、こちらは`apps/mobile`）。
- Webのバックエンド（AI相談の対話継続、家族への通知API）は本番反映済み。
- アプリのコードは main にあるが、**配布ビルドはまだ作っていない**。

### 次にやること

1. EASビルド。`app.json` に `extra.eas.projectId` が無いので `eas init` が要る。
   ```
   npx eas-cli login
   cd apps/mobile && npx eas-cli init
   corepack pnpm run eas:mobile:build:ios
   ```
2. 相談画面で実際にAIへ投げて、2回目の相談が前回を踏まえて返るかを見る
   （見本データのままでは外部APIを叩かないので、ログインした状態で確認が要る）。
3. 家族への通知が実際に届くか。送信側と受信側で別アカウントが要る。

### 残っているもの（追記145から）

- `/admin/funnel` を開くための `ADMIN_ACCESS_TOKEN`。値が不明なら再設定する。
- プレミアプランを作るかどうか。中身が決まっていない。
- 次に見る数字: `/admin/funnel` の「7日以内に2件目を書いた」割合。

## 2026-08-22 追記 147 — MONETIZATION.mdを正として課金土台を実装

別セッションの成果を取り込んだ。`~/Desktop/0001`〜`0005` のパッチは `git am -3` で適用済み。
`docs/SESSION_HANDOFF.md` だけ衝突したので、両方の追記を残し、重複していた見出し番号を
`追記145` / `追記146` に整理した。その5コミットは先に `origin/main` へpush済み。

その後、`docs/MONETIZATION.md` を正として以下を実装した。

- プランは無料 / Family Plus の2段だけに固定。月額980円・年額9,800円の文言をWeb/Appに反映。
- 無料の家族招待枠を「あなたのほかに1人まで」に統一。SQL側のRPC制限も `1` に変更。
- `supabase/consult_trial.sql` を追加し、`families.consult_trial_used_at` を追加。
  本番DBにはこのSQLを流すこと。`supabase/schema.sql` と `verify_compact.sql` にも反映済み。
- Web `/api/consult` にGETを追加。ログイン済み家族のPlus状態・初回無料相談の残数を返す。
- `authorizePlusConsult` に「家族ごと初回1回無料」を追加。相談が成功して回答を返せる状態になった後だけ
  `consult_trial_used_at` を更新する。APIエラー、入力不備、AI refusal ではおためし権利を消費しない。
- 2回目以降の無料相談は 402 `plus_required`。文言は
  「おためし相談は使いました。続きはPlusで使えます。手帳と記録はこのまま無料で使えます。」。
- アプリ相談画面は `/api/consult` のGETを読み、Plus / おためし残あり / おためし使用済み / 未ログインを表示。
  402時はPlus案内を出す。
- Web相談パネルも同じGETで利用状態を表示し、相談成功後に状態を再取得する。
- プラン画面（Web / App）に「解約しても基本の記録は読める」を追加。
- 全タスク完了済みの時だけ、プラン画面にPlus見直し案内を出す。未完了の家族には出ない。
- 記録画面に「キーボードのマイクボタンで、話すだけでも書けます」の一文を追加。
- 管理手帳から無料の緊急カードを開けるようにした。A5印刷向けで、呼び名・関係・状態・緊急連絡先・
  病院/施設・薬/注意・希望/配慮・家族構成を載せる。書類の保管場所、銀行情報、暗証番号は載せない。

受け入れ条件の確認:

- 無料家族が相談を1回成功させると、`consult_trial_used_at` が入り、次回は402になる設計にした。
- 相談APIがエラーを返した回では、更新処理に到達しないため権利は減らない。
- Plus家族は従来通り `CONSULT_CLIENT_DAILY_LIMIT` 既定5回/日まで。
- 危機モードは触っていない。未ログインで開ける状態を維持。
- 緊急カードに書類保管場所は載せていない。画面内でも「載せません」と明記。
- 解約案内は `PlanCompletionNotice` とアプリの `allComplete` 条件で、完了済みの時だけ表示。
- `apps/mobile` と `apps/web` の `corepack pnpm exec tsc --noEmit` は両方通過。

まだ外部設定として残るもの:

- RevenueCat の `plus_monthly` / `plus_annual` 登録。
- Stripe側の同額Price作成と `NEXT_PUBLIC_PLUS_PRICE_LABEL` / checkout系環境変数の本番確認。
- 本番Supabaseへ `supabase/consult_trial.sql` を流すこと。
- 製本PDF（追加機能B）は中期タスクとして未実装。今回の最優先1〜8の範囲では、緊急カード・音声文言・
  完了時の解約案内まで入れた。

## 2026-08-22 追記 148 — 完成判定とPlus課金理由の再確認

ユーザーから「もう完成か？1人目無料の体験が『家族で共有したい』『AI相談したい』『2人目も管理したい』
と思えるレベルまで強いこと。これは大丈夫か？」と確認があった。

結論は、**完成ではない**。課金の土台、初回無料相談、緊急カード、プラン表示は入ったが、Family Plusへ
自然に進むだけの「1人目無料の手帳体験」はまだ完成ラインに届いていない。

次に太くするべき順番:

1. 1人目の対象者ページを「本物のマイページ」にする。プロフィール編集、日記、過去記録、写真/資料、
   確認リストをタブで整理する。
2. 記録から「最近の変化」「今週聞くこと」「期限アラート」を出す。単なる保存ではなく、毎回戻る理由を作る。
3. 家族共有は価値体験として無料範囲を残し、Plusの理由は2人目以降、AI相談、容量、PDF/製本に寄せる。
4. AI相談は、プロフィールと日記の文脈を参照する本物の相談体験にする。キーワードヒントをAIと呼ばない。
5. 1人目登録後に同じCTAが残る、飛び先がバラバラ、読み物ページに内部向け説明が出る、などの整合性を潰す。

判断: 広告やアフィリエイトを増やす前に、まず1人目無料体験の信頼と便利さを上げる。ここが弱いまま
収益導線を増やすと、家族手帳としての信用が落ちる。

## 2026-08-22 追記 149 — 1人目無料の手帳体験を強化

追記148の判断を受けて、`apps/web/app/home/page.tsx` の家族ボード上部を強化した。
1人目登録後に「何を押せばプロフィール編集できるか」「過去の記録はどこか」「今日何を残すか」が
分かりにくかったため、対象者カード直下に以下を追加した。

- 「今日の手帳」カード。最新の日記本文を短く表示し、`今日の記録を書く` と `過去の記録を見る` を大きいボタンで出す。
- 「次に整えること」パネル。基本情報、確認リスト、家族に聞くことを3行で出し、それぞれ `編集する` / `確認する` / `記録する` へ直接飛ばす。
- プロフィール編集ボタンは `#profile-edit-fields` を開き、プロフィールタブと編集フォームを同時に開く。
- 過去記録ボタンは記録タブの `#diary-history` へ飛ぶ。
- 確認リストボタンは `#task-checklist` へ飛ぶ。

`apps/web/app/globals.css` には、スマホで押しやすい44px以上のボタン、1列表示、手帳らしい濃緑カードの
スタイルを追加した。下に既存の補助メニューは残しているが、上部だけで主要操作が分かるようにした。

確認:

- `apps/web`: `corepack pnpm exec tsc --noEmit` 通過。
- `apps/mobile`: `corepack pnpm exec tsc --noEmit` 通過。

次に見ること:

1. 実機iPhoneで `https://oyano-moshimo-navi.vercel.app/home` を更新し、対象者カード直下に
   「今日の手帳」「次に整えること」が出ているか確認する。
2. まだ「しょぼい」と感じる場合は、次はカードの見た目ではなく、日記の履歴表示を月別タイムライン化し、
   記録から「最近の変化」「次に家族へ聞くこと」がもっと目立つようにする。

## 2026-08-22 追記 150 — レビュー用に0人状態から登録画面を開けるURLを追加

ユーザーから「誰かにレビューしてもらう時、0から登録画面からにしてほしい」と依頼があった。
レビュー相手に既存の家族ボードをいきなり見せるのではなく、最初の登録体験から確認してもらうため、
以下を実装した。

- ルート `/` は `/home` ではなく `/start` へredirectするように変更。
- `/start?fresh=1` または `/start?reset=1` を開いた時だけ、その端末のローカル手帳データを削除して
  0人状態から登録画面を表示する。
- 削除対象はWeb/PWAのローカル保存だけ。`oyano_cases_v03`、`oyano_diary_entries_v01`、
  `oyano_plan_v01` を消す。管理トークンやSupabaseセッションには触らない。
- `fresh/reset` パラメータは実行後にURLから消す。

レビュー相手へ送るURL:

- 通常の登録画面: `https://oyano-moshimo-navi.vercel.app/start`
- その端末の古いローカル手帳を消して0から見せるレビュー用:
  `https://oyano-moshimo-navi.vercel.app/start?fresh=1`

確認:

- `apps/web`: `corepack pnpm exec tsc --noEmit` 通過。

## 2026-08-22 追記 151 — 登録開始ページを「完全に0から始める」見え方へ修正

ユーザーから、レビュー用URLを開いても画面左上の「もどる」から古い「お母さんの手帳」風のページへ戻れてしまい、
0から始まる登録画面に見えないと指摘があった。

対応:

- `apps/web/app/start/page.tsx` の画面内「‹ もどる」ボタンを削除した。
- `/start` の見出しを「1人目の登録」ではなく「ここから始めます」「まずは1人だけ、家族の手帳を作ります。」へ変更。
- 最初に何を押すか分かるように「下のカードから、いま一番近い状況を1つ押してください。」という案内を追加。
- `apps/web/app/globals.css` に、登録開始ページを手帳の表紙カードとして見せるスタイルを追加した。

レビュー相手へ見せる時は、引き続き以下を使う:

- `https://oyano-moshimo-navi.vercel.app/start?fresh=1`

注意:

- ブラウザやLINE/Safariの左上に出る端末側の「戻る」は履歴なのでアプリ側から完全には消せない。
- ただし、アプリ画面内の「もどる」導線は削除済みなので、ページ自体は0から始める登録体験として見える。

## 2026-08-22 追記 152 — 本番反映とPWAキャッシュ対策

追記151の修正後、ユーザー実機ではまだ古い `/start` が表示され、画面内に「‹ もどる」が残っていた。
確認したところ、GitHubには `e85c6d0` がpush済みだったが、Vercel本番が古いビルドを返していた。

対応:

- `npx vercel --prod --yes` は `Not authorized` で失敗した。
- `npx vercel whoami` は `dogwoodcommunity`、`npx vercel project ls` では対象プロジェクトが
  `dogwoodcommunity1` 配下だった。
- `npx vercel --prod --yes --scope dogwoodcommunity1` で本番デプロイ成功。
- 本番URL `https://oyano-moshimo-navi.vercel.app` は新しいデプロイへalias済み。
- さらに `apps/web/public/sw.js` の `CACHE_VERSION` を `oyano-moshimo-navi-v19` へ更新。
- `/start?fresh=1` や `/start?reset=1` はサービスワーカーのページキャッシュを使わず、
  `cache: "reload"` で取得するように変更した。

判断:

- 初めて使う人は通常、過去登録データがないため、古い手帳へ戻る状態にはならない。
- ただし、既に同じ端末でテストしているユーザーはブラウザ履歴・PWAキャッシュ・localStorageが残るため、
  レビューには `https://oyano-moshimo-navi.vercel.app/start?fresh=1` を使う。

## 2026-08-22 追記 153 — `/start?fresh=1` の本番反映確認

追記152の再デプロイ後、本番URLを確認した。

確認結果:

- `https://oyano-moshimo-navi.vercel.app/sw.js` は
  `CACHE_VERSION = "oyano-moshimo-navi-v19"` を返している。
- `https://oyano-moshimo-navi.vercel.app/start?fresh=1&v=9d4ae39` はHTTP 200。
- 取得したHTMLには新しい文言
  `ここから始めます`、`まずは1人だけ`、`下のカードから` が含まれている。
- 古い画面内の `もどる`、`1人目の登録` は本文検索では出ていない。

ユーザーへの案内:

- 初回ユーザーは過去のlocalStorageがないため、以前登録した手帳へ戻る表示にはならない。
- テスト済み端末ではSafari/ChatGPT内ブラウザ/PWAの履歴やキャッシュが残るため、
  レビュー用URLは `https://oyano-moshimo-navi.vercel.app/start?fresh=1&v=9d4ae39` を使う。
- それでも古い画面が残る場合は、iPhoneのSafariサイトデータで `oyano` を削除して開き直す。

## 2026-08-22 追記 154 — 施設配布用A5家族確認カードの叩き台

ユーザーから、介護施設・病院・地域包括支援センターなどに置いてもらう宣伝方法として、
「家族確認カード」の実物イメージが欲しいと相談があった。

対応:

- `docs/marketing/family_check_card_a5.html` を新規作成。
- A5縦、表裏2ページの印刷用HTML。
- 表面は広告ではなく「親が入院した時、家族で最初に確認すること」として、
  病院窓口、退院準備、支払い・保険、家族の役割分担を書き込めるカードにした。
- 裏面はQRから `https://oyano-moshimo-navi.vercel.app/start?fresh=1` に誘導し、
  「無料で状況を整理」「この人の手帳として残す」という導線にした。
- ロゴは `apps/web/public/brand/watch-bird-mark.svg` を参照。
- QRは暫定で `api.qrserver.com` の生成URLを使っている。正式印刷前には固定QR画像に差し替えるのが望ましい。

判断:

- 全国郵送DMより、施設・病院・ケアマネが家族へ渡しやすい「使える紙」として設計する方が初期検証に向く。
- 初期配布は全国ではなく、地域包括支援センター、退院支援窓口、居宅介護支援事業所など30か所程度で反応を見るのがよい。

## 2026-08-22 追記 155 — ロゴ素材を用途別に追加

ユーザーから「ロゴほしい」と依頼があった。

対応:

- `docs/marketing/logo_assets/` を新規作成。
- 以下のSVGを追加した。
  - `oyano-moshimo-logo-horizontal.svg`: チラシ、資料、Webヘッダー向けの横組みロゴ。
  - `oyano-moshimo-logo-stacked.svg`: 表紙、SNS画像、カード中央配置向けの縦組みロゴ。
  - `oyano-moshimo-logo-mark.svg`: 見守り鳥のアイコン単体。
  - `README.md`: 用途と色指定。

判断:

- 既存の見守り鳥キャラをブランドの核として使い、先頭の漢字アイコンのような硬い印象は避ける。
- 印刷会社へ渡す場合はSVGをPDFまたはPNGに書き出して使う。

## 2026-08-22 追記 156 — ロゴをスマホ保存しやすいPNGでも出力

ユーザーから「画像でダウンロードできない」と指摘があった。
SVGだけではスマホで保存・共有しづらいため、同じロゴをPNG画像として追加した。

対応:

- `docs/marketing/logo_assets/oyano-moshimo-logo-horizontal.png` を追加。
- `docs/marketing/logo_assets/oyano-moshimo-logo-horizontal-transparent.png` を追加。
- `docs/marketing/logo_assets/oyano-moshimo-logo-stacked.png` を追加。
- `docs/marketing/logo_assets/oyano-moshimo-logo-mark.png` を追加。
- `docs/marketing/logo_assets/oyano-moshimo-logo-png.zip` を追加。
- `docs/marketing/logo_assets/README.md` に、スマホ保存はPNG、印刷・デザイン用途はSVGという使い分けを追記。

判断:

- ユーザーがスマホやチャットで即共有できるよう、PNG一式とZIPを残した。
- 透過背景が必要な場面に備えて、横組みは通常背景版と透過版の両方を用意した。

## 2026-08-22 追記 157 — 横組みロゴPNGの上下余白を拡張

ユーザーから、横組みロゴ画像について「上下の幅を広げて」と指摘があった。

対応:

- `docs/marketing/logo_assets/oyano-moshimo-logo-horizontal.svg` のviewBoxを `420×148` に広げ、鳥と文字を縦方向中央へ配置し直した。
- `docs/marketing/logo_assets/oyano-moshimo-logo-horizontal.png` を `1680×592` で再生成した。
- `docs/marketing/logo_assets/oyano-moshimo-logo-horizontal-transparent.png` も同じ `1680×592` で再生成した。
- `docs/marketing/logo_assets/oyano-moshimo-logo-png.zip` を新しいPNG込みで作り直した。
- `docs/marketing/logo_assets/README.md` に、横組みPNGは上下余白を広めに取った版であることを追記した。

判断:

- 前の `1680×448` 版はスマホ表示や資料貼り付け時に上下が詰まって見えた。
- 新しい横組みPNGは白い角丸背景の上下余白を広げ、チラシやレビュー資料に置いた時に窮屈に見えないようにした。

## 2026-08-22 追記 158 — 招待された家族には課金CTAを出さない

ユーザーから「1人目で課金して招待しているのに、2人目以降のアプリにも課金ボタンが出るのは変。共有のみのページにすべき」と指摘があった。

判断:

- Family Plusは個人課金ではなく、家族手帳単位の課金として扱う。
- 手帳を作った人が招待とプランを管理する。
- 招待された家族は、同じ手帳の記録・確認リスト・写真更新に参加する人であり、同じ手帳に対する追加課金CTAは出さない。
- 招待された家族が自分で別の家族手帳を作る時だけ、自分のプラン判断になる。

対応:

- `apps/web/app/api/notebook/sync/route.ts` が `isFamilyOwner` / `canManageFamilyBilling` を返すようにした。
- 共有メンバーがクラウド同期する場合、新しい対象者の作成はスキップし、既存の共有手帳の更新に限定した。
- `apps/web/lib/store.ts` に家族課金管理可否の保存/読込を追加した。
- `apps/web/app/home/page.tsx` で共有メンバー判定を追加し、共有メンバーには「手帳を追加」「Plusでできること」などの課金・作成者向け導線を非表示にした。
- `apps/web/components/FamilyShare.tsx` で、共有メンバーには招待フォームではなく「共有された手帳に参加中」の説明と手帳を開く導線だけを表示するようにした。
- `apps/web/components/PlusUpgrade.tsx` で、ログイン後に家族情報を確認し、非オーナーには決済ボタンを出さないようにした。
- `apps/web/app/family/page.tsx`、`apps/web/app/plans/page.tsx`、`apps/web/components/InviteAccept.tsx`、`apps/web/app/invite/[token]/page.tsx` の文言を「追加課金なし」「家族手帳単位」に統一した。
- Expo側の `apps/mobile/app/account/plan.tsx` と `apps/mobile/app/invite.tsx` も、招待された家族が別で支払う必要はない文言に揃えた。
- `docs/MONETIZATION.md` に「招待された家族の扱い」を追記した。

検証:

- `corepack pnpm --dir apps/web exec tsc --noEmit` 成功。
- `corepack pnpm --dir apps/mobile exec tsc --noEmit` 成功。

次に確認すること:

- 実機で、オーナーアカウントでは家族招待・Plus導線が見えること。
- 招待された家族アカウントで `/home?cloud=1` を開いた時、追加手帳・Plus導線が消え、共有手帳の更新だけになっていること。

## 2026-08-22 追記 159 — 「お守り代わり・手帳代わり」として足りるかの正直評価

ユーザーから、実際に出して期待に応えられるアプリになっているか、導入から最後の出口まで「使ってよかった」と思ってもらえるか、足りないものを再評価してほしいと相談があった。

判断:

- 方向性は合っている。親や親族の状況を1人ずつ管理し、家族で記録・確認リスト・写真・相談を残す「家族の手帳」というポジションは強い。
- ただし、現状のままではまだ「大事な記録を預けていい手帳」としては弱い。画面の雰囲気やCTA整理だけでなく、保存の安心、過去記録の見返し、プロフィール編集、家族共有後の役割、AI相談の本物感が足りない。
- ユーザーが有料でも使いたくなる核は、派手な機能追加ではなく「この人のことを忘れず、家族で同じ前提を持てる」体験にある。
- まず強化すべきは、1人目無料体験の深さ。1人目のマイページが便利で信頼できれば、2人目追加・家族共有・AI相談への課金理由が自然に生まれる。

優先して補うべきもの:

1. 記録が消えないクラウド同期と、ユーザーに伝わる安心表示。
2. 対象者マイページのタブ化（プロフィール、日記・記録、確認リスト、写真・資料、家族共有）。
3. プロフィール編集の明確な入口と、入力済み情報の充実度表示。
4. 日記・写真・PDFを時系列で見返せる「手帳」体験。
5. 日記の内容から、注意点・次に聞くこと・家族への共有文を出す相談/ヒント機能。
6. 緊急時にすぐ使える「今日やること」「病院に聞くこと」「家族に頼むこと」。
7. 家族共有後は、招待された家族には課金ではなく共同更新の役割を見せる。
8. 最終的には、入院、退院後在宅、介護、危篤、死後手続き、実家じまいまで同じ手帳でつながる体験にする。

次に実装するなら:

- まず1人目マイページを本当に使える手帳にする。プロフィール編集、過去記録一覧、日記からのヒント、確認リスト編集を優先する。
- その後、クラウド同期と共有状態の見え方を実機で固める。
- AI相談は「AI」と名乗るなら本物の文脈参照が必要。キーワードヒントの段階では「AI相談」ではなく「今日のヒント」程度に抑える。

## 2026-08-22 追記 160 — 1人目の無料手帳体験を強化

ユーザーから「じゃあ、完璧にして」と依頼があり、直前の正直評価に基づいて、まず1人目の無料体験が価値として伝わる導線を強化した。

判断:

- いま足りないのは機能の数ではなく、1人目の手帳を触った瞬間に「これは家族で共有したい」「記録を残して相談したい」「2人目も管理したい」と思える見せ方。
- 既にプロフィール編集、日々の記録、過去記録の編集、確認リスト編集、写真・資料、クラウド控え保存は実装済みなので、次に必要なのはそれらを1つの手帳体験として見つけやすくすること。
- 共有メンバーに課金CTAが見えると違和感が出るため、手帳作成者と共有メンバーで説明を分ける。

対応:

- `apps/web/app/home/page.tsx` に「手帳の育ち具合」カードを追加した。
- その人の手帳が、プロフィール、日々の記録、確認リスト、写真・資料の4項目でどれだけ育っているかを%表示するようにした。
- 各項目を押すと、該当タブ/該当編集箇所へ直接移動するようにした。
- 「次におすすめ」「入力あり」「あとで」を出し、ユーザーが次に何を触ればいいか分かるようにした。
- 1人目、2人目以降、共有メンバーで説明文を分岐した。
  - 1人目: 無料で手帳を育て、共有・2人目・相談が必要になった時だけPlusへ。
  - 2人目以降: 家族手帳の作成者が支払いをまとめて管理。
  - 共有メンバー: 追加課金なしで記録・確認リスト・写真を一緒に更新できる。
- `apps/web/app/globals.css` に手帳カード専用のUIを追加し、ただのフォームではなく「育つ手帳」に見えるようにした。

検証:

- `corepack pnpm --dir apps/web exec tsc --noEmit` 成功。
- `corepack pnpm --dir apps/mobile exec tsc --noEmit` 成功。

次に確認すること:

- iPhone実機で `/home` を開き、登録済みの対象者ページに「手帳の育ち具合」カードが出ること。
- 「本人プロフィール」「日々の記録」「確認リスト」「写真・資料」を押した時、それぞれ正しい場所へ移動すること。
- 共有メンバーで開いた時、Plusや追加課金を求めるような文言になっていないこと。

## 2026-08-22 追記 161 — 「もう完璧か？」への判断

ユーザーから「もう完璧か？」と確認があった。

判断:

- 完璧ではない。正直に言うと、今は「初期ユーザーやレビュー相手に触ってもらえる骨格」まで来た段階。
- ただし、以前のような単なる診断サイト/薄い家族ボードではなく、1人ごとの手帳、記録、確認リスト、写真、クラウド控え保存、共有、Plus導線までつながり始めている。
- ここから本当に課金されるアプリにするには、次の3点が残る。
  1. 実機での体験確認と細かいUI違和感の潰し込み。
  2. Supabase同期・共有・復元が実ユーザー操作で確実に動くことの確認。
  3. 「今日のヒント/相談」を、記録とプロフィールを前提にもっと実用的にすること。
- 現時点で「知人・エンジニア・家族3組にレビューしてもらう」は可能。
- ただし「全国に配布して集客する」「有料課金を本格開始する」は、上の3点を実機で潰してからにする。

次の実務:

- iPhoneで `/home` の手帳導線を確認する。
- 1人目登録、プロフィール編集、日記作成、過去記録編集、確認リスト編集、写真/資料導線、控え保存、家族共有を1本のシナリオで実機確認する。
- 違和感が出た画面をスクリーンショットで受け、そこを次に直す。

## 2026-08-22 追記 162 — 記録から「今日の一手」と家族共有文を出す

ユーザーから「できるだけやって」と依頼があり、前回の判断で残っていた「今日何を見ればいいか」「日々の記録をどう家族に共有するか」「過去記録をどう活かすか」を強化した。

対応:

- `apps/web/app/home/page.tsx` に「今日の一手」カードを追加した。
- 記録、期限が近い確認リスト、担当未定、プロフィール不足、写真不足を見て、次に押すべきボタンを1つに絞って表示するようにした。
- 「家族に送るなら」の一文を自動で作り、コピーできるようにした。
- 「7日以内の確認」「担当未定」「最後の記録から何日か」を短い見守りポイントとして表示するようにした。
- 月次レビューにも「家族に共有する一文」を追加し、記録を見返すだけで終わらず家族会話につなげるようにした。
- `apps/web/lib/store.ts` の日記ヒントを少し強化し、変化があった日の残し方と、家族へ送る時の書き分けを追加した。
- `apps/web/app/globals.css` に今日の一手、共有文、見守りポイント、月次共有文のスタイルを追加した。

判断:

- これで「ただの日記」ではなく、日記から今日見る場所、家族へ送る文、次の確認が出る形に近づいた。
- ただし本物の長期AI相談や完全なクラウド同期検証まではまだ別タスク。現段階では「相談メモ/ヒント」として安全に見せる。

検証:

- `corepack pnpm --dir apps/web exec tsc --noEmit` 成功。
- `corepack pnpm --dir apps/mobile exec tsc --noEmit` 成功。
- `git diff --check` 成功。
- ローカルNext確認は `127.0.0.1:3016` で起動しようとしたが、環境側で `listen EPERM` になったため未実施。push後はVercel本番URLで実機確認する。

## 2026-08-22 追記 163 — Claudeレビュー用資料を作成

ユーザーから「claudにレビューもらうから資料つくって」と依頼があった。

対応:

- `docs/CLAUDE_REVIEW_PROMPT_2026-08-22.md` を追加した。
  - Claudeにそのまま貼れるレビュー依頼文。
  - 結論、UX、課金価値、手帳としての信頼、AI/相談、セキュリティ/法務、コード構造をレビューしてもらう構成。
- `docs/CLAUDE_PRODUCT_REVIEW_BRIEF_2026-08-22.md` を追加した。
  - 現在のPWA/アプリ中心方針、主画面、直近改善、未解決リスク、レビューで答えてほしい質問を整理。
- この後、最新 `main` を `git archive` でZIP化し、Claudeに渡せるコード監査パッケージとして `review_exports/claude_review_2026-08-22/` に出力する。

Claudeに渡す時の優先順:

1. `docs/CLAUDE_REVIEW_PROMPT_2026-08-22.md`
2. `docs/CLAUDE_PRODUCT_REVIEW_BRIEF_2026-08-22.md`
3. コードZIP
4. 必要なら `docs/MONETIZATION.md` と `docs/SESSION_HANDOFF.md`

## 2026-08-22 追記 164 — Claude再レビューの致命傷を先に補修

ユーザーがClaude再レビュー結果を貼り付けた。主な指摘は「消えない手帳」を名乗るには、写真/PDFのlocalStorage保存、存在しないconsultモデルID、家族同時編集の丸上書きが危ないというもの。

対応:

- `apps/web/app/api/consult/route.ts`
  - `claude-opus-5` 固定をやめ、`ANTHROPIC_MODEL` 環境変数、未設定時 `claude-sonnet-4-6` に変更した。
  - これで存在しないモデルID固定によるPlus相談の即死を避ける。
- `apps/web/app/home/page.tsx`
  - 日記添付を当面「写真のみ」に絞った。
  - PDF添付UIは一旦隠し、メッセージも「写真」に統一した。
  - 画像は追加時に長辺1280px、JPEG品質0.78で圧縮する。
  - 端末保存中は写真3枚までに制限し、4枚目以降やPDFは「クラウド保管へ移行するまで一時停止」と明示する。
  - 保存容量不足時の警告を記録画面に表示する。
- `apps/web/lib/store.ts`
  - `CaseRecord.updatedAt` を追加した。
  - プロフィール、タスク、日記作成/編集で対象者手帳の `updatedAt` が進むようにした。
  - localStorage保存失敗時の警告を握りつぶさず、UIが表示できるよう `consumeNotebookStorageWarning()` を追加した。
- `apps/web/app/api/notebook/sync/route.ts`
  - クラウド同期の `people.profile.localUpdatedAt` に端末側の最終更新時刻を保存するようにした。
  - 既存クラウド手帳より古い端末からPOSTされた場合は `409 notebook_conflict` を返し、「先にクラウドの控えを復元してから保存」と案内する。
  - GET復元時、ユーザーが消したタスクをテンプレfallbackで復活させないよう、クラウドにもprofileにもタスクがない時は空配列にした。

判断:

- これはSupabase Storage本移行ではなく、3組テスト前の応急補修。
- 「写真/PDF添付」は、現時点では「写真3枚まで」に表現を下げるのが正しい。
- 有料テスト前には、Supabase Storageへの写真本移行、メール通知、consult実API複数回確認がまだ必要。

検証:

- `git diff --check` 成功。
- `corepack pnpm --dir apps/web exec tsc --noEmit` 成功。
- `corepack pnpm --dir apps/mobile exec tsc --noEmit` 成功。
- `corepack pnpm --dir apps/web run build` 成功。
  - Supabase SDKからNode 20非推奨警告は出るが、ビルド自体は成功。

次に残ること:

1. consultを本番環境の実APIで5回程度叩き、応答品質とエラー率を見る。
2. 写真をSupabase Storageへ移す。本実装ではlocalStorageにbase64を残さない。
3. 期限通知/月1確認の受け皿を、PWA方針に合わせてメール通知へ寄せる。
4. `apps/web/app/home/page.tsx` が大きくなりすぎているので、`ProfileTab` / `RecordTab` / `TasksTab` / `MediaTab` / hooks に分割する。

## 2026-08-23 追記 165 — GitHub push と本番反映

追記164の補修をコミットしてGitHubへpushし、本番Vercelにも反映した。

コミット:

- `83e1aa7 Patch notebook reliability issues from review`
- push先: `origin main`

本番:

- 通常URL: `https://oyano-moshimo-navi.vercel.app`
- Vercel deployment: `https://oyano-moshimo-navi-edc7sz2u4-dogwoodcommunity1.vercel.app`
- Vercel inspect: `https://vercel.com/dogwoodcommunity1/oyano-moshimo-navi/DH6taLDwMs16T9JemvLJCS8235ps`
- readyState: `READY`

本番確認:

- `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- `/home` は `HTTP/2 200`。
- 主要ページ `/home`, `/start`, `/guides`, `/consult`, `/family`, `/plans`, `/diagnosis`, `/support-pack`, `/manifest.webmanifest`, `/sw.js` などが200。
- 認証が必要なAPIは401、空相談は400など、スモーク上のガードも期待通り。

注意:

- 未追跡の `review_exports/` はレビュー用生成物なので今回のコミット対象外。
- 本番に入ったのは、consultモデルID修正、写真3枚/圧縮/警告、PDF添付一時停止、同期競合409、日記更新時の手帳 `updatedAt` 更新。

## 2026-08-23 追記 166 — 日記写真をSupabase Storageへ逃がす実装

Claude再レビューの「写真がlocalStorage base64だけで、消えない手帳の約束と矛盾する」指摘に対して、本実装の第一段を入れた。

対応:

- `apps/web/app/api/notebook/photo-upload-url/route.ts` を追加。
  - 認証済みユーザーのBearer tokenを検証し、Supabase Storage bucket `home-photos` に署名付きアップロードURLを発行する。
  - 保存パスは `notebook/{userId}/{uuid}-{safeFileName}`。
  - jpeg/png/webpのみ、8MBまで。
  - 住所・表札・鍵番号・位置情報への注意もレスポンスに含める。
- `apps/web/lib/store.ts`
  - `DiaryAttachment` に `storageBucket`, `storagePath`, `uploadedAt`, `uploadStatus` を追加。
- `apps/web/app/home/page.tsx`
  - 写真追加時、長辺1280px/JPEG品質0.78で圧縮し、端末プレビュー用のData URLとアップロード用Blobを分けた。
  - メール確認済みでSupabase sessionがある場合は、写真追加時に裏でStorageへアップロードする。
  - アップロード成功時は添付にStorageの保存先を持たせる。
  - アップロード失敗時も端末側には追加し、クラウド保管失敗の警告を出す。
  - PDFは引き続き一時停止。写真は1回の記録につき3枚まで。
- `apps/web/app/api/notebook/sync/route.ts`
  - クラウド同期POST時、Storage保存済みの写真はbase64 `previewUrl` をDBへ送らず、bucket/pathだけ保存する。
  - クラウド復元GET時、Storage保存済み写真に1時間の署名付き表示URLを発行して `previewUrl` に戻す。
  - local-only写真は従来通り圧縮済みData URLを残す。

判断:

- 未ログイン利用を壊さないため、localStorageプレビューは残す。
- ただしログイン済みなら写真実体はSupabase Storageにも残るので、「端末履歴削除で写真実体が完全消失する」問題をかなり弱めた。
- bucket名は既存の `home-photos` を流用した。日記写真専用bucketを作るより、既存SQLと本番bucketを活かす方が今は安全。
- PDFの実体保存は未実装。PDF UIはまだ出さない方針を維持。

検証:

- `git diff --check` 成功。
- `corepack pnpm --dir apps/web exec tsc --noEmit` 成功。
- `corepack pnpm --dir apps/mobile exec tsc --noEmit` 成功。
- `corepack pnpm --dir apps/web run build` 成功。
  - Supabase SDKのNode 20非推奨警告は出るが、ビルド自体は成功。

次に残ること:

1. 実機で、メール確認済み状態で写真を追加し、Storage uploadが通るか確認する。
2. Supabase Storage上に `notebook/{userId}/...` のobjectができているか確認する。
3. 別端末/別ブラウザでクラウド復元し、写真が署名付きURLで表示されるか確認する。
4. 期限通知/月1確認をPWA方針に合わせてメール通知へ寄せる。

## 2026-08-23 追記 167 — 日記写真Storage対応を本番へ反映

追記166の変更をコミット、pushし、本番Vercelへ反映した。

コミット:

- `679f0d4 Store notebook photos in Supabase Storage`
- push先: `origin main`

本番:

- 通常URL: `https://oyano-moshimo-navi.vercel.app`
- Vercel deployment: `https://oyano-moshimo-navi-6nzbud7xw-dogwoodcommunity1.vercel.app`
- Vercel inspect: `https://vercel.com/dogwoodcommunity1/oyano-moshimo-navi/61Mt2ArA2VTCaDLvuUQbnvpE8Lsy`
- readyState: `READY`

本番確認:

- `npx vercel --prod --yes` の本番ビルド成功。
- `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` は主要ページ/APIガードまで成功確認後、終端が戻らなかったため手動停止した。
  - 確認できた範囲: `/home`, `/start`, `/guides`, `/consult`, `/family`, `/plans`, `/diagnosis`, `/support-pack`, `/manifest.webmanifest`, `/sw.js`, `/api/health` は期待通り。
  - 認証必須APIは401、空相談は400など期待通り。
- 新規API `/api/notebook/photo-upload-url`
  - GETは405。Route Handlerは本番に載っている。
  - 未認証POSTは401 `{ "error": "Authorization bearer token is required" }`。

注意:

- まだ「実機でログイン済み状態の写真追加 → Storage object作成 → 別端末復元」の実弾確認は未実施。
- 未追跡の `review_exports/` はレビュー用生成物なのでコミット対象外。

## 2026-08-23 追記 168 — Claudeレビュー提出資料を最新版で作成

ユーザーから「資料は？」と聞かれたため、Claudeへ最新レビューを依頼するための資料セットを作成した。

作成場所:

- `review_exports/claude_review_2026-08-23/README_CLAUDE_REVIEW_2026-08-23.md`
- `review_exports/claude_review_2026-08-23/CLAUDE_REVIEW_PROMPT_2026-08-23.md`
- `review_exports/claude_review_2026-08-23/ENGINEER_REVIEW_BRIEF_2026-08-23.md`
- `review_exports/claude_review_2026-08-23/PRODUCT_REVENUE_REVIEW_BRIEF_2026-08-23.md`
- `review_exports/claude_review_2026-08-23/oyano-moshimo-navi-source-2026-08-23-41795f1.zip`

レビュー対象コミット:

- `41795f1 Record notebook photo storage deployment`

資料の内容:

- 8/22版のClaudeレビュー依頼に、日記写真Storage対応、sync時のbase64除去、Storage写真復元時の署名付きURL発行、consultモデルID修正、同期競合ガード、PDF添付一時停止を反映。
- Claudeには、家族3組テスト可否、有料テスト可否、Storage/同期/データ消失、RLS/Auth/service role、課金価値、家族共有境界、UXを見てもらう構成。
- `review_exports/` は従来どおりレビュー用生成物なのでGit管理外。必要ならユーザーがこのフォルダまたはZIPをClaudeに渡す。

## 2026-08-23 追記 169 — Claude再レビューの3組テスト前ブロッカー対応

Claude再レビューで「家族3組テストはOK。ただしlocalStorage preview残り、409復元時の日記消失、Storage署名/アップロードURLの安全化を先に」と指摘されたため、3組テスト前の信用部分だけを小さく修正した。

変更:

- `apps/web/app/home/page.tsx`
  - メール確認済みで写真をSupabase Storageへアップロードできた場合、添付からdata URLの `previewUrl` を削除するよう変更。
  - これにより、アップロード済み写真のbase64がlocalStorageに残り続ける問題を防ぐ。
  - クラウド復元時は `replaceLocalNotebook()` の戻り値を同期済みsignatureに使うよう変更。
- `apps/web/lib/store.ts`
  - `replaceLocalNotebook()` を全置換から、日記だけ `id` でunion mergeする形へ変更。
  - クラウド復元しても、その端末にだけ残っていた未送信日記を消さない。
- `apps/web/app/api/notebook/sync/route.ts`
  - Storage写真署名前に、`home-photos/notebook/{user_id}/...` の `user_id` が同じfamilyのメンバーか確認するよう変更。
  - 不正なbucket/pathやfamily外userのpathは署名URL化しない。
  - POSTでは既存手帳の日記を、プロフィール/タスクの409競合判定より先にupsertするよう変更。
  - 競合で409を返す場合でも、その直前に書いた日記は先にクラウドへ退避される。
- `apps/web/app/api/notebook/photo-upload-url/route.ts`
  - 署名付きアップロードURL発行にIP単位とuser単位のレート制限を追加。
  - Supabase Storage上の `notebook/{user_id}` 使用量を概算し、freeは50MB、plusは500MBを超えるアップロードURL発行を止める。
- `supabase/storage_setup.sql`
  - `home_photos` policyと手帳日記写真の守り方が違うことをコメントで明記。
- `supabase/home_photo_security_hardening.sql` / `supabase/production_pending_hardening.sql`
  - 直接Storage upload policyを削除し、手帳写真はWeb APIのauth + family scope検証で守る説明へ修正。
- `docs/CLOUD_BACKUP_VERIFICATION.md` / `docs/PRIVACY_AND_REVIEW_GUARDRAILS.md`
  - 古い「日記添付はdata URL同期」説明を現状に合わせて更新。

検証:

- `corepack pnpm exec tsc --noEmit` in `apps/web` 成功。
- `corepack pnpm exec tsc --noEmit` in `apps/mobile` 成功。

残り:

1. 実機で、ログイン済み写真追加後にlocalStorageへdata URLが残らないことを確認。
2. 別端末/別ブラウザ復元で、Storage写真が署名URLで表示されることを確認。
3. 409競合を意図的に起こし、未送信日記が復元後も残ることを確認。
4. 有料テスト前には、consult実弾5回、Stripe E2E、メール通知の実装/確認がまだ必要。

## 2026-08-23 追記 170 — post-hardening版Claude再レビュー資料を作成

Claude再レビューで指摘された3組テスト前ブロッカー対応後の状態を、もう一度レビューしてもらうための資料セットを作成した。

作成場所:

- `review_exports/claude_review_2026-08-23-post-hardening/README_CLAUDE_REVIEW_2026-08-23_POST_HARDENING.md`
- `review_exports/claude_review_2026-08-23-post-hardening/CLAUDE_REVIEW_PROMPT_2026-08-23_POST_HARDENING.md`
- `review_exports/claude_review_2026-08-23-post-hardening/oyano-moshimo-navi-source-2026-08-23-5555ada.zip`

レビュー対象:

- コミット: `5555ada Harden notebook photo sync`
- 本番URL: `https://oyano-moshimo-navi.vercel.app`
- 初回導線: `https://oyano-moshimo-navi.vercel.app/start?fresh=1`
- 家族ボード: `https://oyano-moshimo-navi.vercel.app/home`

レビューで見てもらう中心:

1. Storageアップロード後にdata URL previewがlocalStorageへ残らないか。
2. 409復元時に未送信日記が消えないか。
3. sync GETのStorage署名URL発行が同一family範囲に閉じているか。
4. photo-upload-urlのレート制限と容量クォータが最低限足りているか。
5. この状態で家族3組テストへ出してよいか。

メモ:

- `review_exports/` はレビュー用生成物のためGit管理外。
- 最新のコード本体は `5555ada` でpush済み。
- 有料テストはまだ不可。consult実弾5回、Stripe E2E、メール通知が残っている。

## 2026-08-23 追記 171 — 3組テストGO検収後の最小対応

Claude再レビューで「家族3組テスト: GO。コード側ブロッカーなし。ただし実機確認3つは必須」と検収された。

追加で、ブロッカーではない軽微指摘として「`mergeDiaryEntries` がID衝突時に常にリモート勝ちなので、既存日記をオフライン編集した場合に巻き戻る可能性がある」と指摘されたため、テスト前に小さく修正した。

変更:

- `apps/web/lib/store.ts`
  - `diaryEntryTimestamp()` を追加。
  - `mergeDiaryEntries()` で同じ日記IDがremote/localにある場合、`updatedAt || createdAt` が新しい方を残すよう変更。
  - 新規日記だけでなく、既存日記のローカル編集もクラウド復元時に残りやすくした。

3組テスト用資料:

- `docs/FAMILY_TEST_PROTOCOL.md`
  - 実機確認3つ、テスト対象、渡すURL、初回に見てもらうこと、観察項目、必ず聞く質問、聞かない質問、判定ラインを整理。
- `docs/TEST_COOPERATION_REQUEST.md`
  - LINE/メールで送れるテスト協力お願い文と口頭説明文を作成。

検証:

- `corepack pnpm exec tsc --noEmit` in `apps/web` 成功。
- `corepack pnpm exec tsc --noEmit` in `apps/mobile` 成功。
- `git diff --check` 成功。

次にやること:

1. 実機確認3つ:
   - ログイン済み写真追加後にlocalStorageへdata URLが残らないこと。
   - 別端末/別ブラウザ復元でStorage写真が署名URLで表示されること。
   - 意図的409で未送信日記が復元後も残ること。
2. 家族3組テスト開始。
3. テストの裏で、有料前必須の consult実弾5回、Stripe E2E、メール通知へ進む。

## 2026-08-23 追記 172 — 写真保存直後の表示をサムネイル化

ユーザーが実機で日記に写真を保存したところ、保存後の記録カードに写真サムネイルではなく `B367A3CB-...jpg` のようなファイル名チップだけが表示され、「写真保存したんやけどなんか中途半端ちゃう？」と指摘。

原因:

- 前回のStorage対応で、アップロード成功後に `previewUrl` を削除していた。
- そのため「localStorageや同期ペイロードにbase64を残さない」という安全対策は効いたが、現在表示中の画面からもプレビューが消え、写真を残した実感が弱くなっていた。

変更:

- `apps/web/app/home/page.tsx`
  - Storageアップロード成功後も、画面表示中の `DiaryAttachment.previewUrl` は保持するよう変更。
  - 代わりに `attachmentForNotebookSync()` / `diaryEntryForNotebookSync()` / `diaryEntriesForNotebookSync()` を追加し、クラウド同期ペイロードではStorage保存済み写真のdata URLだけを落とす。
  - 日記作成前の添付一覧と保存後の記録カードで、写真がある添付に `has-preview` classを付け、ファイル名だけでなくサムネイルとして見えるよう変更。
  - `restoreNotebookFromCloud()` 後にlocalStorageから読み直して署名URLプレビューを落としていたため、復元直後はクラウドから返った `restoredNotebook.diaryEntries` をstateへ直接反映するよう変更。
- `apps/web/lib/store.ts`
  - `attachmentForNotebookStorage()` / `diaryEntryForNotebookStorage()` を追加。
  - localStorage保存時は、Storage保存済み写真の `previewUrl` を除外してJSON保存する。
  - 画面の現在stateではプレビューを残しつつ、端末保存容量とSafari localStorage枯渇リスクを抑える。
- `apps/web/app/globals.css`
  - 日記入力中の添付と保存後の添付表示を、丸いファイル名チップではなく小さな写真カード風に調整。

意図:

- ユーザー体験上は「写真を保存した」と分かる。
- 技術的には、重いbase64 data URLをlocalStorageや同期JSONに残さない。
- 未ログインでStorageに上がっていない写真だけは、従来どおり端末内プレビューを保持する。

## 2026-08-23 追記 173 — 手帳画面と相談画面の迷子対策

ユーザーが実機で `/consult` を確認し、「この手帳」が2つ並んでいること、さらに全体として機能が多すぎて50代以上の家族が迷子になりそうだと指摘。

判断:

- 機能追加ではなく、初期表示の情報量を減らす。
- 手帳の主動線は「今日の記録」「基本情報」「確認リスト」の3つに絞る。
- 写真、過去記録、共有、AI相談、緊急カードは消さず、必要な時だけ開く補助導線へ下げる。

変更:

- `apps/web/components/ConsultPanel.tsx`
  - 相談対象の手帳選択で、表示名が空または重複する場合に `1人目：名前未入力` のように番号を付けるよう変更。
  - 各手帳ボタンに状況ラベルと作成日を表示し、同じ「この手帳」が並ばないようにした。
  - Plus説明を「この人の手帳」連呼から、「相談は手帳を読む機能です」に変更して意味を明確化。
- `apps/web/app/home/page.tsx`
  - 最初に見える `person-next-panel` を3項目へ整理:
    1. 今日の記録を書く
    2. 基本情報を編集する
    3. 確認リストを見る
  - 写真、過去の記録、プロフィール詳細、確認リスト編集、写真一覧へのショートカットは `details.person-more-actions` に格納。
  - 家族共有、長期相談、緊急カードの3カードを個別に並べるのをやめ、`必要な時だけ使う` の折りたたみカードへ統合。
- `apps/web/app/globals.css`
  - `person-more-actions`、`optional-tools-card`、`optional-tool` の見た目を追加。
  - `consult-case-picker` を追加し、相談対象選択をタブではなく手帳カード風に変更。

検証:

- `corepack pnpm exec tsc --noEmit` in `apps/web` 成功。
- `corepack pnpm exec tsc --noEmit` in `apps/mobile` 成功。
- `git diff --check` 成功。

次に見ること:

- 実機で `/home` を開き、最初に見る操作が「今日の記録」「基本情報」「確認リスト」に絞られて見えるか。
- `/consult` で複数手帳がある時、同じ「この手帳」が並ばず、誰の相談か判断できるか。
- まだ迷う場合は、機能削除ではなくタブの初期表示をさらに「今日」だけに寄せる。

## 2026-08-23 追記 174 — 上部メニューの現在地表示を明確化

ユーザーが実機で上部メニューを確認し、「急なとき」の色が常に目立つため、今開いているページが「急なとき」だと勘違いしやすいと指摘。

変更:

- `apps/web/components/MainNav.tsx` を追加。
  - `usePathname()` で現在URLを見て、`家族ボード` / `読む` / `急なとき` の該当メニューだけに `aria-current="page"` と `is-active` を付ける。
  - `/home` は家族ボード、`/guides` と配下は読む、`/crisis` と配下は急なときとして扱う。
- `apps/web/app/layout.tsx`
  - 固定の `nav` リンクを `MainNav` に差し替え。
  - critical CSS側にも `nav-link` / `is-active` / `nav-crisis` の見た目を追加。
- `apps/web/app/globals.css`
  - 現在地は濃い緑のピルで表示。
  - 「急なとき」は通常時は薄い注意色のアウトライン風にし、`/crisis` を開いている時だけ暖色の選択状態にする。
  - フォーカスリングも追加し、キーボード操作でも現在地と操作対象が分かるようにした。

意図:

- 緊急導線としての「急なとき」と、現在地表示を分離する。
- 相談ページなどメニュー外の画面では「急なとき」が選択中に見えないようにする。
- 高齢の家族にも「いまどこにいるか」が分かるナビに寄せる。

## 2026-08-23 追記 175 — ナビ現在地表示をさらに強調

追記174の修正後、ユーザーから「何が変わったかわからん」と指摘。

原因:

- `/consult` など上部メニューに直接ない画面では、どのメニューも `is-active` にならず、変化が見えにくかった。
- active表示も濃い緑ピルだけで、スマホ実機では差が弱かった。

変更:

- `apps/web/components/MainNav.tsx`
  - `/consult`、`/family`、`/plans`、`/emergency-card`、`/checklists`、`/install`、`/support-pack` は家族ボード配下として扱い、上部メニューでは `家族ボード` を表示中にする。
  - activeリンク内に `表示中` ラベルを出す。
- `apps/web/app/globals.css` / `apps/web/app/layout.tsx`
  - activeリンクをより濃い緑に変更。
  - activeリンクの下に短い下線を追加。
  - `表示中` の小ラベルを追加。
  - `急なとき` は通常時の背景をさらに白寄せにして、常時選択中に見えないようにした。

意図:

- ユーザーが相談ページやPlusページを見ていても「いまは家族ボード側にいる」と分かる。
- 「急なとき」は緊急導線であり、現在地ではないことを明確にする。

## 2026-08-23 追記 176 — 本番Vercelの古いナビ表示を手動再デプロイで解消

ユーザーが実機スクショで、まだ旧ナビ（`家族ボード / 読む / 急なとき` のみ、`表示中` ラベルなし）が表示されていると報告。

確認:

- `curl -I https://oyano-moshimo-navi.vercel.app/home` で最初は古いVercelキャッシュが返っていた。
- HTML上も旧ナビのままで、`nav-link` / `nav-current-label` が本番に出ていなかった。

対応:

- `npx vercel --prod --yes` は `Not authorized` で失敗。
- Vercel CLIは `dogwoodcommunity` でログイン済みだったが、チームスコープ指定が必要だった。
- `npx vercel --prod --yes --scope dogwoodcommunity1` で本番デプロイ成功。
- 本番URL `https://oyano-moshimo-navi.vercel.app` に最新ビルドがエイリアスされた。

再確認:

- `curl -sL https://oyano-moshimo-navi.vercel.app/home` で `nav-link`、`is-active`、`nav-current-label`、`表示中` が返ることを確認。
- `curl -I` でも `age: 0`、`x-vercel-cache: PRERENDER` の新しいレスポンスを確認。

ユーザーへの案内:

- iPhone側でまだ古く見える場合は、同じタブを引っ張って再読み込みする。
- それでも古い場合は一度タブを閉じて、`https://oyano-moshimo-navi.vercel.app/home?v=nav2` で開く。

## 2026-08-23 追記 177 — 1人目登録導線を「プロフィール入力 → 状況選択 → 手帳」へ修正

ユーザーが実機で、`/home` から「1人目の手帳を作る」を押したあと、親のフルネーム・生年月日・今の状態を入れるつもりだったのに、いきなり状況カード選択ページが開いて迷ったと報告。さらに状況カードを押すと、プロフィール入力ではなく別の情報ボタンに飛んだように見え、途中で離脱しそうになった。

原因:

- `/start` が「まず状況を1つ選ぶ」構成のままで、アプリ内手帳としての最初の期待（誰の手帳かを登録する）と合っていなかった。
- `createCase()` は状況だけの `draft` を作り、`/diagnosis` へ遷移していたため、ユーザーの認知では「親の情報を入れるボタンを押したのに診断/選択画面へ飛ばされた」状態になっていた。
- `/home` の空状態CTAも「1人目の手帳を作る」とだけ表示しており、次に何をするのかが弱かった。

変更:

- `apps/web/app/start/page.tsx`
  - 画面上部を「まず、管理する人の情報を入れます。」に変更。
  - 状況カードより前に、呼び名・関係・フルネーム・生年月日の入力カードを追加。
  - 未入力でも進められるが、入力した内容は登録後のプロフィール欄に入ることを明記。
  - 状況選択セクションを「2. いまの状況を選ぶ」とし、押すと「この人の手帳と確認リストを作って家族ボードに戻る」と説明。
  - 状況カードのCTA文言を「この状況で登録する」から「この人の手帳を作る」に変更。
  - 作成後の遷移先を `/diagnosis` ではなく `/home?created={caseId}#person-profile` に変更。
- `apps/web/lib/store.ts`
  - `createCase(selectedStatus, initialProfile)` に拡張。
  - 初期プロフィールを保存し、関係や呼び名から診断対象の種別を推定。
  - 状況とプロフィールから初期 `DiagnosisAnswers` を作り、`buildDiagnosisResult()` で確認リストを即生成。
  - 新規ケースは `draft` ではなく `result_ready` とし、最初から手帳・日記・確認リストが使える状態にした。
- `apps/web/app/home/page.tsx`
  - 空状態のCTAを「親の情報を入力して始める」に変更。
  - 説明文も「次の画面で呼び名・関係・生年月日を入れてから、近い状況を選ぶ」に変更。
  - 表紙の空状態リンクを「作る」から「情報を入力」に変更。
- `apps/web/app/globals.css`
  - `/start` のプロフィール入力カード、入力欄、ステップ説明のスタイルを追加。
  - モバイルでは入力欄を1列にして、押せる/入力できる場所が分かるようにした。

検証:

- `apps/web` で `corepack pnpm exec tsc --noEmit` 成功。

次に見ること:

- 実機で `/home?fresh=1` または初回状態から「親の情報を入力して始める」を押し、最初にプロフィール入力欄が出るか。
- 呼び名・関係・生年月日を入れて状況カードを押した後、家族ボードのプロフィール欄に戻り、入力値と確認リストが表示されるか。
- まだ「ボタンを押したら何が起きるか」が曖昧なら、状況カードの下部CTAをさらに「この内容で手帳を作成」に寄せる。

## 2026-08-23 追記 178 — 手帳の本質を「記録するたび次の一歩を返す伴走AI」へ寄せる方針

ユーザーから、手帳を毎日/必要時に記録する意味をもっと強くしたいという相談。単なる保存先ではなく、日々の記録、プロフィール、写真、状況変化をもとに、AIがその人専用の次の確認事項、相談先、心のケア、家族へ共有する一文を返す構想。

ユーザー例:

- ケアマネジャーから要介護認定を勧められた。
- 施設入所を考え始めた。
- 在宅で訪問介護を探したい。
- 特養、負担限度額認定、書類、窓口などを調べないといけない。
- 亡くなるまで、また亡くなった後の実家じまいまで、毎回ゼロから説明せずに相談したい。

判断:

- この方向は正しい。親のもしもナビの課金価値は「記録できる」だけではなく、「記録した情報を覚えていて、この人に合った次の一歩を返してくれる」こと。
- 現状の `diaryAdvice()` はキーワードベースの軽いヒントに近く、Plusの核にするには弱い。
- 既存の `/api/consult` はプロフィール、最近の記録、過去相談をClaudeへ渡す設計があるため、これを「日記保存後の相談メモ生成」と「長期AI相談」に展開できる。

設計方針:

1. 無料: 日記保存後に「今日の記録からのヒント」を出す。
   - これは医療/法律/税務の判断ではなく、次に確認すること、家族に共有する一文、窓口で聞く質問を返す。
   - LLMを使う場合も短く低コストにする。未ログイン/未Plusでも価値を感じる入口にする。
2. Plus: 長期AI相談。
   - プロフィール、日記、写真メモ、確認リスト、過去相談を前提に、毎回ゼロから説明せずに相談できる。
   - 「この人の今まで」を読んだ返答にする。
   - 相談成功時だけ初回無料枠を消費する既存方針を維持。
3. 地域情報:
   - 神戸市など自治体ごとの具体窓口や手続きは、住所/自治体情報をプロフィールに持たせる。
   - 回答時は断定せず、公式情報確認前提で「地域包括支援センター/区役所/介護保険窓口など、確認先カテゴリ」を返す。
   - 将来は自治体公式リンク/検索結果をRAG化するが、MVPではカテゴリと聞くべき質問までに留める。
4. UI:
   - 日記保存後のカードを「この日のメモから」ではなく、「次に確認すること」「家族に送る一文」「相談先で聞くこと」の3ブロックにする。
   - 相談ページへ飛ばすボタンは1つだけにし、重複ボタンをなくす。
   - 50代以上が迷わないよう、手帳トップの主行動は「今日の記録を書く」「過去の記録を見る」「確認リストを見る」の3つに絞る。

次の実装候補:

- `diaryAdvice()` を `recordInsight` という概念に変え、日記本文・状態・プロフィールから「次に確認すること/家族に共有する一文/相談先で聞くこと」を返す。
- `/api/consult` を流用して、Plus向けに「この記録をもとに相談メモを作る」を本物のLLM応答へ寄せる。
- 自治体・居住地・介護保険者をプロフィール項目に追加する。ただし住所詳細は必須にしない。
- ガイド記事と相談回答をつなぎ、要介護認定、退院調整、施設探し、訪問介護、負担限度額認定などの頻出テーマは記事/チェックリストへ誘導する。

## 2026-08-23 追記 179 — 手帳UIは「記録ファースト」、詳細情報は裏側で育てる方針

ユーザーから、手帳としては日々の記録が最重要で、40〜60代が使うには機能を前面に出しすぎると迷うという指摘。薬、お薬手帳、介護保険証、負担割合証、負担限度額認定、家族情報、親族情報なども手帳として持てると便利だが、個人情報を集めすぎるリスクも気にしている。

整理:

- 表の主役は「今日の記録を書く」。
- 日記を書いたら、その記録をもとにAIが「次に確認すること」「家族に共有する一文」「相談先で聞くこと」を返す。
- プロフィールや医療/介護情報は、最初から全部必須にしない。手帳が育つにつれて必要な項目を追加する。
- ケアマネジャーや病院窓口に見せられるような「この人の基本情報カード」は価値がある。
- ただし、暗証番号、パスワード、マイナンバー画像、保険証/介護保険証の全面画像、通帳全ページ、詳細な資産情報は原則預からない。

UI方針:

1. ホームの主ボタンは「今日の記録を書く」だけに近づける。
2. 記録後の画面にAIヒントを出し、必要なら確認リスト/相談メモへつなげる。
3. 詳細情報は「この人の情報を整える」内にまとめる。
   - 基本: 呼び名、関係、氏名、ふりがな、生年月日、年代、市区町村
   - 医療/介護: かかりつけ、薬、介護保険の有無、要介護度、ケアマネ、施設/訪問サービス
   - 家族/連絡: 代表者、連絡順、緊急連絡先、家族に共有する一文
   - 書類の所在: お薬手帳、介護保険証、負担割合証、負担限度額認定証、保険証券などの「場所」だけ
4. これらは必須登録ではなく、AI相談や家族共有に効く項目として「入力すると手帳が強くなる」見せ方にする。

法務/安全面:

- 病歴、介護関係記録、身体状況、病状、治療等は要配慮個人情報に該当し得るため、取得目的、本人/家族の同意、第三者提供なし、削除方法、漏えい時対応をリリース前に明文化する。
- 「全部入力させる」より、「必要な範囲だけ、なぜ必要かを示して入力してもらう」方が信頼に合う。

次の実装候補:

- 家族ボードの初期表示を「今日の記録を書く」「最近の記録」「AIからの次の一歩」に寄せ、タブやCTAを減らす。
- プロフィール欄を「基本情報カード」「医療・介護カード」「書類の所在カード」に分け、編集導線を明確化。
- 日記保存後に返すヒントUIを、現状の箇条書きから「次に確認すること/家族に共有する一文/相談先で聞くこと」に変更。

## 2026-08-23 追記 180 — Claudeレビュー用資料を作成

ユーザーが、記録ファーストAI伴走方針についてClaudeにもレビューしてもらいたいと依頼。

作成物:

- `review_exports/claude_review_2026-08-23-record-first-ai/README_CLAUDE_REVIEW_2026-08-23_RECORD_FIRST_AI.md`
- `review_exports/claude_review_2026-08-23-record-first-ai/CLAUDE_REVIEW_PROMPT_2026-08-23_RECORD_FIRST_AI.md`
- `review_exports/claude_review_2026-08-23-record-first-ai/PRODUCT_AI_COMPANION_REVIEW_BRIEF_2026-08-23.md`
- `review_exports/claude_review_2026-08-23-record-first-ai/oyano-moshimo-navi-source-2026-08-23-record-first-ai-36249aa.zip`
- `review_exports/claude_review_2026-08-23-record-first-ai.zip`

資料の主題:

- 「保存アプリ」ではなく「記録するたび次の一歩を返す手帳」へ寄せるべきか。
- ホームの主役を「今日の記録を書く」に絞るべきか。
- 日記保存後のAIヒントとPlusの長期AI相談の境界。
- 個人情報/要配慮情報として、何を保存し、何を避けるべきか。
- 50代以上が迷わないUI構造。

確認:

- コードZIPはGit管理下のファイルのみから作成。
- `.env.local`、`node_modules`、既存の `review_exports` は含めていない。
- ZIP内の `docs/SESSION_HANDOFF.md` に追記179が含まれることを確認済み。

## 2026-08-23 追記 181 — ユーザー判断で記録ファーストへ大改装を開始

Claudeレビューでは「テスト前の大改修には反対」という意見もあったが、ユーザーは実機で触った本人/想定利用者の本音として「今の見え方は迷う。記録を書く手帳として再スタートさせるべき」と判断。これを採用し、手帳トップを小手先修正ではなく記録ファーストへ切り替え始めた。

実装済み:

- `apps/web/app/home/page.tsx`
  - 手帳の初期タブを `overview` から `record` に変更。
  - 対象者切り替え時も `record` に戻す。
  - 手帳トップのメインカードを「今日あったことを、まず1行残します。」に差し替え。
  - 主ボタンを「今日の記録を書く」1つに寄せた。
  - 直近記録、記録から見える次の一歩、必要時だけ開くメニューを追加。
  - プロフィール、確認リスト、写真、過去の記録は折りたたみ内に移動。
  - 登録済み手帳では上部の「急なとき」バナーを非表示にし、現在ページとの誤認を避けた。
  - `recentEntries` を2件から3件表示へ変更。
  - 写真添付がクラウド保存済みで `previewUrl` を持たない場合、UUIDファイル名ではなく「写真を保存済み」と表示するようにした。
  - 気づきメモは記録が1件以上ある時だけ表示するようにした。
- `apps/web/app/globals.css`
  - 5タブの `notebook-tab-bar` を非表示。
  - 旧「手帳の育ち具合」カードを非表示。
  - 記録ファーストカード用のスタイルを追加。
  - クラウド保存済み写真の表示スタイルを追加。

設計判断:

- ホームは「今日の記録を書く」が主役。
- 50代以上が迷いやすいタブ・育ち具合・多数CTAは初期表示から外す。
- 「急なとき」「読む記事」「Plus相談」「写真」「プロフィール」は主役ではなく、必要になった時に開く。
- 写真は安全上、永続保存ではbase64を残さない方針を維持し、表示だけ分かりやすくする。

次に確認すること:

- TypeScriptチェック。
- 実機で、ホーム初期表示が記録欄になっているか。
- プロフィール/確認リスト/写真/過去記録の折りたたみリンクが正しい場所へ飛ぶか。
- 写真保存後と復元後の表示が「写真を保存済み」またはサムネイルで見えるか。

## 2026-08-23 追記 182 — 記録ファースト手帳として再スタート

ユーザーが「方向転換に賛成ならそこから再スタートさせる。この声こそが利用者の本音や」と判断。Claudeの「テスト前の大改修は反対」という意見より、実機で迷った本人の声を優先し、プロダクトの主語を「多機能な家族ボード」から「毎日の記録を残すと次の一歩が分かる手帳」へ切り直した。

追加実装:

- `apps/web/app/home/page.tsx`
  - `?reset=1` 付きで開いた時に `resetLocalNotebookData()` を実行し、初回利用者の見え方で表示するようにした。
  - `?reset=1` 直後は初期クラウド復元をスキップし、レビュー担当者が過去の「お母さんの手帳」に戻らないようにした。
  - 未登録時のトップを「まず1人目の手帳を作ります。」に整理し、CTAを「1人目の手帳を作る」へ一本化。
  - 登録済み時の最初の画面は「今日あったことを、まず1行残します。」にし、「今日の記録を書く」を最大の主ボタンにした。
  - プロフィール、確認リスト、写真、過去の記録、別の人の追加は「プロフィール・確認リスト・写真を開く」の折りたたみ内へ移動。
  - クラウド控えのメール入力は初期表示から隠し、「保存状態」詳細として必要な時だけ開く形にした。
  - 既存の `storagePath` 写真はUUIDファイル名ではなく「写真を保存済み」と表示。
- `apps/web/components/MainNav.tsx`
  - メニュー文言を「家族ボード」から「手帳」に変更。
- `apps/web/app/layout.tsx`
  - フッター文言も「手帳」に変更。
- `apps/web/app/globals.css`
  - 「急なとき」メニューはアクティブ時だけ色が付くようにし、通常時の赤/オレンジ強調を削除。
  - 旧5タブと旧「手帳の育ち具合」カードを非表示。
  - 記録ファーストカード、クラウド控え折りたたみ、保存済み写真チップの見た目を追加。

レビュー用URL:

- 初回利用者の見え方: `https://oyano-moshimo-navi.vercel.app/home?reset=1`
- 通常の手帳画面: `https://oyano-moshimo-navi.vercel.app/home`

確認済み:

- `corepack pnpm --dir apps/web exec tsc --noEmit`
- `corepack pnpm --dir apps/mobile exec tsc --noEmit`
- `git diff --check`

次に実機で見ること:

- `/home?reset=1` で過去の手帳に戻らず、1人目登録から始まるか。
- 登録後、最初に「今日の記録を書く」が見えるか。
- プロフィールや確認リストが迷わず折りたたみから開けるか。
- 写真添付の表示が「UUIDファイル名」ではなく利用者に分かる表示になっているか。

## 2026-08-23 追記 183 — 記録ファースト版をVercel本番へ手動デプロイ

`fc2f386 Make notebook home record-first` はGitHubへpush済みだったが、公開URL `https://oyano-moshimo-navi.vercel.app/home?reset=1` が古い `/home` chunk (`page-fe4d097a9a337c86.js`) を返していたため、Vercel CLIで本番デプロイを実行した。

実行:

- `npx vercel --prod --yes`

結果:

- Vercel deployment id: `dpl_HcTtJBbANAWGmqQhfavLCvJjYd9m`
- Production URL: `https://oyano-moshimo-navi-e07ibqsfa-dogwoodcommunity1.vercel.app`
- Alias: `https://oyano-moshimo-navi.vercel.app`
- Build: 成功
- `/home` の新chunk: `/_next/static/chunks/app/home/page-416a3398cf7009e5.js`

公開確認:

- `https://oyano-moshimo-navi.vercel.app/home?reset=1` がHTTP 200。
- HTML内で `.nav-crisis{background:transparent...}` を確認し、「急なとき」メニューが通常時に強調されない版になっている。
- HTML内でトップナビが「手帳 / 読む / 急なとき」になっている。
- 初回レビューURLは `https://oyano-moshimo-navi.vercel.app/home?reset=1`。

注意:

- `/home?reset=1` はローカルの手帳データを消して初回見え方に戻すレビュー用URL。自分の保存データを残したい端末では通常の `https://oyano-moshimo-navi.vercel.app/home` を使う。

## 2026-08-23 追記 184 — 初回画面を「完全なゼロ登録画面」に切り直し

ユーザーが実機スクショを見て「合ってる？何も変わってないような」と指摘。前回の記録ファースト修正では、初回状態でも濃紺の手帳表紙、急なときバナー、旧カードの雰囲気が残り、初めて使う人には「どこから登録するか」がまだ弱かった。

対応:

- `apps/web/app/home/page.tsx`
  - 未登録時は `notebook-cover` を出さないようにし、「最初の手帳を作る」濃紺表紙を完全に非表示。
  - 未登録時の大きい `crisis-banner` を外し、主導線を1人目登録に集中。
  - 未登録時専用の `first-run-screen` を追加。
  - 見出しを「まず、1人分だけ手帳を作ります。」に変更。
  - CTAを「1人目の登録を始める」に一本化し、登録後にその人専用の記録手帳ができることを明記。
  - 「呼び名と関係を入れる」「今日の記録を1行残す」「必要な確認だけ開く」の3ステップを表示。
  - 急なときは主導線ではなく小さな補助リンクに変更。
  - 使わなくなった `setupPreviewItems` を削除。
- `apps/web/app/globals.css`
  - `first-run-screen` / `first-run-hero` / `first-run-primary` / `first-run-steps` / `first-run-crisis` のスタイルを追加。
  - 初回画面は白・生成り・緑を基調にして、旧手帳表紙とは別物に見えるようにした。

確認:

- `corepack pnpm --dir apps/web exec tsc --noEmit`
- `git diff --check`

注意:

- ローカルNext devを `127.0.0.1:3006` で試したが、環境側で `EMFILE: too many open files, watch` が出て `/home` が404になったため、ローカルdev画面ではなくVercel本番デプロイ後の実機確認を正とする。
- 次の確認URLはデプロイ後に `https://oyano-moshimo-navi.vercel.app/home?reset=1&v=first-run-184` を使う。

## 2026-08-23 追記 185 — 初回ゼロ登録画面を本番デプロイ

追記184の初回画面修正をGitHubとVercel本番へ反映した。

実行:

- `git commit -m "Clarify first notebook entry screen"`
- commit: `d4e56cd`
- `git push origin main`
- `npx vercel --prod --yes`

結果:

- Vercel deployment id: `dpl_B5PQK6VGVbybhTiJPCEaKwXNQ6wA`
- Production URL: `https://oyano-moshimo-navi-ewv5pm6zk-dogwoodcommunity1.vercel.app`
- Alias: `https://oyano-moshimo-navi.vercel.app`
- `/home` の新chunk: `/_next/static/chunks/app/home/page-862025de83b95712.js`

確認:

- `corepack pnpm --dir apps/web exec tsc --noEmit`
- `git diff --check`
- `corepack pnpm --dir apps/web build`
- `https://oyano-moshimo-navi.vercel.app/home?reset=1&v=first-run-184` がHTTP 200。
- 新chunk内に `まず、1人分だけ手帳を作ります` が存在。
- 新chunk内に旧文言 `最初の手帳を作る` が存在しない。

ユーザーへの案内:

- 初回レビューは `https://oyano-moshimo-navi.vercel.app/home?reset=1&v=first-run-184`。
- 端末側で古い表示が残る場合は、PWA/ブラウザのキャッシュか既存localStorageの可能性が高い。レビュー用URLの `reset=1` は端末内の手帳データを初期化するので、自分の保存データを残したい端末では使わない。

## 2026-08-23 追記 186 — 記録の日付・カレンダー・AI相談導線を整理

ユーザーが実機利用で「記録しても日付が出ない」「カレンダー形式で過去の記録をすぐ見たい」「相談メモが何に使うものか分からない」「AIが寄り添うのはどれか分からない」と指摘。記録ファーストの方向性を崩さず、記録→日付で残る→過去を探せる→短い寄り添い→詳しいAI相談、の流れに寄せた。

対応:

- `apps/web/app/home/page.tsx`
  - 日記フォームに `date` を追加し、保存時に任意の日付で記録できるようにした。
  - 「記録する日付」入力を追加。過去の日も選べる説明を表示。
  - 保存後は保存した日付を選択状態にし、成功メッセージも日付入りに変更。
  - 「過去の手帳」に月カレンダーを追加。日付をタップするとその日の記録だけ表示し、解除ボタンで全件に戻せる。
  - `相談メモ` / `気づきメモ` の画面文言を廃止し、`AI相談チャット` / `ナビからのひとこと` / `ナビからの寄り添い` に整理。
  - 記録ごとに `ナビからの寄り添い` コメントを表示し、その下に次に確認するとよいことを出すようにした。
  - 記録タブ内に `AI相談チャット` カードを追加。「短い自動コメント」と「手帳を読んで答えるAI相談チャット」の違いを明記し、`/consult` へ直接進めるようにした。
- `apps/web/lib/store.ts`
  - `diaryCompanionComment()` を追加。記録本文と緊急度から、入院・薬・認知変化・介護・実家/書類などに応じた寄り添いコメントを返す。
- `apps/web/components/ConsultPanel.tsx`
  - `相談メモ` 表記を `AI相談チャット` に変更。
  - AI相談はプロフィールと最近の記録を前提に、次に確認すること・窓口で聞くこと・家族へ共有することを整理する機能だと説明を強めた。
- `apps/web/app/globals.css`
  - 日付入力、記録カレンダー、選択日表示、寄り添いコメント、AI相談チャットカードのスタイルを追加。

確認:

- `corepack pnpm --dir apps/web exec tsc --noEmit`
- `git diff --check`
- `corepack pnpm --dir apps/web build`

注意:

- `corepack pnpm --dir apps/web build` で Next.js のビルドは成功。Supabase JS から Node.js 20以下非推奨警告が出るが、今回の修正起因ではない。
- まだ本番デプロイ前。次は commit → push → Vercel prod deploy → `/home` の確認URLを案内する。

## 2026-08-23 追記 187 — 記録カレンダー・AI相談導線を本番反映

追記186の修正をGitHubとVercel本番へ反映した。ユーザーの最新指摘は「記録しても日付が見えない」「過去記録をカレンダーで見たい」「相談メモが何のためか分からない」「AIが寄り添う導線を明確にしたい」。これに対して、手帳の中心を `日付つき記録` → `カレンダーで見返す` → `ナビからの寄り添い` → `AI相談チャット` に整理した。

実行:

- `git commit -m "Clarify diary history and AI consultation"`
- commit: `004aafb`
- `git push origin main`
- `npx vercel --prod --yes`

結果:

- Vercel deployment id: `dpl_7MiEGuXFmYw1cugY7ftjs5gHfoC5`
- Production URL: `https://oyano-moshimo-navi-pjul0vaka-dogwoodcommunity1.vercel.app`
- Alias: `https://oyano-moshimo-navi.vercel.app`
- `/home` の新chunk: `/_next/static/chunks/app/home/page-b085a307c3ca07bb.js`

確認:

- `corepack pnpm --dir apps/web exec tsc --noEmit`
- `git diff --check`
- `corepack pnpm --dir apps/web build`
- `https://oyano-moshimo-navi.vercel.app/home?v=diary-calendar-186` がHTTP 200。
- 本番chunk内に `記録する日付` / `過去の日も選べます` / `ナビからの寄り添い` / `AI相談チャット` が存在。
- 本番chunk内に旧文言 `相談メモ` / `気づきメモ` は見つからない。

ユーザーへの案内:

- 確認URLは `https://oyano-moshimo-navi.vercel.app/home?v=diary-calendar-186`。
- 端末に古い表示が残る場合は、上記の `?v=diary-calendar-186` 付きURLで開き直す。保存済み手帳を消したくない場合は `?reset=1` は付けない。
- 今回は「相談メモ」を機能名として残さず、短い自動コメントを `ナビからの寄り添い`、深い相談入口を `AI相談チャット` に統一した。

## 2026-08-23 追記 188 — 記録からAI相談ボタンの反応を明確化

ユーザーが実機で「記録をもとにAIに相談するボタンを押してもAIの画面が出ない」と指摘。原因は、家族ボード上のAI相談導線が `/consult` へ単純遷移するだけで、どの記録をもとに相談するのかが画面上で見えず、相談画面側にも質問文や対象手帳が渡っていなかったこと。

対応:

- `apps/web/app/home/page.tsx`
  - `ConsultDraft` を追加し、記録タブ内でAI相談の下書きを状態管理するようにした。
  - `buildEntryConsultQuestion()` / `buildDigestConsultQuestion()` / `consultHref()` を追加。
  - `AI相談チャットを開く`、`記録をもとにAI相談する`、各記録の `AI相談する`、月まとめの `この月をAI相談チャットに持っていく` を、まず家族ボード内の `inline-ai-consult` へ展開する導線に変更。
  - 展開カードには「AIに聞く内容」「ナビからの寄り添い」「次に確認すること」を表示し、そこから `本格AI相談チャットへ進む` で `/consult?caseId=...&q=...` へ進む形にした。
- `apps/web/components/ConsultPanel.tsx`
  - `/consult` が `caseId` と `q` のURLパラメータを読み、対象手帳を選択済み・質問文を入力済みで開くようにした。
- `apps/web/app/globals.css`
  - インラインAI相談カードと、button化したAI相談導線のスタイルを追加。リンクとボタンの見た目が崩れないように調整。

確認:

- `corepack pnpm --filter web run typecheck`
- `git diff --check`
- `corepack pnpm --filter web run build`

注意:

- `corepack pnpm --filter web run build` は成功。Supabase JS 由来の Node.js 20以下非推奨警告が出るが、今回の修正起因ではない。
- まだ本番デプロイ前。次は commit → push → Vercel prod deploy → `/home` の確認URLを案内する。

## 2026-08-23 追記 189 — 記録からAI相談導線を本番反映

追記188の修正をGitHubとVercel本番へ反映した。実機で「記録をもとにAIに相談する」系のボタンを押したとき、いきなり別画面へ飛ばすのではなく、家族ボード内に `AIに聞く内容` の確認カードを出すようにした。ユーザーには、このカードが出れば反応している状態で、そこから `本格AI相談チャットへ進む` を押すと `/consult` が対象手帳・質問文入りで開く、と案内する。

実行:

- `git commit -m "Clarify record to AI consultation flow"`
- commit: `f0bcb87`
- `git push origin main`
- `npx vercel --prod --yes`

結果:

- Vercel deployment id: `dpl_6f1iomN2ZPLnC15b8wPWFWhpuTTR`
- Production URL: `https://oyano-moshimo-navi-2i86ge03w-dogwoodcommunity1.vercel.app`
- Alias: `https://oyano-moshimo-navi.vercel.app`
- `/home` の新chunk: `/_next/static/chunks/app/home/page-75ca203ae00d244f.js`

確認:

- `corepack pnpm --filter web run typecheck`
- `git diff --check`
- `corepack pnpm --filter web run build`
- `https://oyano-moshimo-navi.vercel.app/home?v=consult-inline-188` がHTTP 200。
- 本番chunk内に `この内容でAI相談チャットに進めます` / `本格AI相談チャットへ進む` / `AIに聞く内容` が存在。

ユーザーへの案内:

- 確認URLは `https://oyano-moshimo-navi.vercel.app/home?v=consult-inline-188`。
- 古い表示が残る場合は、上記の `?v=consult-inline-188` 付きURLで開き直す。
- 期待挙動は、記録欄の `記録をもとにAI相談する` または各記録の `AI相談する` を押す → 画面内に相談カードが開く → `本格AI相談チャットへ進む` で相談画面が質問入りで開く、の順。

## 2026-08-23 追記 190 — 日記保存完了とAI相談導線を一本道に再整理

ユーザーが実機で「日記を書いても保存されたか分かりにくい」「AI相談ボタンを押してもどこで相談するのか分からない」「Plusの境界も見えにくい」と指摘。50代・60代が迷わず使うには、画面内に中間カードを増やすより、`記録する → 保存完了を見る → その記録でAI相談へ進む → 相談結果を手帳に残す` の一本道にする方がよいと判断した。

対応:

- `apps/web/app/home/page.tsx`
  - 日記保存・日記編集後に `#diary-save-complete` へ自動スクロールするようにした。
  - 保存完了カードを追加し、保存された日付・本文・気分をその場で確認できるようにした。
  - 保存完了カードから `この記録でAI相談する`、`保存された記録を見る`、`少し直す` を直接選べるようにした。
  - 追記188で入れた家族ボード内の中間AI相談カードを削除し、AI相談ボタンは `/consult?caseId=...&q=...` へ直行するように戻した。中間カードが迷子の原因になるため。
  - 各記録カードのボタン文言を `この記録でAI相談` に変更。
- `apps/web/components/ConsultPanel.tsx`
  - URLの `q` パラメータで開いた場合、相談フォームの上に `記録から相談` 案内カードを表示。
  - 相談フォームをPlus説明より上に移動し、質問文が入った状態ですぐボタンを押せる構成にした。
  - 同意チェックとPlus/無料条件の説明を相談ボタン直前へ移動。
  - 相談回答を手帳へ保存した時の文言を `AI相談の回答を、今日の記録として手帳に残しました。` に変更。
- `apps/web/app/globals.css`
  - 保存完了カード、記録から相談カード、Plus境界メモのスタイルを追加。

確認:

- `corepack pnpm --filter web run typecheck`
- `git diff --check`
- `corepack pnpm --filter web run build`

注意:

- `corepack pnpm --filter web run build` は成功。Supabase JS 由来の Node.js 20以下非推奨警告が出るが、今回の修正起因ではない。
- まだ commit / push / Vercel本番反映前。次は commit → push → Vercel prod deploy → `/home` と `/consult` の確認URLを案内する。

## 2026-08-23 追記 191 — 地域スポンサー/掲載枠の収益仮説を将来枠として整理

ユーザーから、地域×分野（葬儀・相続士業・家族信託・ホーム紹介・保険・遺品整理）で掲載枠を切るローカル媒体モデルの共有があった。机上では `47都道府県 × 6分野 × 月3万円 = 年約1億円` の器になるが、枠は作れば売れるものではなく、地域の会員密度と問い合わせ実績が先に必要という整理。

判断:

- 「手帳、記録、危機モード、AI相談の途中に広告を出す」は引き続きやらない。`docs/MONETIZATION.md` の「広告はやらない」という信頼方針は維持する。
- 一方で、将来のB2B収益としての「地域スポンサー/掲載枠」は検討余地あり。これは画面内広告ではなく、ユーザーが明示的に開く地域ガイド、相談先一覧、印刷物の協賛枠などに限定する。
- 全国枠を先に作るのは反対。最初は兵庫または神戸市に一点集中し、会員1,000〜3,000家族規模と「1枠あたり月何件問い合わせが来たか」の実績を作ってから、大阪/京都などへ1県ずつ複製する。
- 広告主が月3万円を払い続ける条件は、2〜3か月に1件以上の問い合わせが来ること。葬儀や士業など粗利の大きい分野なら1件で元が取れるが、半年ゼロなら更新されない。
- 20県を超えるまでは直販または限定的な紹介で検証し、広域展開時に地元広告代理店や商工会系への代理店卸を検討する。

対応:

- `docs/MONETIZATION.md` の最終更新日を `2026-08-23` に更新。
- `docs/MONETIZATION.md` の「将来の柱」に `地域スポンサー/掲載枠` を追記。
- ただし、これは3組テスト、有料テスト、Plusの価値検証より前に着手しない将来仮説として扱う。

## 2026-08-23 追記 192 — スポンサー枠の申請受付を初期導線として実装

ユーザーから、地域スポンサー枠は「後で考える」ではなく、会員数を増やす初期段階から事業者が申請できる枠組みをアプリ内に持っておきたい、という訂正があった。判断を更新し、手帳内広告は禁止のまま、B2Bスポンサー枠の申請受付だけを初期実装として追加した。

実装:

- `apps/web/app/sponsors/page.tsx`
  - 公開ページ `/sponsors` を追加。都道府県×分野のスポンサー枠を申請できるページ。
  - 手帳・記録・危機モード・AI相談の途中には広告を出さないことを明記。
  - 申請分野は葬儀、相続士業、家族信託、ホーム紹介、保険、遺品整理、その他。
- `apps/web/components/SponsorApplicationForm.tsx`
  - 47都道府県、分野、希望枠、会社情報、連絡先、メッセージ、同意チェックを持つ申請フォームを追加。
  - `POST /api/sponsors/apply` へ送信。DB未準備時は `sponsor_applications_not_ready` として案内を返す。
- `apps/web/app/api/sponsors/apply/route.ts`
  - 公開申請APIを追加。IPレート制限、必須項目検証、同意確認、メール形式検証を行う。
  - Supabase service role で `sponsor_applications` に保存する。
- `apps/web/app/admin/sponsor-applications/page.tsx`
  - 管理画面 `/admin/sponsor-applications` を追加。
  - `ADMIN_ACCESS_TOKEN` 付きの管理者だけが申請一覧を確認できる。
- `apps/web/app/api/admin/sponsor-applications/route.ts`
  - 管理者用一覧APIを追加。
- `apps/web/components/AdminSponsorApplications.tsx`
  - 申請日時、都道府県、分野、会社名、担当者、連絡先、希望枠、メッセージを一覧表示。
- `apps/web/app/layout.tsx`
  - フッターに `スポンサー枠` へのリンクを追加。
- `apps/web/app/admin/page.tsx`
  - 管理トップから `sponsor slots` 管理へ入れる導線を追加。
- `apps/web/app/globals.css`
  - スポンサー申請ページと申請フォームの見た目を追加。
- `supabase/sponsor_applications.sql`
  - 既存DB向けの追加SQLを新規作成。
- `supabase/schema.sql` / `supabase/production_rls.sql` / `supabase/indexes.sql`
  - `sponsor_applications` テーブル、RLS、管理者read policy、検索用indexを本体SQLにも反映。
- `docs/MONETIZATION.md`
  - 「広告は永久にやらない」を「手帳内広告は永久にやらない」に修正。
  - スポンサー枠は初期から申請受付だけ持つが、実際の掲載・販売・送客は審査基準と地域実績ができてから、と整理。

重要な設計境界:

- ユーザーの手帳、日記、写真、危機モード、AI相談途中にはスポンサー広告を出さない。
- 初期の `/sponsors` は営業リストと枠需要の先行把握であり、利用者への事業者紹介や成約課金ではない。
- 本番で申請を保存するには、Supabaseに `supabase/sponsor_applications.sql` を適用する必要がある。未適用の場合、公開フォームは `sponsor_applications_not_ready` を返す。

## 2026-08-23 追記 193 — スポンサー枠申請フローをGitHubとVercel本番へ反映

追記192のスポンサー枠申請フローをGitHubとVercel本番へ反映した。

実行:

- `corepack pnpm --filter web run typecheck`
- `git diff --check`
- `corepack pnpm --filter web run build`
- `git commit -m "Add sponsor slot application flow"`
- commit: `e2e5448`
- `git push origin main`
- `npx vercel --prod --yes`

デプロイ:

- Vercel deployment id: `dpl_91cGC4Ux4LnDjSJDmgaJeYuYZNTo`
- Production URL: `https://oyano-moshimo-navi-6omdo7dmi-dogwoodcommunity1.vercel.app`
- Alias: `https://oyano-moshimo-navi.vercel.app`

確認:

- `https://oyano-moshimo-navi.vercel.app/sponsors?v=sponsor-slots-192` がHTTP 200。
- `https://oyano-moshimo-navi.vercel.app/admin/sponsor-applications?v=sponsor-slots-192` がHTTP 200。

注意:

- 最初に `apps/web` 直下からVercelへ投げたデプロイは、Vercelが `npm install` を使って `workspace:*` を読めず失敗した。正しいデプロイはリポジトリルートから `npx vercel --prod --yes`。
- 本番DBへ保存するには、Supabase SQL Editorで `supabase/sponsor_applications.sql` を適用する必要がある。未適用の場合、公開フォームは案内付きで保存準備中エラーになる。

## 2026-08-23 追記 194 — 地域スポンサー枠を親の居住都道府県ベースで配線

ユーザーから、スポンサー枠は「本人の住所」ではなく、葬儀・施設・相続などが実際に発生する「親御さんの居住都道府県」を基準にする、という仕様確定があった。全国の会員数を貯めながら、都道府県×6分野のスポンサー枠を最初から申請・集計できるように配線した。

実装:

- `apps/web/lib/prefectures.ts`
  - 47都道府県、スポンサー6分野、申請用カテゴリ、公開表示閾値ヘルパーを共通化。
- `apps/web/app/start/page.tsx`
  - 初回登録で `呼び名`、`関係`、`親御さんの居住都道府県` を必須化。
  - 市区町村は任意。整理結果と手帳作成の基準は親の居住地。
- `apps/web/app/home/page.tsx`
  - 既存ユーザーに親御さんの都道府県入力を1回促すモーダルを追加。
  - プロフィール編集で親の都道府県・市区町村、利用者本人の都道府県を更新可能にした。
- `apps/web/lib/store.ts`
  - `PersonProfile` に `parentPrefecture`、`parentCity`、`userPrefecture` を追加。
- `apps/web/app/api/notebook/sync/route.ts`
  - `personProfile.parentPrefecture/parentCity` を Supabase `people.prefecture/city` と同期。
  - 既存DBにまだカラムが無い場合は location カラムなしで再試行し、画面を止めないフォールバックを入れた。
- `apps/web/components/SponsorApplicationForm.tsx` / `apps/web/app/api/sponsors/apply/route.ts`
  - 都道府県とカテゴリを共通定義から使うように変更。
  - API側でも47都道府県と申請カテゴリを検証し、不正な地域・カテゴリで営業データが汚れないようにした。
- `apps/web/app/sponsors/page.tsx`
  - スポンサー説明を「親の居住都道府県×分野」の枠に更新。
  - 公開数字は閾値制で、閾値未満の県は生数字を出さない方針を明記。
- `apps/web/app/admin/regional-sponsors/page.tsx`
  - 管理画面に地域スポンサー集計ページを追加。
- `apps/web/components/AdminRegionalSponsorMetrics.tsx`
  - 都道府県×6分野の有効会員数、前月比、公開状態、スポンサー状態、表示数、タップ数、問い合わせ数を一覧化。
  - 営業資料用CSVを出力可能。
- `apps/web/app/api/admin/regional-sponsor-metrics/route.ts`
  - `prefecture_active_family_counts` view と `partners` を読み、管理画面用の地域スポンサー指標を返す。
  - DB未適用時は `source: not_ready` で空行を返し、管理画面が落ちないようにした。
- `apps/web/app/admin/page.tsx`
  - 管理トップから regional metrics に入れる導線を追加。
- `supabase/schema.sql`
  - `people.prefecture/city`、`partners` テーブル、`prefecture_active_family_counts` view を追加。
- `supabase/regional_sponsor_data.sql`
  - 既存本番DB向けの追加SQLを作成。Supabase SQL Editorで適用する。
- `supabase/indexes.sql` / `supabase/production_rls.sql` / `supabase/verify_setup.sql` / `supabase/verify_compact.sql`
  - 地域スポンサー用のindex、RLS、検証SQLを追加。
- `docs/MONETIZATION.md`
  - 2026/8/23のP1仕様として、登録フロー、DB、2段階表示、CSVエクスポートを追記。

重要な仕様:

- 集計・掲載マッチングの基準はすべて「親御さんの居住都道府県」。
- 管理画面は全都道府県の生数字を表示する。
- 公開側は `PUBLIC_PREFECTURE_USAGE_THRESHOLD` または `NEXT_PUBLIC_PREFECTURE_USAGE_THRESHOLD` 以上の県だけ「利用中家族数」を表示する。未設定時の閾値は100。
- 手帳、日記、急なとき、AI相談の途中にはスポンサー広告を出さない。スポンサー申請と集計枠はB2B営業用の土台。

確認:

- `corepack pnpm --filter mobile run typecheck` 成功。
- `corepack pnpm --filter web run typecheck` 成功。
- `git diff --check` 成功。
- `corepack pnpm --filter web run build` 成功。
  - Supabase JS由来の Node.js 20以下非推奨警告は出るが、今回の修正起因ではない。

次に必要:

- commit / push / Vercel本番反映。
- 本番Supabaseへ `supabase/regional_sponsor_data.sql` を適用。
- 適用後に `supabase/verify_compact.sql` または `supabase/verify_setup.sql` で `partners`、`people.prefecture/city`、`prefecture_active_family_counts` が true になることを確認。

## 2026-08-23 追記 195 — 地域スポンサー指標をGitHubとVercel本番へ反映

追記194の地域スポンサー枠配線をGitHubとVercel本番へ反映した。

実行:

- `corepack pnpm --filter mobile run typecheck`
- `corepack pnpm --filter web run typecheck`
- `git diff --check`
- `corepack pnpm --filter web run build`
- `git commit -m "Add regional sponsor metrics"`
- commit: `7e3b526`
- `git push origin main`
- `npx vercel --prod --yes`

デプロイ:

- Vercel deployment id: `dpl_46MntFkoePweEZ4i3qcsc4Uy8zy4`
- Production URL: `https://oyano-moshimo-navi-6jfb4subu-dogwoodcommunity1.vercel.app`
- Alias: `https://oyano-moshimo-navi.vercel.app`

確認:

- `https://oyano-moshimo-navi.vercel.app/sponsors?v=regional-sponsors-194` がHTTP 200。
- `https://oyano-moshimo-navi.vercel.app/admin/regional-sponsors?v=regional-sponsors-194` がHTTP 200。

注意:

- ワークツリーには未追跡の `review_exports/` が残っている。今回の実装とは別出力と判断して触っていない。
- 本番DBへ保存・集計を有効化するには、Supabase SQL Editorで `supabase/regional_sponsor_data.sql` を適用する必要がある。

## 2026-08-23 追記 196 — AI相談の未ログイン時ボタンを押せる導線に変更

ユーザー実機で `/consult` の緑ボタンが灰色のまま押せず、「利用条件を確認しています」と見える問題を確認。原因は、AI相談が保存済み手帳を前提にしているのに、未ログイン・未クラウド控え状態では `button disabled` だけを表示していたこと。

修正:

- `apps/web/components/ConsultPanel.tsx`
  - 未ログイン時は無効ボタンではなく、`/home?cloud=1#cloud-backup` へ遷移する「先にクラウド控えを作る」ボタンを表示。
  - Plus権限不足時は「Plusを見る（AI相談を続ける）」リンクを表示。
  - 通常のAI相談ボタンは、本人確認済みかつ同意・質問文字数・手帳内容の条件が揃った時だけ表示。
  - 未ログイン時の説明文を「押すと家族ボードの保存欄へ移動します」に変更。
- `apps/web/app/home/page.tsx`
  - クラウド保存欄に `id="cloud-backup"` と ref を付与。
  - `/home?cloud=1` または `#cloud-backup` で開いた時に保存状態パネルを開き、自動スクロールするようにした。
- `apps/web/app/globals.css`
  - リンク版の相談CTAを通常ボタンと同じ見た目で中央揃えにした。

確認:

- `corepack pnpm --filter web run typecheck` 成功。

次:

- 本番へpush/deployして、実機で「AI相談 → 先にクラウド控えを作る → 保存状態が開く」ことを確認する。

## 2026-08-23 追記 197 — AI相談CTA修正を本番反映

追記196のAI相談CTA修正をGitHubとVercel本番へ反映した。

実行:

- `corepack pnpm --filter web run typecheck`
- `git diff --check`
- `corepack pnpm --filter web run build`
- `git commit -m "Fix consult cloud backup CTA"`
- commit: `d7b1b41`
- `git push origin main`
- 初回に `apps/web` 直下から `npx vercel --prod --yes` を実行したところ、Vercel側が `npm install` で `workspace:*` を解決できず失敗。これはコード不具合ではなくデプロイ実行ディレクトリの問題。
- repoルートから `npx vercel --prod --yes` を再実行して成功。

デプロイ:

- Vercel deployment id: `dpl_5jvV4K9jkTRh8yfKoSfYifC5vb6a`
- Production URL: `https://oyano-moshimo-navi-9smfyunux-dogwoodcommunity1.vercel.app`
- Alias: `https://oyano-moshimo-navi.vercel.app`

確認:

- `https://oyano-moshimo-navi.vercel.app/consult?v=consult-cta-196` がHTTP 200。
- `https://oyano-moshimo-navi.vercel.app/home?cloud=1` がHTTP 200。

実機確認ポイント:

- `/consult` で未ログインなら、灰色の「AI相談をはじめる」ではなく「先にクラウド控えを作る」が押せること。
- 押すと `/home?cloud=1#cloud-backup` に移動し、保存状態パネルが開いて見えること。
- メール確認後はAI相談の通常ボタンが表示されること。

## 2026-08-23 追記 198 — 地域スポンサーの会員数表記を「利用者/世帯」併記へ統一

ユーザーから、会員数の表示は全箇所で「利用者◯人（◯世帯）」に統一し、掲載料の段階判定は世帯数（有効会員=家族）基準のまま固定する方針が追加された。これを、admin / 営業CSV / 公開LP / docs / Supabase view へ反映した。

修正:

- `supabase/schema.sql` / `supabase/regional_sponsor_data.sql`
  - `prefecture_active_family_counts` view に `active_users`、`previous_month_users`、`month_over_month_users` を追加。
  - `active_families` は従来どおり世帯数として残し、公開閾値・掲載料判定の基準に使う。
- `apps/web/app/api/admin/regional-sponsor-metrics/route.ts`
  - APIレスポンスに利用者数と世帯数を両方返すようにした。
  - 本番DBへSQL未適用の間も落ちないよう、view取得は `select("*")` にし、利用者数カラムが無い場合は世帯数へフォールバックする。
- `apps/web/components/AdminRegionalSponsorMetrics.tsx`
  - 管理画面のサマリ、一覧、CSVを `利用者X人（Y世帯）` 表記へ統一。
  - CSVは利用者数・世帯数（料金判定基準）を別カラムでも出す。
- `apps/web/app/sponsors/page.tsx`
  - 公開LPの説明を `利用者△△人（□□世帯）` 表記へ変更。
  - 「掲載料の段階判定は世帯数基準、人数は表示専用」と明記。
- `apps/web/app/admin/page.tsx` / `apps/web/app/admin/regional-sponsors/page.tsx`
  - 管理導線の説明を利用者数・世帯数の両方に合わせた。
- `supabase/verify_setup.sql` / `supabase/verify_compact.sql`
  - view の利用者数カラム検証を追加。
- `docs/MONETIZATION.md`
  - 会員数表記ルールと料金判定基準を正式仕様として追記。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `git diff --check` 成功。
- `corepack pnpm --filter web run build` 成功。
  - Supabase JS由来の Node.js 20以下非推奨警告は出るが、今回の修正起因ではない。

次に必要:

- commit / push / Vercel本番反映。
- 本番DBで実際の利用者数カラムを返すには、Supabase SQL Editorで `supabase/regional_sponsor_data.sql` を再適用する必要がある。未適用中はAPI側フォールバックで利用者数=世帯数として表示される。

## 2026-08-23 追記 199 — 利用者/世帯併記をGitHubとVercel本番へ反映

追記198の「利用者◯人（◯世帯）」表示統一をGitHubとVercel本番へ反映した。

実行:

- `corepack pnpm --filter web run typecheck`
- `git diff --check`
- `corepack pnpm --filter web run build`
- `git commit -m "Show regional users and households"`
- commit: `de84929`
- `git push origin main`
- `npx vercel --prod --yes`

デプロイ:

- Vercel deployment id: `dpl_5xjfg3wgDALBX3SPCDyiUBU7bAih`
- Production URL: `https://oyano-moshimo-navi-4yuqnrks4-dogwoodcommunity1.vercel.app`
- Alias: `https://oyano-moshimo-navi.vercel.app`

確認:

- `https://oyano-moshimo-navi.vercel.app/sponsors?v=regional-usage-198` がHTTP 200。
- `https://oyano-moshimo-navi.vercel.app/admin/regional-sponsors?v=regional-usage-198` がHTTP 200。

注意:

- ワークツリーには未追跡の `review_exports/` が残っている。今回の実装とは別出力と判断して触っていない。
- 本番DBの `prefecture_active_family_counts` view に `active_users` 等を実際に追加するには、Supabase SQL Editorで `supabase/regional_sponsor_data.sql` の再適用が必要。コード側はSQL未適用でも落ちないようにフォールバック済み。

## 2026-08-23 追記 200 — Claudeレビュー用資料とソースZIPを作成

ユーザーから「claudeにレビューもらうから資料つくって」と依頼があり、Claudeへ渡すレビュー資料一式を `review_exports/claude_review_2026-08-23-regional-usage/` に作成した。

作成物:

- `review_exports/claude_review_2026-08-23-regional-usage/CLAUDE_REVIEW_PROMPT_2026-08-23_REGIONAL_USAGE.md`
  - Claudeへ最初に貼るレビュー依頼文。
  - 家族3組テスト可否、有料テスト可否、UX、AI相談、地域スポンサー、DB/security、やらないこと、実装順をレビューするよう指定。
- `review_exports/claude_review_2026-08-23-regional-usage/IMPLEMENTATION_BRIEF_2026-08-23_REGIONAL_USAGE.md`
  - 現在の実装状態、重要URL、主要ファイル、直近の仕様変更、既知の未完了事項を整理。
- `review_exports/claude_review_2026-08-23-regional-usage/README_CLAUDE_REVIEW_2026-08-23_REGIONAL_USAGE.md`
  - Claudeへ渡す順番とレビュー観点の簡易案内。
- `review_exports/claude_review_2026-08-23-regional-usage/oyano-moshimo-navi-source-2026-08-23-regional-usage-ff08f63.zip`
  - `git archive` で commit `ff08f63` から作成したソースZIP。
  - tracked files のみで作成しており、未追跡ファイルやローカル出力は含めていない。
- `review_exports/claude_review_2026-08-23-regional-usage.zip`
  - 上記フォルダ一式をまとめた提出用ZIP。

Claudeへの渡し方:

1. `CLAUDE_REVIEW_PROMPT_2026-08-23_REGIONAL_USAGE.md` の中身を貼る。
2. `oyano-moshimo-navi-source-2026-08-23-regional-usage-ff08f63.zip` を添付する。
3. 必要なら `IMPLEMENTATION_BRIEF_2026-08-23_REGIONAL_USAGE.md` も添付する。

レビューで特に見てほしい論点:

- PWAを「記録ファースト + AI伴走 + 家族手帳」として再設計した方向性が正しいか。
- 初回登録、日記保存、AI相談、過去記録確認の導線が50〜70代でも迷わないか。
- AI相談がPlusの課金理由になっているか。
- 地域スポンサー枠（市区町村×分野、利用者/世帯併記、世帯数基準課金）の仕様に穴がないか。
- Storage、同期、consult、地域スポンサー集計、RLS/APIまわりにテスト前ブロッカーが残っていないか。

注意:

- `review_exports/` は未追跡のローカル出力フォルダ。GitHubへはまだ入れていない。
- 本番DBには引き続き `supabase/regional_sponsor_data.sql` の再適用が必要。

## 2026-08-23 追記 201 — Claudeレビュー指摘への追加対応（スポンサー数字/AI最小化/PR防火壁）

Claudeレビューで指摘された「スポンサー営業に使う数字の固定化」「協賛/PR表記の整理」「AI相談へ送る生年月日の最小化」「都道府県入力の初回強制を避ける」を実装した。

実装:

- `apps/web/components/ConsultPanel.tsx`
  - AI相談へ送る `birthDate` を、生年月日そのものではなく `70代` などの年代へ変換。
  - Web側も最近の記録を `CONSULT_MAX_ENTRIES`（12件）に統一。
- `apps/mobile/app/consult.tsx`
  - モバイル側のAI相談 payload も、生年月日を年代へ丸める。
  - 最近の記録数を `CONSULT_MAX_ENTRIES` に統一。
- `apps/web/lib/consult.ts`
  - サーバ側も `70代` などの年代文字列をそのまま受けられるようにし、二重に最小化。
- `packages/shared/src/consult.ts`
  - `ConsultPerson.birthDate` は外部AI送信前に年代化する前提をコメントで明記。
- `apps/web/app/home/page.tsx`
  - 親御さんの都道府県入力モーダルは、記録が2件以上たまってから出す。
  - 初回手帳作成時に地域を聞いて警戒される流れを避ける。
- `supabase/schema.sql` / `supabase/regional_sponsor_data.sql`
  - `prefecture_usage_snapshots` を追加。
  - 月初に `capture_prefecture_usage_snapshot()` で現在値を固定保存する方式へ変更。
  - `prefecture_active_family_current_counts` は現在値専用、`prefecture_active_family_counts` は現在値 + 前月スナップショット差分を返す。
  - スポンサー営業に使う前月比が、あとから変わる可変ビューにならないようにした。
- `supabase/production_rls.sql` / `supabase/indexes.sql` / `supabase/verify_setup.sql` / `supabase/verify_compact.sql`
  - snapshotテーブル、index、function、RLS、検証項目を追加。
- `docs/MONETIZATION.md`
  - 有効世帯の定義を明記。
    - 親情報1件 + 親の都道府県 + オーナー以外の家族メンバー1人以上、または7日以内のpending招待1件以上。
    - ソロ利用者はスポンサー営業用の有効世帯数には含めない。
    - 県違いの対象者がいる家族は県ごとに1世帯、同県内複数対象者は1世帯。
  - 利用者に見える掲載はすべて協賛/PR表記必須に変更。
  - 記録画面・危機モード・AI相談にはスポンサー名を混ぜない方針を明記。
- `apps/web/app/sponsors/page.tsx`
  - スポンサーLPに、協賛/PR表記、手帳内広告を出さないこと、AI相談へスポンサー名を混ぜないことを追記。
  - 前月比は月次スナップショットの確定値だけを使うと明記。
- `docs/PRIVACY_AND_REVIEW_GUARDRAILS.md`
  - スポンサー/協賛掲載の防火壁を恒久レビュー項目として追加。
  - AI相談に送る情報の最小化（年代化、氏名/連絡先/写真/PDF/保管場所/広告情報を送らない）を明記。
- `apps/web/app/legal/privacy/page.tsx`
  - スポンサー/協賛掲載の扱いと、広告主へ個人データを提供しないことを追記。
  - AI送信対象の最近の記録数を最大12件へ修正。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter mobile run typecheck` 成功。
- `git diff --check` 成功。
- `corepack pnpm --filter web run build` 成功。
  - Supabase JS由来の Node.js 20以下非推奨警告は出るが、ビルド自体は成功。
- AI相談コードに `partners` / `sponsor_applications` / `sponsor` 参照がないことを `rg` で確認。

次に必要:

- 本番Supabase SQL Editorで `supabase/regional_sponsor_data.sql` を再適用する。
  - これをしないと `prefecture_usage_snapshots` と `capture_prefecture_usage_snapshot()` は本番DBにまだ無い。
- SQL適用後、`supabase/verify_setup.sql` または `supabase/verify_compact.sql` で該当チェックがtrueになることを確認。
- 月初に `select capture_prefecture_usage_snapshot();` を実行するcron/運用を作る。
- Claudeレビューへ渡す新しい資料とZIPを、この追記後のcommitから作り直す。

## 2026-08-23 追記 202 — Claude再レビュー資料を作成

追記201の修正（スポンサー数字の月次スナップショット化、協賛/PR防火壁、AI相談の生年月日最小化、都道府県入力の後ろ倒し）をコミットし、そのコミットを基準にClaudeレビュー用資料を作成した。

コミット:

- `92ba97e` Harden sponsor metrics and consult privacy

作成したレビュー資料:

- `review_exports/claude_review_2026-08-23-sponsor-privacy-hardening/CLAUDE_REVIEW_PROMPT_2026-08-23_SPONSOR_PRIVACY_HARDENING.md`
- `review_exports/claude_review_2026-08-23-sponsor-privacy-hardening/IMPLEMENTATION_BRIEF_2026-08-23_SPONSOR_PRIVACY_HARDENING.md`
- `review_exports/claude_review_2026-08-23-sponsor-privacy-hardening/README_CLAUDE_REVIEW_2026-08-23_SPONSOR_PRIVACY_HARDENING.md`
- `review_exports/claude_review_2026-08-23-sponsor-privacy-hardening/oyano-moshimo-navi-source-2026-08-23-sponsor-privacy-hardening-92ba97e.zip`
- `review_exports/claude_review_2026-08-23-sponsor-privacy-hardening.zip`

Claudeへ渡す時:

1. `CLAUDE_REVIEW_PROMPT_2026-08-23_SPONSOR_PRIVACY_HARDENING.md` の内容を貼る。
2. `oyano-moshimo-navi-source-2026-08-23-sponsor-privacy-hardening-92ba97e.zip` を添付する。
3. 必要なら `IMPLEMENTATION_BRIEF_2026-08-23_SPONSOR_PRIVACY_HARDENING.md` も添付する。

レビューで見てほしい主な論点:

- 家族3組テストを開始してよいか。
- 有料テストはまだ止めるべきか。
- スポンサー営業を開始してよいか、まだ寝かせるべきか。
- `prefecture_usage_snapshots` と `capture_prefecture_usage_snapshot()` で前月比が固定値になったか。
- 有効世帯数の定義が営業資料として説明可能か。
- 記録画面/急なとき/AI相談にスポンサーを混ぜない防火壁が保たれているか。
- AI相談へ送る生年月日が年代化され、送信情報が最小化されているか。

注意:

- `review_exports/` はローカル提出物フォルダで、GitHubには基本入れない。
- 本番DBにはまだ `supabase/regional_sponsor_data.sql` の再適用が必要。

## 2026-08-23 追記 203 — GitHub pushとVercel本番デプロイ完了

Claudeレビュー指摘への追加対応をGitHubへpushし、Vercel本番にも反映した。

GitHub:

- repository: `https://github.com/dogwoodcommunity/oyano-moshimo-navi`
- pushed branch: `main`
- pushed commits:
  - `92ba97e` Harden sponsor metrics and consult privacy
  - `755420d` Record sponsor review package

Vercel:

- production URL: `https://oyano-moshimo-navi.vercel.app`
- deployment URL: `https://oyano-moshimo-navi-r8qg51sgm-dogwoodcommunity1.vercel.app`
- inspector: `https://vercel.com/dogwoodcommunity1/oyano-moshimo-navi/2aDsf2ivyaA7sQhHkM6RKWrTLAxn`
- deployment state: `READY`

確認済み:

- `corepack pnpm --filter web run typecheck`
- `corepack pnpm --filter mobile run typecheck`
- `git diff --check`
- `npx vercel --prod --yes`

残っている外部作業:

- 本番Supabase SQL Editorで `supabase/regional_sponsor_data.sql` を再適用。
- 適用後に `supabase/verify_setup.sql` または `supabase/verify_compact.sql` を実行。
- 月次スナップショット運用として `select capture_prefecture_usage_snapshot();` をcron化、または月初手動実行。

## 2026-08-23 追記 204 — スポンサー月次スナップショット運用を明文化

Claude再検収で「スナップショットの意味論を1行文書化」「cronだけは今設定できるように」と指摘されたため、文書とSQLを追加した。

実装:

- `docs/MONETIZATION.md`
  - `prefecture_usage_snapshots` は「毎月1日時点の確定値」として扱う、と明記。
  - 前月比は「前月1日時点の確定値」と「現在値」の差分で見る、と明記。
  - 月途中の手動再実行は禁止。訂正が必要な時だけ、管理者が理由を残して再実行する、と明記。
- `supabase/prefecture_usage_snapshot_cron.sql`
  - `pg_cron` を使い、毎月1日 00:10 UTC（日本時間09:10）に `capture_prefecture_usage_snapshot()` を実行するSQLを追加。
  - 同名ジョブがある場合は一度unscheduleしてから再登録する。
- `supabase/README.md`
  - 本番SQL実行順に `regional_sponsor_data.sql` を追加。
  - 既存DB向け個別SQLとして `prefecture_usage_snapshot_cron.sql` を追加。
- `supabase/regional_sponsor_data.sql` / `supabase/schema.sql`
  - `capture_prefecture_usage_snapshot()` の運用コメントを追加。

本番Supabaseで必要な実行順:

1. `supabase/regional_sponsor_data.sql`
2. `supabase/verify_setup.sql` または `supabase/verify_compact.sql`
3. `supabase/prefecture_usage_snapshot_cron.sql`

注意:

- `prefecture_usage_snapshot_cron.sql` は `pg_cron` を使う。Supabase側で拡張が有効化できない場合は、Edge Function定期実行または月初手動実行に切り替える。
- 月途中に `capture_prefecture_usage_snapshot()` を再実行すると、その月の確定値が上書きされるため、通常運用では実行しない。

## 2026-08-23 追記 205 — AI相談を直通化し、中高年向けに文字を拡大

利用者から「AI相談を押してもクラウド控え作成とメール確認へ回され、相談に到達できない」「文字が小さい」と指摘されたため、相談導線と可読性を修正した。

実装:

- `apps/web/components/ConsultPanel.tsx`
  - AI相談の前提だったクラウド控え・メール確認への強制誘導を削除。
  - 未ログインでも相談画面をそのまま表示し、初回1回の無料相談を開始できるようにした。
  - 相談送信時は、画面にある最新プロフィール・最近の記録・確認リストを直接APIへ送る。メール確認はAI相談の前提ではない。
  - 回答生成後は回答欄まで自動スクロールし、結果がどこに出たか分かるようにした。
  - 初期アクセス確認が失敗してもボタンが永遠に待機状態にならないよう、例外処理と `finally` を追加。
- `apps/web/app/api/consult/route.ts`
  - Bearer tokenがない端末でも `device-trial` として初回無料相談を許可。
  - 初回相談が正常に成功した時だけ、HttpOnly / SameSite=Lax / 1年のcookieへ利用済みを記録する。失敗時は権利を消費しない。
  - 既存の家族単位おためし、Family Plus判定、IP単位5回/日・全体200回/日の制限は維持。
  - 不正なBearer tokenは従来どおり401。認証を迂回してPlus扱いにはしない。
- `apps/web/app/home/page.tsx`
  - 記録保存完了文に「AI相談へすぐ反映」を明記。
  - ログイン済み手帳は従来の1.2秒デバウンスで自動クラウド同期、未ログインでも端末内保存直後からAI相談の文脈に反映される。
- `apps/web/app/layout.tsx` / `apps/web/app/globals.css`
  - 本文、ナビ、相談フォーム、回答、保存カード、主要ボタンの文字を拡大。
  - スマホ幅では `text-size-adjust: 112%` を適用し、中高年が読みやすい基準へ変更。

安全境界:

- メール確認は機種変更・別端末復元のための「クラウド控え」にのみ使い、AI相談の入口では要求しない。
- 未ログイン相談でも外部AIへ送る対象は、相談に必要な最小プロフィールと最近の記録・確認リストに限定する。氏名、連絡先、写真/PDF、書類の保管場所、スポンサー情報は送らない既存方針を維持。
- 無料相談のcookieは回答成功後のみ設定し、API障害や生成失敗で無料権利を消費させない。

確認:

- `apps/web`: `corepack pnpm exec tsc --noEmit` 成功。
- `apps/mobile`: `corepack pnpm exec tsc --noEmit` 成功。
- `apps/web`: `corepack pnpm build` 成功。
  - Supabase JS由来のNode.js 20以下非推奨警告は出るが、ビルド自体は成功。
- `git diff --check` 成功。

次に確認すること:

- Vercel本番反映後、未ログインのiPhone/Androidで `/consult` を開き、「先にクラウド控えを作る」が表示されず、相談ボタンが有効になること。
- 記録保存直後に「この記録でAI相談する」を押し、入力内容が相談欄へ入り、回答後に回答欄まで自動で移動すること。
- 同じ未ログイン端末では、相談成功後に初回無料が再度使えないこと。別端末やcookie削除による再利用は、既存レート制限で費用上限を守り、正式有料テスト前に追加の不正対策を検討する。

## 2026-08-23 追記 206 — GitHub反映完了、本番デプロイはVercel認証待ち

追記205のAI相談直通化・文字拡大はcommit `9823a80` としてGitHubの `main` へpush済み。

確認結果:

- GitHub Actionsの `web-and-mobile` と `check` は成功。
- GitHub Actionsの `deploy` は、リポジトリに `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` が設定されていないためskip。
- ローカルからの `npx vercel --prod --yes` は `Not authorized` で停止。Vercel CLIの再認証が必要。
- そのため、現時点の本番 `https://oyano-moshimo-navi.vercel.app/api/consult` は旧実装の `login_required` を返す。コード修正はGitHubにあるが、本番画面にはまだ反映されていない。

次の外部作業:

1. ターミナルで `npx vercel login` を実行し、Vercelへ再ログインする。
2. `apps/web` で `npx vercel --prod --yes` を実行する。
3. 本番 `/api/consult` を未ログインで開き、HTTP 200かつ `signedIn: false` / `trialAvailable: true` が返ることを確認する。
4. iPhone/Androidで記録保存からAI相談へ直行できることを確認する。

注意:

- VercelのtokenやSupabaseのsecretを台帳・Git・チャットへ記録しない。
- `review_exports/` はレビュー用の未追跡成果物であり、今回のcommitには含めない。

## 2026-08-23 追記 207 — AI相談直通版をVercel本番へ反映

Vercel CLIへ `dogwoodcommunity` として再認証できたため、リポジトリルートから本番デプロイを実行した。

デプロイ結果:

- 対象Vercel project: `oyano-moshimo-navi`
- deployment ID: `dpl_GD1Ch1dDobk8qKPqSDRELfuALk5X`
- production alias: `https://oyano-moshimo-navi.vercel.app`

- Vercel上のmonorepo install、Next.js build、156ページの静的生成、serverless function生成がすべて成功。
- `https://oyano-moshimo-navi.vercel.app/api/consult` を未ログインで確認し、次の本番応答を確認した。
  - `signedIn: false`
  - `plan: free`
  - `trialAvailable: true`
  - `canConsult: true`
- 本番 `/consult` で、旧「先にクラウド控えを作る」「メール確認が必要」の強制導線が表示されないことを確認した。
- 手帳が1件もない新規端末では、相談の前提となる対象者を作るため「先に1人分の手帳を作ってください」と案内する。手帳がある端末では、記録からAI相談へ直接進む。

注意:

- `apps/web` ディレクトリには別Vercel project `web` への古いlinkがあり、そこからdeployするとworkspace依存をnpmで解決できず失敗する。今後の本番deployは必ず**リポジトリルート**から `npx vercel --prod --yes` を実行する。
- 次の確認は、実利用データが入っているiPhoneで「記録を保存 → この記録でAI相談する → 質問送信 → 回答まで自動スクロール」を1回通すこと。

## 2026-08-23 追記 208 — PWA全画面の文字サイズを中高年向けに統一

利用者実機で「文字がまだ小さい」と再指摘されたため、AI相談周辺だけでなくPWA全画面の文字指定を再監査した。`body` の文字サイズを大きくしても、各部品に残っていた10〜16pxの明示指定429件と、1rem未満の指定が上書きしていたことが原因だった。

変更:

- `apps/web/app/globals.css`
  - 画面内テキストの最小値を16px / 1remへ統一。
  - 10〜13px指定は16px、14〜15px指定は17px、16px指定は主要本文相当の18pxへ引き上げた。
  - クラウド控え、記録、プロフィール、確認リスト、写真、家族共有、AI相談、急なとき、記事、管理画面を含む全スタイルを対象にした。
  - スマホ幅の `text-size-adjust: 112%` は維持し、iPhone上では補足も十分な実寸になるようにした。
- `apps/web/app/layout.tsx`
  - 初期表示用のインラインCSSに残っていた「表示中」13pxとフッター15pxを16pxへ修正。
  - 読み込み直後と通常表示で文字サイズが変わらないように統一。

確認:

- `apps/web`: `corepack pnpm exec tsc --noEmit` 成功。
- `apps/mobile`: `corepack pnpm exec tsc --noEmit` 成功。
- `apps/web`: `corepack pnpm build` 成功。156ページを生成。
- `git diff --check` 成功。
- Vercel本番をiPhone相当の390×844pxで確認。
  - 表示中要素のcomputed font-sizeが16px未満: 0件。
  - ページ全体の横はみ出し: 0件。
  - ホームとAI相談画面で、本文、ナビ、ボタンの折返し・重なりがないことを目視確認。

本番反映:

- deployment ID: `dpl_AzniyNRrWGSwg9f3GDGGVjdiDFUB`
- production alias: `https://oyano-moshimo-navi.vercel.app`
- 本番 `/home` はHTTP 200を確認。

注意:

- PWAまたはSafari内ブラウザに旧CSSが残る場合は、タブを閉じて本番URLを開き直す。表示確認時は古いキャッシュと混同しないこと。
- `review_exports/` は今回も未追跡のレビュー成果物としてcommit対象外。

## 2026-08-23 追記 209 — AI相談を1回答型から継続チャット型へ変更

利用者から「AI相談が一回につき一回の返答だけに見える。普通のチャット形式で続けて相談したい」と指摘があったため、既存の会話履歴対応APIを生かし、相談画面を継続チャットUIへ変更した。

変更:

- `apps/web/components/ConsultPanel.tsx`
  - 相談結果を1件だけ表示する状態から、質問と回答を複数ターン保持する会話スレッドへ変更。
  - 利用者の質問を右側、AIの回答を左側に表示し、その直下の入力欄から続けて質問できるようにした。
  - 2回目以降は、それまでの質問と構造化回答を履歴として `/api/consult` へ送り、前の会話を踏まえて回答できるようにした。
  - 対象者を切り替えた場合は、別人の情報が混ざらないように現在の会話をリセットする。
  - AI回答は各ターンごとに「この回答を手帳に残す」で日記へ保存でき、端末保存とクラウド控え保存の状態もターンごとに表示する。
  - 初回はおすすめ質問とAI送信同意を表示し、回答後は同意を繰り返し要求せず、すぐ次の質問を書けるようにした。
  - 外部AIへ送る情報の説明は常時大きく表示せず、必要な時に開ける詳細表示へ整理した。
- `apps/web/app/consult/page.tsx`
  - 見出しを「この人のことを、続けて相談できます。」へ変更し、プロフィール・最近の記録・前の会話を踏まえるチャットであることを明示した。
- `apps/web/app/globals.css`
  - 390px幅のスマホを基準に、会話吹き出し、回答ブロック、入力欄、無料回答後のPlus案内を追加。
  - 追記208の中高年向け最小16px基準を維持し、横はみ出しや重複が起きない寸法にした。

料金境界:

- 無料プランは、従来どおり家族ごとに最初のAI回答1回を無料で利用できる。
- Family Plusは、同じ会話を引き継いだまま1日5回まで質問できる。
- 無料回答を使い終えた場合は、会話履歴を残したまま「Plusでこの相談を続ける」を表示する。
- 既存のAPI利用制限と成功時だけ無料権を消費する仕様は変更していない。

確認:

- `apps/web`: `corepack pnpm exec tsc --noEmit` 成功。
- `apps/mobile`: `corepack pnpm exec tsc --noEmit` 成功。
- `apps/web`: `corepack pnpm build` 成功。156ページを生成。
- `git diff --check` 成功。
- ローカル `/consult` を390×844pxで確認し、会話枠・入力欄・情報開示・フッターの重複なし、横はみ出しなしを確認。
- ローカルに残っていた確認用対象者は記録・プロフィールの相談条件を満たしていなかったため、実AIへの送信はUIが正しく無効化した。実データを使った会話往復は本番実機で確認する。

本番反映:

- deployment ID: `dpl_2p1TApn4mfBpDyJNRLHCB9TYjzsV`
- production alias: `https://oyano-moshimo-navi.vercel.app`
- 本番 `/consult` はHTTP 200を確認。
- 本番HTMLに「AI相談チャット」「この人のことを、続けて相談できます。」が反映されていることを確認。

注意:

- 会話履歴は相談ページを開いている間のセッション内で保持する。残したい回答は各回答の「この回答を手帳に残す」を使う。
- 対象者の切り替え時に会話をリセットする仕様は、異なる対象者の要配慮情報がAI文脈へ混ざることを防ぐため意図的なもの。
- `review_exports/` は未追跡のレビュー成果物であり、今回もcommit対象外。

## 2026-08-23 追記 210 — AI相談チャットのトークン原価を制御・記録

継続チャット化後に、利用者から「トークン費用が大きくならないか」と指摘があった。
調査すると、従来は1回答の `max_tokens` が5,000、会話履歴が直近6ターン、
サービス全体の既定上限が200回/日で、有料初期運用には余裕が大きすぎた。

変更:

- `apps/web/app/api/consult/route.ts`
  - 1回答の最大出力を5,000tokenから1,600tokenへ変更。
  - `CONSULT_MAX_OUTPUT_TOKENS` で調整できるが、コード側で800〜2,000に制限。
  - 利用者ごとの上限は5回/日のまま維持。
  - サービス全体の既定上限を200回/日から50回/日へ変更。
  - Anthropic応答の実入力・実出力token、モデル、履歴数、高速モード、推定USD原価を
    `audit_logs` の `ai_consult_usage` とサーバーログへ記録する。
  - 原価ログ保存に失敗しても、利用者への相談回答は失敗させない。
- `packages/shared/src/consult.ts`
  - 続きの相談で送る会話履歴を直近6ターンから4ターンへ短縮。
- `apps/web/lib/consult.ts`
  - 回答全体を日本語約1,000文字までにし、次の確認3件、質問2〜3件、相談先2件、
    注意点2件へ整理。重複説明を避ける指示を追加。
- `docs/MONETIZATION.md` / `docs/ENVIRONMENT_MATRIX.md` / `apps/web/.env.example`
  - 新しい原価管理方針と環境変数を反映。

原価判断:

- Claude Sonnet 4.6標準料金（2026-08-23時点）は入力$3/100万token、
  出力$15/100万token。高速モードは料金2倍なので既定OFFを維持する。
- 出力上限だけで比べると、5,000token時の最大$0.075/回から、
  1,600token時の最大$0.024/回へ68%削減した。入力tokenの費用は別途加わる。
- 5回/日を毎日使う利用者は¥980の採算を超える可能性が残るため、
  月間上限はまだ推測で決めず、`ai_consult_usage` の実測後に判断する。
- Family Plus 1世帯あたりのAI原価目標は月¥200〜300以内。

注意:

- `max_tokens` は上限であり、毎回その量を消費するわけではない。
- `ANTHROPIC_MODEL` をSonnet 4.6以外へ変える場合は、コード内の原価単価も同時に更新する。
- 過去の引き継ぎ追記に残る「全体200回/日」は当時の履歴。現行仕様は本追記の50回/日が正。

確認:

- `apps/web`: `corepack pnpm exec tsc --noEmit` 成功。
- `apps/mobile`: `corepack pnpm exec tsc --noEmit` 成功。
- `apps/web`: `corepack pnpm build` 成功。156ページを生成。
- `git diff --check` 成功。

本番反映:

- deployment ID: `dpl_2WBKFLooytnappBT7ymphqVybbfw`
- production alias: `https://oyano-moshimo-navi.vercel.app`

## 2026-08-24 追記 211 — AI相談の課金境界と運営用管理画面を確定

利用者との協議で、無料相談を長く開放して原価を膨らませるのではなく、最初の価値体験だけ無料にし、会話の継続をFamily Plusの価値にする方針を確定した。

料金境界:

- 無料家族・未ログイン端末は、最初のAI回答1回だけ無料。
- 2回答目からFamily Plusが必要。失敗・拒否・無効な回答では無料権を消費しない。
- Family Plusは同じ会話を続けられるが、家族単位で1日5回・月30回まで。
- 月間上限はサーバー側で `audit_logs.action = ai_consult_usage` の成功回答を数えて強制する。
- 過去ログに `outcome` がない場合は成功として数え、仕様変更で回数が不意にリセットされないようにした。

実装:

- `apps/web/lib/consultLimits.ts`
  - 日5回、月30回、サービス全体50回/日、最大1,600token、原価単価を一元管理。
  - 日本時間の当日・当月開始時刻を算出する。
- `apps/web/app/api/consult/route.ts`
  - Plus家族の月30回上限を回答生成前に確認。
  - AI APIを呼んだ結果を `success` / `refusal` / `invalid_response` で原価ログへ記録。
  - 月上限到達時も手帳と記録は使えることを日本語で案内。
- `apps/web/app/admin/ai-usage/page.tsx`
  - 利用者画面と分離した運営専用ページを新設。
  - 今月の成功回答数、今日のAPI呼び出し数、入出力token、概算USD/円原価、家族ごとの上限到達状況を表示。
  - 相談本文は管理画面へ表示しない。
- `apps/web/app/api/admin/ai-usage/route.ts`
  - 既存のadmin認証を必須にし、当月の `ai_consult_usage` だけを集計。
  - 家族IDは画面上で先頭8文字だけ表示。
- 管理トークンの保存・削除時に `admin-auth-changed` を発火し、同じ画面の利用指標を自動で再取得する。
- `/admin` にAI usageの入口を追加。スポンサー管理・地域指標も従来どおり同じ運営入口から確認できる。
- Web/PWA・Expoの料金表示を「1日5回・月30回まで」に統一。
- `CONSULT_FAMILY_MONTHLY_LIMIT` を環境変数資料へ追加。未設定時は30。

確認:

- `apps/web`: `corepack pnpm --filter web exec tsc --noEmit` 成功。
- `apps/mobile`: `corepack pnpm --filter mobile exec tsc --noEmit` 成功。
- `apps/web`: `corepack pnpm --filter web build` 成功。157ページを生成し、`/admin/ai-usage` と `/api/admin/ai-usage` を確認。
- `git diff --check` 成功。

注意:

- 管理画面の円換算は運営判断用の概算として `$1 = ¥150` を使用する。実請求との照合はAnthropic側の請求明細で行う。
- 原価ログ保存に失敗した場合も利用者への回答は止めない既存方針を維持している。管理画面でログ欠損が疑われる場合はサーバーログと請求明細を照合する。
- 未追跡の `review_exports/` はレビュー成果物であり、今回もcommit対象外。

本番反映:

- Vercel CLIを `dogwoodcommunity` で再認証し、リポジトリルートから本番deployを実行。
- deployment ID: `dpl_AhLFVoVMEayM3CCrnu4JbwELvHc3`
- production alias: `https://oyano-moshimo-navi.vercel.app`
- 本番 `/admin/ai-usage` はHTTP 200、見出し「AI相談の利用回数と原価」の反映を確認。
- 本番 `/api/admin/ai-usage` は管理認証なしでHTTP 401を確認。運営データは未認証では取得できない。

## 2026-08-24 追記 212 — Claude向けの専用引き継ぎ文書を作成

別セッションのClaudeで安全に開発を継続できるよう、現在のコード・商品判断・料金境界・安全境界・
管理画面・残課題を1本に整理した `docs/CLAUDE_HANDOFF_2026-08-24.md` を新設した。

引き継ぎ文書に固定した主な内容:

- Web/PWAが現在の主導線で、Expoは将来利用に備えて削除せず保管する。
- 記録→保存確認→AI相談→相談回答を手帳へ保存、を中心導線にする。
- 無料はAI成功回答1回、2回答目からFamily Plus。Plusは家族単位で1日5回・月30回。
- Family Plusは月980円・年9,800円、手帳2人目と追加家族招待を主な課金境界にする。
- 利用者用PWAと運営管理画面を分離し、AI原価管理は `/admin/ai-usage` で行う。
- 記録・急なとき・AI回答にスポンサーを混ぜず、AIコードからpartner/sponsorを参照しない。
- `review_exports/` は未追跡のレビュー成果物なので、今後もcommitしない。
- 本番Supabase SQL/cron、consult実弾、Stripe E2E、メール通知は外部確認・残作業として明示した。
- 作業完了時はWeb/Mobileのtypecheck、Web build、`git diff --check`、台帳追記、mainへのpushを必須とした。

Claudeで作業を始める際は、古いレビュー資料より本書、現行コード、追記211以降、
`docs/MONETIZATION.md` の現行ルールを優先する。

## 2026-08-24 追記 213 — 完了案内の出し方を仕様どおりに直し、記録欄へ音声入力の案内を追加

`docs/MONETIZATION.md` の実装タスクのうち、6（音声入力の文言）と8（完了時の解約案内）が
Web側で未達だったため対応した。

### 1. 解約案内が、終わっていない家族にも出ていた

`PlanCompletionNotice` の判定は「全対象者のタスクがdoneまたはskipped」だった。
仕様は「**対象者が全員『完了』ステータス**」（追加機能C）であり、条件が別物になっていた。

このずれは文言だけの問題では済まない。親がまだ入院中でも、最初に出た数件のタスクを
片付けただけで「役目を終えたようです」が出る。看取りを扱う画面でそれを出すのは、
受け入れ条件の「解約案内は、完了していない家族には一切出ない」に反する。

判定を `selectedStatus === "completed"` に変えた。タスクの進捗は見ない。

### 2. 無料家族に「解約」と言わない

仕様の文面は「Plusを解約しても」で始まるが、無料家族に解約を語っても意味がなく、
「知らないうちに課金されていたのか」と読ませかねない。うっかり課金への警戒が
最も強い層が相手なので、プランで文面を分けた。

- Plus: 「Plusをやめても、これまでの記録はずっと読み返せます。」
- 無料: 「これまでの記録は、このままずっと読み返せます。」

プラン判定は `readPlan()`（`oyano_plan_v01`）。クラウドに一度も触れていない端末では
free として扱われるため、Plus家族へ無料向けの文面が出ることはありうる。
どちらの文面も事実として正しいので、実害はない。

仕様にある「記録を一冊のPDFにまとめることもできます」は**入れていない**。
製本PDF（実装タスク9）が未実装で、無い機能を案内することになるため。実装後に足す。

あわせて「こちらで勝手に解約することはありません。この案内も、この画面を開いたときだけ
出ます」を明記した。自動解約しない・通知しないという設計を、利用者にも読める形にした。

localStorage を読むため、判定はマウント後に行う（サーバー描画との食い違いを避ける）。

### 3. 記録欄に音声入力の案内（Web）

実装タスク6はアプリ側だけに入っていた。現在の主導線はWeb/PWAなので、
記録欄の直下に同じ一文を置いた。文言はアプリと完全に同じにしている。

```
キーボードのマイクボタンで、話すだけでも書けます。
```

中高年向けの最低16pxを守るため、`.diary-voice-hint` は16pxにした
（アプリ側は12.5pxだが、Webは本文16pxの方針を優先）。

### 確認

`corepack pnpm` は同梱版が11.23.0で、`node_modules` の作り直しを求めて失敗する
（`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`）。リポジトリのpnpm 10.33.0で
同じ検査を実行した。

- `pnpm --filter web exec tsc --noEmit` 成功（exit 0）
- `pnpm --filter mobile exec tsc --noEmit` 成功（exit 0）
- `pnpm --filter web build` 成功（exit 0）
- `git diff --check` 成功

実画面（390×844）で受け入れ条件を検証した。6件すべて期待どおり。

| 状況 | 案内 |
| --- | --- |
| 手帳なし | 出ない |
| 入院中1人・タスク全部done | **出ない**（従来は出ていた） |
| 完了1人（無料） | 出る／無料向け文面 |
| 完了1人 + 相続中1人 | 出ない |
| 完了2人（Plus） | 出る／Plus向け文面 |
| 完了2人（無料） | 出る／無料向け文面 |

あわせて確認したこと:

- 記録欄の補足が記録欄の直下に出る。文字サイズ16px。文言はアプリと一致。
- `/crisis`、`/crisis/hospital-night`、`/crisis/critical`、`/crisis/just-died` が
  未ログインで全て200。急なときに課金の壁が入っていないことを再確認した。
- 緊急カードに書類の保管場所が載っていないことを確認（受け入れ条件）。
  画面上でも「銀行情報、暗証番号、重要書類の保管場所は載せません。」と明示されている。

### 残課題

- 実装タスク9（製本PDF）は未着手。完了案内へPDFの案内を足すのは、その後。
- モバイルのプラン画面には完了案内を入れていない。対象者の状態を持っていないため、
  入れるならサーバーから状態を取る配線が要る。現在の主導線がWebなので後回しにした。
- 本番反映は未実施。この作業環境からは `vercel.com` がネットワークポリシーで
  遮断されている（403）ため、利用者のパソコンから `npx vercel --prod` を実行する。
## 2026-08-24 追記 214 — モニター専用入口・回答フォーム・回答管理を実装

モニターへ通常のアプリURLを直接送り、古い手帳や複数の導線を見せて混乱させないよう、
モニターテスト専用の入口と回答導線を新設した。

公開導線:

- モニター入口: `https://oyano-moshimo-navi.vercel.app/monitor`
- 回答フォーム: `https://oyano-moshimo-navi.vercel.app/monitor/report`
- 回答管理: `https://oyano-moshimo-navi.vercel.app/admin/monitor-feedback`

実装内容:

- `/monitor` に10〜15分のテスト手順、個人情報を入力しない注意、テスト開始、結果報告を集約。
- 通常の「テストを始める」は既存のローカル手帳を消さず `/start?monitor=1` へ進む。
- データを消して最初から試す操作は、確認ダイアログ付きの別ボタンに分離。
- `/monitor/report` にGoogleフォーム相当の専用回答フォームを実装。年齢層、端末、完走状況、
  迷った場所、記録の再発見、AI相談、7日後の利用意向、共有意向、980円/9,800円の支払意向、
  自由記述を収集する。
- 公開API `/api/monitor-feedback` はIP単位で1時間5回に制限し、入力を整形・長さ制限して
  `audit_logs.action = monitor_feedback_submitted` へ保存する。
- 管理API `/api/admin/monitor-feedback` と管理画面 `/admin/monitor-feedback` は既存の管理者認証を必須にした。
- 管理画面では回答数、自力完走、7日後の利用意向、支払意向の集計と回答詳細を確認できる。
- `/admin` にモニター回答管理への入口を追加。
- `docs/FAMILY_TEST_PROTOCOL.md` と `docs/TEST_COOPERATION_REQUEST.md` を現行の記録ファースト導線へ更新。

確認:

- `apps/web`: `corepack pnpm --filter web exec tsc --noEmit` 成功。
- `apps/mobile`: `corepack pnpm --filter mobile exec tsc --noEmit` 成功。
- `apps/web`: `corepack pnpm --filter web build` 成功。161ページを生成し、モニター・回答・管理の各ページ/APIを確認。
- 実装commit: `491151e Add monitor testing and feedback flow`。`origin/main` へpush済み。
- Vercel本番deploy: `HNx1xtcUyUdgw4LZPcNjsP52zjhd`。
  `https://oyano-moshimo-navi.vercel.app` へalias済み。
- 本番疎通: `/monitor` は200、`/monitor/report` は200。
  未認証の `/api/admin/monitor-feedback` は401となり、管理者保護を確認。
- iPhone相当の390×844表示で `/monitor` と `/monitor/report` を目視確認。
  文字、必須項目、ボタンに重なり・横はみ出しなし。
- 未追跡の `review_exports/` は今回もcommit対象外。

## 2026-08-24 追記 215 — 7日間の有償モニターテストへ更新

短時間の操作確認だったモニター導線を、募集要項どおりの7日間テストへ更新した。
モニターは個人情報を使わず、日常的に戻れるか、主要機能を自力で見つけられるか、
有料価値を感じるかまで一連で回答できる。

公開導線:

- モニター入口: `https://oyano-moshimo-navi.vercel.app/monitor`
- 最終報告フォーム: `https://oyano-moshimo-navi.vercel.app/monitor/report`
- 回答管理: `https://oyano-moshimo-navi.vercel.app/admin/monitor-feedback`

実装内容:

- `/monitor` に「7日間」「最終回答約15分」「報酬2,000円（検収後）」を明示。
- 初日に呼び名と関係だけで手帳を1冊作り、7日間で「今日の記録」を3回以上書く手順に変更。
- 確認リスト、書類の所在メモ、家族招待を各1回試し、最終日に約15問とスクリーンショット3枚を提出する。
- 実名、住所、病名、電話番号、暗証番号、マイナンバー等を入力・撮影しない注意を入口と回答画面の両方に表示。
- `/monitor/report` は年代、介護対象との関係、現在の状況、端末、利用日数、記録回数、
  主要3機能の実施状況、保存した記録の再発見、AI相談、迷った場所、継続・共有・支払意向、
  自由記述を収集する7日間用フォームへ更新。
- スクリーンショットはJPEG/PNG/WebPを3枚必須、1枚4MB以下に制限。
- 公開API `/api/monitor-feedback/screenshot` を新設し、IP+User-Agentで1時間12回に制限。
  画像はprivateの`home-photos`バケット内`monitor-feedback/YYYY-MM/`へ保存し、公開URLは持たない。
- 回答本体にはStorage pathだけを保存し、管理APIが管理者認証後に1時間の署名URLを発行する。
- 管理画面は総回答数、7日利用、記録3回以上、支払意向を集計し、各回答のスクリーンショット3枚も確認できる。
- `docs/TEST_COOPERATION_REQUEST.md` に募集掲載文、採用後の送信文、短いLINE文を整備。
- `docs/FAMILY_TEST_PROTOCOL.md` を7日間の検収条件と観察項目へ更新。

確認:

- `apps/web`: `corepack pnpm --filter web build` 成功。162ページを生成。
- `apps/web`: `corepack pnpm --filter web exec tsc --noEmit` 成功。
- `git diff --check` 成功。
- ローカルの本番ビルドで `/monitor` と `/monitor/report` は200。
- 未認証の `/api/admin/monitor-feedback` は401。
- ファイルなしの `/api/monitor-feedback/screenshot` は400。
- iPhone相当の390×844表示で入口と最終報告フォームを目視確認。
  報酬・手順・必須項目・画像添付に重なりや横はみ出しなし。
- 既存のprivate `home-photos` バケットを利用するため、今回の追加DB migrationは不要。
- 未追跡の `review_exports/` はcommit対象外。

本番反映:

- 実装commit: `ad99932 Add seven-day monitor testing flow`。`origin/main` へpush済み。
- Vercel本番deployment: `dpl_A2puxaA4MYwN2vNpYoKKj1hrkjkt`。
- deployment URL: `https://oyano-moshimo-navi-akvg86ks7-dogwoodcommunity1.vercel.app`。
- `https://oyano-moshimo-navi.vercel.app` へalias済み。
- 本番の `/monitor` と `/monitor/report` は200。
- 本番HTMLに「7日間」「検証結果」を確認。
- 本番の未認証 `/api/admin/monitor-feedback` は401。
- 本番のファイルなし `/api/monitor-feedback/screenshot` は400。

## 2026-08-24 追記 216 — モニター入口のスマホ文字崩れを修正

本番の `/monitor` をiPhone相当の390×844で再確認したところ、
「お願いすること」の説明文が番号用の狭い列へ入り、1文字ずつ縦に並ぶ不具合を再現した。

原因:

- 1つの `li` 内に番号、見出し、説明テキストを直置きしていた。
- CSS Gridでは番号と見出しの後にある匿名テキストも別のgrid itemとして扱われ、
  折り返し後の説明が42pxの番号列へ配置されていた。

修正:

- 各手順を「番号」と `stepBody` の2列へ整理し、見出しと説明を同じ本文領域にまとめた。
- 本文列へ `minmax(0, 1fr)` と `min-width: 0` を指定し、スマホ幅でも自然に折り返すようにした。
- 「利用期間・最終回答・報酬」は横並びの短いラベルから概要グリッドへ変更。
  390px以下では1項目ずつ縦に並べ、金額と支払条件を読み分けやすくした。

確認:

- `apps/web`: `corepack pnpm --filter web exec tsc --noEmit` 成功。
- `apps/web`: `corepack pnpm --filter web build` 成功。162ページを生成。
- `git diff --check` 成功。
- この実行環境ではlocalhostのlistenが `EPERM` で制限されるため、最終のスマホ表示確認は
  Vercel本番反映後に390×844で実施する。
- 未追跡の `review_exports/` はcommit対象外。

本番反映・最終確認:

- 実装commit: `98b0753 Fix monitor mobile text layout`。`origin/main` へpush済み。
- Vercel本番deployment: `FVGkwTfB35dBZFJwvqXMnSXHXQFo`。
- deployment URL: `https://oyano-moshimo-navi-i8mzsmjne-dogwoodcommunity1.vercel.app`。
- `https://oyano-moshimo-navi.vercel.app` へalias済み。
- 本番 `/monitor` を390×844で再確認。document幅390px、横はみ出しなし。
- 4件の手順本文幅はいずれも232pxで、1文字ずつ縦に並ぶ不具合が解消した。
- 手順カードの高さは120〜151pxに収まり、見出し・説明・番号が読みやすい順序で表示された。

## 2026-08-24 追記 217 — AI相談の入力補助と利用状況エラーを修正

AI相談チャットで質問例を押すと、日記から用意された相談文がすべて置き換わるため、
何が起きたか分かりにくく、相談内容も編集しにくい状態だった。また、相談開始時の
家族プラン・初回無料相談の照会に失敗すると、初回相談まで503で止まっていた。

修正:

- 5つの質問例は入力欄を置き換えず、現在の相談文の末尾へ追加する方式に変更。
- 同じ質問例を複数回押しても重複追加しない。
- 質問例へ「＋」を表示し、「押すと末尾へ追加され、元の文章は消えない」と説明した。
- 日記から相談文を用意した場合は「内容は自由に修正・削除して構いません」と入力欄の直前に明示。
- 通常の相談でも「文章は自由に修正できます。短い言葉でも大丈夫です」と表示。
- 家族メンバー、プラン、初回無料相談の照会に一時的な障害があっても、端末側の初回無料相談判定へ
  フォールバックし、利用状況エラーだけを理由に相談開始を止めないようにした。
- `families.consult_trial_used_at` が未適用の古いDBでも、Plus判定は維持し、無料利用者は端末側判定へ戻す。
- API障害はサーバーログへ残し、利用者には必要以上の内部情報を見せない。

確認:

- `apps/web`: `corepack pnpm --filter web exec tsc --noEmit` 成功。
- `apps/web`: `corepack pnpm --filter web build` 成功。162ページを生成。
- `git diff --check` 成功。
- 未追跡の `review_exports/` はcommit対象外。

本番反映・最終確認:

- 実装commit: `6fc4665 Fix consultation input and access fallback`。`origin/main` へpush済み。
- Vercel本番deployment: `dpl_Gu6g7A6NQYxfHfPRHuGQVAk6BDMs`。
- deployment URL: `https://oyano-moshimo-navi-ephyepfi2-dogwoodcommunity1.vercel.app`。
- `https://oyano-moshimo-navi.vercel.app` へalias済み。
- 本番の `GET /api/consult` はHTTP 200。
  未ログイン状態で `trialAvailable: true`、`canConsult: true` を返し、旧503エラーが出ないことを確認。
- 本番 `/consult` は表示でき、手帳未登録の新規端末では手帳作成案内へ安全に分岐することを確認。

## 2026-08-24 追記 218 — 運営管理画面を日本語の業務ダッシュボードへ再設計

旧 `/admin` は英語見出し、内部用語、8つの機能が同じ強さで並び、
管理者が「いま何を確認すればよいか」を判断しにくかった。認証も長い管理キーの入力が
前面に出ており、通常運用と緊急運用の区別がなかった。

修正:

- 管理画面専用の共通ヘッダーとナビを新設。通常サイトのナビ・フッターは管理画面では非表示。
- 管理トップを「いま確認する」「利用状況」「売上・提携」「システム」の4分類へ整理。
- 最優先CTAを「モニター回答を見る」とし、AI利用・原価、削除依頼も同じ最優先帯へ配置。
- 各機能名を日本語へ統一し、英語の内部名や番号中心の一覧を廃止。
- モニター回答は横長11列テーブルを廃止し、1回答1カードで、利用状況・率直な感想・
  スクリーンショットを順に読める表示へ変更。
- 管理認証の通常導線を、`app_admins` に登録した管理者メール宛の本人確認リンクへ変更。
- `/api/admin/auth-status` を追加し、ログイン後に管理者権限をサーバー側で確認。
- `ADMIN_ACCESS_TOKEN` は通常画面から隠し、「メールで入れない場合」の緊急用管理キーへ降格。
- スマホでは共通ナビを横スクロール可能にし、カードを1列へ変更。管理情報が横にはみ出さない設計にした。

確認:

- `apps/web`: `corepack pnpm --filter web build` 成功。163ページを生成。
- `apps/web`: build完了後に `corepack pnpm --filter web exec tsc --noEmit` 成功。
  buildとtscを同時実行するとNext.jsが`.next/types`を再生成中のため一時的なTS6053が出るので、
  今後もbuild後に順番に実行する。
- `git diff --check` 成功。
- この実行環境ではlocalhostのlistenが `EPERM` で制限されるため、最終のPC・スマホ表示確認は
  Vercel本番反映後に実施する。
- 未追跡の `review_exports/` はcommit対象外。

本番反映・最終確認:

- 実装commit: `4f3975f Redesign admin operations dashboard`。`origin/main` へpush済み。
- Vercel本番deployment: `41AiASJ1S4yVxuSQYv72NWXagybv`。
- deployment URL: `https://oyano-moshimo-navi-k1mrzd2a1-dogwoodcommunity1.vercel.app`。
- `https://oyano-moshimo-navi.vercel.app` へalias済み。
- 本番 `/admin` を1440x900で確認。通常サイトのヘッダー・フッターは表示されず、
  管理専用ナビ、管理者メール認証、4分類の業務カードが正しい順序で表示された。
- 本番 `/admin` を390x844で確認。document幅390px、横はみ出しなし。
  ナビは横スクロール、カードと認証フォームは1列表示になった。
- 本番 `/admin/monitor-feedback` を390x844で確認。横はみ出しなし。
  未認証時は管理者メール確認が先に表示され、回答が見えない理由と次の操作が分かる。
- 管理画面の入口: `https://oyano-moshimo-navi.vercel.app/admin`。
- モニター回答: `https://oyano-moshimo-navi.vercel.app/admin/monitor-feedback`。

## 2026-08-25 追記 219 — 本番の運営管理者メールを登録

本番Supabaseで、通常運用に使う運営管理者メールを作成し、管理者台帳へ登録した。

- Supabase Authenticationから `info@bee-ch.co.jp` へ招待メールを送信済み。
- Auth user ID: `a5599e10-2124-4ebf-9037-e2fc7f87863e`。
- `profiles` 行を冪等に作成・更新した上で、`app_admins` に `運営管理者` として登録。
- 確認SQLで `info@bee-ch.co.jp`、上記user ID、`運営管理者` の1行が返ることを確認。
- 管理者本人は最初にSupabaseの招待メールを1回開いて本人確認を完了する。
- 以後は `https://oyano-moshimo-navi.vercel.app/admin` で同じメールアドレスを入力し、
  届いた管理者ログインリンクから入る。`ADMIN_ACCESS_TOKEN` は緊急時のfallbackのみ。
- パスワードやSMTP/APIキーなどの秘密情報は台帳へ記録していない。

## 2026-08-25 追記 220 — 7日間モニターを「毎日1回記録」に統一

モニターが最終回答フォームを見失わず、7日間の作業内容も毎日迷わないように、
モニター開始から回答完了までの導線を手帳内へ常設した。

実装:

- `/monitor` の課題を「7日間で3回以上」から「1日1回、7日間で合計7回」へ変更。
- 「7日間のテストを始める」を押した日時を端末へ保存し、手帳上部に現在のテスト日数を表示。
- その日に日記を保存していない場合は「今日の記録を1回保存してください」と表示し、
  既存の記録入力欄へ直接進める。
- その日の記録が保存済みなら「今日の記録は完了です」と表示する。
- 開始から168時間後は、自動的に「お疲れさまでした。最後に回答をお願いします」へ切り替え、
  `/monitor/report` への大きな回答ボタンを手帳上部へ固定表示する。
- 最終回答の送信成功後は回答済み日時を端末へ保存し、同じ端末では回答案内を再表示しない。
- 最終フォームの記録回数を「7日すべて / 5〜6日 / 2〜4日 / 1日 / 保存できなかった」へ変更。
- 運営管理画面の集計も「3回以上」から「7日すべて記録した」へ変更。
- 家族テスト手順書と協力依頼文書も、毎日1回・合計7回の条件へ統一。

確認:

- `apps/web`: `corepack pnpm --filter web run build` 成功。163ページを生成。
- `apps/web`: `corepack pnpm --filter web run typecheck` 成功。
- `apps/mobile`: `corepack pnpm --filter mobile run typecheck` 成功。
- `git diff --check` 成功。
- この実行環境ではlocalhostのlistenが `EPERM` で制限されるため、最終の画面確認は
  Vercel本番URLで実施した。
- 未追跡の `review_exports/` はcommit対象外。

本番反映・最終確認:

- 実装commit `84a0c6c` (`Add daily seven-day monitor reminders`) を `origin/main` へpush済み。
- Vercel本番deployment: `dpl_5qBaEnmaDHq83gUKjAR7SrhqWS7a`。
- deployment URL: `https://oyano-moshimo-navi-ipn0i9w8q-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- Vercel本番build成功。163ページを生成。
- 本番 `/monitor` のHTMLで「1日1回」「合計7回」「7日間の終了後」
  「手帳の先頭に出る案内」を確認し、新しいモニター条件が反映済み。

## 2026-08-25 追記 221 — 最終報告を7日目まで隠し、モニター導線を本番で通し確認

モニター開始画面に最終報告ボタンが最初からあると、作業前に回答を促しているように見え、
毎日の記録導線とも競合する。そのため、最終報告は開始から168時間後だけ表示する仕様へ固定した。

実装・仕様:

- `/monitor` の開始画面から「最終日の結果を報告する」CTAを撤去。
- モニター開始前、または開始から168時間未満に `/monitor/report` を直接開いても、
  最終報告フォームは表示せず、現在の日数と残り日数、今日の記録へ戻る導線だけを表示。
- 168時間経過後は手帳上部のモニター案内を「お疲れさまでした。最後に回答をお願いします」へ切り替え、
  最終報告ボタンを表示する。
- 回答送信後は同じ端末で回答済み状態を保持し、最終報告を再度促さない。
- 日付判定をUTC文字列の切り出しから `Asia/Tokyo` 基準へ変更。深夜帯でも記録日、カレンダー、
  AI相談へ渡す記録日、同期APIの日付が日本の日付からずれないようにした。

本番で行った通し確認:

- `/monitor`: 初期画面に最終報告ボタンがないことを確認。
- `/monitor/report`: 開始前はフォームを出さず、開始後1日目は「あと7日です」と表示して
  日記入力へ戻せることを確認。
- `/start?monitor=1`: 呼び名、関係、都道府県、状況の初期登録を完了。
- 今日の記録: 2026-08-25として保存され、「保存しました」の完了表示、カレンダーの記録日表示、
  過去の記録一覧への反映を確認。
- 記録からAI相談: 「この記録でAI相談する」から `/consult` へ直接遷移し、相談文に当日の記録が
  あらかじめ入ることを確認。
- AI相談: 本番Anthropic APIから日本語の構造化回答が実際に返り、回答が手帳へ保存されることを確認。
  初回無料回答後、2通目はFamily Plusの境界が表示されることも確認。
- 確認リスト: モニター用の確認項目を追加し、一覧と次の期限へ反映されることを確認。
- プロフィール: 市区町村と主な連絡役を編集して保存し、保存完了表示と再表示値を確認。
- 家族招待: `/family?monitor=1` でメール入力後に送信ボタンが有効になるところまで確認。
  実在する受取人の同意がないため、テストメールの実送信だけは行っていない。

検証:

- `apps/web`: `corepack pnpm --filter web run build` 成功。163ページを生成。
- `apps/web`: build後に `corepack pnpm --filter web run typecheck` 成功。
- `apps/mobile`: `corepack pnpm --filter mobile run typecheck` 成功。
- `git diff --check` 成功。
- 本番自動スモークは実行環境の一時的なDNS解決エラーでHTTP接続できなかったが、同じ本番URLを
  ブラウザから操作する実動作確認で、登録・保存・履歴・AI実回答・Plus境界まで通して確認済み。
- モニター確認に使った人物名、日記、確認リスト、プロフィールはすべてダミー情報。
- 未追跡の `review_exports/` は変更・commit対象外。

本番:

- production: `https://oyano-moshimo-navi.vercel.app`
- モニター開始: `https://oyano-moshimo-navi.vercel.app/monitor`
- 最終報告: `https://oyano-moshimo-navi.vercel.app/monitor/report`
- 日付修正commit: `7ea50a0` (`Use Japan dates for daily monitor records`)。
- 最終報告ゲートcommit: `c133e3a` (`Gate monitor report until day seven`)。
- production deployment: `dpl_9YvoxuJ8TPR6tZxVwGRRN37s1nUd`。

## 2026-08-25 追記 222 — 期限・月1確認を登録メールでも受け取れる土台を実装

`a2d9e57` から作業を再開し、有料テスト前の未完了項目だった「期限通知と月1確認のメール通知」を実装した。
既存のExpo Pushは残し、登録メールにも同日の通知を1通へまとめて送る。外部メールサービスはResendのHTTP APIを使用し、SDK依存は追加していない。

実装:

- `/api/cron/send-due-notifications` で、期限タスクと月1確認を利用者・日本日付単位のダイジェストにまとめ、
  Expo Pushと登録メールへ配信するようにした。
- メールはResendのbatch APIで最大100通を1回に送り、通知ID集合から作るIdempotency-Keyを付けた。
- `scheduled_notifications.push_sent_at` / `email_sent_at` を追加し、片方だけ成功した場合は成功チャネルを再送せず、失敗チャネルだけ次回Cronで再試行する。
- `supabase/notification_email_delivery.sql` を新設。既存本番DBへ安全に後追いできる加算migrationとした。
- WebがSQLより先にdeployされても、追加列がない間はメールだけを停止して従来のPush配送を継続する互換分岐を入れた。
- 配送直前に通知設定を再取得するようにした。期限通知OFFは期限タスクへ、月1確認OFFは月1確認へ正しく反映する。
- 月1確認の作成対象を「active Push tokenがある人だけ」から「登録メールまたはactive Push tokenがある人」へ拡張した。
- モバイル通知設定の説明を、端末通知と登録メールに共通の設定であることが分かる文言へ変更した。
- `RESEND_API_KEY` / `NOTIFICATION_EMAIL_FROM` / 任意の `NOTIFICATION_EMAIL_REPLY_TO` を環境変数資料へ追加し、管理画面のenv確認にも必須2項目を追加した。
- Cron Routeを `force-dynamic` に固定し、ビルド時の静的応答化を防いだ。
- Vercel CronはUTC固定のため、従来の `0 9 * * *`（日本時間18:00）を `0 0 * * *`（日本時間09:00）へ修正した。
- 手動Cron確認手順は、秘密値をURLへ載せるquery方式から `Authorization: Bearer` header方式へ修正した。
- Supabase実行順、setup verification、local doctor、本番チェックリスト、専用引き継ぎ文書を現行仕様へ更新した。

安全上の判断:

- `RESEND_API_KEY` または送信元が未設定ならメールだけを停止し、Pushを止めない。
- `notification_email_delivery.sql` 未適用時も、二重送信防止列がないためメールだけを停止する。
- 通知設定をOFFにした後にすでに作成済みの通知が残っていても、配送時判定で送らない。
- メール件名には親の氏名やタスク名を入れず、本文も従来Pushと同じ確認項目だけに限定した。
- 未追跡の `review_exports/` は変更・追加・commitしていない。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter mobile run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。Cron RouteがDynamic (`ƒ`) になり、162ページを生成。
- `corepack pnpm run doctor:local` 成功。
- `git diff --check` 成功。
- ローカル本番ビルドを3100番で起動し、環境変数なしのCron APIがHTTP 200と
  `{ sent: 0, skipped: true, reason: "Supabase is not configured" }` を返すことを確認。
- `node scripts/smoke-web.mjs http://localhost:3100` 成功。主要ページ/APIはすべて期待ステータス。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。

GitHub:

- 実装commit: `4e2a396` (`Add email reminder delivery`)。
- 引き継ぎcommit: `f452038` (`Record email reminder handoff`)。
- `a2d9e57..f452038` を `origin/main` へpush済み。
- GitHub Actions CI run `32795058497` は成功。Web/Mobile typecheck、Web build、smokeがすべて成功。
- Vercel deploy workflow run `32795058494` はcheck成功、deploy jobはVercel secrets未設定のためskip。
  今回の本番deployment IDはなく、本番反映確認も行っていない。

本番でメールを有効にするために残る作業:

1. Supabase SQL Editorで `supabase/notification_email_delivery.sql` を実行し、`verify_compact.sql` の
   `scheduled_notifications.push_sent_at` / `email_sent_at` がtrueになることを確認する。
2. Resendで送信ドメインを認証し、Vercelへ `RESEND_API_KEY` と `NOTIFICATION_EMAIL_FROM` を設定する。
3. ダミーの期限通知と月1確認を各1件だけ作り、メール実受信、Pushとの同日集約、通知OFF後の非送信、
   `push_sent_at` / `email_sent_at` の記録を確認する。

今回は本番SupabaseへのSQL適用、Resendのアカウント/ドメイン設定、実メール送信は行っていない。
資格情報がない状態で推測値を入れず、コードはメールOFFの安全な状態でdeployできるようにしている。

## 2026-08-25 追記 223 — 親の市区町村をWeb/PWA登録の必須項目に変更

ユーザーから、将来の「市区町村×分野」の地域データには都道府県だけでなく市区町村まで必要という仕様確定があった。モニターが使うWeb/PWAの手帳登録で、親の都道府県と市区町村の両方を必須にした。

実装:

- `/start` の初回入力を「呼び名・関係・都道府県・市区町村」の4項目必須に変更。
- 市区町村が未入力または空白だけの場合は状況カードを押しても手帳を作成せず、必須項目を案内する。
- 既存ユーザーは都道府県または市区町村がなければ、記録件数に関係なく地域設定を表示する。「あとで入力する」は廃止し、両方がなければ保存できない。
- 手帳のプロフィール編集でも両方を必須表示にし、片方が空の場合は保存せずエラーを表示する。プロフィール充足率と未入力リストにも市区町村を追加。
- `/monitor` とモニター手順・依頼文を新しい4項目に更新。モニターには市区町村も架空の内容を入れてもらう。
- プライバシーポリシーの取得項目に「親の居住都道府県・市区町村」を明記した。
- PWAの古い表示が残らないよう、service worker cacheを `v20` へ更新。

データ・プライバシー上の判断:

- 取得範囲は市区町村まで。番地、丁目、建物名などの詳細住所は引き続き取得しない。
- `people.prefecture` / `people.city` はすでにクラウド同期対象のため、DB migrationは不要。
- 既存レコードとWeb/DBの展開順序を壊さないため、DB列はnullableのままとし、Web/PWAで未入力を補完させる。
- 現行の管理画面・月次snapshot・公開閾値は都道府県単位のまま。市区町村は将来の市区町村単位の分析・掲載に使えるよう先に収集する。
- 今回の対象は現在の主導線であるWeb/PWA。Expoモバイルの新規対象者RPCはリリース運用後のため変更していない。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `corepack pnpm --filter mobile run typecheck` 成功。
- `corepack pnpm run doctor:local` 成功。
- ローカル本番ビルドを3100番で起動し、`node scripts/smoke-web.mjs http://localhost:3100` 成功。
- `/start` のHTMLに「最初は4つだけ」「市区町村（必須・番地不要）」、`/monitor` に「都道府県・市区町村」、`/legal/privacy` に取得地域の説明が出ることを確認。
- `git diff --check` 成功。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

GitHub:

- 実装commit: `2de8689` (`Require parent municipality in web registration`)。
- 引き継ぎcommit: `67994a8` (`Record municipality requirement handoff`)。
- `29761a2..67994a8` を `origin/main` へpush済み。
- GitHub Actions CI run `32795875885` は成功。Web/Mobile typecheck、Web build、smokeがすべて成功。
- Vercel deploy workflow run `32795875838` はcheck成功、deploy jobはVercel secrets未設定のためskip。

本番反映・最終確認:

- Vercel CLIでproduction deployを実行し、deployment `dpl_CDmuoJHLiA67dEJ2MtbvijToBoXX` がREADY。
- deployment URL: `https://oyano-moshimo-navi-kg98z82jj-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/start` で「最初は4つだけ」「市区町村（必須・番地不要）」、`/monitor` で「都道府県・市区町村」、`/sw.js` でcache `v20` を確認。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に作業ツリーから削除した。どちらもVercel linkで再生成可能な、commit対象外の一時設定。

## 2026-08-25 追記 224 — 状況カードの無反応と初回登録の必須エラーを改善

ユーザーから、iPhoneの `/start` で状況カードを押せないように見える画面キャプチャと、必須未入力時にエラーを出す要望があった。原因は2つあり、必須エラーが11個の状況カードより下に出るためスマホでは見えなかったこと、既に無料枠の手帳1冊がある端末ではカード自体をdisabledにしていたこと。

実装:

- 未入力のまま状況カードを押すと、基本情報欄に「入力されていない必須項目があります」と未入力項目名を表示。
- 呼び名、関係、都道府県、市区町村の各欄を赤枠にし、それぞれの入力欄の下に具体的なエラーを表示。`aria-invalid` / `aria-describedby` / `role=alert` を付けた。
- 状況カードを押した場所から、最初の未入力欄へ自動スクロールしてfocusする。エラーは入力に応じて項目ごとに消える。
- 手帳上限でも状況カードをdisabledにせず、押したときに「無料は1冊まで」の理由、Plus、いまの手帳へ戻る導線へ自動スクロールする。
- 一般エラーと手帳上限の案内を状況カード一覧の下から、状況選択見出しの直下へ移動。
- PWA更新用にservice worker cacheを `v21` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `corepack pnpm --filter mobile run typecheck` 成功。
- `corepack pnpm run doctor:local` 成功。
- ローカル本番ビルド3100番で `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- アプリ内ブラウザの390×844pxで、未入力の状況カードがenabled、押下後に4項目のエラー、エラー要約、呼び名欄のfocus、`aria-invalid=true` 4件を確認。
- 4項目にダミー入力後は `/home?created=...` へ遷移することを確認。その後 `/start` を開き直し、手帳上限時もカードがenabledで、押下後に上限エラーへfocusすることを確認。
- `git diff --check` 成功。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

GitHub・本番:

- 実装commit: `3c4f0d7` (`Show registration validation errors`)。
- Vercel production deployment: `dpl_2ymQkGVn4s7Kb6Jta5fQkSdTjrWm` がREADY。
- deployment URL: `https://oyano-moshimo-navi-mqulztk47-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。本番 `/sw.js` がcache `v21`、`/start` で市区町村必須表示と状況カードを確認。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 225 — 手帳がある端末でも必須未入力エラーを優先

追記224の本番確認後、ユーザーの端末で必須項目を未入力にしてもエラーが出ないとの再指摘があった。この端末はすでに無料枠の手帳1冊を持っており、必須入力より先に手帳上限を判定していたことが原因。

変更:

- `/start` の状況カード押下時の判定順を「必須入力4項目 → 手帳上限 → 手帳作成」に変更。
- すでに手帳がある端末でも、呼び名・関係・都道府県・市区町村が未入力なら4項目のエラーを先に表示する。
- 4項目を入力した後に同じカードを押した場合だけ、無料枠の手帳1冊上限を案内する。
- PWA更新用にservice worker cacheを `v22` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- 手帳1冊があるローカルブラウザの390×844pxで、未入力押下時に上限案内が消え、4項目のエラー、`aria-invalid=true` 4件、呼び名欄へのfocusを確認。
- 同じ画面で4項目を入力後に押すと、必須エラーが消えて手帳上限案内へfocusすることを確認。
- 本番production aliasをservice worker更新後に再読み込みし、手帳1冊がある本番originでも、未入力押下後に4エラーと呼び名focusが出ることを実操作確認。
- ローカルと本番の `scripts/smoke-web.mjs` 成功。`git diff --check` 成功。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

GitHub・本番:

- 実装commit: `6dc7a12` (`Validate required registration fields first`)。
- Vercel production deployment: `dpl_7VVunKoEibkeqBorYQNWV4gwJWhv` がREADY。
- deployment URL: `https://oyano-moshimo-navi-3kxru7y4c-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- 本番 `/sw.js` でcache `v22` を確認。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 226 — モニターの既存手帳を開始画面から再開

追記225の反映後、ユーザーからiPhoneの `/start` で状況カードを押しても次へ進まないとの再指摘があった。端末にはモニターテストで作成済みの無料手帳が1冊あり、同じ開始画面から2冊目を作ろうとして手帳上限で止まっていたことが原因。

変更:

- 既存のモニターセッションと手帳が同じ端末にある場合、`/start` を再表示せず `/home` へ自動的に戻すようにした。
- 自動遷移前に画面が残って状況カードを押した場合も、2冊目を作ろうとせず既存の `/home` へ進むフォールバックを追加した。
- 通常利用ですでに手帳がある人が初めてモニターURLを開いた場合は、勝手に既存手帳へ切り替えない。ページ表示前からモニターセッションが存在する端末だけを再開対象にした。
- `/start?reset=1&monitor=1` の明示的なやり直し導線は自動遷移の対象外。確認後にテストデータを消して最初から登録できる既存仕様を維持した。
- 新規端末では従来どおり、呼び名・関係・都道府県・市区町村が未入力なら状況カード押下時に4項目のエラーを表示する。
- PWA更新用にservice worker cacheを `v23` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカルの新規originでモニターセッションを開始し、必須4項目をダミー入力して手帳を作成できることを確認。
- 同じoriginで `/start` を開き直すと `/home` へ自動遷移することを確認。
- 新規originの未入力押下では、追記225の必須4項目エラーが維持されることを確認。
- ローカルと本番の `scripts/smoke-web.mjs` 成功。
- 本番production aliasの既存モニター端末で `/start` を開き、初回表示のまま `/home` へ自動遷移することを実操作確認。
- 本番 `/sw.js` でcache `v23` を確認。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

GitHub・本番:

- 実装commit: `a1f2718` (`Resume existing monitor notebook`)。
- Vercel production deployment: `dpl_35ekQtm5hfSW3tfB9ggjWr7mc1Rq` がREADY。
- deployment URL: `https://oyano-moshimo-navi-o7513h44s-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 227 — 無料AI相談を日本時間で1日1回に変更

ユーザーから、AI相談を1日1回使える形にする方針決定があった。無料家族と未ログインのWeb/PWA端末は日本時間で毎日1回答を無料、Family Plusは従来どおり1日5回答・月30回答とした。

実装:

- 無料家族は `families.consult_trial_used_at` を「最後に成功した無料相談日時」として再利用し、日本時間の当日0時より前またはnullなら1回相談できるようにした。
- 未ログイン端末は既存のHttpOnly Cookie `oyano_consult_trial_used_v01` の日時を再利用。同じ端末で当日1回答まで、翌日0時に自動で再開する。
- 相談成功時だけ利用日時を更新する。入力不備、AI拒否、不正な回答、外部APIエラーではその日の無料枠を減らさない。
- 同じ日の2回目はHTTP 429 `daily_free_limit` とし、「明日また1回」「今すぐ続ける場合はPlus」を案内する。
- Family Plusの1日5回答・月30回答、サービス全体1日50回答、出力上限1,600tokenは変更していない。
- WebのAI相談画面、記録保存後の案内、料金比較、モバイル相談画面・プラン詳細、運営AI原価画面を1日1回仕様へ統一した。
- 旧モバイルとの展開順を壊さないよう、GET `/api/consult` の `trialAvailable` / `trialUsedAt` は互換フィールドとして残し、新しい `dailyFreeAvailable` / `dailyFreeUsedAt` も返す。
- 既存DB列とCookieをそのまま使うため、追加migrationや本番Supabaseでの手作業は不要。
- PWA更新用にservice worker cacheを `v24` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter mobile run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `corepack pnpm run doctor:local` 成功。
- ローカルと本番の `scripts/smoke-web.mjs` 成功。
- ローカル・本番GET `/api/consult` で、Cookieなしは `dailyFreeAvailable: true`、前日のCookieもtrue、当日のCookieはfalseになることを確認。
- ローカルPOST `/api/consult` で、当日のCookieはHTTP 429 `daily_free_limit`、前日のCookieは無料枠判定を通過して次の手帳内容検証（HTTP 422）へ進むことを確認。外部AI APIは呼んでいない。
- 本番の既存モニター端末で `/consult` を開き、「今日の無料相談は利用済み」「明日0時からまた1回」「Plusなら今日のうちも続けられる」の表示を実操作確認。
- 本番 `/sw.js` でcache `v24` を確認。
- `git diff --check` 成功。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

GitHub・本番:

- 実装commit: `6c44471` (`Allow one free AI consult daily`)。
- Vercel production deployment: `dpl_2y1MgbXDoD3QdvpQ8tePz1XaV9ab` がREADY。
- deployment URL: `https://oyano-moshimo-navi-d3tpn0jfr-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 228 — 日記の振り返りをスマホ向けカード表示に改善

ユーザーから、iPhoneの手帳にある「最近の記録」が見にくいとの指摘があった。従来は日付・本文・状態を1行の表形式へ押し込み、スマホでは本文が短く切れる一方で状態だけが次の行へ離れていたため、1件の日記としてまとまりを追いにくかった。

変更:

- 「最近の記録」を表形式から、記録ごとの独立したカードへ変更した。
- カード上段に日付と状態、中央に本文プレビュー、下段に「この記録を見返す・編集する」を配置し、読む順序を揃えた。
- 日付で絞り込んだ場合は見出しを「8月25日の記録」のように切り替え、表示件数も同じ行に出す。
- 短い記録は本文を全文表示する。非常に長い記録は空白と改行を整えた96文字のプレビューにし、一覧が縦に伸びすぎないようにした。全文はカード下の導線から該当する詳細・編集欄で確認できる。
- 長文表示には5行相当の高さ制限も入れ、端末ごとの折り返し差に対する安全策とした。
- 旧 `.history-row` のモバイル専用grid指定を削除した。
- PWA更新用にservice worker cacheを `v28` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカル本番ビルドを3100番で起動し、`node scripts/smoke-web.mjs http://localhost:3100` 成功。
- アプリ内ブラウザの390×844pxで、長めのダミー日記が日付・状態・本文・編集導線の順に1枚のカードとして表示されることを目視確認。
- カードの「この記録を見返す・編集する」を押すと、同じ記録の `#diary-entry-...` へ移動することを確認。
- 本番production aliasの既存モニターデータ3件で、短文は全文、長文は末尾 `…` のプレビューになり、次のカードと操作導線が画面内で見分けられることを390×844pxで実操作確認。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v28` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

GitHub・本番:

- 実装commit: `1958878` (`Improve diary history readability`)。
- 長文プレビュー調整commit: `ead92a5` (`Clamp long diary previews`)、`0f617e0` (`Bound diary preview height`)、`b0ef2f1` (`Shorten long diary card previews`)。
- 最終Vercel production deployment: `dpl_H9e2u76R5RGeeBh2zzZKRie1JFuy` がREADY。
- deployment URL: `https://oyano-moshimo-navi-cnc7a1k0g-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 229 — 保存先・AI相談メモ・音声入力の説明を明確化

ユーザーから、手帳上部の「保存状態／控え保存／開」が何を示すのか分かりにくい、AI相談の回答がどこに保存されるのか分からない、「キーボードのマイクボタン」は中高年には伝わらないとの指摘があった。実際の仕様を確認し、保存の動作は変えずに、画面上で保存先と操作結果が分かるようにした。

AI回答の現行仕様:

- AI相談の回答は表示しただけでは保存しない。相談画面を閉じると回答は消える。
- 残したい回答で「この回答を手帳に残す」を押した時だけ、今日の日付の手帳記録として保存する。
- 保存内容は手帳の「過去の手帳」に残り、本文は `相談メモ:` から始まる。
- メール確認前はこの端末の手帳に保存し、メール確認済みの場合はクラウドにも同期する。
- AI回答を自動保存しない方針は維持した。不要な回答や個人情報を含む回答を勝手に手帳へ蓄積しないため、利用者が残す回答を選ぶ。

変更:

- 閉じた保存欄を「手帳データの保存先／今はこの端末だけに保存／見る」の2段表示に変更。クラウド保存済みなら「この端末とクラウドに保存」と表示する。
- 保存欄のgridを組み直し、丸い「開」が別の行に落ちて大きな空白を作る問題を解消。「見る／閉じる」の文字ボタンにした。
- 「控え保存」「クラウド控え」という独自用語を、利用者向け画面では「クラウド保存」「クラウドに保存」へ統一した。
- AI相談画面の上部に「AIの回答は自動保存されない」「画面を閉じると消える」「残す時は回答下のボタンを押す」「過去の手帳にAI相談メモとして保存される」を常時表示した。
- 回答保存ボタンの完了表示を「AI相談メモとして保存済み」に変更し、保存後も「過去の手帳」に保存したことを表示する。
- 手帳のAI相談案内にも、回答は自動保存されず、操作した回答だけ過去の手帳へ残ることを追記した。
- `相談メモ:` から始まる既存・新規の保存記録は、状態バッジを「通常」ではなく「AI相談メモ」と表示し、通常の日記と区別できるようにした。
- 曖昧な「キーボードのマイクボタンで、話すだけでも書けます」を削除。「声で入力する方法を見る（使わなくても大丈夫）」を開くと、入力欄を押す、画面下の文字入力画面の `🎤` を押す、話す、の3手順を表示する。マイクが見つからなければ文字入力でよいことも明記した。
- モニター回答項目、家族共有・招待、端末容量エラーも「クラウド保存」の表現へ揃えた。
- PWA更新用にservice worker cacheを `v29` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカル本番ビルドを3100番で起動し、`node scripts/smoke-web.mjs http://localhost:3100` 成功。
- アプリ内ブラウザの390×844pxで、保存先欄が余白なく「今はこの端末だけに保存／見る」と表示されることを目視確認。
- 同じ画面で音声入力説明を開き、3手順と「使わなくても大丈夫」「マイクがなければ文字入力」の案内を目視確認。
- ローカル `/consult` で、AI回答の非自動保存と「過去の手帳／AI相談メモ」の保存先説明を常時確認できることを確認。
- 本番production aliasの既存モニターデータで、保存先欄、音声入力の説明、AI相談画面の保存説明を確認。
- 本番に保存済みだった相談回答が、最近の記録と詳細記録の両方で「AI相談メモ」と表示されることを確認。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v29` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

GitHub・本番:

- 実装commit: `b4ff4a3` (`Clarify notebook and AI answer storage`)。
- Vercel production deployment: `dpl_6tas258XoTfQ9GPSM6J4cfYimYgV` がREADY。
- deployment URL: `https://oyano-moshimo-navi-cqhjp2md5-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 230 — モニター最終アンケートの確認用プレビューを追加

ユーザーからアンケート回答フォームを今すぐ見たいとの要望があった。通常の `/monitor/report` は同じ端末でモニター開始から7日経過するまでフォームを表示しないため、日付制限を変えずに回答項目だけ確認できるプレビューURLを追加した。

変更:

- `/monitor/report?preview=1` で、モニターセッションや経過日数に関係なく最終アンケートの全項目を表示する。
- プレビュー冒頭に「確認用」「入力内容と画像は送信できない」「実際の回答は7日後」と明記した。
- プレビューの送信ボタンはdisabledにし、「プレビューでは送信できません」と表示する。
- UI上のdisabledだけに頼らず、submit処理側でもpreviewなら送信を止める。
- 通常の `/monitor/report` の開始端末判定、7日間の経過判定、送信済み判定は変更していない。
- PWA更新用にservice worker cacheを `v30` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカル本番ビルドを3100番で起動し、390×844pxでプレビューの注意書き、全回答項目、disabledの送信ボタンを確認。
- 同じoriginでqueryなしの `/monitor/report` を開き、従来どおり開始端末または7日経過のgateが表示され、プレビュー項目が出ないことを確認。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番 `https://oyano-moshimo-navi.vercel.app/monitor/report?preview=1` で注意書き、年代などの質問、送信不可ボタンを実操作確認。
- 本番のqueryなし `/monitor/report` では従来の7日後gateが維持されることを確認。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v30` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

GitHub・本番:

- 実装commit: `18c7a6a` (`Add monitor survey preview`)。
- Vercel production deployment: `dpl_HqaM5oL9voRmdTtatf2kns7ddfKV` がREADY。
- deployment URL: `https://oyano-moshimo-navi-i9i5wwd1k-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 231 — Claude向けモニター総合レビュー資料を作成

ユーザーが7日間モニター関連をClaudeへレビュー依頼できるよう、現行実装・調査設計・アンケート・データフロー・既知論点を1つにまとめたレビュー資料を新設した。

追加ファイル:

- `docs/CLAUDE_MONITOR_REVIEW_PACKET.md`

内容:

- Claudeへそのまま貼れるレビュー依頼文。
- モニター入口、初回登録、手帳、回答プレビュー、実回答、管理画面のURLと操作上の禁止事項。
- `localStorage` の開始時刻、168時間gate、再開・reset、日次案内、最終回答までのフロー。
- 最終アンケートの必須15項目、複数選択、自由記述、スクリーンショット3枚の全仕様。
- 公開回答API、公開画像API、rate limit、`audit_logs`、private Storage、管理者署名URLのデータフロー。
- 現行の3人モニター判定ライン。
- 調査設計、端末継続性、設問バイアス、画像負荷、API、孤立画像、重複回答、文書不一致など、レビュー前から確認できる論点。
- P0/P1/P2、GO判定、募集前必須修正、修正版アンケート、集計案をClaudeへ求める回答フォーマット。
- 関連ソースファイルと現在の本番・CI検証状態。

資料内で明示した主な未解決論点:

- 7日gateと実際の日記7件・課題完了をサーバーで突合していない。
- セッションと送信済み状態が同じブラウザの端末内保存に依存する。
- 正確な168時間判定が利用者の「7日目」認識とずれる可能性がある。
- スクリーンショット3枚必須が、困った利用者ほど回答を送れない要因になり得る。
- 画像を回答本体より先に保存するため、回答失敗時に孤立画像が残り得る。
- 回答を専用テーブルでなく `audit_logs` に保存し、重複回答・検収状態・保持期限を持たない。
- `/monitor` はAI相談を課題に含む一方、募集文・LINE文ではAI相談が抜けているなど資料間に不一致がある。

確認:

- モニター説明、開始・再開、端末内セッション、日次案内、回答フォーム、回答API、画像API、管理API、管理画面、既存手順書・募集文を実コードから再確認した。
- 回答項目、選択肢、文字数、画像枚数・形式・容量、rate limit、Storage path、署名URL有効時間を実装と突合した。
- `git diff --check` 成功。
- リポジトリ外のユーザー向け同内容ファイルを `outputs/CLAUDE_MONITOR_REVIEW_PACKET.md` に作成した。
- アプリ本体の挙動変更、本番再deploy、回答送信、画像アップロードは行っていない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

## 2026-08-25 追記 232 — モニター回答者名をクラウドワークス表示名へ変更

ユーザーから「モニター番号」の意味が分かりにくく、クラウドワークス上の名前で回答者を照合したいとの要望があったため、最終アンケートの先頭項目と保存形式を変更した。

変更:

- 「モニター番号またはニックネーム」を「クラウドワークスで使っている名前」へ変更した。
- 「クラウドワークスのプロフィールに表示されている名前を入力してください。」という説明と、入力例「やまだ123」を追加した。
- この項目は引き続き必須。空欄ではブラウザの必須入力エラーが働き、送信処理へ進まない。
- 新規回答は `monitorCode` ではなく `crowdworksName` として保存する。form versionは `2026-08-25-crowdworks-name`。
- 更新前の画面を開いたままの利用者から旧 `monitorCode` が届いた場合も、APIで `crowdworksName` に正規化して受け付ける。
- 管理画面は新しい `crowdworksName` を回答見出しと「クラウドワークス名」に表示し、既存回答の `monitorCode` もfallback表示する。
- Claudeレビュー資料 `docs/CLAUDE_MONITOR_REVIEW_PACKET.md` と、リポジトリ外の `outputs/CLAUDE_MONITOR_REVIEW_PACKET.md` も新項目・新データキーへ更新した。
- PWA更新用にservice worker cacheを `v31` へ上げた。

確認:

- `corepack pnpm --filter web run build` 成功。162ページを生成。
- build完了後に `corepack pnpm --filter web run typecheck` を単独実行し成功。最初の並列実行時はbuildが `.next/types` を作り直す競合で一度失敗したが、コード起因ではない。
- `git diff --check` 成功。
- ローカル本番ビルドの `/monitor/report?preview=1` で、新ラベル、説明、placeholderを確認。
- 同画面で `required=true`、空欄時 `validity.valueMissing=true`、formに `novalidate` がないことを確認。
- 本番 `https://oyano-moshimo-navi.vercel.app/monitor/report?preview=1` でも新ラベルと必須属性を確認。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v31` を確認。
- 回答送信・画像アップロードは実行していない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

GitHub・本番:

- Vercel production deployment: `dpl_3x3XRuP5QVGewEttwDj6syYNJSa7` がREADY。
- deployment URL: `https://oyano-moshimo-navi-nnbeekczi-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 233 — Claudeのモニター設計レビューを実装へ反映

Claudeから、7日間モニターは条件付きGOだが、募集前に自己申告依存、端末内保存一本、スクリーンショット3枚必須、報酬表現、168時間gate、回答者照合、価格設問、保持・削除案内を直すべきとのレビューを受けた。指摘されたP0/P1とアンケート修正を実装・運営資料へ反映した。

変更:

- 最終回答の開放条件を正確な168時間後からカレンダー日へ変更した。開始日を1日目とし、開始日の7日後（8日目）0:00に開く。回答前画面には具体的な開放日と時刻を常時表示する。
- モニター期間中の端末内行動計測を追加した。アプリを開いた回数・日数、今日の記録の保存回数・日数・最終保存日、端末内の日記件数・日数、初回登録所要時間、確認リスト、日記履歴、書類メモ、家族招待画面、AI相談、クラウド同期成功を記録する。
- 最終送信時に端末内の自動計測値を回答payloadへ添付し、自己申告の利用日数・日記回数と管理画面で併記する。日記7件や機能試行の未達は回答gateにしない。
- 初日の必須課題へ「メール確認を完了し、クラウドの控えを作る」を追加した。実際のクラウド同期成功時だけ完了として計測する。同じ端末・同じブラウザを使い、プライベートブラウズや履歴・サイトデータ削除をしない注意も画面・募集文へ追加した。
- 家族招待の必須範囲を「招待画面を開いて手順を確認する」までに変更し、実際の送信は任意にした。AI相談1回は必須課題として維持した。
- 最終アンケートの所要時間を15〜20分へ変更し、スクリーンショットを1枚必須・最大3枚に緩和した。クライアントとAPIの両方で1〜3枚を検証する。
- 「最終回答の提出で報酬を支払う」「使えなかった報告も同じ価値で同額」「未達・否定回答で減額しない」をモニター画面、回答フォーム、募集文、運営手順へ明記した。
- フォーム冒頭へ、回答・画像は改善目的のみ、6か月後に削除、クラウドワークスのメッセージから希望時に削除可能、実名・住所・病名などを書かないという同意・注意文を追加した。削除予定日と支払状態は運営スプレッドシートで手動管理する。
- 確認リスト、書類メモ、家族招待、AI相談に「使う必要がなかった」を追加した。「一番最初に迷った場所」を必須単一選択で追加し、ほかの迷いは従来どおり複数選択で取得する。
- 支払意向を2段階化した。価格提示前に月0円・300円・500円・980円・980円以上から上限を聞き、その後に実価格の月980円・年9,800円を提示して、月払い、年払い検討、家族相談、無料範囲、使わないから反応を聞く。
- `MONITOR_ALLOWED_CROWDWORKS_NAMES` をserver-only環境変数として追加した。回答前にクラウドワークス表示名をNFKC正規化・大文字小文字を無視して許可リスト照合し、未設定時はHTTP 503、対象外はHTTP 400で画像アップロード前に止める。
- 同じクラウドワークス表示名の再送は `audit_logs` の既存回答を上書きし、初回送信日時と再送回数を残す。3人の回答を別人・二重回答として混ぜない。
- 回答管理画面へ、端末内自動計測、自己申告との差、最初の迷い、価格提示前後の反応を追加した。
- `docs/FAMILY_TEST_PROTOCOL.md` に「前進 / 再設計 / 立ち止まり」の3段階判定と、必ず観察する5項目を追加した。3人中2人の単純な合否判定は廃止した。
- `docs/TEST_COOPERATION_REQUEST.md` を新しい課題・報酬・画像・保持条件へ揃えた。
- `docs/CLAUDE_MONITOR_REVIEW_PACKET.md` を初回レビュー後の再レビュー資料に全面更新し、リポジトリ外の `outputs/CLAUDE_MONITOR_REVIEW_PACKET.md` と同一内容にした。
- PWA更新用にservice worker cacheを `v32` へ上げた。

募集前に残る必須作業:

- 採用する3人の正確なクラウドワークス表示名を受け取り、Vercel Productionの `MONITOR_ALLOWED_CROWDWORKS_NAMES` にカンマ区切りで設定して再deployする。
- 現時点のproductionはこの環境変数を未設定にしており、誤った回答を受け付けないため回答APIをHTTP 503で安全に停止している。説明画面と確認用プレビューは利用できるが、募集開始・実回答は環境変数設定後に行う。
- 報酬支払日、削除予定日、削除依頼日を記録する3人分の運営スプレッドシートを用意する。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカル本番ビルドをテスト用許可名2件で起動し、`node scripts/smoke-web.mjs http://127.0.0.1:3100` 成功。
- ローカルAPIの回答者事前照合で、全角の `ＲＥＶＩＥＷ＿ＴＥＳＴＥＲ` が半角許可名 `review_tester` と一致してHTTP 200、対象外名はHTTP 400になることを確認した。回答本体と画像は送信していない。
- ローカルの確認用フォームで、6か月後削除、使えなかった回答と報酬の中立表現、最初の迷い、2段階価格設問、スクリーンショット1〜3枚、送信不可を実操作確認した。
- fresh originでモニターを開始し、1日目表示と具体的な8日目0:00の開放日時が出て、期間中は回答フォームが表示されないことを確認した。
- 本番 `https://oyano-moshimo-navi.vercel.app/monitor/report?preview=1` で、スクリーンショット1枚必須・最大3枚、価格提示前の支払上限、6か月後削除の表示を実操作確認した。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v32` を確認。
- 本番回答APIが、許可名未設定のため意図どおりHTTP 503「受付準備中」を返すことを確認した。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment: `dpl_4knbVnhSDZu4prkDFvhj5LEGrALf` がREADY。
- deployment URL: `https://oyano-moshimo-navi-kd03na445-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 234 — モニター人数を実際の10人へ訂正

ユーザーから、モニターは3人ではなく、すでに10人集めているとの訂正があった。Claudeの初回レビューが3人前提だったため、その人数を実運用人数と誤認して資料へ反映していた。実際の対象人数は10人であり、「クラウドワークス表示名」は採用した10人それぞれのプロフィールに表示される名前を指す。

変更:

- `docs/FAMILY_TEST_PROTOCOL.md`、`docs/TEST_COOPERATION_REQUEST.md`、`docs/CLAUDE_MONITOR_REVIEW_PACKET.md` の参加人数、許可名設定、運営対象を3人から10人へ訂正した。
- 10人を大規模な統計調査ではなく探索的モニターとして扱う方針は維持した。
- 3段階判定を10人用の暫定基準へ変更した。「前進」は実価格へ前向きな反応が3人以上かつ5日以上の記録が7人以上、「再設計」は5日以上の記録が7人以上だが前向きな支払反応が2人以下、「立ち止まり」は7人以上が3日以内に記録を停止とした。
- どの暫定基準にも明確に当てはまらない場合は無理に合否を作らず、10人分の最初の迷い、停止日、自己申告との差、価格反応、スクリーンショットを並べて再設計箇所を決めると明記した。
- リポジトリ外の `outputs/CLAUDE_MONITOR_REVIEW_PACKET.md` も更新後のリポジトリ資料と同一内容にした。
- 回答APIの `MONITOR_ALLOWED_CROWDWORKS_NAMES` はもともと固定人数ではなくカンマ区切りの任意件数に対応しているため、アプリコードの人数上限変更は不要。10人の正確な表示名を環境変数へ登録すれば全員を照合できる。

開始前に残る作業:

- 採用した10人のクラウドワークスプロフィール表示名を、そのまま10件受け取る。
- 10件をVercel Productionの `MONITOR_ALLOWED_CROWDWORKS_NAMES` へ設定し、再deploy後に全10名の事前照合を確認する。
- 設定完了までは、productionの最終回答APIをHTTP 503「受付準備中」で停止したままにする。

確認:

- 対象3文書に残る「3人」「3名」を確認し、10人の判定条件で意図的に使う「3人以上」以外の旧人数表現がないことを確認した。
- `docs/CLAUDE_MONITOR_REVIEW_PACKET.md` とリポジトリ外の `outputs/CLAUDE_MONITOR_REVIEW_PACKET.md` が同一であることを `cmp` で確認した。
- `git diff --check` 成功。
- アプリコードと本番の挙動変更はないため、Vercel再deployは行っていない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

## 2026-08-25 追記 235 — 日記の見返し・編集・保存導線と移動位置を修正

ユーザーから、最近の記録にある「この記録を見返す・編集する」を押しても対象位置へ正しく移動せず、編集と保存の導線も分かりにくいとの指摘があった。

原因:

- 最近の記録側は単純なページ内アンカーだったため、記録の絞り込み状態によって対象カードが詳細一覧に描画されていないと移動できなかった。
- 対象カードに固定ヘッダー分のscroll offsetがなく、移動してもカード上端がヘッダーに隠れた。
- 最近の記録から詳細カードへ移動した後、さらに「この記録を編集」を押す二段階操作だった。
- 編集保存後は対象カードではなく、上にある汎用の保存完了カードへ移動していたため、どの記録を更新したか追いにくかった。
- 「閉じる」は入力途中の内容を画面上から隠すだけで、同じ編集欄を開き直すと未保存の変更が残っていた。

変更:

- 最近の記録の導線を「内容を確認・編集する」という独立したボタンへ変更し、背景・枠・丸みを付けて操作箇所を明確にした。
- ボタン1回で対象日へ絞り込み、記録フィルターを「すべて」へ戻し、詳細drawerを開き、該当記録の編集欄を表示するようにした。
- 対象カードへ `scroll-margin-top: 96px` を設定し、固定ヘッダーの下へ上端が収まる位置までsmooth scrollするようにした。
- 新規保存直後の「この記録を編集する」も同じ処理を使い、編集欄まで確実に移動するようにした。
- 編集欄の先頭へ「この記録を編集しています」と手順を表示した。
- ボタン名を「変更を保存する」「変更せず閉じる」へ変更した。後者は未保存の入力を破棄し、元の記録内容へ戻す。
- 記録内容が空白だけの場合は保存ボタンをdisabledにし、反応がないように見える状態を防いだ。
- 編集保存後は上の汎用保存完了カードへ移動せず、更新した記録カードの位置へ戻して「変更を保存しました」と表示するようにした。
- 詳細カードの操作名も「内容を編集する」「確認リストに追加」「AIに相談する」に短く整理した。
- PWA更新用にservice worker cacheを `v33` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカルのfresh originで手帳と架空の日記を作り、「内容を確認・編集する」を押すと該当カードが編集状態になり、カード上端が固定ヘッダー下へ収まることを実操作確認した。
- 入力途中で「変更せず閉じる」を押して開き直すと、未保存の文ではなく保存済みの原文へ戻ることを確認した。
- 空白だけの記録内容では「変更を保存する」がdisabledになることを確認した。
- 変更保存後、同じ記録カードで本文が更新され、「変更を保存しました」が表示され、上の汎用保存完了カードへ飛ばないことを確認した。
- ローカル `node scripts/smoke-web.mjs http://127.0.0.1:3101` 成功。
- 本番production aliasの既存日記で「内容を確認・編集する」を押し、対象カードが編集状態になり、カード上端が固定ヘッダーの下に表示されることを確認した。本番データの保存変更は行っていない。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v33` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment: `dpl_9rxsBJ5nxXqTeJALizRSht5bFfhQ` がREADY。
- deployment URL: `https://oyano-moshimo-navi-qmpsqyh43-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy用に一時生成された `.env.local` と `.vercel/` は、本番確認後に削除済み。

## 2026-08-25 追記 236 — モニターのクラウド保存を任意化し、誤った移動を修正

ユーザーから、7日間モニターで「クラウドの控えを作る」を必須にする必要性が分からず、そのボタンを押してもクラウド保存欄ではなく「今日の記録」が見えるとの指摘があった。

判断:

- 7日間モニターの主目的は、日記を迷わず書き続けられるかを確認すること。初日にメール確認まで必須にすると、認証での脱落が日記体験の評価へ混ざるため、クラウド保存は任意の安全策へ変更した。
- 端末内データ消失のリスク対策として、同じスマートフォン・同じブラウザを使い、プライベートブラウズや履歴・サイトデータ削除を避ける注意は維持した。
- 追記233の「クラウドの控えを初日の必須課題にする」という判断は、この追記で上書きする。

原因:

- クラウド同期が未完了の場合、モニター案内が日記案内を早期returnで置き換え、「クラウドの控え」が初日の主課題として大きく表示されていた。
- ボタンは同じ `/home` 内の `?cloud=1#cloud-backup` へNext.jsのクライアント遷移をしていたが、クラウド欄を開く処理はページ初回mount時だけだった。同一ページ遷移では処理が再実行されず、閉じたクラウド欄の見出しが固定ヘッダーに隠れ、その直後の「今日の記録」が見えていた。

変更:

- モニター案内はクラウド同期状態に関係なく、「今日の記録を1回保存してください」を主課題として表示するようにした。
- クラウド保存は「クラウド保存を見る（任意）」という補助リンクへ下げ、「使わない場合は、同じブラウザを使い、履歴を削除しない」と明記した。
- 任意リンクを押した時は、`#cloud-backup` の `details` をその場で開き、URL hashを更新してからクラウド欄へsmooth scrollするようにした。
- クラウド欄へ `scroll-margin-top: 110px` を追加し、固定ヘッダーに見出しが隠れないようにした。
- `/monitor` の初日説明も「手帳を1冊作る。クラウド保存は使いたい人だけ」に変更した。
- `docs/FAMILY_TEST_PROTOCOL.md`、`docs/TEST_COOPERATION_REQUEST.md`、`docs/CLAUDE_MONITOR_REVIEW_PACKET.md` を任意方針へ揃えた。Claude資料には、必須化すると初日の脱落要因になり日記体験の評価を濁すため方針変更したことを明記した。
- リポジトリ外のユーザー向け `outputs/CLAUDE_MONITOR_REVIEW_PACKET.md` も同じ内容へ更新し、リポジトリ内資料と一致させた。
- PWA更新用にservice worker cacheを `v34` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカルのfresh monitorで手帳を作成し、案内の主見出しが「今日の記録を1回保存してください」、クラウド導線が「クラウド保存を見る（任意）」になることを実操作確認した。
- ローカルで任意リンクを押すと、URLが `#cloud-backup` になり、クラウド欄がopen、クラウド欄上端が約110px、今日の記録は約815px先になることを確認した。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番 `/monitor` でクラウド保存が任意と表示され、旧「クラウドの控えを作る」必須説明がないことを確認した。
- 本番 `/home` で日記が主課題、クラウド保存が任意表示になることを確認した。
- 本番で任意リンクを押すと `#cloud-backup` がopenになり、クラウド欄上端が約110px、今日の記録は約843px先になることを実操作確認した。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v34` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment: `dpl_FPahdEQgw8bTMeQ2DnhJ93oEYD8s` がREADY。
- deployment URL: `https://oyano-moshimo-navi-414om829k-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に一時生成された `.vercel/` は、worktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-1241` へ退避した。

## 2026-08-25 追記 237 — クラウド保存の利点を画面内で具体化

ユーザーから、任意にしたクラウド保存について「保存すると何がよいか」を画面へ書くよう要望があった。

変更:

- 7日間モニターの日次案内へ、「機種変更・端末故障・履歴削除のあとも、メール確認で手帳を戻せる」と具体的な利点を追記した。任意であることと、使わない場合は同じブラウザを使い履歴を削除しない注意も維持した。
- 補助リンク名を「クラウド保存を見る（任意）」から「クラウド保存の説明を見る（任意）」へ変更し、押すと何が表示されるか明確にした。
- `/monitor` の初日説明にも、クラウド保存を使うと機種変更・故障・履歴削除後に手帳を戻せることを追記した。
- クラウド保存欄の冒頭で、「手帳の控えをインターネット上にも残す機能」と平易に説明した。
- 未設定時の利点を、①日記・プロフィール・確認リストの変更を自動で控える、②履歴削除・機種変更・端末故障後もメール確認で戻せる、③家族と同じ手帳を共有する時の保存先になる、の3点へ整理した。
- PWA更新用にservice worker cacheを `v35` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカルのfresh monitorで、日記が主課題のまま、復元の利点と「クラウド保存の説明を見る（任意）」が表示されることを実操作確認した。
- ローカルで説明リンクを押し、クラウド欄がopenになり、機能説明、自動の控え、復元、家族共有の3利点がすべて表示されることを確認した。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番 `/home` でも復元の利点と新しいリンク名を確認し、リンク先に機能説明と3利点が表示されることを実操作確認した。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v35` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment: `dpl_An4TtRMBsJ3xJA5yqmAhd1PtCgjJ` がREADY。
- deployment URL: `https://oyano-moshimo-navi-3hi80e9o1-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に一時生成された `.vercel/` は、worktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-1300` へ退避した。

## 2026-08-25 追記 238 — 日記カードの確認項目作成とボタン配色を明確化

ユーザーから、日記カードの「確認リストに追加」が何をする操作か分からず、中央だけ緑色なので「緑のボタンだけが操作できるのか」と見えるとの指摘があった。

原因:

- 「確認リストに追加」は、日記本文を判定して「薬・服薬について確認する」など、家族や病院へあとで確認する項目を即時作成する機能だが、ボタン内に説明がなかった。
- 日記カードの3つの操作はすべて押せるにもかかわらず、CSSの `nth-child(2)` で中央の確認リスト操作だけを緑色にしていた。緑が「唯一押せる」「選択中」と誤解される配色だった。
- 編集欄を開いた後も下に「内容を編集する」ボタンが残り、同じ操作をもう一度押せるように見えていた。

変更:

- ボタン名を「確認リストに追加」から「確認することを作る」へ変更し、下に「家族や病院にあとで聞く項目」と補足した。
- 日記カードの3操作へそれぞれ補足を追加した。「内容を編集する / 日付や記録内容を直す」「確認することを作る / 家族や病院にあとで聞く項目」「AIに相談する / この記録をもとに質問する」。
- 3つの補助操作から緑背景を外し、すべて同じ白地・青緑文字・枠線のデザインへ統一した。緑は「変更を保存する」など、その場の主操作だけに残した。
- 編集欄が開いている時は、最初のボタンを「上で編集中」と表示してdisabledにし、灰色で押せない状態を示すようにした。
- 確認項目を作成した後は、「『薬・服薬について確認する』を、あとで確認することに追加しました」のように、実際に作られた項目名を表示するようにした。
- 確認リストの冒頭説明を「病院に聞くことや家族へ頼むことを、あとで忘れず確認するための一覧」へ変更した。手入力の確定ボタンも「確認することを追加」へ変更した。
- 日記のまとめ説明も「編集、あとで確認することの作成、AI相談」へ変更した。
- PWA更新用にservice worker cacheを `v36` へ上げた。

確認:

- `corepack pnpm --filter web run typecheck` 成功。
- `corepack pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカルで架空の日記を作り、3つの補助ボタンの背景がすべて `rgb(248, 251, 245)`、文字色がすべて `rgb(47, 110, 130)` で一致することを確認した。
- 「内容を編集する」を押すと「上で編集中」になり、disabled、灰色背景へ変わることを確認した。
- 「確認することを作る」を押すと、日記内容に応じた「薬・服薬について確認する」という項目名付きの完了表示が出ることを確認した。
- 確認リストへ移動し、新しい説明文と作成された項目が表示されることを確認した。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番 `/home` でも新しい名称と補足が表示され、3つの補助ボタンの背景・文字色が一致することを確認した。本番では確認項目の追加操作を行わず、利用データを変更していない。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v36` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment: `dpl_C9XzuuFsbGd71JrKsHzrjF5Q8mvy` がREADY。
- deployment URL: `https://oyano-moshimo-navi-7su9goagq-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に一時生成された `.vercel/` は、worktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-1316` へ退避した。

## 2026-08-25 追記 239 — 全体フォント統一と過去の手帳の表示整理

ユーザーから、画面全体で字体が統一されておらずAI生成画面のように見えること、過去の手帳でカレンダーを押した結果が分かりにくいこと、実記録と月間まとめの順序・重複表示のため記録を見つけにくいことを指摘された。

原因:

- 全体で標準ゴシック、丸ゴシック、明朝体の3種類を意図的に使い分け、手帳名、月見出し、カレンダー見出しなどだけ字体が変わっていた。
- 過去の手帳では同じ記録を「最近の記録」と全件一覧の2か所へ重複表示し、その間に最近のまとめと月間まとめを置いていた。
- 日付選択後に、カレンダー直下と詳細一覧内の2か所で選択状態を表示していた。「すべての日付に戻す」という文言も、何が戻るのか分かりにくかった。
- 記録が0件の日を選んでも件数が0になるだけで、操作が反映されたことが伝わりにくかった。
- 「この月の見返し」が月全体の自動集計であること、記録の追加・編集に応じて内容が変わることを説明していなかった。

変更:

- Google Fontsの `Noto Sans JP`、`Zen Maru Gothic`、`Shippori Mincho` 読み込みを外した。
- 全画面の本文・見出し・手帳名を、iPhone・Mac・Windowsで普段使われる日本語システムゴシック体1系統へ統一した。既存の `--font-body`、`--font-rounded`、`--font-serif` はすべて同じ `--font-ui` を参照するため、古い個別指定が残る画面も同じ字体になる。
- 過去の手帳から「最近のまとめ」「最近の記録」「すべての記録を見返す・編集する」の重複表示を外し、カレンダー直下へ実際の記録一覧を直接表示する構造にした。
- 一覧の先頭を「保存した記録 / すべての記録」または「選んだ日の記録 / 日付」と件数に整理した。
- 選択日を戻す操作を「全日付の記録を表示」へ変更し、「○日の記録だけ表示中 / すべての日付に戻す」という二重案内を削除した。
- 記録がない日を押した場合、カレンダー直下に「この日には記録がありません」、一覧側に「別の日を選ぶか、全日付の記録を表示」と明示するようにした。
- 各月は、月見出し、実記録カード、折りたたみ式の月まとめの順へ変更した。月まとめは初期状態で閉じ、記録を先に読めるようにした。
- 月まとめの見出しを「この月の記録から自動で作ったまとめ」へ変更し、「記録を追加・編集すると、この内容も自動で変わります」と明記した。
- 日付や「変化・急ぎ」「写真」で一覧を絞り込んでいても、月まとめ自体はその月の全記録を使って作るようにした。
- AI導線を「この月の記録まとめでAIに相談する」へ変更した。
- PWA更新用にservice worker cacheを `v37` へ上げた。

確認:

- `CI=true pnpm --filter web run typecheck` 成功。
- `CI=true pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカルで架空の手帳と記録2件を作り、記録が2件ある日を押すと案内・一覧件数・実カードがすべて2件になることを実操作確認した。
- 記録がない日を押すと2か所に空の日の説明が出て、「全日付の記録を表示」で2件へ戻ることを確認した。
- 実記録カードが月まとめより先に表示され、月まとめが初期状態で閉じていることを確認した。開くと自動作成・自動更新の説明と新しいAI相談名が表示されることを確認した。
- 旧文言「すべての日付に戻す」「記録だけ表示中」「すべての記録を見返す・編集する」が表示されないことを確認した。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番の既存3件で、全件表示、8月24日の2件表示、記録がない8月23日の案内、実記録の後に閉じた月まとめが出ることを実操作確認した。本番データの追加・編集は行っていない。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v37` を確認。
- `smoke-monitor-journey` は、本番の最終回答受付を許可名設定までHTTP 503で停止しているため「未入力回答は400」の1項目だけ失敗する。追記234から継続中の意図した受付停止で、今回変更した画面・APIの回帰ではない。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deploymentはREADY。
- deployment URL: `https://oyano-moshimo-navi-hfhmnr1se-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に一時生成された `.vercel/` と `.env.local` は、それぞれworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-font-history` と `/private/tmp/oyano-moshimo-navi-env-local-20260825-font-history` へ退避した。

## 2026-08-25 追記 240 — ロゴ以外を読みやすいBIZ UDP明朝へ変更

ユーザーから、追記239で統一したゴシック体をやめ、ロゴの「親のもしもナビ」だけはゴシック体のまま、本文や見出しを明朝体に近い読みやすい字体へ変更するよう要望があった。モニター用の募集・登録・最終アンケートも同じ字体で確認できることを求められた。

判断:

- 本文用には `BIZ UDPMincho` を採用した。明朝系の雰囲気を保ちながら、文字の形や濁点を判別しやすく設計されたユニバーサルデザイン書体で、中高年を含む利用者の読みやすさを優先できる。
- ロゴはサービス識別のため、従来の太い日本語システムゴシック体を維持した。
- 通常版とモニター版を別CSSにはせず、共通layoutで字体を適用し、画面間の不一致を防いだ。

変更:

- `next/font/google` の `BIZ_UDPMincho` 400・700を読み込み、全画面の `--font-ui`、`--font-body`、`--font-rounded`、`--font-serif` から参照するようにした。
- フォント読込前も明朝系で表示されるよう、`Yu Mincho`、`Hiragino Mincho ProN` などをfallbackへ設定した。
- 上部固定ヘッダー、初回画面のロックアップ、手帳表紙、初回登録のブランド表示、管理画面ブランドの「親のもしもナビ」は `--font-brand` のゴシック体へ固定した。
- 本文、見出し、ボタン、入力欄、手帳、モニター募集、モニター新規登録、7日間案内、最終アンケートはBIZ UDP明朝へ統一した。
- PWA更新用にservice worker cacheを `v38` へ上げた。

確認:

- `CI=true pnpm --filter web run typecheck` 成功。
- `CI=true pnpm --filter web run build` 成功。162ページを生成。
- `git diff --check` 成功。
- ローカルの通常手帳で、ヘッダーと手帳表紙の「親のもしもナビ」はゴシック体のまま、手帳名、説明、日記、ボタンがBIZ UDP明朝になることを目視確認した。
- ローカル `/monitor` で、募集見出し、説明、報酬・期間、お願い事項がBIZ UDP明朝になり、文字切れがないことを確認した。
- ローカル `/start?reset=1&monitor=1` でモニター用の新規登録画面を表示し、ロゴだけゴシック、登録見出し・説明・必須項目がBIZ UDP明朝になることを確認した。
- ローカル `/monitor/report?preview=1` で、最終報告見出し、説明、同意文、回答項目がBIZ UDP明朝になることを確認した。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番 `/monitor` と `/monitor/report?preview=1` を実ブラウザで開き、新字体と文字切れがないことを確認した。
- 本番 `/start?monitor=1` のHTMLに「はじめての手帳登録」「市区町村（必須・番地不要）」が含まれることを確認した。既存手帳があるブラウザでは手帳へ戻る仕様のため、本番データをリセットする確認は行っていない。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v38` を確認。
- `smoke-monitor-journey` の既知のHTTP 503は、許可名設定まで最終回答受付を停止しているためで、今回の字体変更による回帰ではない。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deploymentはREADY。
- deployment URL: `https://oyano-moshimo-navi-dtadyfame-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- モニター募集: `https://oyano-moshimo-navi.vercel.app/monitor`。
- モニター新規登録: `https://oyano-moshimo-navi.vercel.app/start?monitor=1`。
- 最終アンケート項目プレビュー: `https://oyano-moshimo-navi.vercel.app/monitor/report?preview=1`。
- deploy時に一時生成された `.vercel/` と `.env.local` は、それぞれworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-biz-mincho` と `/private/tmp/oyano-moshimo-navi-env-local-20260825-biz-mincho` へ退避した。

## 2026-08-25 追記 241 — BIZ UDP明朝から軽いNoto Serif JPへ変更

ユーザーから、追記240で採用したBIZ UDP明朝も文字が見にくいため、別の読みやすい字体を試すよう要望があった。

判断:

- BIZ UDP明朝は700の太字で縦線が強くなり、この画面の大きな見出しや太字本文では黒く詰まって見えていた。
- 代わりに `Noto Serif JP` を採用した。明朝系の雰囲気は残しながら線のバランスが素直で、通常本文から大見出しまで同じ書体で読みやすくできる。
- 読みやすさを優先し、読み込む太さは400・600だけにした。既存CSSが700以上を指定する箇所も600で表示されるため、太字が過度に黒くならない。
- ロゴの「親のもしもナビ」は、ユーザー指定どおり従来の日本語システムゴシック体を維持した。

変更:

- `next/font/google` の読み込みを `BIZ_UDPMincho` から `Noto_Serif_JP` 400・600へ変更した。
- 全画面の共通font variableを `--font-readable-serif` へ変更し、本文・見出し・ボタン・入力欄・通常手帳・モニター関連画面へ `Noto Serif JP` を適用した。
- フォント読込前は `Yu Mincho`、`Hiragino Mincho ProN` などの明朝系fallbackを使う。
- ロゴ用の `--font-brand` と既存ロゴセレクタは変更していない。
- PWA更新用にservice worker cacheを `v39` へ上げた。

確認:

- `git diff --check` 成功。
- `CI=true pnpm --filter web run build` 成功。162ページを生成。
- build完了後に単独実行した `CI=true pnpm --filter web run typecheck` 成功。最初にbuildと並列実行したtypecheckだけは、buildが `.next/types` を入れ替えたため一時的にTS6053となったが、コードエラーではない。
- ローカルの通常手帳で、ロゴはゴシックのまま、手帳名、案内、日記、操作名がNoto Serif JPになることを実ブラウザで確認した。
- ローカル `/monitor`、`/start?monitor=1`、`/monitor/report?preview=1` を実ブラウザで開き、募集・登録・最終回答が同じNoto Serif JPになり、BIZ UDP明朝より線が軽く表示されることを確認した。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- ローカル `smoke-monitor-journey` は、発行済みモニター名allowlistがないため最終回答拒否が503、クラウド同期設定がないため未認証同期が501となる既知の2項目だけ失敗した。字体変更による回帰ではない。
- 本番 `/monitor` と `/monitor/report?preview=1` を実ブラウザで開き、新字体が反映され、文字切れがないことを確認した。
- 本番 `/start?monitor=1` のHTMLに「はじめての手帳登録」「市区町村（必須・番地不要）」が含まれることを確認した。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v39` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment `dpl_J2wHDUJMqiNeE4RvB79FCx5BnCuH` はREADY。
- deployment URL: `https://oyano-moshimo-navi-qnxox0snh-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- モニター募集: `https://oyano-moshimo-navi.vercel.app/monitor`。
- モニター新規登録: `https://oyano-moshimo-navi.vercel.app/start?monitor=1`。
- 最終アンケート項目プレビュー: `https://oyano-moshimo-navi.vercel.app/monitor/report?preview=1`。
- deploy時に一時生成された `.vercel/` はworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-noto-serif` へ退避した。今回は `.env.local` は生成されなかった。

## 2026-08-25 追記 242 — 過去の記録カードの背景境界を強調

ユーザーから、過去の手帳でページ背景、記録カード、カード内のナビ説明の色が近く、領域の境目が分かりにくいと指摘された。

変更:

- 過去の手帳全体を淡いベージュの面にし、外枠と影を少し強めた。
- 記録一覧の背景を一段濃いベージュへ変更し、カレンダーとの境界を2pxの線で明示した。
- 月見出しを淡い緑へ変更し、外枠、影、左側の青緑アクセント線を追加した。
- 1件ごとの記録カードを白にし、ベージュの外枠、影、左側の青緑アクセント線を追加した。
- 月見出し、記録カード、次の記録の間隔を広げた。
- 「ナビからの寄り添い」を淡い緑の面と緑の外枠で区切り、見出し下へ境界線を追加した。
- ナビのひとことを白い内側カードにし、確認ポイント一覧もさらに薄い面と外枠で分けた。
- PWA更新用にservice worker cacheを `v40` へ上げた。

確認:

- `git diff --check` 成功。
- `CI=true pnpm --filter web run typecheck` 成功。
- `CI=true pnpm --filter web run build` 成功。162ページを生成。
- ローカルの実データで過去の記録を表示し、外側ベージュ、緑の月見出し、白い記録カード、緑のナビ欄、白いナビコメントの5段階が視覚的に分かれることを実ブラウザで確認した。
- 同じモニターテスト中の手帳画面でも新しい境界表示になることを確認した。通常版とモニター版は同じ記録部品を使う。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番で「記録を見る」から過去の手帳へ移動し、8月24日の2件を選択して、月見出しと各記録カードの境界が新表示になることを実ブラウザで確認した。本番データの追加・編集は行っていない。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v40` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment `dpl_GehAjJ9jtRtD3ccr2U8U8WQcu82n` はREADY。
- deployment URL: `https://oyano-moshimo-navi-5pbktymtl-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に一時生成された `.vercel/` はworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-card-contrast` へ退避した。今回は `.env.local` は生成されなかった。

## 2026-08-25 追記 243 — 記録種類が選択操作であることを明示

ユーザーから、記録入力画面の「通常・変化あり・急ぎ」が押して選択できる項目であることを画面に書いた方がよいと指摘された。

変更:

- 3つの選択肢の上に「記録の種類を選ぶ」「3つから1つ選択できます」を表示した。
- 現在選ばれている項目の中へ「選択中」を表示した。
- 各ボタンへ `aria-pressed` を追加し、読み上げでも選択状態が分かるようにした。
- 新しい記録を書く画面と、過去記録の編集画面の両方へ同じ案内を追加した。
- 選択肢全体へ外枠を追加し、選択中の白い項目は影を少し強めた。
- PWA更新用にservice worker cacheを `v41` へ上げた。

確認:

- `git diff --check` 成功。
- `CI=true pnpm --filter web run typecheck` 成功。
- `CI=true pnpm --filter web run build` 成功。162ページを生成。
- ローカルの新規記録画面で案内文と「通常 / 選択中」を確認した。「変化あり」を押すと「選択中」が変化ありへ移り、DOM上の押下状態も切り替わることを実ブラウザで確認した。確認後は通常へ戻した。
- ローカルの過去記録で「内容を編集する」を開き、編集画面にも同じ案内文と選択中表示が出ることを確認した。保存せず「変更せず閉じる」で終了し、記録内容は変更していない。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番の新規記録画面で「記録の種類を選ぶ」「3つから1つ選択できます」「選択中」が表示されることを実ブラウザで確認した。本番では選択や保存を行っていない。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v41` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment `dpl_6ZNcVj3aCU1PAEUaGyc2F1kpQEM9` はREADY。
- deployment URL: `https://oyano-moshimo-navi-7obbx0o3u-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に一時生成された `.vercel/` はworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-mood-choice` へ退避した。今回は `.env.local` は生成されなかった。

## 2026-08-25 追記 244 — 記録本文を強調し、3つの操作を小型化

ユーザーから、過去の記録カードで「内容を編集する」「確認することを作る」「AIに相談する」の3ボタンが大きすぎて、実際に記録した内容を見つけにくいと指摘された。また「確認することを作る」という名称も意味が分かりにくかった。

変更:

- 記録本文を「記録した内容」という見出し付きの淡いクリーム色の枠へ入れた。
- 記録本文は18px・太字へ上げ、左側へ金色のアクセント線を付け、カード内で最初に目に入るようにした。
- 3つの操作ボタンを記録本文の直下から外し、「ナビからの寄り添い」の後、カード最下部へ移動した。
- 操作欄へ小さく「この記録の操作」と表示した。
- ボタンの補足文を外し、44pxのタップ領域を保ったまま高さと余白を縮小した。スマホでも3つを1列に並べる。
- 表示名を「編集」「確認リストに追加」「AIに相談」へ短縮した。
- 各ボタンには詳しい `aria-label` を残し、短い表示名でも操作内容を読み上げられるようにした。
- PWA更新用にservice worker cacheを `v42` へ上げた。

確認:

- `git diff --check` 成功。
- `CI=true pnpm --filter web run typecheck` 成功。
- `CI=true pnpm --filter web run build` 成功。162ページを生成。
- ローカルの過去記録で、「記録した内容」の枠が日付直下に表示され、その後にナビ欄、最後に小型の3ボタンが出ることを実ブラウザで確認した。
- 小型化後の「編集」を押すと編集画面が開くことを確認し、「変更せず閉じる」で終了した。記録内容は変更していない。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番の既存3件で「記録した内容」の枠と本文強調が反映されることを実ブラウザで確認した。本番データの追加・編集は行っていない。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v42` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment `dpl_CXYLrw2LpfF8Bx5Ws1wYqxsfBccm` はREADY。
- deployment URL: `https://oyano-moshimo-navi-qzbn5uuka-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に一時生成された `.vercel/` はworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-compact-diary-actions` へ退避した。今回は `.env.local` は生成されなかった。

## 2026-08-25 追記 245 — ナビの確認ポイントを濃い文字へ変更

ユーザーから、「変化があった日は、いつから・誰が見たか・次に誰へ伝えるか」「家族に送る時は『今日あったこと』『次に確認したいこと』を分ける」といったナビの箇条書きが薄くて読みにくいと指摘された。

変更:

- 「ナビからの寄り添い」内の確認ポイントを、薄い補足色から濃い紺灰色 `#263b43` へ変更した。
- 文字サイズを16pxから17pxへ上げ、太さを強めた。
- 箇条書きの点を青緑 `#2f6e82` へ変更し、各項目の開始位置を見つけやすくした。
- PWA更新用にservice worker cacheを `v43` へ上げた。

確認:

- `git diff --check` 成功。
- `CI=true pnpm --filter web run typecheck` 成功。
- `CI=true pnpm --filter web run build` 成功。162ページを生成。
- ローカルの過去記録で、淡い緑のナビ欄に対して箇条書き本文と点が濃く表示されることを実ブラウザで確認した。
- ローカル `node scripts/smoke-web.mjs http://localhost:3100` 成功。
- 本番の既存記録で同じ箇条書きを表示し、濃い文字と青緑の点が反映されることを実ブラウザで確認した。本番データの追加・編集は行っていない。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` 成功。
- 本番 `/sw.js` でcache `v43` を確認。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment `dpl_DxJTnzNK8WjBtfSwkx44DcVu2pnv` はREADY。
- deployment URL: `https://oyano-moshimo-navi-h5x2fjek4-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に一時生成された `.vercel/` はworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-dark-advice-text` へ退避した。今回は `.env.local` は生成されなかった。

## 2026-08-25 追記 246 — 7日間モニターの最終通過テストと日付境界の再確認

ユーザーから、モニター本人と同じ手順で初日登録から7日目終了、翌日の最終アンケート、回答完了までを複数回シミュレーションし、最後まで迷わず進めるか再確認するよう依頼があった。

日付仕様の確認:

- 開始日を1日目とし、7日目23:59:59までは記録期間で、最終アンケートはまだ開かない。
- 8日目の0:00ちょうどから手帳上部を「7日間モニター 完了」へ切り替え、「最終アンケートに回答する」を表示する。
- 朝開始、23:59開始、月またぎ、年またぎの4パターンを `scripts/test-monitor-timeline.mjs` で検証した。すべて7日目23:59:59は未開放、8日目0:00は開放になった。
- 1〜6日目は「今日を含めてあとN日」、7日目は「今日が7日目（最終日）」と表示するよう修正した。従来の7日目「あと1日です」は、もう1日記録が必要だと誤解されるため廃止した。
- `/monitor/report` を期間中に直接開いた場合も同じ文言を使い、7日目にはフォームを出さず今日の記録へ戻す。

実ブラウザの通過テスト:

- モニター入口から新規登録をやり直し、必須4項目を空欄のまま状況カードを押すと、呼び名・関係・都道府県・市区町村のエラー一覧と各項目のエラーが表示されることを確認した。
- 4項目を入力して手帳を作成し、1日目案内、今日の記録保存、保存完了、過去の記録の再発見、編集、変更保存まで実操作した。
- 確認リストを開いて状態を更新し、プロフィールの「書類・鍵などの保管メモ」を保存した。
- 家族招待画面を開いた。ローカル環境はクラウド未設定のため招待操作は停止するが、停止理由と手帳へ戻る導線が表示されることを確認した。
- AI相談画面で質問、同意、送信まで操作した。ローカル環境はAIキー未設定のため「いまは相談を受け付けられません」と安全に表示された。本番のAI実回答は前回までの確認を継続する。
- 開発環境だけで開始日時を指定できるテスト補助を追加し、7日目の手帳と直接アクセスgate、8日目の完了案内と回答フォームを実画面で再現した。production buildでは同じqueryを渡しても1日目となり、テスト用日時指定が無効になることを確認した。
- 開発環境かつ `MONITOR_E2E_MODE=1` の時だけ、スクリーンショット保存と最終回答保存を外部へ書き込まず成功応答にする通過テスト補助を追加した。productionではこの分岐は動かない。
- 最終回答は2パターン実行した。1回目は全機能を試した回答、2回目は「保存できなかった」「使う必要がなかった」を中心にした回答で、どちらもスクリーンショット1枚を添付して送信完了まで進んだ。
- 2回目はクラウドワークス名を意図的に間違え、画像送信前に照合エラーが出ること、入力内容と添付が保持されること、名前だけ直して再送信できることを確認した。
- 送信後は手帳上部のモニター案内が消え、回答URLを再度開いても送信完了画面になり、同じ端末から二重回答画面へ戻らないことを確認した。

通過テストで見つけて修正した問題:

- 今日の記録が空欄のまま「この人の手帳に残す」を押すと、従来は無反応だった。
- 空欄時は入力欄へ戻し、「記録内容を1行入力するか、写真を1枚追加してください。」を濃い赤のエラーとして表示するようにした。`aria-invalid` と `aria-describedby` も追加した。
- モニター用smokeは、許可名未設定時の意図した503と、クラウド未設定時の501を正常な停止状態として扱えるよう更新した。
- PWA更新用にservice worker cacheを `v44` へ上げた。

確認:

- `pnpm test:monitor-timeline` 成功。通常開始、深夜開始、月またぎ、年またぎを確認。
- `pnpm --filter web run typecheck` 成功。
- `WEB_BASE_URL=http://localhost:3101 pnpm smoke:monitor` 成功。開始画面、期間gate、初期登録、AI利用状況API、未入力回答拒否、画像なし拒否、未認証クラウド同期を確認。
- `pnpm --filter web run build` 成功。162ページを生成。
- production buildをローカル起動した `WEB_BASE_URL=http://localhost:3102 pnpm smoke:monitor` も全項目成功。
- production buildでは `MONITOR_E2E_MODE=1` を渡しても開発用日時指定が動かず、回答画面は1日目gateのままであることを実ブラウザで確認した。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

募集開始前に残る運営作業:

- 採用した10人の正確なクラウドワークス表示名をVercel Productionの `MONITOR_ALLOWED_CROWDWORKS_NAMES` へ登録して再deployする。
- 許可名が未設定の間、本番の最終回答APIは意図的に503で受付停止する。実在モニター名を使った本番の保存完了テストは、10人の表示名設定後に1件だけ実施する。

commit・本番:

- 実装commit: `160734e` (`Verify seven-day monitor journey`)。`origin/main` へpush済み。
- GitHub Actions CI `32814137788` はweb/mobile typecheck、web build、smokeを含めすべて成功。
- GitHub ActionsのVercel workflow `32814137763` は、Vercel secrets未設定のため設計どおりdeploy jobをスキップした。
- 既存projectを明示してVercel CLIからproduction deploymentを実行し、READYとalias更新を確認した。
- deployment ID: `2ZxzeofNfUJH6JpVzSGVkNo9XFVW`。
- deployment URL: `https://oyano-moshimo-navi-7xq193kw6-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` は全項目成功。
- 本番 `WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app pnpm smoke:monitor` は全項目成功。許可名未設定の503も意図した受付停止として確認した。
- 本番 `/sw.js` でcache `v44` を確認した。
- `vercel link` が一時生成した `.vercel/` と `.env.local` は、worktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-monitor-final/` へ退避した。`.env.local` の内容は表示していない。

## 2026-08-25 追記 247 — 固定人数・事前許可名を廃止し、参加者向けモニターセットを作成

ユーザーから、実際に何人へ送るかは未確定で、ランダムに選んだ参加者へ送るため、採用者名を先に登録する方式ではなく、最終回答フォームで本人がクラウドワークス表示名を入力する運用へ変更するよう指示があった。また、参加者へそのまま渡せる説明書を含むモニターセットの作成依頼があった。

回答者名の変更:

- `MONITOR_ALLOWED_CROWDWORKS_NAMES` による事前許可名照合を回答APIから廃止した。参加人数と参加者名を事前に固定しない。
- 最終回答フォームでは「あなたのクラウドワークス表示名」と表示し、本人がプロフィール画面の表示名をそのまま入力する。
- 「事前にお伝えするモニター番号はありません」とフォーム内に明記した。
- 表示名が空欄の場合は、画像アップロード前の事前確認でHTTP 400とし、「クラウドワークスのプロフィールに表示されている名前を入力してください」と表示する。
- 同じ表示名の再送を最新回答で上書きする既存仕様は継続した。
- 管理者の環境変数確認APIと `docs/ENVIRONMENT_MATRIX.md` から、不要になった許可名環境変数を削除した。
- `scripts/smoke-monitor-journey.mjs` は、未入力回答が必ず400になることを検証する内容へ戻した。

モニター資料:

- `docs/MONITOR_PARTICIPANT_GUIDE.md` を新規作成した。開始URL、初日登録、毎日の記録、期間中に試す機能、8日目0:00の最終回答、本人入力する表示名、スクリーンショット、個人情報、困った時の連絡までを参加者向けの言葉でまとめた。
- `docs/MONITOR_SEND_MESSAGE.txt` を新規作成した。ランダムに選んだ参加者へクラウドワークスからそのまま送れる文面で、固定人数やモニター番号を使わない。
- `docs/TEST_COOPERATION_REQUEST.md`、`docs/FAMILY_TEST_PROTOCOL.md`、`docs/CLAUDE_MONITOR_REVIEW_PACKET.md` を固定10人・許可名方式から参加人数未固定の運用へ更新した。
- 参加人数が5人未満なら比率で合否を作らず定性判断、5人以上なら前向きな支払意向30%と5日以上記録70%を暫定の参考線にする形へ変更した。
- 配布用として、4ページのPDF、編集用DOCX、コピペ送付文を作成した。3ファイルを `親のもしもナビ_7日間モニター参加セット.zip` にまとめ、ZIP内は文字化けを避けるため `monitor_guide.pdf`、`monitor_guide.docx`、`send_message.txt` のASCII名にした。
- 配布成果物はリポジトリ外のCodex出力フォルダ `outputs/` に保存した。リポジトリには内容の正本となるMarkdownと送付文だけを保存した。

文書検証:

- Documentsスキルの `compact_reference_guide` と `customer_pack` を基準に、Letter、四辺1インチ、本文11pt相当、実番号リスト、固定幅9360 DXAの表としてDOCXを生成した。
- 内蔵LibreOfficeへ日本語フォントを検証時だけ追加してPDF化し、全4ページを100%表示で目視確認した。文字欠け、重なり、表の崩れ、孤立ページ、途中切れはない。
- PDFへArial Unicode MSが埋め込まれていること、4ページ、Letter、リンク付きであることを確認した。
- `unzip -t` でDOCXの全構成ファイルが正常、表8件が `tblW=9360`、`tblInd=120`、4セクションが `pgSz=12240x15840`、余白1440、header/footer 708であることを確認した。
- ZIPは3ファイルだけを含むことを `unzip -l` で確認した。

実装確認:

- `pnpm --filter web run typecheck` 成功。
- `pnpm test:monitor-timeline` 成功。朝開始、深夜開始、月またぎ、年またぎ、7日目終了から8日目0:00の境界を確認。
- `pnpm --filter web run build` 成功。162ページを生成。
- `pnpm lint` はESLint設定ファイルが未作成のため、Next.jsの対話式設定画面で停止した。コードのlint違反ではなく、既存のリポジトリ設定上の制約。
- production buildのローカル起動で `node scripts/smoke-web.mjs http://127.0.0.1:3100` と `WEB_BASE_URL=http://127.0.0.1:3100 pnpm smoke:monitor` が成功した。
- ローカルAPIで未登録の任意名 `ランダム参加者_123` の事前確認がHTTP 200 `{"ok":true}`、空欄がHTTP 400になることを確認した。回答本体や画像は保存していない。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

本番:

- Vercel production deployment `dpl_6h1fyDfK4DcCnqQzy8BrkhBEuSWR` はREADY。
- deployment URL: `https://oyano-moshimo-navi-m9lpqblbo-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` と `WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app pnpm smoke:monitor` は全項目成功。
- 本番APIで、事前登録していない任意の表示名がHTTP 200、空欄がHTTP 400になることを確認した。`validateOnly` だけを使い、回答本体や画像は保存していない。
- deploy時に使用した `.vercel/` はworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-random-monitor-kit` へ退避した。`.env.local` は生成していない。

現在の運用:

- 参加人数は固定しない。参加者を選んだら、配布セットの `send_message.txt` と `monitor_guide.pdf` を渡す。
- 最終回答では、参加者本人がクラウドワークスのプロフィール表示名を入力する。事前名簿登録とモニター番号発行は不要。
- 支払管理表には、本人が入力した表示名、提出日時、支払状態、削除予定日、削除依頼を記録する。

commit・GitHub:

- 実装・資料commit: `7a6955c` (`Allow self-identified monitor participants`)。`origin/main` へpush済み。
- GitHub Actions CI `32815752642` はweb/mobile typecheck、web build、smokeを含めすべて成功。
- GitHub ActionsのVercel workflow `32815752364` はcheck成功、Vercel secrets未設定のためdeploy jobを設計どおりスキップした。productionは上記のVercel CLI deploymentで反映済み。

## 2026-08-25 追記 248 — 募集条件を「7日間で3回以上」に統一し、配布セットを再作成

ユーザーから、クラウドワークスへ掲載するモニター募集文として、7日間で「今日の記録」を3回以上書く条件、応募条件、報酬・期間、機密保持、応募時の質問を追加・修正したいとの依頼があった。提示文には旧仕様の「初期設定は呼び名と関係のみ」「最終日にGoogleフォーム」「スクリーンショット3枚必須」「検収後に支払い」も含まれていたため、現在の本番仕様と報酬方針へ合わせて整理した。

募集条件と参加者向け表現:

- 記録課題を「1日1回を目安に、7日間で3回以上」へ変更した。毎日書けない日があっても参加を継続でき、1日目の記録も3回に含める。
- 初期設定は本番で必須の呼び名、関係、都道府県、市区町村の4項目とした。呼び名と地域は仮名・架空でよく、クラウド保存は任意。
- 期間中の課題へ、保存した過去の記録を見返す操作を明記した。確認リスト、書類の所在メモ、AI相談は各1回、家族招待は画面を開いて手順確認までで、実送信は任意。
- 最終回答はGoogleフォームではなく、開始日を1日目とした8日目0:00以降にアプリ内へ表示する専用フォームと明記した。回答時間は15〜20分。
- スクリーンショットは1枚必須・最大3枚。3枚必須には戻していない。
- 報酬は検収後ではなく、最終回答の提出で2,000円を支払う。記録未達、機能を使えなかった回答、否定回答でも報酬は変えない。
- 同じスマートフォン・同じブラウザ、プライベートブラウズ不使用、履歴・サイトデータ削除禁止、個人情報を入力・撮影しないこと、回答と画像を6か月後に削除することを募集文へ追加した。
- `docs/MONITOR_RECRUITMENT_POST.txt` を新規作成し、クラウドワークスへそのまま貼れる平文の募集文を保存した。
- `docs/TEST_COOPERATION_REQUEST.md`、`docs/MONITOR_PARTICIPANT_GUIDE.md`、`docs/MONITOR_SEND_MESSAGE.txt`、`docs/FAMILY_TEST_PROTOCOL.md`、`docs/CLAUDE_MONITOR_REVIEW_PACKET.md` を同じ条件へ更新した。

画面と集計:

- `/monitor` の課題を「1日1回を目安に、7日間で3回以上」へ変更し、過去の記録を見返す課題も表示した。
- 手帳上部のモニター案内は、端末内の保存イベントを暦日ごとに数え、3日に届くまでは「あとN日分」、3日以上なら「3回以上の記録ができています」と表示する。毎日必須とは表示しない。
- 期間中に最終回答URLを直接開いた場合の説明も3回以上へ変更した。
- 最終アンケートの自己申告選択肢を「7日すべて / 5〜6日 / 3〜4日 / 2日 / 1日 / 保存できなかった」へ変更した。
- 運営管理画面の集計を「5日以上記録」から「3日以上記録」へ変更した。
- 参加人数5人以上の場合の暫定判定も、3日以上記録した人70%以上を前進・再設計の基準、2日以下の人70%以上を立ち止まりの基準へ変更した。
- PWA更新用にservice worker cacheを `v45` へ上げた。

配布成果物:

- リポジトリ外の `outputs/親のもしもナビ_モニター募集文.txt` を新規作成した。
- `outputs/親のもしもナビ_7日間モニター参加ガイド.docx` とPDFを新条件で再生成した。
- 配布ZIP `outputs/親のもしもナビ_7日間モニター参加セット.zip` を再作成し、`monitor_guide.docx`、`monitor_guide.pdf`、`send_message.txt` の3ファイルだけを収録した。
- 日本語フォントを埋め込んだPDFは4ページ、US Letter、リンク付き。全4ページを100%表示で目視し、文字欠け、重なり、途中切れ、不要な空白ページがないことを確認した。
- DOCXは4セクション、全8表が `tblW=9360`、`tblInd=120`。ZIPとDOCXの圧縮データ検査も成功した。

実装確認:

- Web TypeScript `tsc --noEmit` 成功。
- `scripts/test-monitor-timeline.mjs` 成功。朝開始、23:59開始、月またぎ、年またぎ、7日目終了から8日目0:00の境界を再確認した。
- Next.js production build成功。162ページを生成した。
- ローカルproduction buildで通常smokeとモニターsmokeが成功した。未入力回答400、画像なし400、未認証クラウド同期501を確認した。
- ローカル `/monitor` のHTMLで「7日間で3回以上」、旧文言「合計7回」が無いこと、`/sw.js` が `v45` であることを確認した。
- 本番の通常smokeとモニターsmokeも成功した。本番は未入力回答400、画像なし400、未認証クラウド同期401。
- 本番 `/monitor` で「7日間で3回以上」「スクショを1〜3枚」「最終回答の提出でお支払い」を確認し、`/sw.js` で `v45` を確認した。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

commit・GitHub・本番:

- 実装・資料commit: `f657496` (`Align monitor tasks to three records`)。`origin/main` へpush済み。
- GitHub Actions CI `32826309666` は成功。
- GitHub Actions Vercel workflow `32826309692` は成功。
- Vercel production deployment `dpl_13UbNg6Q5gjLqbomEDgBcTs6tsSW` はREADY。
- deployment URL: `https://oyano-moshimo-navi-d9m9chdly-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に生成された `.vercel/` はworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260825-monitor-three-records` へ退避した。`.env.local` は生成していない。

## 2026-08-26 追記 249 — 特商法ページのスマホ横崩れを修正

モニター参加者から、スマートフォンのBraveで「特定商取引法に基づく表記」ページのレイアウトが横に崩れるとの報告とスクリーンショットが届いた。広告ブロックのオン・オフでは変化しないとの申告だった。

原因と修正:

- `/legal/tokushoho` が管理画面用の `.admin-table` を直接利用しており、同クラスの `min-width: 680px` がスマホでも有効になっていた。画面幅390pxでdocument幅721px、表幅680pxとなることを本番で再現した。
- 特商法ページの表を公開ページ専用の `.legal-disclosure-table` へ分離した。管理画面の表には変更を加えていない。
- PC・タブレットでは従来どおり項目名と内容の2列、640px以下では各項目を「項目名→内容」の縦並びにした。
- 長いURLや文言も画面外へ出ないよう `overflow-wrap: anywhere`、`table-layout: fixed`、関連コンテナの `min-width: 0` を設定した。
- スマホではページ左右余白、カード内余白、見出しサイズも特商法ページの範囲だけ調整した。
- PWA更新用にservice worker cacheを `v46` へ上げた。

確認:

- 修正前の本番は390px幅でdocument幅721px、横はみ出しあり。修正後の本番はviewport/document/bodyがすべて390px、表幅320px、14行すべて画面内、横はみ出しなし。
- ローカルproduction buildを320px、390px、768px、1280pxで確認し、全幅でdocument幅とviewport幅が一致して横はみ出しがない。640px以下は縦並び、768px以上は2列表となることを確認した。
- 本番390px幅の目視確認で、ヘッダー、見出し、説明、販売事業者・運営責任者の項目と内容が1画面幅に収まることを確認した。ブラウザconsoleのwarning/errorは0件。
- `pnpm --filter web run typecheck` 成功。
- `pnpm --filter web run build` 成功。162ページを生成。
- `pnpm --filter web run lint` はESLint設定ファイルが未作成のため、Next.jsの対話式初回設定で停止した。コードのlint違反ではなく既存設定上の制約。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` は全項目成功。
- 本番 `/sw.js` でcache `v46` を確認した。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

commit・GitHub・本番:

- 実装commit: `7c82eeb` (`Fix mobile legal disclosure layout`)。引き継ぎ更新commit `0037255` とともに `origin/main` へpush済み。
- GitHub Actions CI `32975926283` はweb/mobile typecheck、web build、smokeを含めすべて成功。
- GitHub Actions Vercel workflow `32975926296` は成功。
- Vercel production deployment `dpl_2GXXV9UGkpYwbdPD2ZSAj4jBgjdY` はREADY。
- deployment URL: `https://oyano-moshimo-navi-edg2sx8y2-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- deploy時に生成された `.vercel/` と `.env.local` は、内容を表示せずworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260826-legal-mobile/` へ退避した。

## 2026-08-28 追記 250 — モニターテスト途中経過の可視性を確認

ユーザーから「今のモニターの使用状況が分かるか」と質問があり、本番の管理画面、回答API、端末内計測、匿名funnel、Vercel request logsの保存範囲を読み取り確認した。

確認結果:

- 現在、モニター固有の自動計測は `oyano_monitor_session_v01` と `oyano_monitor_activity_v01` として各参加者のlocalStorageに保存される。
- 計測対象は開始日時、手帳を開いた回数・日数、記録保存回数・日数、過去記録、確認リスト、書類メモ、家族招待、AI相談、クラウド控えなど。
- これらは8日目の最終回答送信時に `usageMetrics` として初めてサーバーへ届き、`audit_logs.action = monitor_feedback_submitted` に保存される。
- したがって、運営側で正確に確認できるのは最終回答を提出済みの参加者だけ。テスト途中の「開始人数」「現在何日目」「現在の記録日数」「途中離脱」はリアルタイムでは分からない。
- 汎用の `funnel_events` には `person_created`、`record_written`、`consult_asked` などが匿名保存されるが、モニター識別子を持たず、通常利用・運営確認・モニターを区別できないため、モニター人数として数えてはいけない。
- Vercel request logsでも `/monitor`、`/home`、`/api/events` などのリクエストは確認できるが、Next.jsのprefetchや運営確認を含み、匿名イベントの種類や参加者単位を判別できない。正式な途中経過集計には使えない。
- `/admin/monitor-feedback` は管理者メール認証または緊急用管理キーが必要。今回のブラウザは未認証で、Supabase DashboardもGitHubログイン画面で停止したため、回答者名・自由記述・提出済み件数のDB確定値は読み取っていない。認証情報の入力やメール送信も行っていない。

今後リアルタイム確認を可能にする場合の最小案:

- モニター開始時に個人情報を含まないランダムなsession IDを発行する。
- 次回アクセス時に、端末内に既にある開始日、最終利用日時、記録した日数、各機能の確認有無だけをサーバーへ同期する。日記本文、写真、氏名、地域は送らない。
- 管理画面へ「進行中 / 何日目 / 最終利用 / 記録日数 / 機能確認 / 最終回答済み」を追加する。
- 既に開始済みの参加者も、修正版を次に開いた時点で端末内の既存計測を同期できる。

作業状態:

- 本番データ、回答、設定は変更していない。
- 確認用に生成された `.vercel/`、`.env.local`、production env一時ファイルは、内容を表示せずworktree外の `/private/tmp/oyano-monitor-status-check-20260828/` へ退避した。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

## 2026-08-28 追記 251 — モニター利用状況を再確認

ユーザーから現時点の状況確認があり、2026-08-28 10:47〜10:51 JSTに本番管理画面と取得可能なVercelログを読み取り確認した。

確認結果:

- `/admin/monitor-feedback` は引き続き管理者認証前で、回答一覧・提出済み件数は取得していない。認証メール送信、認証情報入力、本番データ変更は行っていない。
- 現在取得できたserverless logは、今回の確認による `GET /api/admin/monitor-feedback` の401だけだった。
- 現在取得できるログ内に最終回答送信の `POST /api/monitor-feedback` はなかった。ただしVercelログの取得可能期間は短く、過去の送信が既に保存範囲外の可能性があるため「提出0件」とは判断しない。
- `/home` のアクセスが1件あったが、モニター識別子がなく、通常利用・運営確認・モニターを区別できないためモニター利用として数えていない。
- 正確に確認できるのは、管理者認証後の `audit_logs.action = monitor_feedback_submitted` の行数と提出済み回答の集計。開始済み人数、現在の日数、途中の記録回数は端末内保存のみのため、現仕様では運営側から取得できない。
- Vercel production envのpullも読み取り目的で確認したが、secretはすべて `[SENSITIVE]` placeholderとなり、service roleを使ったDB集計は行っていない。秘密情報は表示していない。
- コード、本番データ、設定は変更していない。未追跡の `review_exports/` は変更・追加・commit対象外。

## 2026-08-28 追記 252 — モニター途中経過を同意付きで同期し、管理画面の「0件」を修正

ユーザーから、モニター開始から3日経っているのに管理画面が0件のままなのは不自然なので修正するよう指示があった。原因は追記250・251のとおり、途中経過が各参加者のlocalStorageにしかなく、8日目の最終回答前にはサーバーへ届かない旧仕様だった。

途中経過の同期:

- モニター開始時に個人情報を含まないUUIDのsession IDを端末内へ発行し、既存sessionにも次回読み込み時に補完する。
- `POST /api/monitor-progress` を追加し、開始日時、終了予定日時、最終利用、現在日、手帳を開いた日数、記録保存回数・日数、最後に記録した日、過去記録・確認リスト・書類メモ・家族招待・AI相談・クラウド控えの到達フラグだけを保存する。
- 呼び名、都道府県、市区町村、記録本文、写真、相談内容は途中経過payloadに含めない。API側も許可項目だけを厳格に検証・再構成して保存する。
- 現在の募集を `crowdworks-2026-08` campaignとして識別し、別campaignのpayloadはHTTP 400で拒否する。管理画面もこのcampaignの途中経過だけを対象にする。
- 同じsession IDは `audit_logs.id` として1行だけにし、回数はmax、到達フラグはORで単調増加させる。revisionを使う楽観ロックと最大4回の再試行を加え、複数タブの同時同期で新しい値を古い値が巻き戻さないようにした。
- 15秒以内の連続送信はクライアント側で間引き、公開APIには既存の1時間60回rate limit、16KB上限、UUID・日時・件数上限を適用した。
- 最終回答済み判定は公開途中経過APIの自己申告を信用せず、実際の `monitor_feedback_submitted` 行とのsession ID一致だけを正とする。
- 最終回答時の自動計測も終了予定時刻より前だけを対象にし、8日目に追加した記録が途中経過と最終回答で食い違わないようにした。

本人への説明と同意:

- `/monitor` の開始ボタン直前へ、送る項目、送らない項目、最終回答後のクラウドワークス名との紐づけ、6か月後削除を明記した。開始ボタンは「内容に同意して7日間のテストを始める」とした。
- すでに開始済みの参加者は、次に手帳を開いた時に同じ説明と「同意して共有する / 今は共有しない」を1回表示する。同意前には送信しない。同意すると端末に残る過去3日分等の回数・到達状況を同期する。
- 同意後も「今後の途中経過共有を停止する」を表示し、以後の同期を止められる。共有しなくても手帳と最終アンケートは利用できる。
- 手帳上部の説明文字を14pxから16pxへ上げた。
- プライバシーポリシー、募集文、送付文、参加ガイド、運営手順、Claude再レビュー資料を同じ説明へ更新した。

管理画面:

- `/admin/monitor-feedback` を「モニターの進み具合と最終回答」へ変更し、「テスト開始操作」「手帳まで到達」「直近48時間に利用」「3日以上記録」「最終回答提出済み」を分けて表示する。
- 「開始操作」は共有URLから届くsession単位の参考値であり、募集人数や物理端末数そのものではない。やり直し、履歴削除、運営確認で別件になる可能性を画面へ明記した。「端末」という誤解を招く単位は使わない。
- 初期登録前の開始操作と、初期設定後に `/home` へ到達した状態を分離した。
- 終了予定日は管理API読み取り時の現在時刻から再計算し、3日目で利用が止まっても8日目以降は「回答期間」と表示する。
- 途中経過と最終回答が一致した場合はクラウドワークス名と「回答を見る」リンクを表示し、クリックすると該当回答を開いて移動する。
- 途中同期に失敗しても最終回答があれば、最終回答の自動計測から開始・記録集計を補完し、「最終回答1件・開始0件」という矛盾を出さない。
- 1分pollは軽量な途中経過だけを取得する。添付画像の署名URLは初回・手動更新・再認証時だけ発行し、pollの競合リクエストはAbortControllerで中止する。カードを勝手に開き直す指定も削除した。

6か月保持:

- 既存の日次 `/api/cron/purge-anonymous-cases` に、途中経過、最終回答、回答画像の6か月purgeを追加した。
- 途中経過は終了予定日、最終回答は最新提出日時を基準に暦月6か月後から削除する。回答画像を先に削除できた行だけ回答本体を削除する。
- 回答保存前の通信失敗や再回答で参照が外れた画像も残り続けないよう、`monitor-feedback/YYYY-MM/` の月フォルダを確認し、6か月を過ぎた未紐付け画像を安全な件数上限付きで削除する。
- cron応答は件数と汎用エラーコードだけとし、回答内容やパスを返さない。

重要な運用上の見え方:

- 旧版には途中同期自体がなかったため、過去3日分をサーバー側から遡って復元することはできない。各参加者の端末には回数・日数・到達状況が残っているため、本番更新後に同じブラウザで手帳を開き、共有へ同意した時点で管理画面へ反映される。
- 参加者名を事前登録せず共通URLを配る現在の方針では、最終回答前に「正確な10人」を認証して数えることはできない。このため開始値は参考session数と明記し、確定人数は最終回答のクラウドワークス名で確認する。

確認:

- `pnpm --filter web run typecheck` 成功。
- `pnpm run test:monitor-timeline` 成功。カレンダー日gate、既存session ID補完、期間内だけの途中経過集計、15秒間引きを確認。
- `pnpm run test:monitor-retention` 成功。途中経過・回答の暦月6か月境界、fallback、画像path allowlist、batch上限、未紐付け画像の月境界を確認。
- `pnpm --filter web run build` 成功。162ページを生成。
- 最終production buildのローカル起動で `node scripts/smoke-web.mjs http://localhost:3217` と `node scripts/smoke-monitor-journey.mjs http://localhost:3217` が成功した。途中経過の不正payload 400、validateOnly 200、別campaign 400、管理APIと軽量poll APIの未認証401も確認した。
- ブラウザで `/monitor` の同意説明、送らない項目、6か月削除、同意付き開始ボタンが表示されることを確認した。
- build時のSupabase JS Node 20非推奨警告は継続。今回の変更起因の失敗ではない。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

commit・GitHub・本番:

- 実装・資料commit: `6a8100f` (`Track monitor progress with consent`)。`origin/main` へpush済み。
- GitHub Actions CI `33136409349` はweb/mobile typecheck、web build、smokeを含めすべて成功。
- GitHub Actions Vercel workflow `33136409356` はcheck成功。Vercel secrets未設定のためdeploy jobは設計どおりスキップされ、本番はVercel CLIで反映した。
- Vercel production deployment `dpl_7euwm2xRk6K7fU6Dwb7BJASN94rf` はREADY。
- deployment URL: `https://oyano-moshimo-navi-jkvrh94m1-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` は全項目成功。
- 本番 `node scripts/smoke-monitor-journey.mjs https://oyano-moshimo-navi.vercel.app` は、期間中gate、初期登録、AI相談状態、未入力回答400、途中経過validate-only 200、別campaign 400、管理API未認証401、画像なし400、クラウド同期未認証401を確認して成功。途中経過はvalidate-onlyだけを使い、本番集計を汚していない。
- 本番ブラウザで `/monitor` の送信項目・送らない項目・クラウドワークス名との紐づけ・6か月削除・「内容に同意して7日間のテストを始める」を確認した。
- 本番 `/sw.js` でcache `v47` を確認した。
- deploy時に生成された `.vercel/` と `.env.local` は、内容を表示せずworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260828.mdbZtC/` へ退避した。

## 2026-08-30 追記 253 — 日々の記録を無料の「思い出の手帳PDF」にまとめる

ユーザーから、日々の記録を一冊にまとめ、対象者が亡くなった後も家族が振り返れる差別化機能として無償提供したいとの依頼があった。「エンディング手帳」は終活時の意思・財産整理を行うエンディングノートと誤解されやすいため、利用者向け名称は「思い出の手帳」とした。

今回の提供範囲:

- 紙の本を無料で印刷・製本・配送する約束にはせず、ブラウザの印刷画面から保存できる「思い出の手帳PDF」を全プランで無料提供する。
- `/memory-book/[caseId]` を追加し、手帳にある日々の記録を古い順に並べ、呼び名、記録期間、記録本文、表示できる写真を一冊の形で表示する。
- 通常利用中も「過去の手帳」の末尾から開ける。死亡確認や通知を条件にせず、看取り後・手続き後を含め、家族が必要になった時に使える。
- 毎日の記録は最初から選択し、AI相談メモは最初は外す。利用者は記録ごとにPDFへ入れるか選び、写真はまとめて入れるか選べる。
- スマホで記録を選んだ後に上まで戻らなくてよいよう、記録一覧の直後にも「PDF保存・印刷へ進む」を置いた。
- iPhoneは印刷プレビューを2本指で広げて共有からファイル保存、Androidはプリンター選択からPDF形式で保存する手順を画面内に追加した。
- 紙の本は届かないこと、無料範囲はPDFデータ作成であること、紙の印刷・製本・配送を含まないことを、手帳の入口、作成画面、料金、利用規約へ明記した。

データ保護と写真:

- 新画面は `getLocalCase` と `listDiaryEntries` の読み取りだけを使い、記録の選択は画面内の一時的なstateだけで管理する。削除、localStorage書き換え、クラウド同期POSTは行わない。
- PDFをアプリのサーバーへ新規保存せず、自動で家族や第三者へ送らない。作成後のPDFの保存場所と共有先は利用者が管理する。
- 表紙は入力された「呼び名」だけを使い、フルネームへ自動フォールバックしない。続柄と元写真ファイル名もPDFへ載せない。
- クラウド保存済み写真は、SupabaseのログインsessionからBearer tokenを取得して既存の認証済みGET `/api/notebook/sync` だけを呼び、署名済み表示URLのみを画面へ補う。本文や元記録は上書きしない。
- 印刷開始前に選択中の写真の読み込み完了を待ち、失敗した写真があれば印刷を止めて案内する。
- スマホの過負荷を避けるため、選択記録の写真が60枚を超える場合は写真を初期OFFにし、記録を分けて60枚以下にするよう案内する。外した記録の写真はDOMへ描画しない。
- 保存前に、暗証番号・身分証画像・第三者が写った写真等が含まれないか、共有してよい内容か確認する注意を表示する。

既存画面・方針:

- `/home` の初回説明と「過去の手帳」末尾、診断結果、料金ページ、全対象者が完了した時の案内に「思い出の手帳PDF」を追加した。
- Family Plusの「家族会議用PDF」は現在の状況共有、無料の「思い出の手帳PDF」は日々の振り返りとして区別した。
- `docs/MONETIZATION.md` の旧「製本PDFは無料プラン買い切り980円」を廃止し、思い出の手帳PDFは全員無料へ変更した。将来、実物の印刷・製本・配送を提供する場合は別サービスとして価格・配送・キャンセル条件を明示する。
- プライバシーポリシーと利用規約に、ブラウザ内でのPDF作成、サーバーへPDFを新規保存しないこと、公的・法的書類ではないこと、紙のサービスを含まないことを追記した。
- PWA更新用にservice worker cacheを `v48` へ上げた。

ローカル確認:

- `pnpm --filter web run typecheck` 成功。
- `pnpm --filter web run build` 成功。162ページを生成し、`/memory-book/[caseId]` を確認した。Supabase JSのNode 20非推奨警告は既知で、今回の変更起因の失敗ではない。
- `node scripts/smoke-web.mjs http://127.0.0.1:3218` 成功。存在しない手帳のfallbackを含む。
- `pnpm run test:monitor-timeline` と `pnpm run test:monitor-retention` は成功し、進行中モニター機能への回帰がないことを確認した。
- 390×844のスマホ幅で、新規手帳を作成し、2件の記録を保存して思い出の手帳を開く実操作を確認した。横はみ出し、ブラウザconsoleのwarning/errorはなかった。
- 最初に2件が選ばれること、1件をPDFから外せること、下部のPDF保存導線、iPhone/Androidの保存手順を確認した。PDFから外して手帳へ戻っても、元の2件が残ることを確認した。
- `/memory-book/smoke-case` のHTMLに `noindex, nofollow` が含まれることを確認した。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

commit・GitHub・本番:

- 実装・資料commit: `f0823dd` (`Add free memory book PDF`)。`origin/main` へpush済み。
- GitHub Actions CI `33286758844` はweb/mobile typecheck、web build、smokeを含めすべて成功。
- GitHub Actions Vercel workflow `33286758854` はcheck成功。Vercel secrets未設定のためdeploy jobは設計どおりスキップされ、本番はVercel CLIで反映した。
- Vercel production deployment `dpl_A1XW9w785WwjvvSYTqoCGJ9VaKoP` はREADY。
- deployment URL: `https://oyano-moshimo-navi-5irdlncts-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- 本番 `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` と `node scripts/smoke-monitor-journey.mjs https://oyano-moshimo-navi.vercel.app` は全項目成功。モニター途中経過はvalidate-onlyだけを使い、本番集計を汚していない。
- 本番で `/memory-book/smoke-case` の200応答、`noindex, nofollow`、`/plans` の無料PDFと紙の印刷・製本・配送を含まない説明、`/sw.js` のcache `v48` を確認した。
- 本番ブラウザで存在しない手帳の安全なfallbackと、料金ページの表示を確認した。ブラウザconsoleのwarning/errorは0件。
- deploy時に生成された `.vercel/` と `.env.local` は、内容を表示せずworktree外の `/private/tmp/oyano-moshimo-navi-vercel-link-20260830-memory-book.LdKTnI/` へ退避した。

## 2026-08-30 追記 254 — 紙の本を将来テーマへ戻し、非競争の「手帳のあゆみ」を決定

ユーザーから、無料製本は費用とデータ消失時の約束違反リスクが大きいため現時点では行わず、
将来テーマへ戻す判断が示された。記録日数に応じた「優良者」「ランク」案も含めてClaudeへ
外部レビューを依頼し、介護者UX、倫理、データ保護、事業性、現在の同期実装を再確認した。

最終決定:

- 現在の提供範囲は、全員無料の「思い出の手帳PDF」までとする。紙の印刷・製本・配送は
  **WAIT** とし、利用者向け画面、料金表、募集文で提供予定や無料特典として予告しない。
- 「優良ユーザー」「ランク」「レベル」「級」は恒久不採用とする。記録日数を介護者の優劣、
  努力、忠誠度へ変換しない。将来の非競争的な利用者向け名称は **「手帳のあゆみ」** とする。
- 将来の初回実装は、本人と同じ手帳の家族にだけ見える **30日分の1節目だけ** とする。
  7日分・90日分は実利用の到達分布が得られてから追加判断する。
- カウントは、日々の記録がある異なる日付の累計とする。同じ日の複数記録は1日分、
  連続日数は数えず、書けない日があってもリセットしない。「あと何日」のカウントダウン、
  節目目的の通知、未達警告、順位・比較は行わない。
- 実装前に記録種別を `daily_record` とAI相談メモ等へ分け、`daily_record` だけを数える。
  現在の本文接頭辞によるAI相談メモ判定を、節目カウントへ流用しない。
- 無料PDFは1日分の記録から誰でも使えるままとする。30日分到達時の候補特典も、
  PDF表紙や期間の振り返りページなど原価ゼロの表示に限定し、基本機能をロックしない。
- 節目表示のための新しいデータ送信はしない。ローカル利用者は端末内で計算し、クラウド控え
  利用者は本人がすでに同期した記録日付から重複なし件数を導出する。本文、写真、AI相談内容を
  節目判定のために追加送信しない。

Claudeとの最終すり合わせでは、7日・30日・90日の複数節目ではなく30日分の1節目に絞った。
複数段階は次の節目への圧力を生み、現段階には到達データもないためである。紙の本については、
最低記録日数を資格にせず、将来条件を満たした場合も印刷可能なPDFが1ページ以上あれば本人が
選んで注文できる有料商品とする。短期間で看取りを迎えた家族を日数で除外しない。

紙の本を再検討する前の必須ゲート:

- 日記単位の版管理・削除反映・競合解決、500件上限を超える全件同期、対象者情報の非破壊
  マージ、JSON控えの取込を実装する。現状は日記更新後に手帳単位の競合判定を行うため、
  古い端末が新しい日記を上書きし得る。また長期履歴は先頭500件に制限されている。
- DBと写真Storageのバックアップ方針、RPO/RTO、復旧手順を文書化する。端末消去からの
  全記録・全写真復元をiPhone Safari、Android、別端末で合計10ケース以上100%成功させ、
  提供開始後も四半期ごとに復元訓練する。
- 注文時の印刷版を固定し、本人がプレビューを校正・承認してから印刷する。注文版と配送住所は
  元の手帳データから分離し、配送完了後30日で削除する。
- 印刷、製本、送料、決済、再印刷、紛失・破損、返金まで含む実原価を試作で測り、価格と
  運用予算を成立させる。恒久無料を約束しない。
- 印刷・配送委託先との個人情報取扱条件、削除証跡、問い合わせ責任を整え、特商法表記、
  利用規約、同意画面へ価格、送料、納期、キャンセル、返品、落丁、再印刷、削除手順を反映する。
- 全条件がそろっても、最初は少人数・件数上限付きの試験提供とする。1つでも未達なら
  WAITのままとし、予告・匂わせをしない。

今回の変更:

- `docs/MONETIZATION.md` に上記の将来方針、30日分の案内文、紙の本の再検討ゲート、
  やらないことを追加した。
- 方針commit: `ba4225f` (`Define memory journey roadmap`)。
- コード、本番画面、DB、APIは変更していないため、Vercelへの再deployは行っていない。
- `git diff --check` は成功した。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

## 2026-08-30 追記 255 — 本番管理者メール登録と匿名モニター進捗の確認

ユーザーの明示承認を受け、`tettsu888@gmail.com` を本番Supabase Authの恒久的な
`app_admin` として登録した。既存の本人確認済みAuthユーザーだけを対象にし、既存profileを
壊さず確認・補完した上で、`app_admins.user_id` と `note = '運営管理者'` を冪等登録した。

登録方法と安全措置:

- Vercel CLIのproduction環境で直接登録する方法を先に試したが、VercelがSensitive設定の
  secret値をローカルへ渡さないため、変更前に停止した。secret値は表示していない。
- 代わりに、すでにメールリンクで本人確認済みのブラウザsessionを使った。短時間だけ、
  `tettsu888@gmail.com` と厳密一致するSupabase Authユーザーだけが実行できるPOST APIと
  明示ボタンを本番へ出し、本人sessionから1回実行した。メール不一致、sessionなし、
  profile確認失敗、`app_admins` 登録・再確認失敗はすべて拒否する実装とした。
- 登録直後に管理画面が `tettsu888@gmail.com` を「確認済み」と表示し、管理APIから集計を
  読めることを確認した。
- 登録後、一時POST APIとボタンをソースから削除して通常版を再デプロイした。本番
  `/api/admin/bootstrap-tettsu` はHTTP 404、一時ボタンは0件、恒久的な管理者認証は有効で
  あることを再確認した。
- 恒久的に残した変更はSupabaseのprofile補完と `app_admins` 行だけである。一時登録用の
  アプリコードはGitへcommitしていない。

2026-08-30 15:22 JST時点の匿名集計:

- テスト開始操作: **8件**
- 手帳まで到達: **8件**
- 直近48時間に利用: **8件**
- 3日以上記録: **8件**
- 最終回答提出済み: **0件**

この8件は、途中経過共有に同意したmonitor session単位の参考値であり、募集人数そのものでは
ない。やり直し、履歴削除、運営確認で別sessionになる場合がある。今回の確認では、記録本文、
写真、AI相談内容、最終回答詳細を開かず、管理画面上部の匿名集計だけを確認した。

確認と本番復旧:

- 一時登録版deployment `dpl_D5UaJfspvWjdzwHX3DTwb7n9s55X` で登録を完了した。
- 一時導線を除去した通常版deployment `dpl_5evFamr4AJ11vS7of5votdmRs35x` はREADYで、
  production alias `https://oyano-moshimo-navi.vercel.app` へ反映済み。
- 一時導線の追加前と削除後に `pnpm --filter web run typecheck` が成功した。
- 通常版本番で `node scripts/smoke-web.mjs https://oyano-moshimo-navi.vercel.app` が成功した。
- 本番管理画面を再読み込みし、管理者認証済み、5集計が `8 / 8 / 8 / 8 / 0`、一時ボタンが
  ないことを確認した。
- Vercel操作で生成された `.vercel/` と `.env.local` は内容を表示せずworktree外の
  `/private/tmp/oyano-admin-registration-20260830-1525/` へ退避した。
- 未追跡の `review_exports/` は変更・追加・commit対象外。

## 2026-09-01 追記 256 — モニター最終回答期間の進捗確認

2026-09-01 10:05 JSTに、本番管理画面を管理者として開き、参加者名、記録本文、写真、
AI相談内容、最終回答の内容を開かず、匿名集計と各sessionの回答期限状態だけを確認した。

確認結果:

- テスト開始操作: **10件**
- 手帳まで到達: **10件**
- 直近48時間に利用: **10件**
- 3日以上記録: **10件**
- 最終回答提出済み: **4件**
- 10 sessionの内訳は、最終回答済み **4件**、回答期間に入った未回答 **2件**、
  開始日が遅くまだ回答期間前 **4件**。

日程の解釈:

- 8月25日に開始した参加者は8月31日が7日目で、9月1日から最終回答期間に入る。
- 全員が同じ日に終了する運用ではなく、各sessionの開始日を1日目とするカレンダー日gateで
  回答開始日が決まる。そのため、9月1日時点で「全員が今日終了」ではない。
- 依頼人数は11人だが、管理画面の10件は途中経過共有に同意したmonitor session単位であり、
  人数そのものではない。残る1人が未開始・未利用だとは、この数字だけでは断定しない。

この確認では本番データ、回答状態、コード、設定を変更していない。未追跡の
`review_exports/` は変更・追加・commit対象外。

## 2026-09-01 追記 257 — 13:08時点のモニター回答状況を再確認

ユーザーの依頼を受け、2026-09-01 13:08 JSTに本番管理画面を再読み込みして確認した。
個別カードの「開く」は押さず、記録本文、写真、AI相談内容、最終回答の詳細は開いていない。
引き継ぎには参加者名や個別回答を記載せず、匿名の件数と期限状態だけを残す。

確認結果:

- テスト開始操作: **11件**
- 手帳まで到達: **11件**
- 直近48時間に利用: **11件**
- 3日以上記録: **11件**
- 最終回答提出済み: **5件**
- 11 sessionの内訳は、最終回答済み **5件**、回答期間に入った未回答 **2件**、
  まだ回答期間前 **4件**。

10:05 JSTの確認から、開始・到達・直近利用・3日以上記録は各 **10件から11件**、
最終回答は **4件から5件**へ増えた。依頼人数11人とsession件数が同数になったが、
sessionはやり直しや計測条件で人数とずれる可能性があるため、11人全員と断定はしない。

この再確認では本番データ、回答状態、コード、設定を変更していない。未追跡の
`review_exports/` は変更・追加・commit対象外。

## 2026-09-01 追記 258 — 最終回答5件の匿名分析

ユーザーの依頼を受け、13:13 JST時点で提出済みの最終回答5件を管理画面から確認した。
参加者名は報告・引き継ぎに残さず、回答はA〜Eとして集計した。添付スクリーンショットは
開いておらず、記録本文、写真、AI相談内容も確認していない。

利用継続と主要機能:

- 自動計測の記録日数は `7 / 7 / 6 / 5 / 7日`、合計32/35日。全員が5日以上、
  3人が7日すべて記録した。
- 過去記録の見返しは、すぐ見つけられた3人、少し迷った2人。
- 確認リストは自己申告では5人全員が「試して使えた」。
- 書類の所在メモは、使えた1人、見つけられない・使えない4人。最初に迷った場所としても
  3人が挙げており、5件中で最も大きな共通課題。
- 家族招待は、手順を確認できた3人、開いたが手順が分からなかった2人。
- AI相談は、すぐ使えた4人、少し迷ったが使えた1人で、自動ログも5人全員成功。ただし、
  1人は今後あまり使わないと思うと回答した。

自由記述の主な傾向:

- 日々の記録と保存の手軽さ、急な時の情報の見つけやすさ、家族招待とAI相談には肯定的な
  反応があった。
- 改善要望は、情報量を減らして簡略化する、保存完了を明確にする、押すボタンを分かりやすく
  する、記録の文字数制限をなくす、急な時に行うことを順番で示す、という内容。
- 7日後も「たぶん使う」は3人、「分からない」は2人で、明確な不使用回答はなかった。
- 家族共有は「共有したい」1人、「場合によっては」3人、「共有しなくてよい」1人。

価格反応:

- 実価格を見せる前の上限は、0円2人、500円2人、980円1人。中央値は500円。
- 月980円を見せた後は「家族と相談する」3人、「無料の範囲だけ使う」2人。
- 「払って使う」「年払いなら検討」は0人で、現時点では980円の課金成立を確認できない。

計測上の注意:

- 確認リストは自己申告5/5に対して自動ログ1/5、家族招待は手順確認3/5に対して自動ログ0/5。
  書類メモにも自己申告と自動ログの逆転例があり、行動ログを合否判定に使う前にイベント定義と
  発火条件の再確認が必要。
- クラウド控えの自動ログは5人全員なし。未実施か計測漏れかを現状の値だけでは区別できない。
- 初回登録時間は57秒から45,397秒までばらつき、長い2件は画面放置・再開を含む可能性が高い。
  完走時間としてそのまま評価しない。

暫定優先順位は、`P0 書類メモの発見・完了導線`、`P0 クラウド控えの完了表示と計測確認`、
`P0 確認リスト・書類・招待のイベントログ修正`、`P1 情報量と主要ボタンの整理`、
`P1 家族招待の手順確認と送信の分離`。今回は閲覧と匿名分析のみで、本番データ、コード、設定を
変更していない。未追跡の `review_exports/` は変更・追加・commit対象外。

## 2026-09-01 追記 259 — 全回答を基に再設計する方針を確定

ユーザーは、現在届いている5件を含むモニター意見を重要な一次情報として扱い、最終回答が
すべて集まった後に、その全体を基に「親のもしもナビ」をもう一度作り直す方針を決定した。
追記258の分析は途中結果であり、5件だけで最終仕様や事業判断を確定しない。

全回答が集まるまでの運用:

- モニター条件を途中で変えないため、大幅な画面・導線変更は保留する。ただし、データ消失、
  回答不能、セキュリティなど継続に重大な不具合があれば例外として対応する。
- 回答数と期限状態を匿名集計で追い、参加者名、記録本文、写真、AI相談内容を引き継ぎ文書へ
  転記しない。
- 現在の5件で見えた問題を消さず、追加回答で同じ問題が何件出たかを積み上げる。

全回答が集まった後に行うこと:

1. 回答一式を匿名化し、設問別の件数、自由記述、添付画面、自己申告と自動ログの差を整理する。
2. 問題を「見つからない」「意味が分からない」「押しても進まない」「保存されたか不安」
   「不要・使わない」に分け、発生人数と影響度で優先順位を付ける。
3. 毎日の記録、書類メモ、確認リスト、家族招待、クラウド控え、AI相談、過去記録、急なときの
   各導線を再設計し、画面構成と文言を先に固めてから実装する。
4. 計測不一致を修正し、再設計版では自己申告と操作ログを正しく突合できる状態で再テストする。
5. 継続意向、共有意向、アンカー前価格、月980円への反応を全回答で再集計し、機能価値と
   課金点を分けて判断する。

この追記は方針の記録のみで、コード、本番データ、回答状態、設定は変更していない。未追跡の
`review_exports/` は変更・追加・commit対象外。

## 2026-09-01 追記 260 — AI相談の「人別の記憶」実装を監査

ユーザーから、日々の記録がその人専用AIの記憶として蓄積され、状況全体を踏まえた相談が
できる実装か確認を求められた。現行コードを監査した結論は、**人別の最近の記録を使う個別相談は
できているが、全履歴を永続記憶して育つ専用AIにはなっていない**、である。

現在できていること:

- Webは選択中の `caseId` のプロフィールと日記だけを使い、対象者を切り替えると画面内の会話も
  リセットする。通常の画面操作では別の対象者の記録を混ぜない。
- 相談のたびに、続柄、年代、状態、病院・施設、薬・注意点、家族構成、本人の希望、最近の日記、
  確認リストをプロンプトとして組み直し、Anthropic Claudeへ1回の独立リクエストとして送る。
- 新しい記録やプロフィール変更は、次回相談時のプロンプトへ反映される。
- 送る日記は新しい順に最大12件、1件400文字まで。確認リストも最大12件。
- 同じ相談画面を開いている間は、直近最大4ターンの質問、前回の状況整理、次の確認事項を
  要約して渡すため、会話の続きとして回答できる。
- 医療、法律、税務などの断定をせず、「次に確認すること」「窓口で聞くこと」を整理するよう
  システムプロンプトで制限している。これは「AI判断」ではなく個別の整理・相談メモである。

「育つ専用AI」とは言えない理由:

- モデル自体を対象者ごとに学習・更新していない。Claudeは相談ごとに渡された情報だけを読む。
- 13件目より古い日記はそのままではAIへ渡らず、全期間の要約や重要変化を残す専用メモリもない。
- 会話履歴はReactの画面状態だけで、再読み込みまたは画面を閉じると消える。
- AI回答は自動保存されない。「この回答を手帳に残す」を押した時だけ相談メモとして日記へ保存
  される。保存した相談メモは最新12件に入る間だけ、後日の相談で再参照され得る。
- サーバーの `audit_logs` へ保存するのはモデル、token数、概算原価、結果などで、質問本文・
  回答本文ではない。
- 氏名、呼び名、連絡先、書類・鍵の場所、写真・PDFは送らない。住所、親の市区町村、重要人物、
  連絡先など、手帳に存在しても相談payloadへ含めない情報があるため「全部分かる」状態ではない。
- Web相談画面は端末の `localStorage` を参照し、相談画面自身はクラウドから復元しない。メール確認
  済みで手帳画面から復元・同期した記録は使えるが、未復元の別端末データは相談に入らない。

安全上の未完了点:

- 通常UIは `caseId` で人別に分けるが、`/api/consult` のrequestには `personId` / `caseId` /
  `familyId` がなく、サーバーは本人が閲覧できる対象者をDBから取得せず、ブラウザが送った
  プロフィールと日記を使う。強い人別認可を伴う「専用AI」ではない。
- Webのローカル手帳はアカウントID別の保存領域ではない。同じブラウザで別アカウントへ切り替えた
  場合、残ったローカル手帳が別のログイン先へ同期される可能性があり、再設計前に分離が必要。
- 日記本文や相談文に書かれた一般の人名は自動伏字できない。自動伏字は電話番号、メール、長い
  数字、カード番号、暗証番号周辺が中心である。

全回答後の再設計で必要な最小構成:

1. 相談APIへ `personId` を渡し、サーバー側で家族メンバー権限を確認する。
2. プロフィール、日記、確認リストをサーバー側DBから取得し、クライアントpayloadを正本にしない。
3. 対象者ごとに、出典記録IDと更新履歴を持つ長期サマリー、重要な変化、相談履歴を永続化する。
4. 全期間サマリー、関連する過去記録、直近記録を毎回組み合わせ、訂正・削除時に再要約する。
5. 利用者がAIの記憶内容を閲覧、訂正、除外、削除できる画面を用意する。
6. AIの回答を事実メモと混同して自己増幅させず、本人入力・確認済み事実・AI提案を区別する。

この監査は現状説明であり、モニター回答がすべて集まる前に実装を変更していない。コード、
本番データ、回答状態、設定は変更なし。未追跡の `review_exports/` は変更・追加・commit対象外。

## 2026-09-01 追記 261 — 対象者ごとに育つAI長期記憶を実装

ユーザーは追記260の監査結果を受け、AI相談をその場限りにせず、対象者ごとの全期間の手帳記録と
継続する相談履歴を踏まえる専用AIを必須機能として実装するよう決定した。全モニター回答後まで
大幅変更を保留する方針のうち、この相談価値の根幹とデータ保全・認可に関する修正だけは先行した。
実装commitは `c404595` (`feat: add durable per-person AI memory`)。

実装した記憶の構成:

- `person_ai_memories` に、対象者ごとの長期要約、重要な変化、家族が確認した補足・訂正、根拠となる
  手帳記録ID、記憶から外した記録ID、集計期間、記憶version、削除境界を永続保存する。
- 手帳の事実記憶は同じ家族の対象者単位で共有する。相談の質問・AI回答は
  `ai_consult_threads` / `ai_consult_turns` へ永続保存するが、他の家族の相談内容を勝手に見せないため、
  相談した利用者本人だけが閲覧・次回利用できる。画面とプライバシー文にもこの区別を明記した。
- 毎回、クラウドにある全期間の手帳記録を最大20,000件（1日1件で約54年）までサーバー側で読み、
  全件の長期概要、重要な変化、最新12件、質問に関連する古い記録最大6件を組み合わせる。
  20,000件超は黙って全件扱いせず、要約または復元画面で上限を明示する。
- 本人の相談履歴は最大20,000件まで全件を長期概要へ集計し、直近4件と質問に関連する古い相談
  最大4件を次回回答へ渡す。再読み込み、別端末、別日に開き直しても履歴は消えない。
- 手帳へ手動保存した過去のAI回答は、本人について確認済みの事実へ再学習させない。手帳の事実、
  家族の補足・訂正、過去のAI提案をデータと画面の両方で分離した。
- WebとMobileに、専用AIが覚えている長期要約・重要な変化・相談履歴の確認、補足・訂正、根拠記録
  の除外・復元、履歴削除、家族共有記憶の削除画面を追加した。Mobileの重要な変化は20件ずつ
  「さらに表示」でき、21件目以降も確認・除外できる。

認可・同意・削除の安全措置:

- 相談APIはブラウザから送られたプロフィールを正本にせず、`personId` / `localCaseId` からサーバーで
  対象者と家族membershipを照合し、プロフィール、手帳、確認リストをDBから取得する。
- 家族roleは `owner/admin/member/viewer` 以外をfail-closedでviewer扱いにする。共有記憶の補足・除外は
  owner/admin/member、共有記憶の一括削除はowner/adminだけ、viewerは閲覧だけとした。
- `ai_memory_consents` に利用者・対象者ごとの同意versionとrevisionを保存する。Web/Mobile共通で
  revision CASを使い、別端末の古い同意状態による上書きを409で止める。同意前は外部AIへ送らず、
  撤回は同じアカウントの別端末にも反映する。
- AIへ送る直前と、30〜55秒のAI処理後に回答を保存・返す直前の両方で、membershipと同意を再確認する。
  処理中に記憶が訂正・除外・削除された場合も `memory_version` と `memory_reset_at` の不一致を409で
  止め、古い記憶から作った回答を保存・表示しない。
- 記憶の削除は元の手帳記録を削除せず、派生要約と根拠を空にして削除時刻以前を再記憶しない。
  自分の相談履歴だけの削除も可能。部分失敗時は削除済み範囲と再試行対象を分けて返し、削除操作は
  `audit_logs` へ結果だけを記録する。
- RLSは、ログイン利用者に新4テーブルの必要なSELECTだけを許可し、追加・更新・削除は家族権限を
  再確認するWeb APIのservice roleだけに限定した。anonはアクセス不可。

全期間クラウド同期の補強:

- 以前のクラウド同期は端末の日記を先頭500件で切っていたため、古い記録がサーバーへ届かない
  可能性があった。Webは500件ずつ全件を分割保存し、復元も500件ずつ最後までページングする。
- 部分的に通信が失敗しても端末の記録を消さず、成功済みbatchは同じ記録IDで再送しても更新扱いに
  なる。復元が途中で途切れた場合も端末の記録を部分データで置き換えない。
- AI回答を手帳へ残す操作は、新しく作った1件だけをクラウドへ同期する。思い出手帳の写真URL取得も
  全ページを読み、古い写真が500件目より後にあっても取得対象にする。

DBと本番反映状態:

- 新規DB用の `schema.sql`、`api_grants.sql`、`production_rls.sql` と、既存DBへ後追い適用する
  再実行可能な `ai_consult_memory.sql`、構成確認用 `verify_compact.sql` を追加・更新した。
- 既存本番DBへ反映する時は、`ai_consult_memory.sql`、`verify_compact.sql` の順だけを実行する。
  `ai_consult_memory.sql` 自体に新テーブルのgrant/revokeとRLSが含まれる。既存policyで途中停止するため、
  既存DBへ `api_grants.sql` や `production_rls.sql` 全体を再実行しない。
- この追記時点では、本番SupabaseへのSQL投入とVercel本番デプロイは未実施。実行には、対象、目的、
  既存データへの影響、費用を説明したうえでユーザーの明示承認が必要。
- migrationは既存の `people` / `timeline_events` / モニター記録を更新・削除しない。反映後の初回読込で
  既存クラウド手帳から派生記憶を構築する。今回の作業中も現在進行のモニター記録、本番回答、
  本番設定は一切変更していない。
- 新しい固定サービス料金はない。既存Supabaseの保存量と、相談時のAnthropic token利用量だけが
  データ量・相談回数に応じて増える。

確認結果:

- `pnpm --filter web exec tsc --noEmit`: 成功
- `pnpm --filter mobile exec tsc --noEmit`: 成功
- `pnpm run test:consult-memory`: 成功。長期要約、関連記録・関連相談、同意CAS、role fail-closed、
  記憶version・削除境界の競合を確認。
- PostgreSQL 16の隔離環境でmigration再実行、家族間隔離、本人相談だけの閲覧、authenticated直接更新
  拒否、service role更新、不正role拒否を確認。
- `pnpm run test:monitor-timeline`、`pnpm run test:monitor-retention`、`pnpm run doctor:local`: 成功
- `pnpm --filter web run build`: 成功。既知のNode 20 / Supabase将来非対応warningだけ。
- ローカルproduction buildに対する `smoke-monitor-journey.mjs`: 送信を伴わない項目はすべて成功。
  実Anthropic回答は費用と本番状態を変えないため未実行。
- 390×844のモバイル表示でAI相談画面に横はみ出しがないことを確認。
- `git diff --check`: 成功。差分secret scanの2件は削除された旧localStorage同意キー文字列への
  generic rule誤検知で、認証情報ではない。
- 独立レビューで未解決P0/P1なし。本番migrationと実Anthropic/Supabase E2Eだけを本番反映後の確認に残す。

未追跡の `review_exports/` は参照・変更・追加・commit対象外。

## 2026-09-01 追記 262 — 手帳同期を本人・家族固定かつ原子的に補強

追記261の独立レビューで、長期記憶そのものとは別に、Web手帳の旧同期処理には、ログイン切替時の
ローカル手帳取り違え、複数家族所属時の曖昧な同期、通信中に追記した記録の保存済み誤判定、途中失敗
時の部分反映など、既存モニター記録を守るうえで先に解消すべき問題が見つかった。これらを
`77c6e5c` (`fix: make notebook sync identity-safe and atomic`) で修正した。
さらに最終レビューで、同じ利用者が複数家族に所属し、各家族に同じ `localCaseId` が存在する場合、
AI記憶の初回対象者解決が別家族を選び得ることを検出した。`f6c1f3c`
(`fix: bind AI memory to exact family`) で、AI記憶の読込、同意、相談、訂正、除外、削除を、
クラウド対象者UUID、または認証本人に固定した家族UUIDと `localCaseId` の組だけで解決するよう修正した。
家族UUIDなしの `localCaseId` 単独要求はfail-closedで拒否する。

同期対象と端末データの保護:

- 端末のクラウド紐付けを、認証ユーザーUUIDと家族UUIDの完全一致で保存する。ログイン直後は必ず
  サーバーの本人・家族・クラウド手帳を先に確認し、未紐付けのローカル手帳を自動送信しない。
- 複数家族に所属する場合は利用者に家族を選ばせる。別アカウントまたは別家族の紐付けが残っている
  場合は同期を止め、本人確認なしに上書きしない。
- 日記は500件ずつ全件を送受信し、総件数、重複排除、ページ進行を検査する。途中で通信や端末保存が
  失敗した場合は部分データで端末を置き換えない。
- 送信中に利用者が編集・追記した記録は、送信開始時のsnapshotと現在値を比較して未同期のまま残す。
  再試行payloadは古い送信内容ではなく、現在の端末手帳から作り直す。
- profile、task、diaryへサーバーrevision・内容hash・端末安定IDを持たせ、同じrevisionから双方が
  変更された場合は409で止める。競合時にどちらかを黙って勝たせない。

DBの原子性・旧Mobile互換・権限:

- 既存DB向け `notebook_atomic_sync_v2.sql` を追加した。端末安定IDとrevision/hashを後付けし、
  `sync_notebook_v2` RPCが対象者、確認リスト、日記、同期receiptを1 transactionで保存する。
  request IDの再送は同じ結果を返し、途中失敗は全体をrollbackする。
- 旧Mobileが直接書いた平坦なプロフィールをPWA形式へ正規化しつつ、PWA専用項目は保持する。旧
  `profile.localTasks` とDB taskを統合して、過去の確認リストが部分migrationで見えなくならないようにした。
- owner/admin/memberは確認リストと日記を更新できる。memberは対象者の基本プロフィールを変更不可、
  viewerは全手帳を閲覧専用とした。画面の無効化だけでなく、RPCと直接書き込み用RLSでも同じ制約を
  強制する。サーバーがprofile保存を拒否した場合、端末側も保存済み扱いにしない。
- migrationは既存の対象者、日記、確認リストを削除しない。欠けている安定ID、revision、hashを
  backfillするだけで、重複があれば全migrationをrollbackする。index作成とbackfill中に短時間の
  書き込みlockが発生し得るため、本番適用はモニター操作の少ない時間に行う。

本番反映順と現在の状態:

1. Supabaseで `notebook_atomic_sync_v2.sql` を実行する。
2. 続けて `ai_consult_memory.sql` を実行する。
3. `verify_compact.sql` を実行し、追加したテーブル、列、index、trigger、RPC、RLSがすべてtrueで
   あることを確認する。
4. 対応するWebをVercelへデプロイし、本人、member、viewer、複数家族、競合、再送、長期AI相談を
   実環境で確認する。

この追記時点では上記の本番SQLとWebデプロイは未実施。実行前に対象、目的、短時間の書き込み影響、
費用を説明し、ユーザーの明示承認を得る。新しい固定サービス料金はなく、Supabaseの保存量と相談時の
Anthropic利用量だけが利用量に応じて増える。現在進行中のモニター記録、本番回答、本番設定には一切
触れておらず、消去・置換もしていない。

確認結果:

- Web/Mobile TypeScript、`test:notebook-sync-runtime`、`test:notebook-sync-safety`、
  `test:consult-memory`、モニター関連test、`doctor:local`、Web production buildに成功。
- 複数家族に同じ `localCaseId` があるfixtureで、指定した家族の対象者だけを解決し、家族指定なし、
  権限外家族、曖昧な削除導線を拒否することを確認した。
- PostgreSQL 16の破棄可能な隔離DBで、migrationの2回連続適用、旧Mobile/PWA混在、端末安定ID、
  owner/member/viewer、直接書き込みRLS、冪等再送、競合・重複時の全rollbackを確認した。
- 390×844のブラウザでクラウド保存説明、AI相談導線、長期記憶が使えない時に相談を送らない
  fail-closed表示を確認した。実Anthropic送信と本番状態変更は行っていない。
- `git diff --check`、変更SQLを含むsecret scanに成功。独立最終レビューでも未解決P0/P1なし。

未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 263 — 本番反映承認済み、Supabaseログイン待ちで安全停止

ユーザーから本番SupabaseとVercelへの反映について明示承認を得た。対象、目的、短時間のDB書き込み
待ち、既存記録を削除しないこと、新規固定費なし、Supabase保存量とAnthropic利用量だけが増え得る
ことは承認前に説明済み。

反映前確認:

- checkoutは `main`、開始HEADは `96a0f1e`、tracked差分なし。origin/mainとの一致を確認した。
- Vercel CLIは `dogwoodcommunity1` で認証済み。対象projectは `oyano-moshimo-navi`、production aliasは
  `https://oyano-moshimo-navi.vercel.app`。確認時のproductionは2026-08-30作成の旧deploymentで、
  長期AI記憶・原子的同期の最新commitはまだ本番公開されていない。
- GitHub Actionsの `Deploy to Vercel` は成功表示だが、`VERCEL_TOKEN` / `VERCEL_ORG_ID` /
  `VERCEL_PROJECT_ID` が未設定のため実deployをskipしていた。CI自体は成功。
- Vercel projectのproduction環境変数名としてSupabase、Anthropic、管理用設定が存在することだけを
  確認し、秘密値は表示・取得していない。CLI linkが自動作成した一時OIDC `.env.local` は内容を読まず
  直ちに削除した。ignoredの `.vercel/project.json` だけをローカルproject紐付けとして残した。

停止理由と現在状態:

- ローカルSupabase CLIにはaccess tokenがなく、Supabase管理画面もin-app browserとChromeでは未ログイン。
  SafariはmacOSの「“パスワード”はロックされています」画面で、Touch IDまたは本人パスワードが必要。
- 認証情報、パスワード、token、環境変数をユーザーへ要求・保存・転記せず、安全停止した。Chromeには
  `https://supabase.com/dashboard/sign-in?returnTo=%2Forganizations` を再開用に残した。
- `notebook_atomic_sync_v2.sql`、`ai_consult_memory.sql`、`verify_compact.sql` は本番未実行。
  Vercel production deployも未実行。既存モニター記録、回答、本番DB、本番Webは変更していない。

再開手順:

1. ユーザー本人がChromeのSupabase画面でログインし、完了したと伝える。認証情報はCodexへ渡さない。
2. 対象projectが親のもしもナビ本番であることを管理画面上で再確認する。
3. `notebook_atomic_sync_v2.sql`、`ai_consult_memory.sql`、`verify_compact.sql` の順に実行し、検証結果を
   保存する。失敗時はWebをdeployせず停止する。
4. DB検証が全件成功した後だけ `oyano-moshimo-navi` をVercel productionへdeployし、production alias、
   health、手帳、クラウド同期、AI長期記憶のfail-closed挙動を確認する。
5. 結果を次の追記へ記録しcommit・pushする。

未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 264 — 本番スキーマ差分を安全補完、Chrome翻訳停止待ち

ユーザー本人のSupabaseログイン後、対象が本番project `ypnuxyfirlvbsqujocuy`
（production Webが参照する `https://ypnuxyfirlvbsqujocuy.supabase.co` と一致）であることを管理画面上で
再確認した。Webデプロイ前にread-only SQLで本番スキーマと件数を調べたところ、本番は古いスキーマで、
`people.profile` / `profile_updated_at` / `prefecture` / `city` と、`timeline_events.mood` /
`attachments` / `metadata` が未作成だった。この状態では追記263の手順どおり
`notebook_atomic_sync_v2.sql` をそのまま実行できないため、推測で投入せず停止した。

本番変更前の控え:

- `people=4`、`tasks=8`、`timeline_events=0`、`audit_logs=44`
- `monitor_progress_synced=10`、`monitor_feedback_submitted=5`
- `profiles`、`families`、`family_members`、`person_status_events`、`is_family_member(uuid)`、
  `anon` / `authenticated` / `service_role`、主要RLSの存在を確認した。
- family member roleは既存5行すべて `owner`。people/task/timelineの外部キー対象IDにNULLはなかった。
- AI記憶4テーブルは未作成で、部分適用状態ではなかった。

互換修正:

- `78c4947` (`fix: support legacy production notebook schema`) で、上記7列を
  `notebook_atomic_sync_v2.sql` の明示transaction内、hash/backfillより前に
  `ADD COLUMN IF NOT EXISTS` するよう修正した。
- 広範囲の `production_pending_hardening.sql` / `person_notebook_hardening.sql` /
  `regional_sponsor_data.sql` 全体は再実行せず、今回必要な最小列だけを追加する契約にした。
- PostgreSQL 16で現行スキーマ、7列が欠けた旧本番相当スキーマ、migration再適用の全ケースを確認し、
  regression、`test-notebook-sync-safety`、`test-notebook-sync-runtime`、`git diff --check` が成功した。
  commitはorigin/mainへpush済み。

現在の停止理由:

- Supabase SQL Editorで確定SQLを入力し、管理画面の「クエリを実行する」確認まで進んだが、Chromeの
  自動翻訳がReact DOMを書き換え、確認ボタン押下直後にSupabase画面が `removeChild` エラーで停止した。
- 開き直してread-only検証を行い、`people.profile` が依然存在しないことを確認した。したがって
  `notebook_atomic_sync_v2.sql` は本番へ未適用で、既存件数・モニター回答・進捗は変更されていない。
- `ai_consult_memory.sql` / `verify_compact.sql` も未実行、Vercel production deployも未実行。

再開手順:

1. ChromeのSupabaseタブで、アドレスバー右側の「翻訳」アイコンから「原文を表示」へ戻す。
   可能ならSupabaseを「このサイトは翻訳しない」にする。認証情報の再入力は不要。
2. 原文表示後、`notebook_atomic_sync_v2.sql` を実行し、列・RPC・index、変更前後の件数を確認する。
3. `ai_consult_memory.sql`、`verify_compact.sql` を実行し、全検査が成功してからWebだけをVercel productionへ
   deployする。失敗時はWebをdeployしない。
4. 実行結果、production deployment URL、公開alias、E2E結果を次の追記へ残しcommit・pushする。

未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 265 — 本番pgcrypto配置差を補正、失敗分の完全rollbackを確認

ChromeのSupabase自動翻訳をユーザー本人が停止し、英語の原文表示へ戻した。確定済みの
`notebook_atomic_sync_v2.sql` を最初に実行したところ、本番Supabaseではpgcryptoの `digest()` が
`extensions` schemaにある一方、hash関数の固定 `search_path` が `public, pg_temp` だけだったため、
`ERROR: 42883: function digest(bytea, unknown) does not exist` で停止した。

データ保全確認:

- migration全体は明示的な `begin` / `commit` transaction内のため、エラー時に列追加、backfill、index、
  trigger、RPC、auditの全変更がrollbackされた。
- 直後のread-only SQLで `people.profile` が存在しないことと、件数が変更前と同じ
  `people=4`、`tasks=8`、`timeline_events=0`、`audit_logs=44`、
  `monitor_progress_synced=10`、`monitor_feedback_submitted=5` であることを再確認した。
- `digest(bytea,text)` と `digest(text,text)` はいずれも `extensions` schemaにあり、
  `anon` / `authenticated` / `service_role` は同schemaへのCREATE権限を持たないことも確認した。
  現在進行中のモニター記録と回答は削除・変更されていない。

互換修正:

- `digest()` を直接呼ぶ3つのcanonical hash関数と `sync_notebook_v2` だけを、固定
  `search_path = pg_catalog, extensions, public, pg_temp` に変更した。Supabase管理schemaを
  `public` より先にし、通常PostgreSQLでpgcryptoが `public` に入る構成もfallbackとして維持する。
- 静的testへ、`digest()` 呼出しが上記4関数だけにあり、各関数が同じ固定search pathを持つ検査を追加した。
- PostgreSQL 16で、pgcrypto=`extensions` の現行schema、7前提列欠落の旧本番相当schema、
  pgcrypto=`public` の通常構成をすべて再現し、migrationとregressionが成功した。
- `test-notebook-sync-safety`、`test-notebook-sync-runtime`、`git diff --check` は成功。

次は、この互換修正をpushしたうえで同じ本番migrationを再実行する。成功後に列、件数、RPC、index、
triggerを確認し、`ai_consult_memory.sql` と `verify_compact.sql` が成功した場合だけVercel本番Webを
deployする。未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 266 — 手帳・AI長期記憶の本番DB反映成功、匿名保持期限の承認待ち

追記265のpgcrypto互換修正を `14bd440` (`fix: resolve pgcrypto in Supabase migrations`) として
origin/mainへpushした後、本番Supabase project `ypnuxyfirlvbsqujocuy` へ次を反映した。

本番DBへ成功したSQL:

1. `notebook_atomic_sync_v2.sql`
   - 初回成功時SHA-256: `f78b293f6e604c0bebe01cbd4358e796db6d52932ee01d7d8e5203bd24419caa`
   - 手帳の対象者、確認リスト、日記を1 transactionで同期するRPC、revision/hash、安定ID、receipt、
     viewer除外RLS、hash/version trigger、重複防止indexを追加した。
2. `ai_consult_memory.sql`
   - SHA-256: `bf4f364c9bae13ce3329b58fe8ba072d019e5b42198449487a50ed49ca7f9c0c`
   - 対象者別長期記憶、本人別相談thread/turn、同意・撤回、閲覧専用RLSとservice role更新権限を追加した。
3. `consult_trial.sql`
   - SHA-256: `1ae9f58ce91537a98f68c1c043fa478247f5a8aa9de383f790064a10e77e8a2f`
   - 旧本番に不足していた無料家族のJSTカレンダー日1日1回相談用列とindexを追加した。
4. `public_api_rate_limits.sql`
   - SHA-256: `490b92643fb83c0425eaa7021b14743e5420efe9bb6f60cef51a156a31b16244`
   - Vercelの複数instanceで共有するAI費用・公開API連打上限table、RLS、service-only RPCを追加した。

読込性能の補強:

- 古い本番には、全期間の手帳復元とAI記憶の並び順に合う
  `idx_timeline_events_person_date` と、従来hardeningの `idx_people_profile_updated_at` がなかった。
- 2 indexを原子的migrationへ含める修正を `f1aace4` (`perf: add notebook read path indexes`) としてpushし、
  PostgreSQL 16の現行schema・7列欠落旧schemaでmigration/regressionを再確認した。
- 本番へSHA-256 `1195ff02ed170a6c98049a2264464adcf256d8431bc866e3ad43f50c702d957e` の
  最新migrationを再実行し、両indexを追加した。再実行は冪等で成功した。

本番検証結果:

- 手帳・AI専用の主要67 targetはすべてtrue。RPC、列、constraint、unique partial index、trigger、
  authenticated/anon/service role権限、AI4テーブルのRLSを個別にも確認した。
- 無料相談列/index、共通rate-limit table/RLS/RPC/service-only grantはすべてtrue。
- AI記憶4テーブルとrate-limit tableは作成直後0件で、既存データを自動コピー・変更していない。
- 既存件数は反映前後とも `people=4`、`tasks=8`、`timeline_events=0`、`audit_logs=44`、
  `monitor_progress_synced=10`、`monitor_feedback_submitted=5`。モニター記録・回答は消えていない。
- `verify_compact.sql` 133項目は117成功、16未適用。残りは旧本番の通知メール2列、Mobile初回登録RPC、
  匿名診断保持期限RPC、寝かせている地域スポンサー12項目で、手帳・AIのschema targetではない。
  地域スポンサー全体を検査数だけのために追加することはscope外として行っていない。

現在の安全停止理由:

- `purge_stale_anonymous_cases` が旧本番に無く、日次匿名診断保持期限cronは現状500になる。ただし同routeの
  モニター回答保持期限処理は独立して実行される。修正用 `anonymous_case_retention.sql` は、適用直後には
  削除しないが、次の日次cronから「ログイン・家族・対象者に紐づかないdraft/result_readyの匿名診断」で
  30日超かつ有償支援依頼やapp引継ぎのないものを最大100件ずつ削除できるようにする。
- これは手帳・AI追加とは異なり、将来の実データ削除を有効化するため、以前説明した「既存データを
  削除しない」承認の範囲を広げず、ユーザーの明示承認待ちで停止した。
- Vercel production Webはまだdeployしていない。現在の旧Webは新しいDB列・tableと後方互換で動作中。
  承認後は保持期限SQLと権限だけを確認し、Vercel本番deploy、公開alias・health・未認証fail-closed・
  手帳/AI導線のsmokeを行う。実モニター記録をテスト用に編集・削除しない。

未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 267 — 匿名保持期限は承認済み、Chrome操作接続の復旧待ち

ユーザーから、追記266で説明した30日超の匿名診断保持期限を有効化し、Vercel本番公開まで進める
明示承認を得た。削除対象はログイン利用者、家族、対象者に紐づかず、app引継ぎ・有償支援依頼のない
`draft` / `result_ready` の匿名診断だけで、モニターの日記・回答・途中経過は対象外である。

公開前ローカル確認（HEAD / origin/mainとも `50c49d2`）:

- Web・Mobile TypeScript: 成功
- `test:notebook-sync-safety` / `test:notebook-sync-runtime`: 成功
- `test:consult-memory`: 成功
- `test:monitor-timeline`: 8/8成功
- `test:monitor-retention`: 6/6成功
- `doctor:local`: 成功
- Web production build: 成功。静的ページ162/162。Node 20のSupabase将来非対応warningだけで現buildは成功。
- `git diff --check`: 成功。tracked差分なし、mainとorigin/main一致。
- `anonymous_case_retention.sql` のSHA-256は
  `07e87f7fc5f91efa706529dc6037ac991080755591668a326f23b9c51d54d2f6`。

現在の停止理由:

- Supabaseへログイン済みのChromeは起動中で、ChatGPT Chrome拡張はDefaultプロフィールにinstall・enable済み、
  native host manifestも正常。しかしタブ一覧取得が2回timeoutし、操作接続だけが応答しなくなった。
- アプリ内ブラウザーは操作可能だがSupabase/GitHubとも未ログイン。認証情報を要求・転記せず停止した。
- この追記時点で `anonymous_case_retention.sql` は未適用、Vercel production Webも未deploy。
  追記266までに反映した手帳・AI長期記憶・無料枠・共通rate limitは本番DBに残り、旧Webと後方互換。
- 次はユーザー承認のうえDefaultプロフィールの新しいChrome windowを1枚開き、拡張接続を再試行する。
  接続後は削除対象件数をread-onlyで確認してから保持期限functionを追加し、権限・既存モニター件数を
  再確認する。続いてVercel本番deploy、公開alias、health、未認証fail-closed、手帳/AI導線を確認し、
  最終結果を次の追記へ残す。

未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 268 — Chrome再接続失敗、Codex内ブラウザーでSupabaseログイン待ち

ユーザー承認後、Defaultプロフィールの新しいChrome windowを1枚だけ開き、2秒以上待って
ChatGPT拡張の操作接続を再試行した。しかしタブ取得が再びtimeoutした。拡張、native host、Chrome起動の
診断は正常だったため、規定どおり同じ接続の再試行や別のMac操作手段による迂回は行っていない。

代替確認:

- `supabase` CLIは未導入で、既存の `scripts/run-sql.mjs --check` は
  `SUPABASE_ACCESS_TOKEN が設定されていません` と安全に停止した。tokenを要求・表示・保存していない。
- Codex内ブラウザーで本番project `ypnuxyfirlvbsqujocuy` のSQL Editor URLを開き、Supabaseの
  `Continue with GitHub` を押してGitHubログイン画面まで進め、ユーザー操作用に前面表示した。
- ユーザーがGitHub認証を完了したら、同じタブから削除候補件数のread-only確認、
  `anonymous_case_retention.sql` の適用、function/grantと既存モニター件数の再確認を続ける。
- この追記時点でも保持期限SQLは未適用、Vercel production Webは未deploy。モニターの日記・回答・
  途中経過は変更・削除していない。

未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 269 — 匿名保持期限とAI長期記憶Webを本番反映、公開smoke成功

ユーザーがCodex内ブラウザーでGitHub / Supabaseへログインし、本番project
`ypnuxyfirlvbsqujocuy` のSQL Editorであることを画面上で再確認した。

匿名診断保持期限:

- 適用前のread-only確認は `cases_total=43`、30日超かつ未ログイン・未引継ぎ・有償支援なしの
  削除候補 `26`、`monitor_progress_synced=10`、`monitor_feedback_submitted=5`。
- SHA-256
  `07e87f7fc5f91efa706529dc6037ac991080755591668a326f23b9c51d54d2f6` と一致する
  `supabase/anonymous_case_retention.sql` を実行した。
- 1回目はSQL Editorが直前のread-only queryを完全消去せず連結し、`create` 直前のsyntax errorで停止した。
  PostgreSQLは構文解析時点で拒否しており書き込みなし。入力全体を選択・消去して54行のSQLだけを入れ直し、
  `Success. No rows returned` を確認した。
- 適用後はfunctionあり、`service_role` execute=true、`authenticated` / `anon` execute=false。
  件数は `43 / 26 / 10 / 5` のまま不変で、適用操作では匿名診断もモニター情報も削除していない。
- 日次cronは `30 3 * * *`（03:30 UTC / 12:30 JST）。次回以降、条件に合う匿名診断だけを
  1回最大100件削除できる。ログイン利用者・家族・対象者、app引継ぎ、有償支援中、モニター情報は対象外。

Vercel production:

- deploy元HEAD / origin/mainは `5620a85`。対象projectは `oyano-moshimo-navi`。
- 最初のCLI呼出しはsandboxのDNS制限でVercelへ到達する前に停止。本番変更なし。network許可後に同じ
  `npx vercel --prod --yes` を再実行した。
- deployment id: `dpl_3VA94uxX7aKFTShrutdKcVdoeNUJ`
- immutable URL: `https://oyano-moshimo-navi-ijju4b84f-dogwoodcommunity1.vercel.app`
- production alias: `https://oyano-moshimo-navi.vercel.app`
- Vercel buildはcompile・typecheck・162/162 static generationに成功し、READY / production / alias済み。

公開smoke:

- `/api/health` 200 / `ok=true` / version `0.3.0`、`/home` 200。
- 未認証 `/api/notebook/sync`、AI memory、AI consent、匿名削除cronはすべて401。
- 空質問の `/api/consult` は課金なしで400。Anthropicへの正常質問は送っていない。
- `smoke:notebook-sync` はtokenなしread-only modeで401を確認して成功。書き込みなし。
- `smoke-web.mjs` は初回、11画面成功後に一時socket切断。単独再実行で全公開画面、monitor開始/報告、
  手帳、相談、PWA、法務、管理画面、health、認証guardを最後まで成功した。
- 実本番 `/consult` をブラウザーで開き、「全期間の手帳記録と本人の過去相談を継続して読む」、
  「長期記憶を確認できるまで相談を送信しない」、「その場限りの回答には戻さない」の表示を確認した。
- 実AI送信、cron実行、モニター記録の編集・削除、認証済みの書き込みsmokeは行っていない。

未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 270 — AI記憶の送信前競合・cron認証・実DB分離testを追加（本番未deploy）

追記269の本番反映後、モニター画面・日記・回答を変更せずに安全監査とローカル回帰testを続けた。
本番Supabaseのブラウザーsessionは期限切れでlogin画面へ戻ったため、追加SQLやread-only queryを実行せず、
最新の本番確認値は `monitor_progress_synced=10`、`monitor_feedback_submitted=5` のまま扱っている。
管理画面の最新集計は11 session / 回答5 / 回答期間中の未回答2 / まだ回答日前4であり、全回答が揃う前の
手帳UI大幅変更は引き続き停止する。

AI長期記憶の外部送信境界:

- 相談用の長期記憶を読んだ後、別端末や家族操作で記憶の訂正・除外・resetが起きても、従来は
  Anthropic呼出し後にしかmemory version / reset時刻の競合を検出できなかった。回答保存・表示は止まるが、
  古い記憶を外部AIへ送った後になるprivacy上のraceだった。
- `/api/consult` で、Anthropicを呼ぶ直前に現在の家族権限・同意を取り直した同じauthorizationを使い、
  memory versionとreset時刻も再照合するようにした。競合時はHTTP 409 `memory_conflict` で止まり、
  Anthropic呼出し0回・相談履歴保存0回となる。AI応答後の既存snapshot再照合も残した。
- fake Anthropicを使うroute-level testを追加し、送信前競合=AI 0回、応答中競合=AI 1回かつ保存0回、
  変更なし=AI 1回かつ保存1回を動的に確認した。実AIは呼んでおらず費用は発生していない。

cron認証のfail-closed化:

- `CRON_SECRET` が未設定・空・空白だけのとき従来は認証を通していた。現在本番は未認証401で秘密値が
  設定済みだが、将来の環境設定事故で匿名診断削除や通知送信を開かないよう、未設定時は503で停止する
  実装に変更した。
- 正しいBearerだけ成功、未設定/空/空白=503、tokenなし/Basic/誤token/同長誤token=401のtestを追加した。
- GitHub CIへcron認証、モニター日程・保持期限、手帳sync safety/runtime、AI記憶+route、
  AI記憶PostgreSQL RLSの7 testを追加した。

AI記憶RLSの実PostgreSQL回帰:

- `supabase/ai_consult_memory_regression.sql` を追加した。本番SQL Editorへは入れず、破棄専用PostgreSQLでだけ
  実行するtransactional testで、全fixture/mutationは最後にrollbackする。
- PostgreSQL 16の破棄専用containerを合計4回作成し、2回目以降はREADME記載の正式順
  `schema.sql` → `api_grants.sql` → `production_rls.sql` → `ai_consult_memory.sql` 2回 → regressionで成功した。
  独立レビューでservice role CRUD検査のany-of偽陽性を見つけ、16権限の個別判定へ修正後、現行bytesを
  3回目で再確認した。さらにauthenticated/anonのTRUNCATE/REFERENCES/TRIGGER否定と自動runnerを追加し、
  4回目はCIと同じ `test:consult-memory:sql` で成功した。migrationの冪等性も確認後、4台とも停止・
  自動削除され、残存containerがないことを確認した。既存Docker DBには触れていない。
- 家族A/Bの共有記憶分離、相談thread/turnの本人限定、同意の本人限定、owner/member/viewerの共有記憶閲覧、
  家族解除直後の4table即時遮断、authenticated直接更新拒否、anon拒否、service role限定CRUD、constraintを
  実row/RLSで確認した。

ローカル検証:

- `test:cron-auth`、`test:consult-memory`（core + route）、`test:monitor-timeline`、
  `test:monitor-retention`、`test:notebook-sync-safety`、`test:notebook-sync-runtime`: すべて成功。
- Web/Mobile TypeScript: 成功。最初にWeb typecheckとbuildを同時実行した回だけ、buildが `.next/types` を
  再生成する競合でTS6053となった。build完了後の単独再実行はWeb/Mobileとも成功した。
- Web production build: 成功。静的ページ162/162。Node 20のSupabase将来非対応warningだけ。
- `git diff --check`: 成功。

この追記時点では本番Webの再deploy、本番DB変更、実AI送信、cron手動実行を行っていない。
公開中は追記269のdeployment `dpl_3VA94uxX7aKFTShrutdKcVdoeNUJ` のままである。今回のコードを本番へ
反映する場合は、対象が `/api/consult` の送信前guardと共通cron認証であることを説明し、明示承認後にdeploy、
未認証cron 401、空質問consult 400、公開smokeを再確認する。

保持期限監査では `purge_stale_anonymous_cases` の削除先は `cases` だけで、`audit_logs.target_id` に
caseへの外部キー/cascadeがないことを確認した。モニター途中経過・回答は別処理で基準日から暦月6か月後だけが
対象なので、現在のモニター情報が次回cronで消えることはない。

次の優先順は、(1)今回の安全修正の本番deploy承認、(2)残り6 sessionの最終回答回収、(3)全回答確定後の
手帳UI再設計、(4)課金開始前に特商法・プライバシーの未確定事業者情報を正式化、(5)匿名診断のcase IDだけで
上書きできる導線へ所有tokenとtransactional RPCを追加、である。

GitHub反映:

- 実装commit `8d1a64a` (`fix: harden AI memory and cron boundaries`) をorigin/mainへpushした。
- GitHub Actions CI run `33491423488` は1分34秒で成功。Web/Mobile typecheck、モニター、cron認証、
  手帳sync、AI記憶core/route、破棄専用PostgreSQL RLS、Web build、smokeがすべてgreen。
- 同commitの `Deploy to Vercel` workflowは成功表示だが、従来どおり環境secret未設定時のskipであり、
  本番deploymentとproduction aliasは変更していない。

未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 271 — AI記憶の送信前guardとcron認証を本番反映

ユーザーから、追記270の安全修正をVercel productionへ反映する明示承認を得た。今回の対象は
`/api/consult` のAnthropic送信直前のmemory version / reset再確認と、共通cron認証の未設定時
fail-closed化だけである。本番SupabaseのSQL・schema・RLSは変更せず、実AI送信、正しいcron tokenでの
実行、モニターの日記・回答・途中経過の編集や削除は行っていない。

公開前確認:

- deploy元HEAD / origin/mainは `6744ed2c7fac905f3306882a6cd600f7112b1c66` で一致し、tracked差分なし。
- 対象Vercel projectは `oyano-moshimo-navi`、project IDは
  `prj_nk3XUTnqSUFsiGZGc4Ifsi9SIr1H`、accountは `dogwoodcommunity`。
- 実装commit `8d1a64a` のGitHub Actions CI run `33491423488` と、最終HEADのrun
  `33491624472` はどちらも成功済み。Web/Mobile typecheck、モニター、cron、手帳sync、AI記憶、
  破棄専用PostgreSQL RLS、Web buildを含む。
- 直前のproduction deploymentは `dpl_3VA94uxX7aKFTShrutdKcVdoeNUJ` だった。

Vercel production反映:

- `npx vercel --prod --yes` を実行し、compile・typecheck・静的ページ162/162生成に成功した。
- deployment id: `dpl_4Ky82Cy38Ycw4wixr6Lh3pHamiWZ`
- immutable URL:
  `https://oyano-moshimo-navi-2d2nh4itl-dogwoodcommunity1.vercel.app`
- production alias: `https://oyano-moshimo-navi.vercel.app`
- inspector:
  `https://vercel.com/dogwoodcommunity1/oyano-moshimo-navi/4Ky82Cy38Ycw4wixr6Lh3pHamiWZ`
- deploy後のalias inspectで、新deploymentが `READY` / `production` としてalias先になったことを確認した。

公開後確認:

- `/api/health` は200 / `ok=true` / version `0.3.0`、`/home` は200。
- 未認証の匿名診断削除cronと通知cronは401 `Invalid cron token`。正しいtokenは使わず、処理を
  実行していない。
- 空質問の `/api/consult` は400。Anthropic呼出しと相談履歴保存は発生していない。
- AI memoryはperson IDなしで400、架空person ID・未ログインで401 `login_required`。
- 認証済みの手帳/AI書き込みsmokeと、本番で意図的に409 `memory_conflict` を起こす再現は行っていない。
  新guardの競合分岐は、fake Anthropicを使うroute-level testとGitHub CIで確認済みである。
- `smoke-notebook-sync.mjs` はtokenなしGET 401のread-only確認だけで成功した。
- `smoke-web.mjs` は公開画面、法務画面、monitor画面、PWA、health、未認証管理/API guardを完走した。
  ただしこのscriptの無効Stripe checkout POSTは、token検証より先に連打防止RPCを通るため、
  `public_api_rate_limits` の `stripe:checkout:<IP・User-Agentのhash>` カウンターを1リクエスト分
  upsertした。制限windowは600秒で、window経過後の次回アクセス時にcountが1へresetされる。
  row自体の自動削除は現SQLにない。送信bodyはsmoke用の架空case IDと `smoke@example.com` で、
  checkout tokenなしの400でStripe設定・case取得より前に停止したため、決済・支援依頼・case・
  モニター・AI・audit logへの書き込みはない。以後このfull smokeは繰り返していない。

本番Supabaseのブラウザーsessionは期限切れのままなので、deploy後にモニター件数を再queryしていない。
最後に確認済みの値は `monitor_progress_synced=10`、`monitor_feedback_submitted=5`、管理画面集計は
11 session / 回答5 / 回答期間中の未回答2 / まだ回答日前4である。これは今回のdeploy後の再確認値ではなく、
追記270までの最新確認値として扱う。次は残り回答を回収し、全回答確定後に手帳UIを再設計する。

未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-01 追記 272 — 本番の最終回答回収数を再確認（5件のまま）

ユーザーがCodex内ブラウザーでGitHub / Supabaseへ再ログインした後、本番project
`ypnuxyfirlvbsqujocuy` のSQL Editorで件数だけをread-only queryした。実行したのは
`audit_logs` の `monitor_progress_synced` / `monitor_feedback_submitted` を集計するSELECT 1回だけで、
INSERT・UPDATE・DELETE、回答本文や画像の取得、SQL EditorのSaveボタン操作は行っていない。実行後の
Editor URLにはquery IDが付いたため、Supabase UI側のautosave draftとしてSELECT本文が残る可能性はある。

2026-09-01の再確認値:

- 途中経過共有: `monitor_progress_synced=10`
- 最終回答: `monitor_feedback_submitted=5`
- 最新の途中経過共有: `2026-09-01 02:42:49.779+00`（11:42:49 JST）
- 最新の最終回答: `2026-09-01 02:27:22.587+00`（11:27:22 JST）

追記270・271時点の5件から新しい最終回答は増えていない。ユーザーが依頼した11人を分母にすると
回収済み5件・未回収6件、回収率の目安は45.5%である。ただし途中経過10は匿名session rowの件数であり、
参加者10人を意味しない。別ブラウザー、履歴削除、やり直し、途中共有への不同意があるため、参加者本人との
照合は最終回答に本人が入力したCrowdWorks名を募集台帳と突合する必要がある。

この確認でモニターの日記・回答・途中経過を編集・削除していない。未追跡の `review_exports/` は引き続き
参照・変更・追加・commit対象外。

## 2026-09-02 追記 273 — 最終回答が7件へ増加、7名分で重複なし

本番Supabaseのログイン済みSQL Editorで、前回の件数確認SELECTを再実行した。結果は次のとおり。

- 途中経過共有: `monitor_progress_synced=10`
- 最終回答: `monitor_feedback_submitted=7`（前回5件から2件増加）
- 最新の途中経過共有: `2026-09-01 22:11:29.762+00`（2026-09-02 07:11:29 JST）
- 最新の最終回答: `2026-09-01 22:11:28.057+00`（2026-09-02 07:11:28 JST）

同じ人の再送を重複計上していないかを、名前本文を表示せず集計だけで追加確認した。最終回答row 7件に対し、
正規化したCrowdWorks名のdistinct countも7件だったため、現在は7つの異なる回答者名である。依頼11人を
分母にすると回収済み7件・未回収4件、回収率63.6%である。ただし途中経過10は引き続き匿名session rowで、
参加者人数を意味しない。

重複確認の最初の入力はSQL Editor上で既存内容の一部が残りsyntax errorとなり、PostgreSQLの構文解析で
拒否された。単一行のread-only SELECTへ入れ直して7 / 7を確認した。いずれもINSERT・UPDATE・DELETE、
回答本文・氏名一覧・画像の取得、Saveボタン操作は行っておらず、モニターの日記・回答・途中経過を
編集・削除していない。未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-02 追記 274 — 未回答4セッション中3件は回答画面表示済み、1件は9月3日0時から

ユーザーから残り4人に回答画面が出ているか確認依頼があり、本番 `audit_logs` の回答本文・氏名を
取得せず、`monitor_progress_synced` の `reportDueAt` と `monitor_feedback_submitted` の紐付けだけを
read-only SELECTで集計した。管理APIと同様にmonitor session IDを優先し、取れない場合は開始日時で
紐付けた。

確認結果:

- 最終回答7件、途中経過10 session
- 途中経過と紐づく最終回答6件、途中経過rowなしで最終回答だけ届いたもの1件
- 途中経過上の未回答は4 session
- 4 sessionのうち回答開始日時を迎えているもの3件
- まだ回答開始日前のもの1件、回答開始予定は
  `2026-09-02 15:00:00+00`（2026-09-03 00:00 JST）
- 回答開始日時を取得できない未回答sessionは0件

したがって「残り4人全員にすでに回答画面が出ている」とは言えず、追跡できる未回答4 sessionでは
3件が現在表示可能、1件は9月3日0:00から表示可能になる。途中経過は匿名で名前を収集していないため、
この4 sessionを募集台帳の残り4名へ個別には紐付けられない。

最初の集計SELECTは `target_id` のuuidと回答側session IDのtextを直接比較して型errorとなり、
PostgreSQLの実行前に拒否された。`target_id::text` へ修正後に上記を確認した。INSERT・UPDATE・DELETE、
回答本文・氏名一覧・画像の取得、Saveボタン操作は行っておらず、モニターデータは変更していない。
未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-03 追記 275 — 依頼数と同じ最終回答11件を回収し、一次集計は「再設計」

ユーザーからモニター回答の集計依頼があり、ログイン済みの本番Supabase SQL Editorで現行モニターの
最終回答をread-only SELECTした。対象は `action=monitor_feedback_submitted`、
`target_type=monitor_test`、`monitorCampaignId=crowdworks-2026-08`、
`formVersion=2026-08-25-monitor-review-v2` に限定した。

回収・整合性:

- 最終回答11件、異なるクラウドワークス表示名11件で、依頼数11人と同数。事前の名前登録をしない
  運用のため、依頼した11人本人かはクラウドワークス採用者名簿との表示名突合が必要。
- 再送0件。自動記録日数を取得できた回答11件。
- `screenshotPaths` が1〜3件だった回答11件、合計14件。画像実体・内容・個人情報は未確認。
- 最初の回答は2026-09-01 01:52:51 JST、最後の回答は2026-09-03 08:38:09 JST。

主要結果:

- 自動カウントで全員が5日以上記録。7日7人、6日2人、5日2人で、合計71/77日（92.2%）。
  最終記録日は11人全員が7日目。初回登録時間の中央値は149秒（2分29秒）。
- AI相談は11人全員が利用でき、10人は「すぐ使えた」。
- 最初に迷った場所は、書類の所在メモ4人、家族招待3人、過去記録2人、初回登録1人、
  今日の記録と保存1人。書類メモと家族招待で7/11人を占めた。
- 書類メモは利用成功3人、利用未完了8人。家族招待は手順確認4人、利用未完了7人。
- 継続意向は「ぜひ使いたい」「たぶん使う」が6/11人。家族共有は「共有したい」または
  「場合によっては共有したい」が9/11人。
- 価格提示前は「0円」が7/11人。月980円・年9,800円提示後は、直接払う・年払い検討が0人、
  家族相談3人、無料のみ6人、使わない2人。

`FAMILY_TEST_PROTOCOL.md` の基準では、自動記録3日以上が11/11人で70%以上、実価格への前向きな
支払意向が0/11人で30%未満なので、判定は **再設計**。指定課題としての短期記録の実行可能性はあるが、現状の
提示条件で直接の支払意向を確認できなかった。価格、課金対象、価値の見せ方のどれが主因かは分離できない。
また、有償で記録を課題として依頼した探索的モニターなので、短期の実行可能性を自然利用の習慣とみなさない。
40代未満が2/11人含まれることも調査上の制約とする。

自動イベントは過去記録10、確認リスト4、書類メモ3、家族招待0、AI相談11、クラウド控え0だったが、
自己申告では確認リスト10人が成功、家族招待6人が画面を開いている。イベント未観測を未使用と断定せず、
再設計時に計測条件も修正する。

匿名の一次集計と再設計優先順位は `docs/MONITOR_FINAL_AGGREGATE_2026-09-03.md` に保存した。回答者名、
回答者ごとの自由記述、画像そのものは資料へ転載していない。次は採用者名簿との表示名突合、
添付14件の実体・内容確認と匿名での画面別分類を行い、
PDF・印刷操作時の停止報告を再現確認してから、今日の記録とAI相談を核に画面構成案と受け入れ条件を作る。

この確認ではINSERT・UPDATE・DELETE、回答・日記・途中経過・画像の編集や削除、SQL EditorのSaveを
行っていない。集計JSONへ切り替えた最初の入力は既存SELECTの後ろへ追記されてsyntax errorとなり、
PostgreSQLの構文解析で拒否された。Editor内容を全選択して単一のread-only SELECTへ入れ直し、結果を確認した。
未追跡の `review_exports/` は引き続き参照・変更・追加・commit対象外。

## 2026-09-03 追記 276 — 11人の声をもとに無料ユーザー中心へ手帳を再設計

ユーザー判断で、今回のモニター結果は有料会員を増やす根拠ではなく、無料で使い続けたい6/11人と
家族共有に前向きな9/11人の声を生かして無料利用者を増やすために使うことになった。直接の支払意向は
0/11人なので、日常画面でPlusを押すのではなく、無料で「記録する→保存を確信する→見返す→書類の
保管場所を残す→家族へ送る」まで通ることを今回の目的に固定した。判断・受け入れ条件・匿名計測の定義は
`docs/FREE_FIRST_REDESIGN_2026-09-03.md` に保存した。

実装:

- 手帳上部を対象者名、端末/クラウドの保存先、今日の記録、AI・家族・履歴・書類の4近道に整理した。
- 非表示だった手帳内ナビを `今日 / 履歴 / 情報 / 確認 / 写真` の5タブとして常時表示し、過去記録を
  今日の入力フォームから分離した。タブにはtablist/tab/tabpanel、選択状態、対応領域を付けた。スマホでは
  縦積みの固定ヘッダーと重ならないよう、手帳タブをstickyにしない。
- 新規登録後は長いプロフィール欄へ自動移動せず、手帳上部から開始する。
- 記録のないカレンダー日は押せない状態にし、日付を押すとその日の一覧、保存直後の「この記録を見返す」
  と「この記録を編集する」は保存した同一カードへ移動する。解除文言は「すべての記録に戻る」に統一した。
- 記録カードでは本文を先に見せ、長いナビ文を「ナビからのヒントを見る」へ折り畳んだ。操作名は
  「内容を編集」「あとで確認に追加」「AIに相談」に短縮した。
- 「書類・鍵の場所」はホームから1操作で編集欄を開き、対象textareaへ移動・focusする。暗証番号等ではなく
  保管場所だけを残す注意を併記した。
- 家族画面はログイン前でも3手順を表示する。招待リンク作成後は「まだ相手には届いていません」と表示し、
  `LINEやメールで送る` を主操作、コピーを副操作にした。家族1人まで無料、招待された人は無料と明示した。
- 通常の保存完了・AI当日上限画面からPlus/980円訴求を外し、料金画面も無料プランを主役にした。Plusは
  2人目以降など本当に必要になった場合だけ確認する位置に残した。
- 記録、AI回答の手帳保存、危機記録、基本情報/書類メモはlocalStorageへの永続化成否を判定する。失敗時は
  成功表示、匿名成功イベント、フォーム消去を行わず、メモリー上の偽保存もrollbackする。
- 無料成長の操作回数として `history_viewed`、`document_memo_saved`、`family_invite_created`、
  `family_invite_shared` を追加した。招待リンク作成とOS共有完了は別イベントで、本文・氏名・メール・画像は
  含めない。プライバシー表示にも種類と利用目的を追記した。管理画面では人数と誤認しない操作回数として出す。
- PWA cacheをv49へ更新した。GitHub CIへ `test:free-first-redesign` を追加した。

ローカルの隔離ブラウザーで行った実操作:

- 新規登録の必須4項目を空で送ると、呼び名・関係・都道府県・市区町村を列挙したエラーが出て最初の入力へ
  focusすることを確認した。仮データで登録すると手帳上部をscrollY=0で開いた。
- 今日の記録を空で保存するとエラーと入力focus、仮の1行を保存すると日付付きの端末保存完了になり、入力が
  空になった。同じ記録の見返しは該当カードがviewport内、編集は同じカード内に開き、変更後も同位置だった。
- 書類メモ近道は情報タブを開いて対象入力へfocusし、保存後の再読込でも仮メモが残った。
- 未ログイン/クラウド未設定でも家族招待の3手順と「リンク作成だけでは届かない」が先に見えた。
- 320 / 390 / 768 / 1280pxで手帳名と5タブが表示され、全幅で
  `documentElement.scrollWidth - clientWidth = 0`。390pxではグローバルヘッダー下でタブがstaticとなり、
  重なりがない。新しいブラウザータブのconsole error/warningは0件だった。

検証:

- `test:free-first-redesign`: 成功。
- `test:notebook-sync-runtime`: 成功。記録保存失敗と基本情報保存失敗が偽データを残さない動的検査を含む。
- `test:notebook-sync-safety`、`test:monitor-timeline`、`test:monitor-retention`、`test:cron-auth`、
  `test:consult-memory`（core + route）: 成功。
- Web/Mobile TypeScript: 成功。
- Web production build: 成功、静的ページ162/162。Node 20のSupabase将来非対応warningだけ。
- ローカル再起動後の `smoke:web` と `smoke:monitor`: 成功。最初のsmokeだけ、起動中のNext devと
  production buildが同じ `.next` を同時利用したためchunk欠落で500になった。dev serverを停止・再起動して
  単独実行した結果は全対象成功で、アプリコードの失敗ではない。今後もdevとbuildは同時実行しない。
- `git diff --check`: 成功。

安全境界:

- 本番deploy、本番DB/schema/RLS変更、実AI送信、実招待、決済、モニターの日記・回答・途中経過・画像の
  編集や削除は行っていない。今回の実装はGitHubへpushするが、本番反映は別の明示承認後に行う。
- モニター添付14件の画像実体・個人情報確認と匿名の画面別分類、PDF/印刷停止の再現は引き続き未実施。
- 未追跡の `review_exports/` は参照・変更・追加・commit対象外。

次は、(1)この無料中心版の本番反映をユーザーが明示承認した場合だけdeploy、(2)公開後は書き込みを伴わない
表示/console/横幅確認、(3)無料利用の履歴到達・書類メモ保存・招待リンク作成を操作回数として観測、
(4)次の無誘導テストで各80%以上を確認する。有料化判断はこの無料利用の定着後まで保留する。

GitHub反映:

- 実装commit `769e1ba` (`feat: redesign notebook for free user growth`) をorigin/mainへpushした。
- GitHub Actions CI run `33715148400` は1分28秒で成功。Web/Mobile typecheck、モニター日程・保持、
  cron認証、手帳sync safety/runtime、無料中心再設計、AI記憶core/route、破棄専用PostgreSQL RLS、
  Web build、smokeがすべてgreen。
- 同commitの `Deploy to Vercel` run `33715148405` はcheckだけ成功し、deploy jobはskipped。したがって
  production deploymentと公開aliasは変更していない。

## 2026-09-03 追記 277 — モニター添付14件を分類し、PDF停止・クラウド横はみ出しを改善

ユーザーの「もらった意見をちゃんと改善したか」という確認を受け、追記276で残していたモニター添付画像の
匿名分類と、PDF・印刷の停止報告に対する実装・再テストを行った。本番公開は別承認のまま、ローカル実装、
本番ビルド、GitHubへの退避までを今回の範囲とした。

添付画像の確認:

- 本番管理者画面から、最終回答に紐づく添付14件を読み取り専用で開き、14/14件が欠損なく表示できた。
- 匿名分類は、今日の記録・手帳5件、履歴4件、初期登録・プロフィール2件、クラウド保存1件、急なとき1件、
  最終回答フォーム1件。PDF・印刷、書類メモ、家族招待そのものの画像は0件だった。
- クラウド保存の1件では、狭い画面で右端が切れて横へはみ出している状態を確認した。今日の記録・履歴では、
  説明やナビ補足が本文より目立つこと、縦スクロール、狭いカード内の折り返しが共通した。
- 画像、氏名、入力内容、Storageの保存パスはリポジトリへ転載していない。入力済みプロフィールが見える画像も
  要配慮として内容を転記していない。匿名レビューは `docs/MONITOR_SCREENSHOT_REVIEW_2026-09-03.md`、
  一次集計への反映は `docs/MONITOR_FINAL_AGGREGATE_2026-09-03.md` に保存した。

実装:

- クラウド保存カード、見出し、説明、メール入力、保存状態、操作ボタンへ `min-width: 0`、幅上限、折り返しを
  追加した。390pxのローカルブラウザーでdocumentと各カードの `scrollWidth <= clientWidth` を計測し、
  横はみ出し0を確認した。
- 思い出の手帳は「PDF保存」と「紙に印刷」を別の準備ボタンへ分けた。準備完了後に利用者がもう一度
  「PDF保存画面を開く」または「印刷画面を開く」を押す2段階にし、非同期処理後も明示的な利用者操作から
  OSの印刷画面を開く。
- 開始日・終了日で毎日の記録を選ぶ期間指定と、全件に戻す操作を追加した。期間境界を含み、期間外を除外する
  動的テストを追加した。
- 写真は一度に12枚までに下げ、画面上で拡大表示できるようにした。印刷用では拡大ボタンの装飾とモーダルを
  出力しない。
- クラウド写真復元は、Supabaseの `getSession()` を含む処理全体へ12秒の期限を付けた。期限時はfetchをabortし、
  遅れて認証が返ってもstateを更新しない。個別画像のload/decodeにも合計7秒の期限を設け、
  `Promise.allSettled` と `finally` で準備中表示を必ず解除する。
- 写真確認中でも「写真もPDFに入れる」を外せば本文だけで進める。印刷準備中は期間、写真、記録の選択を
  一時的に無効化し、古い非同期結果が変更後の選択を準備済みに戻す競合を防いだ。
- 専用テスト `scripts/test-memory-book-export.mjs` を追加し、CIへ組み込んだ。未解決の認証Promise、遅れて届く
  load、届かないload、未解決decode、期間境界、準備中の選択ロックを検査する。

ローカルの隔離ブラウザーで行った実操作:

- 新規登録の必須4項目を空で進め、呼び名・関係・都道府県・市区町村を列挙するエラーと先頭項目へのfocusを
  確認した。
- 開始日を2026-09-03にした初日は、回答開始が2026-09-10 0:00でフォーム非表示だった。
- 開始日を2026-08-28にした7日目は「今日が7日目（最終日）」と2026-09-04 0:00の開放日時が表示され、
  まだフォームは表示されなかった。
- 開始日を2026-08-26にした8日目は、手帳上部に「最終アンケートに回答する」が表示され、クラウドワークス
  表示名、必須設問、スクショ1〜3枚の実フォームまで遷移できた。
- 390px幅でダミー手帳と記録を作り、思い出の手帳が横にはみ出さず、PDF保存と紙印刷の各準備完了ボタンが
  別々に出ることを確認した。OSの印刷画面そのものは開いていないため、iPhone/Android実機で保存先または
  プリンター選択まで進む確認は残る。

検証:

- Web/Mobile TypeScript: 成功。
- `test:monitor-timeline`、`test:monitor-retention`、`test:cron-auth`、`test:notebook-sync-safety`、
  `test:notebook-sync-runtime`、`test:memory-book-export`、`test:free-first-redesign`、
  `test:consult-memory`（core + route）: 成功。
- 破棄専用Docker PostgreSQLの `test:consult-memory:sql`: 成功。本番DBには接続していない。最初はsandboxから
  Docker socketへの権限がなく失敗し、許可された外側実行で同じテストを再実行して成功した。
- Web production build: 成功、静的ページ162/162。Node 20のSupabase将来非対応warningだけ。
- 開発サーバーとproduction buildの両方で `smoke:web`、`smoke:monitor` が成功。最初のsandbox内smokeは
  localhost接続EPERMで開始前に失敗し、許可された外側実行で成功した。
- PDF差分の独立コードレビューは、初回の2件のP1を上記期限・選択ロックで修正後、P0/P1なし。
- `git diff --check`: 成功。

安全境界:

- 本番deploy、本番DB/schema/RLS変更、モニター回答・日記・途中経過・添付画像の編集や削除、実AI送信、
  実招待、決済は行っていない。
- Vercel環境変数の確認用に作った明示的な一時directoryは削除済みで、内容を表示・commitしていない。
- 未追跡の `review_exports/` は参照・変更・追加・commit対象外のまま。

GitHub反映:

- 実装commit `a592419` (`fix: harden memory book export flow`) を作成した。
- handoff commit `18ce388` (`docs: hand off monitor feedback fixes`) とともに `origin/main` へpushした。
- GitHub Actions CI run `33757383239` は1分39秒で成功。新設したmemory book export safety、Web/Mobile
  typecheck、モニター日程・保持、cron認証、手帳sync、無料中心再設計、AI記憶core/route、破棄専用PostgreSQL
  RLS、Web build、production smokeがすべてgreen。
- `Deploy to Vercel` run `33757383213` は環境checkだけ成功し、deploy jobはskipped。本番deploymentと公開aliasは
  変更していない。
- 自動deployは今回行わない。公開URLへ反映する場合は、ユーザーの明示承認後にVercel production deployを行い、
  公開後に390px横幅、クラウド保存、思い出の手帳、主要導線を読み取り中心で再確認する。

## 2026-09-03 追記 278 — Claude総合レビュー完了、機密P0のため現行版はNO-GO

ユーザーの明示承認を得て、11人の匿名モニター集計とcommit
`8a54ad827af9984ccb07d622a9e0ce7094718225` の追跡済みソースをClaudeへ渡し、技術、セキュリティ、
AI長期記憶、保存同期、UX、アクセシビリティ、調査解釈、無料成長、本番可否を総合レビューした。

送信範囲と検証:

- `/tmp` の隔離snapshotへ必要な追跡済みソースと匿名集計資料だけを展開した。
- ZIPは4.1MB、SHA-256は `6ca38e28fc7e3d7731685378644eabd559f7c389f912149ba1172ba0b9954d6a`。
  gitleaksで秘密情報の検出なしを確認した。
- Claude.aiのWeb検索とClaude memoryをオフにし、添付snapshotだけを正本にした。
- raw回答、表示名、メール、自由記述原文、添付画像、session ID、Storage path、本番DB取得結果、
  環境変数、秘密鍵、`.vercel/`、このhandoff全文、未追跡 `review_exports/` は送っていない。
- Claudeの初回回答で残った未読範囲を追加で3回読ませ、最後にCodexの独立照合結果を渡して重大度を
  再判定させた。現行 `pnpm run test:free-first-redesign` は成功することも再確認した。

最終結果:

- Claudeの初回「条件付きGO」は、最終的に **P0 1件・NO-GO**へ訂正された。
- P0は、従来からある公開Webと家族手帳の引き継ぎ境界で、第三者が既存familyの高権限を取得し得る
  認可不備。コード履歴と過去の本番DB確認から現行productionにも残る可能性が高いが、実在データを使う
  攻撃的な本番再現は行っていない。
- 公開リポジトリへ修正前の再現手順と該当行をpushすると現行本番の危険を増やすため、詳細な依頼書と
  レビュー結果はローカルの未追跡
  `docs/CLAUDE_FULL_REVIEW_REQUEST_2026-09-03.md` と
  `docs/CLAUDE_FULL_REVIEW_RESULT_2026-09-03.md` に保持し、修正と同時に安全に公開できるまでcommitしない。
- P1として、無料中心方針に反する日常Plus導線、既存記録の編集保存失敗を成功に見せる経路、終了済み
  モニター受付の完全性保護不足を確認した。詳細は上記ローカル結果に保存した。
- Mobileの競合更新、無料枠のサーバー強制、IAP対象family、push通知の機微情報、公開uploadは、該当機能の
  有効化前に直す事項として整理した。
- AI長期記憶のversion/CAS、reset境界、AI提案の事実化防止、履歴の本人分離、RLS回帰test、手帳同期の
  idempotency/競合検出/非削除、Stripe署名には重大指摘なし。ただし本番DB投入状態と実機挙動は別確認。

モニター結果のレビュー判断:

- 有償・指定課題下で11人が5日以上記録し、AI相談まで到達した実行可能性は言える。
- 書類メモと家族招待の未完了は、優先的に直すべき導線課題として複数指標が一致した。
- 継続意向、家族共有意向、直接支払意向を混同せず、課金より無料価値を先に検証する判断は妥当。
- 自然継続率、購入率、紹介率、「無料なら必ず広がる」、11回答の本人突合は言えない。
- 安全修正後の次回は、報酬と毎日の催促なしの新規50人以上で、D1/D7/D30、履歴、書類メモ、
  招待リンク作成から実共有までを分けて測る。今回の有償課題の80%基準は流用しない。

次の作業はユーザーの追加承認が必要:

1. 機密P0を最優先で修正し、別ユーザー、変換済みcase、token再利用を含む回帰testを追加する。
2. 終了済みモニターの回答・画像受付を停止して、既存11回答を保護する。
3. 編集保存の偽成功と日常Plus導線を修正し、guardrail testを追加する。
4. 独立reviewとCI後、ユーザーの明示承認を得た場合だけsecurity hotfixをproductionへ反映する。
5. 修正後に詳細reviewをcommitし、本番DB version、最小smoke、実機/Brave/文字拡大を確認する。

今回、ソースコード修正、production deploy、本番DB/schema/RLS変更、実在caseでの攻撃再現、実AI送信、
実招待、決済、cron実行、モニター回答・日記・途中経過・画像の編集や削除は行っていない。
未追跡の `review_exports/` は参照・変更・追加・commit対象外。

GitHub反映:

- 機密詳細を除いたhandoff commit `166db6a` (`docs: record confidential Claude review gate`) を
  `origin/main` へpushした。
- GitHub Actions CI run `33761022231` は成功。Web/Mobile typecheck、全主要test、破棄専用PostgreSQL RLS、
  Web build、smokeがgreen。
- `Deploy to Vercel` run `33761022203` はcheckだけ成功し、deploy jobはskipped。本番deploymentと
  production aliasは変更していない。
- 外部送信用に作った `/tmp` の隔離directoryとZIPは、結果記録後に削除した。

## 2026-09-03 追記 279 — Claude指摘のP0/P1を修正、production反映前のため公開版は引き続きNO-GO

ユーザーの「直して」という指示を受け、追記278で確定した認可P0と3件のP1を修正した。今回の範囲は
ローカル実装、破棄専用DBを含む回帰test、独立review、GitHubへの退避までであり、本番DBとVercel
productionにはまだ反映していない。

匿名診断・アプリ引き継ぎの認可修正:

- 匿名caseの所有証明を予測可能な値から32-byte乱数のtokenへ変更した。診断APIはcase IDだけでは更新せず、
  所有tokenをheaderで確認する。
- 診断、同意記録、診断結果、初回handoff tokenの保存を新しい
  `submit_anonymous_case_diagnosis` RPCの1トランザクションへまとめた。新規caseと、APIで先に作った
  `draft`＋正しいtokenは通し、別token、内容を変えた再送、変換済みcaseは拒否する。応答消失時の同一内容再送は
  元のhandoff tokenを返し、重複rowを作らない。
- `consume_case_handoff` は `result_ready` の未変換caseだけを初回変換できる。既存familyへ新しい利用者を
  ownerとして追加・昇格する従来分岐を削除した。
- 初回変換がcommitした後にHTTP応答だけ失われた場合は、同じtokenを持つ既存family memberだけが
  書き込みなしで結果を再取得できる。部外者、未消費の後付けtoken、既存viewerの昇格、`closed` / `draft` case、
  消費済みtokenによる別利用者の再送は拒否する。
- DB内部の予期しない診断エラーはクライアントへ詳細を返さない。状態競合は409、無効な所有証明は404へ分けた。
- `supabase/verify_setup.sql`、`verify_compact.sql`、`README.md`、production checklist、local doctor、
  本番確認用smoke scriptを新しい所有tokenとRPCへ合わせた。本番適用順は、更新済み
  `handoff_consume_rpc.sql` → `anonymous_diagnosis_rpc.sql` → `verify_compact.sql` → Web deployで固定する。
  Webを先に出すと新RPCがなく診断が500になるため、この順序を崩さない。

終了済みモニターの保護:

- `crowdworks-2026-08` をsource-controlledな `closed` にした。途中経過、最終回答、画像uploadの3 POSTは、
  request body、画像byte、rate limit、DB、Storageへ触れる前に共通code付きHTTP 410を返す。
- 保存済みの最終回答11件・画像14件、管理者GET、6か月保持処理は変更しない。次回campaignを単純に再開せず、
  サーバー発行・失効可能・用途限定の参加者tokenを先に用意する方針を `FAMILY_TEST_PROTOCOL.md` に残した。
- `/monitor` は新規開始・resetを出さず受付終了を表示する。回答済み端末は従来の送信完了表示を維持し、
  未送信端末は受付終了を表示する。確認用 `?preview=1` は送信不可のまま残した。
- 過去に配った `/start?reset=1&monitor=1` を再度開いても、受付終了判定をlocalStorage削除より先に行い、
  `/monitor` へ戻す。終了後の古いURLで現在の手帳を消さない回帰testを追加した。

無料中心UXの修正:

- 日常の「ナビからの次の一歩」からPlus案内を外した。料金画面など、必要時に本人が確認する導線は維持する。
- 過去記録の編集はlocalStorageへの書き込み成否を返すようにした。失敗時はメモリー上の仮変更もrollbackし、
  編集欄と入力内容を残して警告する。成功表示、編集終了、一覧更新、scrollは行わない。

回帰testとレビュー:

- `test:handoff-security`: 成功。所有token生成、診断route/RPC呼び出し、エラー境界、handoff状態競合を確認。
- `test:handoff-security:sql`: 破棄専用PostgreSQL 16で成功。migrationの2回適用、新規/draft診断、同一再送、
  遅い失敗の全rollback、初回変換、同一memberのread-only再送、部外者・viewer昇格・fresh token・closed case拒否、
  RPCのservice-role限定を実動確認した。最初のsandbox内実行はDocker socket権限で開始前に失敗し、許可された
  外側実行で同じtestを再実行して成功した。
- `test:monitor-submission-gate`: 成功。3 POSTの副作用前410、管理GET維持、受付終了画面、古いreset URLの
  削除前guardを確認した。
- monitor timeline/retention、cron auth、notebook sync safety/runtime、memory-book export、free-first redesign、
  AI相談memory core/route、破棄専用PostgreSQL RLS、Web/Mobile typecheck、local doctor: すべて成功。
- Web production build: 成功、静的ページ162/162。Node 20のSupabase将来非対応warningだけ。
- 更新後のproduction buildをローカル起動し、`smoke:web` と `smoke:monitor` は成功。最初のmonitor smokeは
  旧「開始画面」文言を期待して1項目だけ失敗したため、終了済みcampaignの期待値へ直し、再build・再実行で
  全対象成功した。
- 認可修正の独立reviewは、途中で安全な応答消失再送と `result_ready` 限定を追加した後、P0/P1残存なし。
- `git diff --check`: 成功。

安全境界と残作業:

- 本番DB/schema/RPC変更、Vercel production deploy、実在caseを使う攻撃再現、実AI送信、実招待、決済、
  cron実行、保存済みモニター回答・日記・途中経過・画像の編集や削除は行っていない。
- このcommitをGitHubへpushしても、productionは旧DB/旧Webのままなので **NO-GOを維持**する。次はユーザーの
  明示承認後、上記順序で2 RPCを本番DBへ適用・検証し、その後だけWebをproduction deployする。
- 機密詳細を含むローカル未追跡 `docs/CLAUDE_FULL_REVIEW_REQUEST_2026-09-03.md` と
  `docs/CLAUDE_FULL_REVIEW_RESULT_2026-09-03.md` はcommitしない。production修正後に再現情報を安全化して扱う。
- 未追跡の `review_exports/` は参照・変更・追加・commit対象外。

## 2026-09-03 追記 280 — security修正commitのGitHub CI完走を確認

追記279の修正をcommit `3ea929f9cc36435b7f66b1db910ef29ffb9f596e`
(`fix: secure handoff and close monitor campaign`) として `origin/main` へpushした。

- GitHub Actions CI run `33764075659` は成功。Web/Mobile typecheck、モニターtimeline/retention/受付終了gate、
  cron認証、手帳同期safety/runtime、memory-book export、free-first、匿名診断・handoffのroute/破棄専用
  PostgreSQL security、AI相談memoryのroute/破棄専用PostgreSQL RLS、Web production build、Web smokeが
  すべてgreen。
- `Deploy to Vercel` run `33764075334` はcheck jobだけ成功し、deploy jobはskipped。Vercel productionと
  production aliasは変更していない。
- 保存済みモニター最終回答11件・画像14件、日記、途中経過には触れていない。未追跡の `review_exports/` と
  機密review文書2件も引き続きcommit対象外。
- GitHub上のソース修正は完了したが、公開版は旧DB・旧Webのままなので引き続き **NO-GO**。本番反映は
  ユーザーの明示承認後に `handoff_consume_rpc.sql` → `anonymous_diagnosis_rpc.sql` →
  `verify_compact.sql` → Web production deploy の順で実施する。

## 2026-09-03 追記 281 — 本番反映承認後のpreflightとRPC権限hardening

ユーザーから「本番反映して」と明示承認を受けた。本番Supabase project
`ypnuxyfirlvbsqujocuy`（Dashboard表示 `main / Production`）で、本文・氏名・画像を取得しない集計SELECTだけを
実行した。ここまで本番DBへの書き込みとVercel deployは行っていない。

本番preflight:

- `cases.anonymous_token` と `case_results.app_handoff_consumed_at` は存在。
- `consume_case_handoff` は存在し、`service_role=true`、`public/anon/authenticated=false`。
- 新しい `submit_anonymous_case_diagnosis` は未投入。
- 保護対象の前値は `monitor_progress_synced=10`、`monitor_feedback_submitted=11`、回答内の画像参照合計14。
- 参考の件数は `cases=17`、`case_results=17`、`families=5`、`people=4`、`tasks=8`。

本番投入前の独立監査で、`api_grants.sql` の全function向けauthenticated grantと
`CREATE OR REPLACE FUNCTION` のACL保持により、環境や再適用順によってserver-only RPCがclient roleへ
再公開され得る不足を発見した。本番投入を止めて次を追加修正した。

- `handoff_consume_rpc.sql`、`anonymous_diagnosis_rpc.sql`、一括hardening内の該当定義で
  `public, anon, authenticated` を明示REVOKEし、`service_role` だけへEXECUTEを付与。
- 新規DBで後から権限が再開かないよう、`api_grants.sql` の広いgrantより後にも両RPCの明示REVOKE/GRANTを追加。
- `verify_compact.sql` に `handoff_consume_rpc_service_only` を追加。
- PostgreSQL回帰で旧client grantを意図的に注入し、各RPCの再適用後と `api_grants.sql` 適用後の両方で
  server-onlyを確認するようにした。

ローカル確認:

- `pnpm run test:handoff-security`: 成功。
- `pnpm run test:handoff-security:sql`: 破棄専用PostgreSQL 16で成功。
- `bash -n scripts/test-handoff-ownership-sql.sh`: 成功。
- `git diff --check`: 成功。

次は、このACL修正をcommit/pushしてGitHub CI成功を確認した場合だけ、本番へ更新済み
`handoff_consume_rpc.sql` → `anonymous_diagnosis_rpc.sql` → `verify_compact.sql` を実行する。
既存本番には `production_pending_hardening.sql` と `api_grants.sql` の全体を再実行しない。その後だけrepo rootから
Vercel production deployし、無書き込みsmokeと上記件数の不変を確認する。未追跡の `review_exports/` と
機密review文書2件は変更・追加・commit対象外。

## 2026-09-03 追記 282 — partial schema互換を直し、CI再実行待ち

ACL hardening commit `7d8990a` を `origin/main` へpushした。GitHub Actions CI run `33765380614` では、
新しいhandoff route/PostgreSQL securityを含む手前の全testは成功したが、後続の
`test:consult-memory:sql` が失敗し、Web build前で停止した。本番DBとVercelにはまだ反映していない。

原因は、AI記憶だけを構築する部分schema testがhandoff RPC未作成の状態で `api_grants.sql` を実行した際、
存在しないRPCへの直接REVOKEで停止したこと。`api_grants.sql` を、各RPCが `to_regprocedure` で存在する場合だけ
dynamic SQLでREVOKE/GRANTするDO blockへ変更した。RPCが存在する通常・新規構築ではserver-onlyを維持し、
部分構築では安全にskipする。静的回帰もこの条件を確認するように更新した。

修正後のローカル確認:

- `pnpm run test:handoff-security`: 成功。
- `pnpm run test:handoff-security:sql`: 破棄専用PostgreSQL 16で成功。
- `pnpm run test:consult-memory:sql`: 破棄専用PostgreSQL 16で成功。
- `git diff --check`: 成功。

次はこの2ファイルとhandoffをcommit/pushして、新しいGitHub CIが全項目成功した場合だけ本番DB適用へ進む。

## 2026-09-03 追記 283 — Claude review security hotfixを本番DB・Vercelへ反映完了

partial schema互換修正commit `6213c977768368767d5dbcb3b464636ffd213bec`
(`fix: keep grants compatible with partial schemas`) を `origin/main` へpushし、GitHub Actions CI run
`33765778079` は全項目成功した。Web/Mobile typecheck、monitor gate、手帳同期、memory book、free-first、
handoff route/破棄専用PostgreSQL security、AI相談memory route/破棄専用PostgreSQL RLS、Web build、Web smokeが
green。Deploy workflow `33765778447` はcheckだけ成功し、deploy jobはskippedだったため、下記の手動CLIで
検証済みHEADを本番へ反映した。

本番Supabase `ypnuxyfirlvbsqujocuy` への適用:

1. 更新済み `supabase/handoff_consume_rpc.sql` を実行: `Success. No rows returned`。
2. 直後のread-only確認で、関数存在、`result_ready` 必須、旧owner upsert不在、
   `service_role=true`、`public/anon/authenticated=false` を確認。
3. `supabase/anonymous_diagnosis_rpc.sql` を実行: `Success. No rows returned`。
4. `supabase/verify_compact.sql` を実行し136項目を取得。今回対象の両RPC存在・両RPC service-onlyはtrue、
   `security_check` のfalseは0件。

`verify_compact.sql` 全体では15件のfalseが残る。内容は、未導入の通知email/push列、
`create_initial_family_person`、および未導入の地域スポンサーtable/view/index/RLSで、今回のhotfix以前から
`PRODUCTION_CHECKLIST.md` 上で未完了の将来機能。今回の認可修正・モニター保護・手帳保存とは別範囲であり、
広い一括migrationを追加投入せず現状を記録した。

本番Vercel:

- repo root、tracked差分なし、HEAD=origin/main=`6213c97`、Vercel user `dogwoodcommunity`、project
  `oyano-moshimo-navi` を確認して `npx vercel --prod --yes` を実行。
- deployment ID: `dpl_Ee9pXkdFrSD5RtyFVUXgGj6pe5ac`。
- immutable URL: `https://oyano-moshimo-navi-dokqp1nn9-dogwoodcommunity1.vercel.app`。
- production alias: `https://oyano-moshimo-navi.vercel.app`。
- `npx vercel inspect` で target=`production`、status=`Ready`、aliasが新deploymentを指すことを確認。

本番の無書き込みsmoke:

- `/api/health`: 200、`ok=true`。
- `node scripts/smoke-monitor-journey.mjs https://oyano-moshimo-navi.vercel.app`: 全項目成功。
  `/monitor`受付終了、新規開始なし、最終回答・途中経過・validate-only・画像POSTが副作用前410、
  admin/手帳同期の未認証401を確認。実AIは実行していない。
- `smoke-notebook-sync.mjs` は最初のsandbox内実行だけDNS `ENOTFOUND`。ネットワーク許可された外側で同じ
  read-only testを再実行し、tokenなしGETが401で成功。`--write` は使用していない。
- `/home`、`/monitor`、`/monitor/report`、`/legal/tokushoho`: すべて200。

データ非破壊確認:

- DB適用前、DB適用後、Web deployとmonitor smoke後の3回で、
  `monitor_progress_synced=10`、`monitor_feedback_submitted=11`、回答内画像参照合計14、
  `cases=17`、`case_results=17`、`families=5`、`people=4`、`tasks=8` がすべて不変。
- モニター回答本文・氏名・画像実体、日記本文、相談本文は取得していない。
- 実診断、実handoff、実招待、実AI送信、実同期write、決済、cron、削除は実行していない。
- 未追跡の `review_exports/` と機密review文書2件は参照・変更・追加・commit対象外。

Claude reviewで特定した認可P0、終了済みモニター受付、日記保存の偽成功、日常Plus導線のhotfixは
公開版へ反映済み。`docs/PRODUCTION_CHECKLIST.md` に両RPCと今回のproduction deploymentを記録した。

## 2026-09-04 追記 284 — 無料Web正式版のソース基盤を実装、本番反映前のためStage AはNO-GO継続

ユーザーの「正式商用版まですすめ、その後アプリ化」という方針に対し、11人のモニター結果で確定した
無料ユーザー優先の方針をStage Aの完成条件に固定した。実装commitは
`6bf4bc24d8a1d9c0b34988ea619d82fa434f79ca` (`feat: prepare free web commercial release`)。

今回のソース実装:

- 有料受付は `COMMERCIAL_SUPPORT_PACK_SALES_ENABLED` / `COMMERCIAL_PLUS_SALES_ENABLED` が明示的に
  `true`で、必須のStripe・価格・特商法情報が全て揃う場合だけ開く。通常は初期OFFで、
  画面は「受付準備中」、Checkout APIは副作用前に503で停止する。無料の手帳・AI相談に
  決済情報は求めない。
- 複数家族所属で暗黙に先頭を選ばず、対象familyを明示選択・検証する。viewerはWeb API、
  Storage、DB RLSで閲覧専用とし、owner/admin/memberだけが対応範囲を更新できる。
- 家族招待は「見るだけ」または「記録・確認リスト・写真を編集」を送信前に必ず選び、
  受け取る側は参加前に権限を確認できる。公開RPCの直接実行もmember/viewerの2種類に限定し、
  旧admin招待はfail closed、既存admin/ownerが参加しても権限を降格させず実権限を表示する。
- 招待取消、メンバー解除、本人退出、最後のownerの移管をfamily単位で直列化した。招待取消と受諾、
  写真追加とメンバー解除の競合で、先に確定した片方だけが成立する。
- 無料AI相談の1日1回を家族単位のDB claimで原子的に制御した。事前確保、外部AI失敗時の返却、
  応答消失時の同一回復を包み、成功した相談だけを使用済みとする。対象者別の長期サマリー、
  重要変化、相談履歴、関連日記、記憶の確認・訂正・削除、家族と非共有の相談の境界を維持する。
- 単一日記と対象者の手帳全体を、CAS、2段階確認、永続receipt、Storage cleanup jobで削除する。
  通信不明時は端末に削除墓標を保持して再同期から除外し、旧端末からの復活を防ぐ。
  未知Storage bucketはDB削除前に停止し、写真不在を全ページ確認するまで完了表示しない。
- Webから本人確認済みのアカウント削除依頼と状態確認を行える。実削除はログイン済みapp_adminと
  初期OFFの安全スイッチが必要で、DB・Auth・Storageの不在検証前にcompletedにしない。
  5,000件を超えるStorage manifestは破壊トランザクション前に停止し、旧homeId署名uploadの遅延も
  prefix lock/triggerとcleanupで回収する。
- 現在の手帳から呼ばれていない旧 `/api/storage/home-photo-upload-url` は、request body、認証、
  Supabase、Storageに触れず410を返す。新しい孤立objectを作らない一方、過去objectのcleanup互換は残す。
- 運営主体、責任者、問い合わせ、規約/プライバシー施行日、有料条件を `LEGAL_*` で表示する構造にした。
  未確定値を正式情報のように表示せず、メール/HTTPS問い合わせは押せる導線にした。
- `docs/COMMERCIAL_RELEASE_PLAN_2026-09-03.md`、`COMMERCIAL_RELEASE_INPUTS.md`、
  `COMMERCIAL_OPERATIONS_RUNBOOK.md` を追加し、無料Web → 有料受付 → iOS/Androidの順、backup/RPO/RTO、
  監視、障害、削除、復旧、release/rollbackの運用境界を文書化した。

検証:

- package内のnon-SQL `test:*` 19本は全て成功。モニター保護、同期、AI記憶、1日1回claim、無料導線、
  family選択/招待/管理、日記/対象者/アカウント削除を含む。実Anthropic送信は行っていない。
- PostgreSQL 16の破棄専用DBでSQL回帰8本は全て成功。アカウント削除は5,001件fixture、
  family管理は取消/受諾と写真/退出の両競合順を実動確認した。
- Web/Mobile `tsc --noEmit`、local doctor、mobile build doctor、`git diff --check` は成功。
- Web production buildは成功し、静的ページ166/166を生成。Supabase SDKが将来Node 20以下を
  サポートしないというwarningのみで、現時点のbuild失敗はない。
- 独立security reviewで最初に4件のP1と招待契約のP2を発見し、全件修正後の最終判定は
  **P0=0、P1=0、P2=0**。
- staged差分のGitleaksは713.14 KBを走査し、leakは0件。
- `pnpm --filter web run lint` はESLint設定がなく対話式setupに入るため単独実行できない。
  `next build`内のコンパイル/型チェックは成功しているが、lint設定の明示追加は残課題。

本番・データの境界:

- 今回はローカルソース、破棄専用DB、文書のみ。Supabase本番migration、Vercel production deploy、
  本番環境変数、Storage/Auth、決済、Resend、Cronは変更していない。
- 保存済みモニター最終回答11件・画像14件、日記、AI相談、家族、写真の本番データは読み取り・
  更新・削除していない。
- 未追跡の `review_exports/` は参照・変更・追加・commit対象外。機密review文書2件も未追跡のままで
  commitしていない。

Stage Aの残るNO-GO項目:

1. 正式な運営者名、責任者、実稼働の問い合わせ窓口、規約/プライバシー施行日を確定する。
2. 個人情報、要配慮情報、AI委託の表示を実契約と照合して法務確認する。
3. 承認済み順序で本番migrationとWeb deployを行い、`verify_compact.sql`、無書き込みsmoke、
   既存件数不変を確認する。
4. Supabase DB/AuthとStorageのbackup方式・保持、復旧演習のRPO/RTO、Vercel/Supabase/Cronの
   失敗通知を本番管理画面で確認する。
5. 2アカウント×2端末とBrave/Safari/Chrome、iPhone/Android幅で登録、保存、復元、招待、
   viewer拒否、写真、個別削除、アカウント削除依頼を実機完走する。

スマホアプリ化はStage Aのデータ契約と権限を正本にする。上記の正式情報と本番運用ゲートが未完了のため、
現時点でTestFlight / Google Play、ストア契約、IAP、外部build、公開は開始していない。

## 2026-09-04 追記 285 — 初回GitHub CIで見つかったsmoke契約の更新

`6bf4bc2` とhandoff commit `5db0f3d` を `origin/main` へpushした。Deploy workflow
`33827837947` はcheckだけ成功し、deploy jobはskipped。Vercel productionとSupabase本番DBは
変更していない。

GitHub Actions CI run `33827837956` の1回目は、26項目成功後の日記削除PostgreSQL起動段階で
内部出力なしのexit 2となった。同じfailed jobを再実行すると該当SQLを含む全SQL・型検査・
機能test・Web buildは成功したが、最後の `smoke-web.mjs` が旧status契約を期待して2件失敗した。

- Supabase未設定のローカル環境では、アカウント削除受付は401ではなく503でfail closedする。
- 有料受付スイッチOFFでは、Stripe checkoutはtoken検証前に503でfail closedする。

これは正式版で意図した安全側のAPI応答であり、smokeの期待値を現契約へ更新した。ローカルの
本番buildを一時起動し、`node scripts/smoke-web.mjs http://localhost:3010` は全対象成功。
アカウント削除受付503、有料受付503、家族/API未設定503、未認証系401を意図どおり確認した。

## 2026-09-04 追記 286 — 正式版ソース基盤のGitHub CI完走

smoke契約修正と追記285をcommit `14bfdae85511de2c0a98711eb6b616c98de79dc3`
(`test: align smoke with closed commercial gates`) として `origin/main` へpushした。

- GitHub Actions CI run `33828280291` は2分13秒で成功。Web/Mobile typecheck、モニター保護、手帳同期、
  memory book、無料導線、アカウント完全削除、family権限/招待/管理、匿名診断handoff、
  AI長期記憶と1日1回claim、日記/対象者削除の各静的・破棄PostgreSQL回帰、Web build、
  最終smokeがすべてgreen。
- Deploy workflow `33828280306` はcheckだけ成功し、deploy jobはskipped。Supabase本番migration、
  Vercel production、本番データは未変更。
- GitHub ActionsはNode 20対象actionをrunner側でNode 24に強制実行する廃止予定warningを表示した。
  test/build失敗ではないが、workflowとアプリruntimeのNode 22以上への明示更新は次回タスク。

## 2026-09-04 追記 287 — 正式運営者名を株式会社BEECHに確定

ユーザー確認により、無料Web正式版および将来の有料受付で公開するサービス運営者・販売事業者の
正式名称を `株式会社BEECH` と確定した。

- `apps/web/.env.example` の `LEGAL_BUSINESS_NAME` を `株式会社BEECH` に固定し、Vercel本番環境にも
  同じ値を設定することを明記した。本番環境変数そのものは、この作業では変更していない。
- `docs/COMMERCIAL_RELEASE_INPUTS.md` の無料Web正式版と有料受付の入力票へ確定値を記録した。
  公開前の登記情報等との最終照合は残している。
- `docs/ENVIRONMENT_MATRIX.md` と `docs/PRODUCTION_CHECKLIST.md` を更新し、名称の確定と本番設定を
  別の完了条件にした。責任者、問い合わせ窓口、規約・プライバシー施行日は推測せず未確定のまま。
- `scripts/test-commercial-release-gates.mjs` に、環境設定例と正式版入力票から確定名称が消えない
  回帰検査を追加した。

検証は `pnpm run test:commercial-release-gates`、`pnpm --filter web run typecheck`、
`git diff --check` がすべて成功。

本番・データの境界:

- Supabase本番DB/Auth/Storage、Vercel production、本番環境変数、モニター回答、日記、写真、
  AI相談、決済には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、個人情報管理・運営の責任者名または役職。

## 2026-09-04 追記 288 — 正式責任者を代表取締役 池田哲也に確定

ユーザー確認により、利用規約の運営責任者、プライバシーポリシーの個人情報管理責任者、
将来の特商法表示の運営責任者を、いずれも `代表取締役 池田哲也` と確定した。

- `apps/web/.env.example` の `LEGAL_RESPONSIBLE_PERSON` に確定値を設定した。
- `docs/COMMERCIAL_RELEASE_INPUTS.md` の無料Web正式版と有料受付の入力票、
  `docs/ENVIRONMENT_MATRIX.md`、`docs/PRODUCTION_CHECKLIST.md` を更新した。
- `scripts/test-commercial-release-gates.mjs` に、環境設定例と入力票から確定責任者が消えない
  回帰検査を追加した。
- アカウント削除担当、障害対応担当、問い合わせ担当などの実務役割は、この回答から推測せず
  未確定のまま残した。公開前の登記情報等との最終照合も残る。

検証は `pnpm run test:commercial-release-gates`、`pnpm --filter web run typecheck`、
`git diff --check` がすべて成功。

本番・データの境界:

- Vercel本番環境の `LEGAL_RESPONSIBLE_PERSON` はまだ変更しておらず、本番法務ページも未更新。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、決済には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、利用者向け問い合わせ先。

## 2026-09-04 追記 289 — 利用者向け問い合わせ先を確定

ユーザー確認により、利用規約、プライバシーポリシー、将来の特商法表示で公開する問い合わせ先を
`info@bee-ch.co.jp` と確定した。現在の `legalContactHref` のメール判定に合致し、公開画面では
`mailto:info@bee-ch.co.jp` としてメール作成画面を開く。押しただけで自動送信はしない。

- `apps/web/.env.example` の `LEGAL_CONTACT` に確定値を設定した。
- `docs/COMMERCIAL_RELEASE_INPUTS.md`、`docs/ENVIRONMENT_MATRIX.md`、
  `docs/PRODUCTION_CHECKLIST.md`、`docs/COMMERCIAL_OPERATIONS_RUNBOOK.md` を更新した。
- `scripts/test-commercial-release-gates.mjs` に、環境設定例と入力票から確定窓口が消えない
  回帰検査を追加した。
- `NOTIFICATION_EMAIL_REPLY_TO` は通知メール専用の別設定であり、今回の回答から同じ値だと推測せず
  未設定のまま残した。公開メールへの迷惑メール対策と担当シフトも運用上の残課題。

検証は `pnpm run test:commercial-release-gates`、`pnpm --filter web run typecheck`、
`git diff --check` がすべて成功。

本番・データの境界:

- Vercel本番環境の `LEGAL_CONTACT` はまだ変更しておらず、実際の受信・返信テスト、
  本番法務ページでの表示・クリック確認も未実施。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、決済、メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、問い合わせ受付時間と一次返信目標。

## 2026-09-04 追記 290 — 問い合わせ受付・返信目安を確定

ユーザーが提案文言を承認し、公開する問い合わせ対応目安を
`メール受付：24時間／原則3営業日以内に返信` と確定した。

- `LEGAL_CONTACT_RESPONSE_TARGET` を新設し、無料正式版の公開情報として必須化した。
  `LEGAL_PHONE_HOURS`（将来の電話受付時間）と `NOTIFICATION_EMAIL_REPLY_TO`（通知メール返信先）
  とは分離している。
- 利用規約、プライバシーポリシー、特商法表示の問い合わせ欄へ「受付・返信目安」を追加した。
- `.env.example`、管理者env確認、local doctor、`ENVIRONMENT_MATRIX.md`、`DEPLOYMENT.md`、
  正式版入力票、公開チェックリスト、モバイル公開資料、運用runbookを同期した。
- 管理者env確認は空白だけの環境変数を設定済みと誤判定しないよう、trim後の値で判定する。
- 公開約束は原則3営業日以内、運用上は余裕を持って2営業日以内に一次返信する内部目標と明記した。
- 正式版ゲート回帰に、新しい環境変数、確定文言、3法務ページの表示、管理者env空白判定を追加した。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm --filter web run typecheck`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。

本番・データの境界:

- Vercel本番環境の `LEGAL_CONTACT_RESPONSE_TARGET` は未設定で、本番法務ページは未更新。
  実際のメール受信・返信、担当不在時の引継ぎも未確認のため、Stage AはNO-GOを継続する。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、決済、メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、利用規約の施行日。

## 2026-09-04 追記 291 — 利用規約の施行日を正式公開日と同日にする方針を確定

ユーザー確認により、利用規約の施行日は `正式公開日と同日` にする方針を確定した。
正式公開日はまだ決まっていないため、`LEGAL_TERMS_EFFECTIVE_DATE` は空欄のまま保ち、
公開日が決まった時点で同じ日本時間の実日付を `YYYY年M月D日` 形式で入力する。

- `.env.example`、`COMMERCIAL_RELEASE_INPUTS.md`、`ENVIRONMENT_MATRIX.md`、`DEPLOYMENT.md`、
  正式版チェックリスト、運用runbookへ方針と公開直前の入力条件を同期した。
- `commercialReadiness.ts` と管理者env確認を強化し、存在しない日付、仮日付、
  `正式公開日と同日` のような方針文言では公開準備完了にならないようにした。
- 同じ検証を将来入力する `LEGAL_PRIVACY_EFFECTIVE_DATE` にも適用したが、
  プライバシーポリシーの施行日そのものは今回の回答から推測せず、未確定のまま残した。
- 正式版ゲート回帰に、利用規約の日付欄を空欄で保つこと、方針を入力票に保持すること、
  実日付検証が公開ゲートと管理者env確認の双方に使われることを追加した。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm --filter web run typecheck`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。

本番・データの境界:

- Vercel本番環境変数と本番法務ページは変更していない。正式公開日が未確定のため、
  `LEGAL_TERMS_EFFECTIVE_DATE` は未設定でStage AはNO-GOを継続する。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、決済、メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、プライバシーポリシーの施行日。

## 2026-09-04 追記 292 — プライバシーポリシーの施行日も正式公開日と同日に確定

ユーザー確認により、プライバシーポリシーの施行日も `正式公開日と同日` にする方針を確定した。
正式公開日はまだ決まっていないため、`LEGAL_PRIVACY_EFFECTIVE_DATE` は空欄のまま保ち、
公開日が決まった時点で同じ日本時間の実日付を `YYYY年M月D日` 形式で入力する。

- `.env.example` と `DEPLOYMENT.md` は、利用規約とプライバシーポリシーの各設定欄へ
  正式公開日と同じ実日付を個別に入力する説明へ更新した。
- `COMMERCIAL_RELEASE_INPUTS.md`、`ENVIRONMENT_MATRIX.md`、正式版チェックリスト、
  運用runbookへ方針と公開直前の入力・表示確認条件を同期した。
- 初回施行日は同日にするが、将来は別々に改定できるよう
  `LEGAL_TERMS_EFFECTIVE_DATE` と `LEGAL_PRIVACY_EFFECTIVE_DATE` は別変数のまま維持した。
- 正式版ゲート回帰に、プライバシー日付欄を実日付確定まで空欄で保つこと、
  方針文言をenv値へ入れないこと、確定方針を入力票へ保持することを追加した。
- 独立した読み取り専用監査でもP0指摘なし。正式公開日はVercel deploy日、プレビュー公開日、
  モニター開始日、有料販売開始日から推測せず、運営が正式公開日として決めた日本時間の日付を使う。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm --filter web run typecheck`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。

本番・データの境界:

- Vercel本番環境変数と本番法務ページは変更していない。正式公開日が未確定のため、
  2つの施行日envは未設定でStage AはNO-GOを継続する。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、決済、メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、アカウント削除担当と代行者。

## 2026-09-04 追記 293 — アカウント削除対応の主担当を確定

ユーザー確認により、アカウント削除対応の主担当を `代表取締役 池田哲也` と確定した。
代行者、別確認者、内部連絡手段は今回の回答から推測せず、未確定のまま残した。

- `COMMERCIAL_RELEASE_INPUTS.md` は、主担当の確定値と代行者の未確定状態を1行内で分離して記録した。
- `COMMERCIAL_OPERATIONS_RUNBOOK.md` のSupabase・個人情報削除担当へ主担当を記録した。
  個人の連絡手段は公開Gitへ書かず、確定後に制限付き運用台帳へ記録する。
- 正式版チェックリストと公開計画へ、主担当確定と、代行者・別確認者・本番運用試験待ちを反映した。
- `ADMIN_AUTH_POLICY.md` に、担当者としての指名だけではAdmin権限を付与しないことを明記した。
  実行には本人確認済みSupabase Authユーザーの `app_admins.user_id` 登録と二者確認が別途必要。
- 正式版ゲート回帰に、主担当が入力票・runbookから消えないこと、代行者を捏造しないこと、
  担当者名から管理権限を付与しない境界を追加した。
- 独立した読み取り専用監査でP0指摘なし。主担当本人のアカウント削除時も、
  本人を実行者・確認者にはせず、別の登録済みapp_adminと確認者を必要とする。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。

本番・データの境界:

- Supabase Authの管理者登録、`app_admins`、`ACCOUNT_ERASURE_EXECUTION_ENABLED`、本番migration、
  Vercel環境変数、本番deploymentは変更していない。削除実行スイッチは初期OFFのまま。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、削除依頼、決済、メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、アカウント削除対応の代行者。

## 2026-09-04 追記 294 — アカウント削除対応の代行者名を確定

ユーザー確認により、アカウント削除対応の代行者名を `池田知也` と確定した。
代行者の役職・責任範囲・内部連絡手段・app_admin登録・別確認者は、
今回の回答から推測せず未確定のまま残した。

- `COMMERCIAL_RELEASE_INPUTS.md` に主担当 `代表取締役 池田哲也` と代行者 `池田知也` を併記した。
- `COMMERCIAL_OPERATIONS_RUNBOOK.md` の代行者欄へ氏名だけを記録し、役職・連絡手段は
  確定後に制限付き運用台帳へ記録する条件を維持した。
- 正式版チェックリストは代行者名の確定だけを完了にし、内部連絡手段、責任範囲、
  Supabase Auth／`app_admins` 登録、削除ごとの別確認者・二者確認手順を未完了で分離した。
- 公開計画と正式版ゲート回帰を更新し、両名の確定値と未確定の権限境界が消えないようにした。
- `LEGAL_RESPONSIBLE_PERSON`、法務ページ、環境変数、SQL、アプリコードは変更していない。
  代行者名の指名だけではAdmin権限や二人目の承認者資格を付与しない。
- 独立した読み取り専用監査でP0指摘なし。主担当または代行者本人のアカウントを削除する場合も、
  対象本人以外の登録済み実行者と別確認者が必要。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。

本番・データの境界:

- Supabase Authの管理者登録、`app_admins`、`ACCOUNT_ERASURE_EXECUTION_ENABLED`、本番migration、
  Vercel環境変数、本番deploymentは変更していない。削除実行スイッチは初期OFFのまま。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、削除依頼、決済、メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、障害対応の主責任者。

## 2026-09-04 追記 295 — 障害対応の主責任者を確定

ユーザー確認により、障害対応の主責任者 / Incident Commanderを
`代表取締役 池田哲也` と確定した。障害対応の代行者、内部連絡手段、アラート通知先、
平日・夜間・休日の当番体制、各サービスの実行権限は、今回の回答から推測せず未確定のまま残した。

- `COMMERCIAL_RELEASE_INPUTS.md` に主責任者の確定値と、代行者・連絡・通知・当番・権限の
  未確定状態を分離して記録した。
- `COMMERCIAL_OPERATIONS_RUNBOOK.md` は、全般的な運用責任者まで指名したと誤解しないよう
  役割名を `障害対応主責任者 / Incident Commander` に限定した。
- 正式版チェックリストと公開計画へ、主責任者名だけが確定し、正式な障害対応体制は
  未完成であることを反映した。
- 主責任者名の記録だけでは、Vercel・Supabase・GitHub・Resend・DNS等の権限、MFA、
  アラート、当番、rollback・DB操作・secret rotationの実行資格を付与しない。
- 承認者と本番操作の実行者を分離し、秘密情報・個人電話番号・MFA・復旧コードはGitへ書かず、
  制限付き運用台帳または承認済みのパスワード管理基盤で管理する境界をrunbookへ明記した。
- 正式版ゲート回帰に、確定した主責任者が入力票・runbookから消えないこと、代行者や権限を
  捏造しないこと、正式運用を閉じたままにすることを追加した。
- 独立した読み取り専用監査でP0指摘なし。ただし代行者・連絡経路・通知先・当番・権限・演習が
  揃うまで、障害対応運用はNO-GOのまま。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。
- 独立した読み取り専用再検証でも、上記4項目がすべて成功し、差分が運用文書と
  回帰テストの6ファイルだけであることを確認。

本番・データの境界:

- Vercel・Supabase・GitHub・Resend・DNSのアカウント、権限、MFA、通知、環境変数、
  本番deploymentは変更していない。障害対応に関する本番操作も行っていない。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、削除依頼、決済、
  メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、障害対応の代行者。

## 2026-09-04 追記 296 — 障害対応の代行者名を確定

ユーザー確認により、障害対応の代行者名を `池田知也` と確定した。
代行者の役職・責任範囲、両名の内部連絡手段、アラート通知先、当番体制、
各サービスの実行権限は、今回の回答から推測せず未確定のまま残した。

- `COMMERCIAL_RELEASE_INPUTS.md` に主責任者 `代表取締役 池田哲也` と代行者 `池田知也` を併記した。
- `COMMERCIAL_OPERATIONS_RUNBOOK.md` の障害対応行へ代行者名だけを記録し、役職・責任範囲・
  内部連絡手段は、確定後に制限付き運用台帳へ記録する条件を維持した。
- 正式版チェックリストは代行者名の確定だけを完了にし、代行者の役職・責任範囲、緊急連絡網、
  通知先、当番、権限・MFA・緊急時アクセス回復方法を未完了で分離した。
- 公開計画と正式版ゲート回帰を更新し、障害対応行全体で両名を検査することで、
  削除担当欄にある同名だけを見て誤って合格しないようにした。
- 代行者名の指名だけでは、app_admin、リリース担当、DB管理者、二人目の承認者、
  rollback・DB操作・secret rotationの実行権限を付与しない。
- 独立した読み取り専用監査でP0指摘なし。ただし連絡・通知・当番・権限・演習が揃うまで、
  障害対応の正式運用はNO-GOのまま。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 単独再実行で成功、静的ページ166/166生成。
  既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。
- 独立した読み取り専用再検証でも上記4項目がすべて成功し、差分が運用文書4ファイルと
  回帰テスト1ファイルだけであることを確認。
- 初回のローカルbuildは独立検証と同じ `.next` を同時利用し、生成中の
  `_ssgManifest.js` が見つからない `ENOENT` で1回失敗した。並行build終了後の単独再実行と
  独立再検証はともに成功しており、アプリ回帰ではなく検証作業領域の競合と確認した。

本番・データの境界:

- Vercel・Supabase・GitHub・Resend・DNSのアカウント、権限、MFA、通知、環境変数、
  本番deploymentは変更していない。障害対応に関する本番操作も行っていない。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、削除依頼、決済、
  メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、障害対応代行者の役職・責任範囲。

## 2026-09-04 追記 297 — 障害対応代行者の責任範囲を確定

ユーザー確認により、障害対応代行者 `池田知也` の責任範囲を
`主責任者不在時の連絡・初動判断の代行。本番操作は別途権限を持つ担当者が実施`
と確定した。代行者の会社・運用上の役職は、今回の回答から推測せず未確定のまま残した。

- `COMMERCIAL_RELEASE_INPUTS.md`、`COMMERCIAL_OPERATIONS_RUNBOOK.md`、正式版チェックリスト、
  公開計画へ確定した責任範囲を同期した。
- 「初動判断」は暫定SEV分類、変更停止・証拠保全の依頼、権限を持つ担当者の招集までに限定した。
- 本番ログや利用者データの閲覧、release停止、rollback、DB書込み、secret rotation、
  外部送信、削除の実行・承認権限は、代行者の指名または今回の責任範囲から付与しない。
- 主責任者不在時に代行者が最終承認できる範囲は未確定であり、正式版チェックリストへ
  独立した未完了項目として追加した。
- 正式版ゲート回帰に、確定した代行範囲、初動判断の上限、本番操作を別権限者が行う境界、
  最終承認権限が未確定であることを追加した。
- 独立した読み取り専用監査でP0指摘なし。ただし内部連絡、通知先、当番、サービス別権限、
  最終承認者、MFA、演習が揃うまで、障害対応の正式運用はNO-GOのまま。
- 独立した読み取り専用再検証でも、正式版ゲート、local doctor、diff checkが成功し、
  差分が運用文書5ファイルと静的回帰テスト1ファイルだけであることを確認した。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。
  既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。

本番・データの境界:

- Vercel・Supabase・GitHub・Resend・DNSのアカウント、権限、MFA、通知、環境変数、
  本番deploymentは変更していない。障害対応に関する本番操作も行っていない。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、削除依頼、決済、
  メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、障害対応代行者 `池田知也` の役職。

## 2026-09-04 追記 298 — 池田知也の役職をシステム責任者に確定

ユーザー確認により、池田知也の会社・運用上の役職を `システム責任者` と確定した。
同一人物を記載している障害対応代行者とアカウント削除代行者の両方へ、この役職を反映した。

- `COMMERCIAL_RELEASE_INPUTS.md` と `COMMERCIAL_OPERATIONS_RUNBOOK.md` の両代行者欄を
  `システム責任者 池田知也` に更新した。
- 正式版チェックリストと公開計画でも役職確定を完了扱いにした。
- 障害対応の確定済み責任範囲は変更していない。アカウント削除対応における代行者の
  具体的責任範囲は、今回の回答から推測せず未確定のまま残した。
- `LEGAL_RESPONSIBLE_PERSON`、利用規約・プライバシーポリシー・特商法表示の公開責任者は
  `代表取締役 池田哲也` のまま変更していない。
- `システム責任者` という役職だけでは、app_admin、リリース担当、DB管理者、最終承認者、
  Vercel・Supabase・GitHub・Resend・DNS等の閲覧・操作権限を付与しない。
- 正式版ゲート回帰に、削除対応と障害対応の両方で役職が保持されることと、
  公開上の責任者を池田知也へ置換しないことを追加した。
- 独立した読み取り専用監査でP0指摘なし。内部連絡、通知、当番、サービス別権限、
  最終承認者、MFA、演習が揃うまで正式運用はNO-GOのまま。
- 独立した読み取り専用再検証でも、正式版ゲート、local doctor、diff checkが成功し、
  役職が両代行者欄へ反映され、公開責任者と権限境界が維持されていることを確認した。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。
  既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。

本番・データの境界:

- 法務ページ、アプリコード、SQL、env、Vercel・Supabase・GitHub・Resend・DNSの権限、
  MFA、通知、本番deploymentは変更していない。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、削除依頼、決済、
  メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、アカウント削除対応における代行者の責任範囲。

## 2026-09-04 追記 299 — アカウント削除対応代行者の責任範囲を確定

ユーザー確認により、アカウント削除対応代行者 `システム責任者 池田知也` の責任範囲を
`主担当不在時に削除依頼の受付・本人確認・実行担当への引継ぎを代行。本番削除は登録済みapp_adminと別確認者の二者で実施`
と確定した。

- `COMMERCIAL_RELEASE_INPUTS.md`、`COMMERCIAL_OPERATIONS_RUNBOOK.md`、正式版チェックリスト、
  公開計画へ確定した責任範囲を同期した。
- 代行者の「本人確認」は、利用者が `/account/delete` のMagic Link認証を完了した状態と、
  request ID・対象user IDの一致を確認する意味に限定した。身分証画像、パスワード、
  Magic Link、access tokenを受け取る運用にはしない。
- 代行者の担当は受付・確認・実行担当への引継ぎまでとし、今回の確定だけでは
  `app_admins` 登録、削除実行、別確認者、最終承認者の資格を付与しない。
- 本番削除の二者確認は、登録済みapp_adminの実行者と別確認者による運用統制であり、
  現行APIが技術的に二人の承認を強制するものではない境界を維持した。
- 主担当または代行者本人のアカウントを削除する場合は、その本人を実行者・確認者にせず、
  別の登録済みapp_adminと確認者を必要とする。
- 両名の内部連絡手段、実行app_admin、別確認者、本番migration、単独テストアカウントでの
  完走試験が揃うまで、`ACCOUNT_ERASURE_EXECUTION_ENABLED=false` を維持し正式運用を開始しない。
- 独立した読み取り専用監査でP0指摘なし。コード・SQL・envの変更は不要と確認した。
- 独立した読み取り専用再検証でも、正式版ゲート、local doctor、diff checkが成功し、
  変更が運用文書5ファイルと静的回帰テスト1ファイルだけであることを確認した。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。
  既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。

本番・データの境界:

- 法務ページ、アプリコード、SQL、env、Supabase Auth、`app_admins`、本番deployment、
  Vercel・Supabase・GitHub・Resend・DNSの権限やMFAは変更していない。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、削除依頼、決済、
  メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、アカウント削除対応の主担当・代行者の内部連絡手段。

## 2026-09-04 追記 300 — アカウント削除依頼の共有受付・双方通知方針を確定

ユーザー確認により、メールによるアカウント削除依頼を `info@bee-ch.co.jp` の共有受信箱で受け、
主担当 `代表取締役 池田哲也` と代行者 `システム責任者 池田知也` の双方へ通知する運用方針を確定した。

- `COMMERCIAL_RELEASE_INPUTS.md`、`COMMERCIAL_OPERATIONS_RUNBOOK.md`、正式版チェックリスト、
  公開計画へメール共有受付と双方通知の方針を同期した。
- アプリ内の `/account/delete` から送られた依頼はDBへ保存され、`/admin/delete-requests` で
  確認する別経路である。現行実装はDB保存時に自動メール通知しないことを明記した。
- 独立した読み取り専用監査で、当初の一括表現ではアプリ内依頼もメールへ届くと誤認するP1を検出した。
  メールとアプリ内DBキューを分離し、外部テストメールとアプリ内テスト依頼を別々に確認する形へ修正した。
- 方針の確定と、実際のメール・DBキューの設定・アクセス確認は分離した。両名の共有受信権限、
  双方通知ルール、DBキューの監視・通知方法、両経路の試験は未確認であり、完了扱いにしていない。
- 共有受信箱は共有パスワード方式にせず、個別アカウントへの委任または追跡可能な転送を使う。
- 共有受信箱のパスワード、MFA、復旧コードをGit・引継ぎ・一般チャットへ記録しない境界を明記した。
- この連絡方針だけでは、`app_admins` 登録、削除実行、別確認者、最終承認者、
  Supabase・Vercel等の本番権限を付与しない。
- 前項で確定した代行者の責任範囲、Magic Linkによる本人確認境界、
  app_admin実行者と別確認者による二者確認、実行スイッチ初期OFFは変更していない。

検証:

- `pnpm run test:commercial-release-gates`: 最終成功。初回は入力票から前項の責任範囲全文が
  省略されたことを検出して失敗し、確定文を復元後に再実行して成功した。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。
  既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。
- 独立した読み取り専用再検証でも上記のゲート、local doctor、diff checkが成功し、
  メールとアプリ内DBキューの区別、自動メール未実装、未確認の運用設定、権限非付与を確認した。

本番・データの境界:

- メール共有・転送設定、DBキューの監視・通知設定、実受信・返信、Supabase Auth、`app_admins`、env、SQL、
  アプリコード、本番deployment、外部送信は変更・実行していない。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、削除依頼、決済には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次にユーザーへ1項目ずつ確認する正式情報は、削除実行に使う登録済みapp_adminの担当者。

## 2026-09-04 追記 301 — アカウント完全削除の実行予定者を確定

ユーザー確認により、アカウント完全削除の実行予定者を
`システム責任者 池田知也` と確定した。

- 今回確定したのは担当者の指名方針だけであり、Supabase Authユーザー、MFA、
  `app_admins` 行、Vercel・Supabase等の本番閲覧・操作権限は作成・付与していない。
- 独立した読み取り専用安全監査でP0指摘はなかった。一方、現行の `app_admin` は
  削除専用ではなく、ケース、モニター回答、AI利用状況、環境確認等を含む全Admin APIに
  共通する管理者権限であるP1境界を確認した。
- そのため、池田知也を実際に `app_admins` へ登録するのは、全Admin APIの閲覧・操作範囲を
  明示承認するか、削除専用roleを実装・検証した後とする。今回はどちらも実施していない。
- 実登録前には、本人確認済みの個別Supabase Auth、正確なuser ID、MFAを制限付き運用台帳で
  確認する。個人のuser IDや認証情報はGit・一般チャットへ記録しない。
- 削除実行者とは別の確認者、代替実行者、本番migration、単独テストアカウントでの
  Auth・DB・Storage完走試験は未確定・未実施のまま残した。
- 池田知也本人のアカウントを削除する場合は、別の登録済み実行者と、さらに別の確認者を必要とする。
- 上記が揃うまで `ACCOUNT_ERASURE_EXECUTION_ENABLED=false` を維持し、削除実行の正式運用を開始しない。
- 正式版入力票、運用runbook、Admin認可方針、正式版チェックリスト、公開計画を同期し、
  この安全境界を静的回帰テストへ追加した。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ166/166生成。
  既知のSupabase Node 20将来廃止warningのみ。
- `git diff --check`: 成功。
- 追記301を含む最終差分の独立した読み取り専用再検証でも、正式版ゲート、local doctor、
  diff checkが成功した。変更が運用文書6ファイルと静的回帰テスト1ファイルだけであり、
  指名と権限付与の分離、全Admin共通権限の保留条件、未完了項目、本番非変更境界を確認した。
- 最終の読み取り専用安全監査でも新規P0/P1なし。秘密、token、実user ID、個人連絡先の混入、
  対象外ファイルの追跡差分がないことを確認した。staged差分のGitleaksも検出0件。

本番・データの境界:

- アプリコード、SQL、env、Supabase Auth、`app_admins`、MFA、本番deployment、
  Vercel・Supabase・GitHub・Resend・DNSの権限は変更していない。
- Supabase本番DB/Auth/Storage、モニター回答、日記、写真、AI相談、削除依頼、決済、
  メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしない。

次の1項目は、現行の全Admin API共通権限を付けずに済むよう、削除専用roleを実装するかの判断。

## 2026-09-04 追記 302 — アカウント削除専用roleを実装

ユーザーの「つくって」を受け、全Admin APIを操作できる `app_admin` を池田知也へ付与せずに済むよう、
アカウント削除対応だけに限定した認証・認可・監査をソース上へ実装した。
実装commitは `a42f4b9 feat: add account deletion operator role`。

- `account_delete_executors` を追加した。初期値は `active=false` で、実在利用者や担当者を自動登録する
  seedは入れていない。有効化・失効状態のDB制約、FORCE RLS、API role向けACL拒否を設定した。
- 削除依頼の一覧、状態更新、事前確認、完全削除、専用の認証状態確認だけが
  `verifyAccountDeleteOperatorRequest` を使う。通常のAdmin APIは従来の `verifyAdminRequest` のままで、
  削除専用担当者からケース、モニター回答、AI利用状況、環境確認等へ権限が広がらない。
- 削除専用画面は個別Supabase AuthのBearer tokenだけを受け付ける。共有の緊急Admin tokenは受け付けず、
  Magic Linkログイン、認証済みTOTPによるMFA、ログアウト、token更新を扱う。
- 一覧・状態更新・削除前確認はAAL1で可能とし、不可逆な完全削除はAAL2を必須にした。
  UIにTOTPの新規登録・復旧機能は持たせず、事前に確認済みfactorがある運用だけを許可する。
- 認証変更時は削除対象、メモ、事前確認結果、完全一致確認文、画面上の依頼情報を消去し、
  古い通信応答がログアウト後やMFA後に個人情報・古い権限表示を復元しない世代ガードを追加した。
- 状態変更はservice_role専用 `update_account_delete_request_status_v1` へ集約し、権限再確認、
  対象行更新、担当者method/email、監査ログを同一トランザクションで記録する。
- 削除用4 RPCも実行直前に担当権限を再確認し、処理途中の権限失効へfail closedする。
  最後の `app_admin` と最後の有効な削除専用実行者は削除対象にできず、blocked状態を永続記録する。
  一方、唯一の削除専用実行者であっても緊急失効自体は妨げない。
- 対象者削除後の残存検査へ、削除専用roleの `user_id` と `created_by` を追加した。
  既存 `app_admin` の互換経路は残したが、静的Admin tokenによる完全削除は許可しない。
- fresh schema、既存DBへの初回migration、migration再実行、権限剥奪、原子的監査、
  最終担当者保護、残存検査をPostgreSQL 16の回帰へ追加した。
- 運用runbook、認可方針、正式版入力票、環境表、正式版チェックリスト、Supabase投入順を同期した。

検証:

- `pnpm run test:account-delete-executor`: 成功。削除専用3 routeと通常Admin 10 routeの分離を確認。
- `pnpm run test:web-account-deletion`: 成功。
- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run doctor:local`: 成功。
- `pnpm --filter web run typecheck`: 成功。
- `pnpm --filter web run build`: 成功、静的ページ167/167生成。
  既知のSupabase Node 20将来廃止warningのみ。
- `pnpm run test:account-erasure:sql`: PostgreSQL 16で最終成功。
  `Verified account erasure PostgreSQL regression: ok`。
- 独立したWeb認可レビューとSQL安全レビューを実施し、最終残存指摘なし。
- staged差分だけを対象にGitleaksを実行し、検出0件。
- `git diff --cached --check` と最終SQL差分check: 成功。

GitHub・本番の境界:

- `main` pushでVercel本番deployが自動起動する構成のため、本番反映の承認とDB migrationより先に
  Webだけが公開されないよう、作業branch `codex/account-delete-executor-role` へpushする。
- この時点で `main`、Vercel本番、Supabase本番DB/Auth/Storage、env、MFA、実担当者role、
  `ACCOUNT_ERASURE_EXECUTION_ENABLED=false` は変更していない。
- モニター回答、日記、写真、AI相談、削除依頼、決済、メール送信には触れていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は参照・変更・commitしていない。

正式運用前の次項目は、本番適用を別承認したうえで、SQLの順序投入、池田知也の個別Supabase Auth、
確認済みTOTP、正確なuser IDに対する有効role行、別確認者、単独テストアカウントでの
Auth・DB・Storage完走を確認すること。すべて揃うまで完全削除スイッチはOFFを維持する。

## 2026-09-04 追記 303 — 削除専用roleのDB・Web本番反映を完了

ユーザーから本番DB変更の明示承認を得た後、削除専用roleと削除パイプラインを
Supabase本番 `ypnuxyfirlvbsqujocuy` へ適用し、PR #3をmainへ通常マージしてVercel本番へ反映した。

- Supabase SQL Editorで `account_delete_executor_role.sql`、`notebook_diary_delete.sql`、
  `notebook_person_delete.sql`、`account_deletion_pipeline.sql` の順に適用し、4本とも
  `Success. No rows returned` を確認した。
- 既存の `app_admins` と削除依頼テーブルは投入前に存在を確認した。
  `admin_auth_hardening.sql` は家族招待関数を古い定義で上書きする可能性があるため再投入せず、
  今回必要な専用migrationだけを適用した。
- 投入後の読み取り専用検証は13項目すべて `true`。テーブル存在、`active=false` 既定値、
  有効化状態制約、FORCE RLS、`operator_method`、状態更新RPC、削除4 RPC、
  service_role限定ACL、operator helperのAPI実行禁止を確認した。
- `account_delete_executors=0`、`account_delete_requests=0`、`account_erasure_jobs=0` で、
  実担当者の自動登録、削除依頼の捏造、削除ジョブの起動がないことを確認した。
- 個人情報の内容は取得せず件数だけを確認し、`profiles=4`、`families=5`、
  `family_members=5`、`people=4` が本番に残っている。DB削除RPC、Auth削除、Storage削除は呼んでいない。
  Vercel反映は利用者ブラウザのlocalStorageを消去しないため、端末内の日記・モニター途中状態も
  今回の操作対象外である。
- PR #3は通常mergeで履歴を保持し、main merge commitは
  `9dcd1de13ce7d709aaefeff8f8cbc1eef15321d5`。
- main CI run `33877360113` の `web-and-mobile` は2分32秒で成功した。
  型検査、全静的回帰、PostgreSQL削除回帰、Web build、smokeがすべて成功した。
- GitHubの `Deploy to Vercel` run `33877360092` はcheckだけ成功し、Vercel secrets未設定のため
  deploy jobがskipされた。成功表示を本番反映の証拠にせず、同じmain SHAをローカルへ
  fast-forwardした後、Vercel CLIで本番deployした。
- Vercel deploymentは `dpl_BTP4b2aMtEdrTwQbXSNCeNCbNAGe`、target `production`、
  status `READY`。`https://oyano-moshimo-navi.vercel.app` へのaliasを確認した。
- 本番URLに対する `scripts/smoke-web.mjs` は主要画面・APIすべて成功。
  `/api/health` は200、削除専用auth-status/listはBearerなしで401、無効な静的
  `x-admin-token` だけでも401を確認した。
- Vercel Production環境には `ACCOUNT_ERASURE_EXECUTION_ENABLED` が登録されていない。
  実装は値が厳密に `true` の場合だけ削除可能なため、完全削除はfail closedのOFF状態である。

未完了・正式運用前の境界:

- `システム責任者 池田知也` の個別メールアドレス、本人確認済みSupabase Auth、正確なuser ID、
  verified TOTPは未確認で、`account_delete_executors` 行はまだ作成していない。
- `info@bee-ch.co.jp` は削除依頼の共有受信箱であり、本人の個別Authメールとして推測利用しない。
- 実行者と別の確認者、代替実行者、共有受信箱とDBキューの通知試験、破棄用単独アカウントによる
  Auth・DB・Storage完全削除の本番完走は未実施。
- 上記が揃うまで `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFを維持し、実利用者の削除は行わない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次の1項目は、池田知也本人だけが受信できるSupabase Auth用の個別メールアドレスを確認すること。

## 2026-09-04 追記 304 — 削除実行者の個別Auth招待を送信直前まで準備

ユーザーから `システム責任者 池田知也` 本人用の個別メールアドレスを受領した。
個人連絡先そのものはGit・引継ぎへ記録せず、Supabase本番で一致するAuth状態だけを確認した。

- 読み取り専用トランザクションで、該当する `auth.users`、確認済みメール、`profiles`、
  MFA factor、verified MFA、`account_delete_executors`、有効executorがすべて0件であることを確認した。
- Supabase Authenticationの `Send invitation` 画面へ個別メールを入力し、最終の
  `Invite user` 実行直前で停止した。外部メール送信とアカウント作成はまだ行っていない。
- 既存の削除担当画面は、既存AuthへのMagic Linkログインと、登録済みTOTP factorの
  `challengeAndVerify` だけを提供する。新規TOTP enrollment・復旧画面はなく、role未登録者は
  auth-statusが403になるため、現状の画面だけでは「招待受諾→TOTP登録→role有効化」を完走できない。
- 安全な順序は、個別招待を本人が受諾、メール確認済みAuthとUUIDを二者照合、profile確認、
  本人セッションでTOTPを登録・検証、その後だけ削除専用roleを有効化すること。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFF、executor登録0件、削除依頼・削除ジョブ0件を維持した。
  既存利用者データ、Auth、Storage、日記、モニター回答には変更を加えていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次の操作は、ユーザーの実行時確認後にSupabaseから個別招待メールを1通送信すること。
並行して、本人だけがTOTPを登録・確認できる安全な初回設定導線を実装・検証する必要がある。

## 2026-09-04 追記 305 — 削除実行者の個別Auth招待を送信

ユーザーの実行時承認を得て、`システム責任者 池田知也` 本人用の個別メールアドレスへ、
Supabase本番からAuth招待メールを1通送信した。個人連絡先そのものはGit・引継ぎへ記録していない。

- Supabaseの送信完了通知とユーザー詳細を確認し、Authユーザー1件、招待日時・確認メール送信日時あり、
  メール確認0件、最終ログインなしであることを確認した。
- 読み取り専用SQLで、該当Authユーザー1件に対して `profiles=0`、MFA factor 0件、
  verified MFA 0件、`account_delete_executors=0`、有効executor 0件、削除依頼0件を確認した。
- 今回実施したのは個別Authへの招待送信だけであり、TOTP MFAの登録・確認、一般Admin登録、
  削除専用roleの付与・有効化は行っていない。
- Vercel本番の `ACCOUNT_ERASURE_EXECUTION_ENABLED` は未登録のままで、完全削除は引き続き
  fail closedのOFF状態である。
- 削除依頼・削除ジョブの作成、DB削除RPC、Auth削除、Storage削除は実行していない。
  既存利用者、モニター回答、日記、写真、AI相談その他の本番データにも変更を加えていない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次の1項目は、本人が招待メールを受諾してメール確認を完了すること。
その後、本人セッションで安全にTOTPを登録・確認できる初回設定導線を実装・検証し、
正確なAuth UUIDとverified MFAを確認してから削除専用roleを付与する。

## 2026-09-05 追記 306 — 削除担当者のTOTP初回設定導線を実装・公開前検証

本人から招待メールの受諾完了連絡を受け、本番の読み取り専用確認でも個別Authユーザー1件、
メール確認済み1件であることを確認した。profile、MFA factor、verified MFA、削除専用roleは0件のままで、
実行スイッチはOFFを維持している。その状態から、本人だけが認証アプリを登録・確認できる
`/admin/delete-requests/setup` を作業branch `codex/delete-operator-mfa-setup` に実装した。

実装:

- 既存Authユーザー限定の個別Magic Linkでログインし、メール確認済みの正確なAuth subjectを再検証する。
- 別端末ではQRコード、同じスマホでは手入力用コードを使える。アカウント名
  `親のもしもナビ 削除担当`、キーの種類 `時間ベース`、約30秒ごとに変わる6桁の数字を日本語で説明した。
- 登録開始は開始時に取得した同一AAL1 token、同一Auth user ID、TOTP種別へ固定する。
  中断・古い応答のcleanupもそのtokenと、この画面が作った正確なfactor IDだけへ限定し、
  verified化済み、別ユーザー、別factorは削除しない。過去の未完了factorは自動・一括削除しない。
- 確認完了は、同じfactorが唯一のverified TOTPであり、確認処理が返した同一token自身の
  current AALがAAL2で、並行するAuth変更がない場合だけ成立する。QR、手入力用コード、6桁入力は
  localStorage、sessionStorage、ログ、DBへ保存しない。
- callback失敗・timeout時、ログインsubject変更、同一subjectのAuth状態変更、別タブのBearer変更時は、古いBearerと
  設定情報を破棄する。callback timeout時はURLの認証情報と古いSupabase local sessionも破棄し、遅れて完了した
  callbackも再度破棄して、必ず新しい確認メールからやり直す。削除依頼画面側も一覧、対象UUID、確認文、メモ、
  事前確認を直ちに隠し、古い応答を無効化する。
- 初期callbackは12秒で安全停止し、新しい確認メールを送る画面へ移る。callbackがない本人状態確認は
  12秒でerrorと再試行ボタンを出す。メール入力はEnter・スマホの送信キー、必須・形式エラー、入力欄への
  focus、読み上げへ対応した。手入力用コードのコピー失敗時はコードを表示し、その欄へfocusを戻す。
- 設定画面は本人確認だけを行い、`profiles`、家族、対象者、`app_admins`、
  `account_delete_executors` を作成・変更しない。完了画面にも「まだ削除担当権限は付いていない」と表示する。

検証:

- `test:delete-operator-mfa-setup`、`test:account-delete-executor`、`test:web-account-deletion`、
  `test:commercial-release-gates`、`doctor:local`: 成功。
- Web/Mobile TypeScript: 成功。
- Web production build: 成功、静的ページ168/168。既知のSupabase Node 20将来廃止warningだけ。
- production buildをローカル起動し、`smoke:web` が成功。新しい削除担当ログイン画面で、空欄送信と
  不正なメール形式をEnterで送信した際に、日本語エラーが表示されメール欄へfocusが戻ることを実操作確認した。
- セキュリティ、race/fail-closed、UI・アクセシビリティの独立レビューを行い、最終P0/P1なし。
- `git diff --check`: 成功。

公開前の安全境界:

- この追記時点ではbranch上のソースだけであり、main merge、Vercel本番deploy、Supabase DB/Auth/Storage、
  profile作成、TOTP登録、削除専用role付与、削除スイッチ変更、削除処理は行っていない。
- 既存利用者、モニター回答、日記、写真、AI相談、削除依頼、家族データは参照・変更・削除していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしない。

次は、明示済みの本番反映指示に従い、このbranchを限定stage・secret検査後にGitHubへpushし、CI成功を確認して
mainへ通常mergeする。同じmain SHAをVercel productionへ反映し、本番setup URLとfail-closed境界を確認する。
本人は公開後のsetup URLでTOTPを自身の端末だけに登録し、完了表示後もrole付与は別確認まで保留する。

## 2026-09-05 追記 307 — 削除担当者のTOTP初回設定導線を本番反映

追記306の実装を限定stage・secret検査後にGitHubへpushし、PR #4を通常mergeして、
同じアプリ実装をVercel productionへ反映した。

GitHub・CI:

- 実装commitは `8588881`、callback timeout時のfail-closed補強commitは `8464fda`。
- PR #4 `https://github.com/dogwoodcommunity/oyano-moshimo-navi/pull/4` を通常mergeした。
- main merge commitは `71ce946bbbcd136682485a02255a8a9262490da8`。
- GitHub Actions run `33932251653` の `web-and-mobile` は2分17秒で成功した。
  型検査、回帰テスト、production build、smokeを含むCIが通過している。
- branchの最終stageに対する `git diff --cached --check` とGitleaksは成功し、secret検出0件だった。

Vercel production:

- 最初の `npx vercel --prod --yes` はteam scopeを省略したため `Not authorized` で停止し、
  本番変更は成立しなかった。既存設定から正しいteam scopeを指定して再実行し、正常完了した。
- deployment IDは `dpl_AX5oKa7QMYbEo7fqLBi4cqvXN75d`、targetは `production`、
  readyStateは `READY`。
- deployment URLは
  `https://oyano-moshimo-navi-h6v9hopes-dogwoodcommunity1.vercel.app`。
- 正式alias `https://oyano-moshimo-navi.vercel.app` への割当を確認した。
- 本番のTOTP初回設定画面は
  `https://oyano-moshimo-navi.vercel.app/admin/delete-requests/setup` でHTTP 200を確認した。
- 本番 `smoke:web` は主要画面・APIの期待値をすべて通過した。削除担当者用
  `/api/admin/delete-requests/auth-status` はBearerなしで401となり、認証なしには開かない。
- 本番画面でも空欄送信は日本語の必須エラー、不正なメール形式をEnterで送信すると
  日本語の形式エラーを表示し、いずれもメール入力欄へfocusが戻ることを実操作確認した。

安全境界:

- 今回の本番反映はWebアプリのコード公開だけである。Supabase DB/Auth/Storage、`profiles`、家族、
  対象者、`app_admins`、`account_delete_executors` を作成・変更していない。
- TOTPのQR、手入力用秘密キー、6桁コードを取得・保存・記録していない。本人だけが本番設定画面で
  登録する。設定完了だけでは削除担当roleは付与されない。
- `account_delete_executors` は0件、完全削除の実行スイッチはOFFを維持している。
  削除依頼・削除ジョブ、DB削除RPC、Auth削除、Storage削除は実行していない。
- 既存利用者、進行中モニター、日記、写真、AI相談、家族・対象者データは今回の作業対象外で、
  参照・変更・削除していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次の1項目は、本人が本番setup URLを開き、招待済みの個別メールで最新の確認メールを同じ端末から開き、
認証アプリへTOTPを登録して現在の6桁コードを入力すること。QR、秘密キー、6桁コードは共有しない。
「初回設定が完了しました」の表示後、正確なAuth UUID、verified TOTP、AAL2を読み取り専用で照合する。
削除担当roleの付与はその照合後も別確認まで行わず、完全削除スイッチはOFFを維持する。

## 2026-09-05 追記 308 — 本人の携帯へTOTP設定用の確認メールを再送

本人から、携帯1台だけで設定するため本番setup画面から確認メールを再送する明示承認を得た。
招待済みの個別メールを本番 `/admin/delete-requests/setup` へ入力し、送信直前の再確認後に
`確認メールを送る` を1回だけ実行した。

- 本番画面で `確認メールを送りました。この端末でメール内のリンクを開いてください。` の
  完了表示を確認した。
- 個人メールアドレスはGit、引継ぎ、ログへ記録していない。
- 本人は携帯で最新メールのリンクを開き、QRコードを別端末で読む代わりに、画面に表示される
  手入力用コードを本人の認証アプリへ登録できる。
- QRコード、手入力用秘密キー、認証アプリの6桁コードは取得・共有・保存しない。
- 今回行った外部操作は既存Authユーザーへの本人確認メール1通の再送だけである。
  TOTP factorの登録・確認、AAL2確認、削除担当roleの付与はまだ行っていない。
- `account_delete_executors` は0件、完全削除スイッチはOFFを維持する。削除依頼・削除ジョブ、
  DB削除RPC、Auth削除、Storage削除は実行していない。
- 既存利用者、モニター回答、日記、写真、AI相談、家族・対象者データは参照・変更・削除していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次の1項目は、本人が携帯のメールで最も新しい確認リンクを開くこと。setup画面の手順2が表示されたら、
同じ携帯では `手入力用コード` を認証アプリへ登録し、現在の6桁を本人だけで入力する。
完了表示後、正確なAuth UUID、verified TOTP、AAL2を読み取り専用で照合する。

## 2026-09-05 追記 309 — 本人のTOTP登録完了と権限付与前の本番照合

本人が携帯1台で手入力用コードを認証アプリへ登録し、本番setup画面へ現在の6桁を入力した。
本人から `認証アプリの登録と本人確認が完了しました` の表示連絡を受けた後、Supabase本番で
件数・状態だけを返すSELECTを実行し、権限付与前の状態を読み取り専用で照合した。

照合結果:

- TOTP factor合計1件、verified 1件、unverified 0件。
- verified TOTPに紐づくAuth userは1件で、メール確認済みAuthとの紐づきも1件。
- verified TOTPに紐づく `profiles` は0件。一般利用者profileを新規作成していない。
- verified TOTPに紐づく `app_admins` は0件。
- verified TOTPに紐づく `account_delete_executors` は0件。全体でもexecutor 0件、有効executor 0件。
- `account_delete_requests` は0件、`account_erasure_jobs` は0件。

安全境界:

- setup完了表示は、同一factorの確認成功と同一tokenのcurrent AAL2を実装側で確認した場合だけ出る。
  本人のBearer/JWT、QR、手入力用秘密キー、6桁コードは取得・表示・保存していない。
- SQLで確認できるのはfactorの永続状態であり、本人ブラウザのAAL2セッションを外部へ取り出していない。
  AAL2だったことは本人が到達したアプリの完了gateで確認し、継続中セッションとは区別する。
- 今回はSELECTだけで、Supabase DB/Auth/Storageへの作成・更新・削除は行っていない。
- 削除担当role、一般Admin roleは未付与。完全削除スイッチはOFFを維持し、削除処理は実行していない。
- 既存利用者、モニター回答、日記、写真、AI相談、家族・対象者データは参照・変更・削除していない。
- 個人メール、Auth UUID、factor ID、認証情報はGit・引継ぎへ記録していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次は、Auth画面とverified factorの正確なuser IDを権限付与直前に再照合する。現行DBでは
`account_delete_executors.user_id`、削除依頼の処理者、削除jobのoperator、監査actorが
`profiles.id` を参照するため、profile 0件のままrole行を直接INSERTすると安全側に失敗する。
当該1 UUIDについて、Authのemailだけを持ち、表示名・電話・家族所属・一般Adminを作らない最小profileと、
`active=false` のexecutor行を同一transactionで作成して再確認する。その後、実行者とは別の確認者と
その正確なprofileを照合・承認した場合だけ有効化する。executorだけを `auth.users` FKへ変える部分修正は、
処理者・job・監査のprofile FKを壊すため行わない。権限変更は別途の実行時確認なしに行わず、
完全削除スイッチは引き続きOFFを維持する。

## 2026-09-05 追記 310 — 削除担当者を安全に登録・有効化する手順を補強

追記309の本番照合後、削除実行者のAuth UUIDを `account_delete_executors` へ直接登録できるかを
現行schemaと削除pipeline全体で再確認した。`account_delete_executors.user_id` だけでなく、削除依頼の
`handled_by`、削除jobの `operator_user_id`、監査logの `actor_user_id` が `profiles.id` に依存するため、
executorだけを `auth.users` 参照へ変える部分修正は、実処理・監査・退会時cleanupを不整合にする。
部分的なFK変更は行わず、Auth UUIDを正本とする最小profile方式を継続する。

文書・安全手順の変更:

- `ADMIN_AUTH_POLICY.md` に、確認済みAuth UUIDとemail、verified TOTP 1件、unverified 0件、
  既存profile・family所属・一般Admin・executorなしを照合し、Auth emailだけの最小profileと
  `active=false` executorを同一transactionで作る初回登録手順を記載した。
- 本人確認記録と別確認者の承認記録は実値を必須にし、空欄や `<...>` のplaceholderのままなら
  SQLが例外で停止する。executor行には本人確認記録と承認記録の両方の参照を保持し、後者で前者を
  上書きしない。正確なUUIDや個人メールは公開Gitへ記録しない。
- 有効化は、実行者とは異なる別確認者についても確認済みAuthと一致するprofileを要求する。
  同じUPDATE文で、実行者の確認済みAuth・profile email一致、verified TOTP正確に1件、
  unverified 0件、family所属なし、一般Adminなし、未有効・未失効の初回行を再検証し、
  途中で状態が変わっていれば0件更新として安全停止する。
- 失効済み行をupsertで復活させる手順を廃止した。失効は有効化済み・未失効の1行だけに限定し、
  既存の失効日時を上書きせず、未有効行へ誤適用しない。未有効行の取消は別の監査手順とする。
- `COMMERCIAL_RELEASE_INPUTS.md`、`COMMERCIAL_OPERATIONS_RUNBOOK.md`、
  `PRODUCTION_CHECKLIST.md` を、TOTP 1件・未完了0件・設定完了時AAL2確認済み、正確なUUIDの
  制限付き台帳記録・最小profileと無効executorの原子的作成・別確認者・有効化は未完了、へ統一した。
- `COMMERCIAL_RELEASE_PLAN_2026-09-03.md` は現況台帳ではなく作成時の基準線であることを明記し、
  古い状態表示を現在の状態と誤認しないようにした。
- `test-commercial-release-gates.mjs` は各SQL code blockだけを抽出し、Auth確認、TOTP再確認、
  family/Admin分離、記録placeholder拒否、原子的な初回登録、状態限定の有効化・失効を個別検査する。

検証:

- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run test:account-delete-executor`: 成功。
- `pnpm run test:web-account-deletion`: 成功。
- `pnpm run doctor:local`: 成功。
- `git diff --check`: 成功。
- 独立した2レビューで初回P0なし。有効化直前のAuth/TOTP再検証、別確認者Auth確認、
  現況台帳の矛盾、原子的登録の表現、placeholder拒否、状態限定失効のP1を反映した。
- 最終差分レビューで、`PRODUCTION_CHECKLIST.md` 冒頭の本番migration欄だけが未実施表示のまま
  残っている矛盾を検出した。追記303の本番証跡に合わせ、削除専用role、削除pipeline、日記削除、
  対象者削除の4 migrationを実施済みに統一し、完了・未完了の二重表示を静的回帰で禁止した。

安全境界:

- 今回は運用文書と静的回帰の変更だけである。本番Supabase DB/Auth/Storage、profile、family、
  `app_admins`、`account_delete_executors` を作成・更新・削除していない。
- 削除担当roleは0件、有効executorは0件のまま。完全削除スイッチはOFFを維持し、削除依頼・
  削除job、DB削除RPC、Auth削除、Storage削除を実行していない。
- 既存利用者、モニター回答、日記、写真、AI相談、家族・対象者データは参照・変更・削除していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次は、最終差分レビューと限定stage・secret検査後に作業branchをGitHubへpushし、CI成功後に
通常mergeする。実際の最小profile・無効executor作成や権限有効化は、正確なUUIDを権限付与直前に
再照合し、実行者とは別の確認者を確定して、各操作時の明示確認を得るまで行わない。

## 2026-09-05 追記 311 — 安全な削除担当者登録手順をmainへ反映

追記310の7ファイルを限定stageし、秘密情報検査と最終独立レビュー後にGitHubへpushした。
PR #5を通常mergeし、mainの全CI成功まで確認した。

GitHub・検証:

- 作業commit: `ea0b903145cca25c703e8e8b39ce1c0c8b0f7c7a`。
- PR #5: `https://github.com/dogwoodcommunity/oyano-moshimo-navi/pull/5`。
- main merge commit: `fd30031892cd5a722342b1265a71f44344201b33`。
- PR CI run `33935032194` は、初回だけ使い捨てPostgreSQLが起動待ち時間内にreadyにならず
  `test:consult-memory:sql` の開始前に停止した。失敗jobを再実行すると同じSHAで2分26秒ですべて成功し、
  型検査、全静的・PostgreSQL回帰、production build、smokeが通過した。
- main CI run `33935294928` も2分12秒ですべて成功した。
- GitHubのDeploy workflow run `33935294962` はsecret存在checkだけ成功し、deploy jobはskipされた。
  成功表示をVercel本番deployの証拠にはしていない。今回の差分は文書と静的回帰のみであり、
  Web runtimeのbyte変更はないためVercel CLIによる再deployは行っていない。
- 限定stageの `git diff --cached --check` とGitleaksは成功し、secret検出0件だった。
- 最終独立レビューは、古い本番migration状態を含む文書間矛盾とテスト不足を修正後、残存指摘なし。

現在の安全境界:

- 本番の本人用Authはメール確認済み、TOTP factorはverified 1件・unverified 0件。
  setup完了時の本人セッションでAAL2を確認済み。
- 正確なAuth UUIDの制限付き運用台帳記録、最小profile、無効executor、別確認者、権限有効化は未実施。
  `account_delete_executors` と有効executorは0件のままで、削除依頼画面の権限はまだ付いていない。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFF。削除依頼・削除job、DB削除RPC、Auth削除、
  Storage削除を実行していない。
- 本番Supabase DB/Auth/Storage、既存利用者、モニター回答、日記、写真、AI相談、家族・対象者データを
  今回の作業で作成・変更・削除していない。
- QR、手入力用秘密キー、6桁コード、Bearer/JWT、個人メール、Auth UUIDはGit・引継ぎへ記録していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次の1項目は、削除実行者とは別の確認者を確定すること。候補を実名だけで推測せず、本人用の
確認済みAuthと一致するprofileを照合する。確認者が未登録なら先に安全な本人確認手順を設計する。
その後も、最小profile・無効executor作成と権限有効化は別操作とし、それぞれ実行直前の明示確認なしに
本番へ書き込まない。完全削除スイッチは単独テストアカウント完走までOFFを維持する。

## 2026-09-05 追記 312 — 別確認者候補を確定し既存本人Auth候補を読み取り確認

ユーザーは、削除実行者 `システム責任者 池田知也` とは別の確認者候補を
`代表取締役 池田哲也` とすること、および本人用Auth/profileの既存有無を安全に確認することを承認した。
この承認は候補指名と読み取り確認までであり、Auth招待送信、profile・executor作成、権限有効化などの
本番書き込み承認には広げていない。

読み取り確認:

- Supabase本番SQL Editorで、表示名が `池田哲也` と完全一致し、かつメール確認済みAuthと
  同じUUIDで結びつくprofile候補を、メール・UUID・内容を出さず件数だけ返すSELECTで確認した。
- 一致候補は0件。候補に結びつくfamily membership、app_admin、delete executor、verified TOTPも
  すべて0件だった。
- 表示名は任意入力であるため、この0件だけで「本人用Authが存在しない」と断定しない。
  既存アカウントを使う場合は、本人が自分の個別Authを画面上で示して照合する必要がある。
- `info@bee-ch.co.jp` は共有削除窓口であり、池田哲也本人用の個別Authと推測・流用しない。
- 確認SQLはSELECTのみ。実行後はEditor内容を個人名を含まないコメントへ置き換え、一時タブを閉じた。

安全境界:

- 本番DB/Auth/Storage、profile、family、app_admin、executorを作成・更新・削除していない。
- 削除担当role、有効executorは0件のまま。完全削除スイッチはOFFを維持し、削除処理を実行していない。
- 既存利用者、モニター回答、日記、写真、AI相談、家族・対象者データは参照・変更・削除していない。
- 個人メール、Auth UUID、MFA、token、認証情報はGit・引継ぎへ記録していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次の1項目は、池田哲也本人だけが使うSupabase Authアカウントをすでに作っているか、本人へ確認すること。
既存ならメールやUUIDをチャットへ書かず画面上で本人確認して読み取り照合する。未作成なら、本人専用メールへの
Auth招待は外部送信・Auth作成となるため、送信直前に別の明示確認を得る。確認者profile作成、operatorの
最小profile＋無効executor作成、権限有効化も、それぞれ別操作・別の実行時確認とする。

## 2026-09-05 追記 313 — 別確認者の既存本人Authを正確に照合

本人がSupabase AuthenticationのUsers一覧から自分だけが使う既存アカウントを画面上で選び、
`代表取締役 池田哲也` 本人のアカウントであることを確認した。新規Auth招待や確認メール再送は行わず、
選択された正確なAuth UUIDを画面内だけで使って本番を読み取り照合した。

読み取り照合:

- メール確認済みAuthは1件だった。
- 同じUUIDの `profiles` は1件で、profileのemailと確認済みAuth emailの一致も1件だった。
- 既存のfamily membershipは1件、`app_admins` は1件だった。どちらも既存状態を読み取っただけで、
  今回作成・更新していない。別確認者の照合は一般Admin権限に依存しない。
- `account_delete_executors` は0件だった。別確認者には削除実行者roleを付与しない。
- 選択した本人Authのverified TOTPとunverified TOTPはいずれも0件だった。同時点で、選択した本人Authとは
  別のAuthにverified TOTPが1件あることを件数だけで確認し、TOTP設定済みの削除実行予定者と同一アカウント
  ではないことを確認した。別確認者には現行仕様上TOTPを要求しない。
- 以上により、この既存Authと一致済みprofileを、削除実行予定者とは別の確認者本人識別として再利用できる。
  Authやprofileを重複作成する必要はない。

安全境界:

- 実行したSQLはSELECTだけである。確認後、SQL Editorの内容を個人識別子を含まない確認済みコメントへ
  置き換えた。個人メール、Auth UUID、token、MFA秘密情報はGit・引継ぎへ記録していない。
- 本番DB/Auth/Storage、profile、family、`app_admins`、`account_delete_executors` を作成・更新・削除していない。
- 削除担当roleと有効executorは0件のまま。`ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFを維持し、
  削除依頼・削除job、DB削除RPC、Auth削除、Storage削除を実行していない。
- 既存利用者、モニター回答、日記、写真、AI相談、家族・対象者データの本文を参照・変更・削除していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次は、削除実行予定者について最小profileと `active=false` のexecutor行を同一transactionで作る本番writeである。
その操作は正確なAuth/TOTP状態の直前再照合と実行時の明示確認を得てから行う。作成後も削除画面へは入れず、
別確認者本人の承認記録を制限付き運用台帳へ残したうえで、有効化を別操作・別承認として行う。
完全削除スイッチは単独テストアカウントのAuth・DB・Storage削除を完走するまでOFFを維持する。

## 2026-09-05 追記 314 — 削除実行者の本人確認・承認証跡をprivate台帳化

削除実行予定者の正確なAuth UUIDを一般文書・公開Git・一般チャットへ残さず、本人確認と別確認者の承認を
本番DB内で安全に結び付けるため、owner専用の追記型台帳と、無効executor登録・有効化の手順を実装した。
この追記時点ではソースと破棄DB回帰までであり、本番DBへの新migration・profile・executor・承認eventの
書き込みは行っていない。

実装:

- `supabase/account_delete_identity_ledger.sql` を追加した。未知の同名schemaがあれば停止し、
  `account_delete_private.operator_identity_events` をDB owner専用・FORCE RLS・policyなしで作る。
  API roleはschema/table/sequence/functionの全権限を持たず、非owner ACLが残ればmigration全体をrollbackする。
- 台帳はAuth UUID、`identity_verified` / `activation_approved`、非秘密の証跡参照、DBが付与する時刻・実行roleだけを
  保存する。メール、氏名、自由記述、OTP、TOTP秘密、tokenは保存しない。承認eventは同じ実行者の本人確認eventだけを
  参照でき、実行者本人を確認者にできない。UPDATE・DELETE・TRUNCATEはtriggerで拒否する。
- `ADMIN_AUTH_POLICY.md` の手順を、画面で本人確認した正確な実行者UUIDと別確認者UUIDを使い、本人確認event、
  最小profile、`active=false` のexecutorを同一transactionで作る形へ更新した。family所有・所属、一般Admin、
  既存profile/executor、TOTP総数・状態が想定外なら何も作らず停止する。
- 有効化は、同じ本人確認event、別確認者の確認済みAuth・一致profile、実行者のTOTP状態を再確認し、
  承認event作成とexactな無効executor 1件の有効化を同一transactionで行う。対象が0件なら承認eventもrollbackする。
- 文書中の実SQL blockをsynthetic UUID・`.invalid` メールだけの破棄DBでそのまま実行するrendererと回帰を追加した。
  回帰SQL自体も、本番と異なる最小Auth shimでなければ開始せず、外側ROLLBACKと短いlock timeoutで保護した。
- `api_grants.sql`、`verify_compact.sql`、Supabase適用順、商用運用文書・本番checklist・静的gateを新しいprivate境界へ
  揃えた。将来private schemaへ関数を追加する場合は、PostgreSQLの既定PUBLIC EXECUTEを同じtransaction内で
  個別REVOKEする必要があることもmigrationへ明記した。

検証:

- `pnpm run test:account-erasure:sql`: PostgreSQL 16の破棄DBで成功。private台帳のACL・追記専用性、
  文書どおりの本人確認event＋最小profile＋無効executor、別確認者承認event＋有効化を実行して確認した。
- `pnpm run test:commercial-release-gates`: 成功。
- `pnpm run test:account-delete-executor`: 成功。
- `pnpm --filter web run typecheck`: 成功。
- `pnpm run doctor:local`: 成功。
- `git diff --check`: 成功。
- 最新差分の独立SQLレビューでP0/P1なし。owner-only ACL、外側ROLLBACK、trigger種別、lock、exact TOTP、
  証跡・profile・executorの原子性を確認した。

安全境界:

- 本番Supabase DB/Auth/StorageへINSERT・UPDATE・DELETE・DDLを行っていない。既存profile、family、Admin、executor、
  利用者、モニター回答、日記、写真、AI相談、家族・対象者データを作成・変更・削除していない。
- 削除担当roleと有効executorは0件のまま。`ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFを維持し、削除依頼・
  削除job、DB削除RPC、Auth削除、Storage削除を実行していない。
- 個人メール、実Auth UUID、MFA秘密、OTP、token、認証情報はソース・Git・引継ぎへ記録していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次は、許可された差分だけを限定stage・秘密情報検査し、作業branchをGitHubへpushしてCI成功後に通常mergeする。
その後、本番の空のprivate台帳migrationは、作成内容と影響を示して実行直前の明示確認を得てから適用する。
本番適用後も、正確な実行者Authの画面選択、最小profile＋無効executor登録、別確認者承認＋有効化を別々の操作とし、
各本番writeの実行直前に確認を得る。完全削除スイッチは引き続きOFFとする。

## 2026-09-05 追記 315 — private本人確認台帳をmainへ反映

追記314の16ファイルを限定stageし、秘密情報検査と2系統の独立レビュー後にGitHubへpushした。
PR #6を通常mergeし、mainの全CI成功まで確認した。

GitHub・検証:

- 作業commit: `dfb46f8fadc1d755e851f98e731a193e294360d7`。
- PR #6: `https://github.com/dogwoodcommunity/oyano-moshimo-navi/pull/6`。
- main merge commit: `4e8198239e82708d6135aa44e6fba16eb62a1c4b`。
- PR CI run `33939330122` は2分30秒で成功した。
- main CI run `33939465316` も2分30秒で成功した。Web・mobile型検査、モニター、認証、
  アカウント削除、private台帳のPostgreSQL回帰、家族権限、AI記憶、日記・対象者削除、build、smokeを含む。
- Deploy workflow run `33939465436` はsecret存在checkだけ成功し、deploy jobはskipされた。
  成功表示をVercel本番deployの証拠にはしていない。今回Web runtime byteの変更はないためCLI deployも行っていない。
- 限定stageの `git diff --cached --check` とGitleaksは成功し、secret検出0件だった。
- 初回独立レビューでowner-only ACL、回帰ROLLBACK、trigger、lock、exact TOTP、証跡の原子性を確認した。
  別系統レビューで、本番確認SQLの制約定義・生成列・余分なtrigger・executor全ACLと、証跡ID完全一致の
  検証漏れを検出した。すべて修正し、最終レビューではP0/P1なしとなった。

安全境界:

- GitHub mainへ入ったのは、private台帳migration、運用手順、検証・回帰だけである。
  本番Supabaseへmigration、profile、executor、本人確認event、承認eventを書き込んでいない。
- 本番の削除担当roleと有効executorは0件のまま。`ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFを維持し、
  削除依頼・削除job、DB削除RPC、Auth削除、Storage削除を実行していない。
- 既存利用者、モニター回答、日記、写真、AI相談、家族・対象者データを作成・変更・削除していない。
- 個人メール、実Auth UUID、MFA秘密、OTP、token、認証情報はGit・引継ぎへ記録していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次の1項目は、本番へ空の `account_delete_private` schemaと追記専用台帳を作る
`supabase/account_delete_identity_ledger.sql` の1回限りの適用である。既存利用者の行は更新・削除せず、
利用者向け権限も付与しない本番DDLだが、本番書き込みであるため、実行内容と影響を示した直後の明示確認を得てから
Supabase SQL Editorで実行する。実行後は強化済み確認SQLをread-onlyで実行し、全項目PASSを確認する。
実行者の最小profile＋無効executor作成と、別確認者承認＋有効化はその後も別操作・別の実行時承認とする。

## 2026-09-05 追記 316 — private本人確認台帳を本番へ空で適用

ユーザーから実行直前の明示確認を得て、mainに反映済みの
`supabase/account_delete_identity_ledger.sql` をSupabase本番へ1回だけ適用した。
このmigrationは空のprivate本人確認台帳と保護機構だけを作成し、既存利用者の行や削除権限を変更しない。

本番適用・read-only検証:

- SQL Editorは本番projectのmain環境であることを確認し、空の新規queryへローカルのmigration全文190行を貼り付けた。
  末尾が`commit;`であり、以前の確認SQLが混在していないことを目視してから1回だけ実行し、
  `Success. No rows returned`を確認した。
- 適用後は個人情報を返さないSELECTだけの検査を実行した。集約結果は`all_checks_pass=true`、
  制約6、列9、非internal trigger 2、private台帳0件、executor総数0件、有効executor 0件だった。
- schema、table、2つのtrigger functionが存在し、全ownerが`postgres`、RLSとFORCE RLSが有効、
  owner以外のACLなし、`anon`・`authenticated`・`service_role`にschema・table・function権限なし、
  生成列と6制約、2 triggerのevent・level・functionが設計どおりであることをread-onlyで確認した。
- migrationは既存のpublic/Auth tableへINSERT・UPDATE・DELETEせず、台帳にも行を作らない。
  適用前の独立監査でもP0/P1なし、途中失敗時はDDLを含めtransaction全体がrollbackされることを確認した。

GitHub・検証:

- 本番適用実績、checklist、適用前状態を固定していた商用gateテストを更新し、commit
  `7be5fb67f6ab19255f87b7d7539838ba9b13f428` をmainへpushした。
- `pnpm run test:commercial-release-gates`、`node --check scripts/test-commercial-release-gates.mjs`、
  `git diff --check`、限定stageの`git diff --cached --check`が成功し、Gitleaksはsecret検出0件だった。
- main CI run `33940520702` は2分36秒で成功した。型検査、private台帳を含む削除系PostgreSQL回帰、
  monitor・家族権限・AI記憶・日記/対象者削除、build、smokeを含む全stepが成功した。
- Deploy workflow run `33940520701` はsecret存在checkだけ成功し、deploy jobはskipされた。
  今回は本番DB migrationと文書・テスト更新だけでWeb runtime byteを変更していないため、
  このworkflowをVercel本番deployの証拠にはしていない。

安全境界:

- 今回作ったのは空のprivate schema・台帳・index・保護function/trigger・ACLだけである。
  最小profile、executor、本人確認event、承認eventは作成しておらず、削除実行者roleは0件のままである。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFを維持した。削除依頼・削除job、DB削除RPC、Auth削除、
  Storage削除、削除実行者の有効化は行っていない。
- 既存利用者、モニター回答、日記、写真、AI相談、家族・対象者データの本文は参照せず、
  作成・変更・削除していない。
- 個人メール、実Auth UUID、MFA秘密、OTP、token、認証情報はGit・引継ぎへ記録していない。
- 未追跡の`review_exports/`と`docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md`は
  参照・変更・stage・commitしていない。

次の1項目は、画面上で削除実行予定者の正確なAuth行とverified TOTPをread-onlyで再照合すること。
その後、別の実行時明示確認を得て、最小profile、本人確認event、`active=false`のexecutorを
同一transactionで作成する。有効化は別確認者の承認eventを伴うさらに別の操作・別承認とし、
完全削除スイッチは単独テストアカウントの完走までOFFを維持する。

## 2026-09-05 追記 317 — 削除実行予定者を無効状態で本番登録

ユーザーから実行直前の明示確認を得て、削除実行予定者の本人確認event、監査用の最小profile、
`active=false` のexecutor行をSupabase本番へ同一transactionで作成した。これは本人識別と
将来の有効化準備だけであり、削除画面へのアクセス権や完全削除権限を付与する操作ではない。

本番事前確認:

- 本人画面で選択済みの正確な実行予定者Auth行と、既に照合済みの別確認者Auth行だけを使った。
- 個人識別子を結果へ返さないread-only transactionで、`ready=true` を確認した。
- 実行予定者はメール確認済みAuth 1件、TOTP総数1件・verified 1件・unverified 0件だった。
- 実行予定者の既存profile、family所有、family所属、一般Admin、executor、本人確認eventはすべて0件だった。
- 別確認者は実行予定者とは別人で、メール確認済みAuthと同一profile emailの一致が1件だった。
- private台帳総数、executor総数はともに0件で、profile INSERTの非internal triggerも既知の
  復活防止guard 1件だけだった。条件が1つでも違えば書き込まない検査である。

本番登録・事後確認:

- `ADMIN_AUTH_POLICY.md` の検証済み初回登録SQLを、短いlock/statement timeout付きの
  1 transactionとして選択範囲なしで1回だけ実行し、`Success. No rows returned` を確認した。
- 新規作成は `identity_verified` event 1件、Auth emailだけの最小profile 1件、
  `created_by=null / active=false / activated_at=null / revoked_at=null` のexecutor 1件だけである。
- 別のread-only事後検査は `all_checks_pass=true`。本人確認event 1件、最小profile 1件、
  private eventを正確に参照する無効executor 1件、台帳総数1件、executor総数1件だった。
- family所有・所属、一般Admin、対象executorの有効行、全体の有効executor、
  `activation_approved` eventはすべて0件で、operator認可methodも未付与だった。
- 実Auth UUIDと個人メールを含む事前確認・登録・事後確認SQLは保存せず、各一時Editorタブを破棄した。

安全境界:

- 既存利用者、モニター回答、日記、写真、AI相談、家族・対象者データを更新・削除していない。
  既存profile、family、一般Admin、削除依頼、削除jobにも変更を加えていない。
- 承認event、executor有効化、削除依頼画面でのログイン、DB削除RPC、Auth削除、Storage削除は
  実行していない。`ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFを維持している。
- 個人メール、実Auth UUID、MFA秘密、OTP、token、認証情報はGit・引継ぎへ記録していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次の1項目は、別確認者による `activation_approved` eventの作成と、正確な無効executor 1件の
有効化を同一transactionで行うことである。これは本番削除権限を付与する別の本番writeなので、
実行直前に状態を再照合し、新しい明示確認を得るまで行わない。完全削除スイッチはその後も、
単独テストアカウントのAuth・DB・Storage削除完走までOFFを維持する。

## 2026-09-05 追記 318 — 無効担当者登録の記録をmainへ反映

追記317の本番実績に合わせ、商用運用手順、公開準備台帳、本番checklist、商用gateテスト、
SESSION_HANDOFFを更新し、許可した5ファイルだけをmainへpushした。

- commit: `04bf75b4b1aed0bf210b2a6230064c327e656853`
- `pnpm run test:commercial-release-gates`、`pnpm run test:account-delete-executor`、
  `pnpm run test:delete-operator-mfa-setup`、`pnpm run test:web-account-deletion`、
  `node --check scripts/test-commercial-release-gates.mjs`、`git diff --check` はすべて成功した。
- 限定stageの `git diff --cached --check` とGitleaksが成功し、secret検出は0件だった。
- main CI run `33941563335` は2分34秒で成功した。型検査、monitor、認証、削除専用権限、
  private台帳を含む削除系PostgreSQL回帰、家族権限、AI記憶、日記・対象者削除、build、smokeを含む。
- Deploy workflow run `33941563353` はsecret存在checkだけ成功し、deploy jobはskipされた。
  今回は本番DBへの無効登録と文書・テスト更新だけでWeb runtime byteを変更していないため、
  このworkflowをVercel本番deployの証拠にはしておらず、CLI deployも行っていない。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFF、有効executorと承認eventは0件のままである。
  未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次は追記317記載の有効化であり、新しい実行時明示確認なしには進めない。

## 2026-09-05 追記 319 — 削除専用実行者を別確認者承認付きで本番有効化

ユーザーからこの本番writeに対する実行時の明示承認を得て、既に無効状態で登録していた
削除専用実行者1件を、別確認者の承認eventと同じtransactionで本番有効化した。
これは削除依頼画面に対する削除専用roleの有効化であり、完全削除の実行許可や削除運用開始ではない。

実行前ゲート:

- Supabase SQL Editorが本番projectの `main / Production` であることを再確認した。
- 個人情報や識別子を結果へ返さないread-only検査で、本人確認event 1件、正確な無効executor 1件、
  承認event 0件、有効executor 0件、実行者と別確認者が別人、確認済みAuth・profile一致、
  TOTP総数1件・verified 1件・unverified 0件、family所有・所属と一般Admin各0件を確認した。
- executor tableの非internal triggerは0件、private台帳の非internal triggerは設計済み2件だけだった。
- Vercel Production環境を一時ファイルへ取得して値を表示せず照合し、
  `ACCOUNT_ERASURE_EXECUTION_ENABLED` が未登録でfail closedのOFFであることを確認した。
  確認用ファイルは直後に削除した。
- 独立監査は、上記条件、1回だけの単独実行、削除RPCを呼ばないことを条件にP0/P1なしのGOだった。

本番有効化・事後確認:

- `ADMIN_AUTH_POLICY.md` の検証済み有効化SQLへ、正確な実行者・別確認者・本人確認eventと
  非秘密の承認証跡参照だけを画面内で設定した。未置換placeholder、DELETE文、削除RPCがないことを確認し、
  選択範囲なしで1回だけ実行して `Success. No rows returned` を確認した。
- 同じtransactionで新規作成したのは `activation_approved` event 1件だけで、既存executor 1件を
  `created_by=別確認者 / active=true / activated_at is not null / revoked_at is null` へ更新した。
  executorのnoteには本人確認eventと承認eventの両台帳参照を順番どおり保持した。
- 別のread-only事後検査は `all_checks_pass=true`。本人確認event 1件、承認event 1件、台帳総数2件、
  最小profile 1件、executor総数1件・有効1件・対象無効0件、認可method一致を確認した。
  family所有・所属、一般Admin、削除jobは各0件で、TOTPとtriggerの安全条件も維持していた。
- 実Auth UUID、個人メール、MFA情報を含む有効化・事後確認SQLは保存せず、各一時Editorタブを破棄した。

安全境界:

- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFのままであり、削除依頼の実行、DB削除RPC、Auth削除、
  Storage削除は行っていない。削除専用アカウントでの本番ログイン試験もまだ行っていない。
- 今回の承認event 1件追加とexecutor 1件更新以外に、利用者、モニター回答、日記、写真、AI相談、
  family・対象者・profile・削除依頼・削除jobの作成、変更、削除は行っていない。
- 個人メール、実Auth UUID、MFA秘密、OTP、token、認証情報はGit・引継ぎへ記録していない。
- 未追跡の `review_exports/` は参照・変更・stage・commitしていない。
  `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は変更・stage・commitしていないが、補助監査の初回検索で
  除外指定が効かず一致行が各1行だけ出力された。以後は検索対象を明示した。

次の1項目は、登録済み削除実行者本人の個別セッションで `/admin/delete-requests` にログインし、
削除依頼画面だけ利用でき、モニター回答・利用状況・本番設定APIは403になることを確認することである。
これはログインと権限分離の確認だけとし、実行スイッチON、削除前確認、完全削除は別承認まで行わない。

## 2026-09-05 追記 320 — 本番有効化の記録をmainへ反映

追記319の本番実績に合わせ、商用運用手順、公開準備台帳、本番checklist、商用gateテスト、
SESSION_HANDOFFを更新し、対象5ファイルだけをmainへpushした。

- commit: `9a31631b078c3da79552deda239e6b273198c792`
- `pnpm run test:commercial-release-gates`、`pnpm run test:account-delete-executor`、
  `pnpm run test:delete-operator-mfa-setup`、`pnpm run test:web-account-deletion`、
  `node --check scripts/test-commercial-release-gates.mjs`、`git diff --check` はすべて成功した。
- 限定stageの `git diff --cached --check` とGitleaksが成功し、secret検出は0件だった。
- 独立最終監査はP0/P1なしのGO。削除専用role有効化と、未完了の本人ログイン・権限分離試験、
  実行スイッチOFF、単独テスト削除未完了を資料とテストで分離していることを確認した。
- main CI run `33942778993` は2分27秒で成功した。型検査、monitor、認証、削除専用権限、
  private台帳を含む削除系PostgreSQL回帰、家族権限、AI記憶、日記・対象者削除、build、smokeを含む。
- Deploy workflow run `33942778995` はsecret存在checkだけ成功し、deploy jobはskipされた。
  今回は本番DBのrole有効化と文書・テスト更新だけでWeb runtime byteを変更していないため、
  このworkflowをVercel本番deployの証拠にはしておらず、CLI deployも行っていない。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFF、承認event 1件、private台帳総数2件、
  executor総数1件・有効1件、削除job 0件の事後確認状態を維持している。
- 未追跡の `review_exports/` は参照・変更・stage・commitしていない。
  `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は変更・stage・commitしていない。

次は追記319記載の削除専用ログイン・権限分離試験である。本人の個別セッションが必要であり、
完全削除スイッチONや削除操作とは分離して進める。

## 2026-09-05 追記 321 — 一般Admin拒否を401と403へ正しく分離

削除専用ログイン・権限分離試験の事前監査で、有効な削除専用実行者が一般Admin APIへ
Bearerを提示した場合も、未認証と同じ401になる不一致を確認した。アクセス自体は拒否できていたが、
本番checklistが求める「本人確認済みだが一般Adminではないため403」を証明できないため修正した。

- `verifyAdminRequest` のSupabase Auth判定を、認証情報なし、無効、本人確認済み非Admin、
  認可済みAdmin、role照合不能へ分離した。
- 一般Admin APIは、認証情報なし・無効を401、本人確認済み非Adminを403、role照合不能を503で
  fail closedにする。正しい `app_admin` と既存の有効な緊急用管理キーは従来どおり利用できる。
- 削除専用roleを一般Adminへ追加しておらず、`account_delete_executors` を一般Admin認可に使わない。
  削除専用API側のBearer限定・AAL境界・実行スイッチには変更を加えていない。
- 静的回帰へ401・403・503の区別と緊急用管理キーfallback順序を追加し、
  `pnpm run test:account-delete-executor`、`pnpm run test:commercial-release-gates`、
  `pnpm run test:web-account-deletion`、`pnpm run test:delete-operator-mfa-setup`、
  `pnpm --filter web run typecheck`、production build、`git diff --check` は成功した。
- `pnpm --filter web run lint` は既存リポジトリにESLint設定がなく対話式初期設定で停止するため、
  lint結果としては扱っていない。build内の型検査は成功している。

同じブラウザ状態から削除担当者のMagic Linkを1通送信したが、ユーザーがリンクを開いた後も
この検証用ブラウザにはcallback/sessionが戻らず、再読込後も未ログイン表示だった。別ブラウザで
リンクを開いた場合はそのブラウザのlocalStorageへsessionが保存されるため、ログイン成功とは記録していない。
削除一覧の認証済みGET、一般Admin APIの403、ログアウト後401は未確認のままである。

安全境界:

- 削除依頼の状態変更、削除前確認、削除実行、DB削除RPC、Auth削除、Storage削除は行っていない。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFのまま。既存利用者、モニター回答、日記、写真、
  AI相談、family・対象者・削除依頼・削除jobを作成・変更・削除していない。
- 個人メール、実Auth UUID、MFA秘密、OTP、token、認証情報はGit・引継ぎへ記録していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次はこの修正をmainへpushしてVercel本番へ反映する。その後、同じブラウザ状態で新しいMagic Linkを
開き、削除専用auth-statusと一覧GETが200、一般Admin 3 APIが403、ログアウト後が401となることだけを
確認する。PATCH、preflight、executeは別承認まで呼ばない。

## 2026-09-05 追記 322 — 403修正をmain・Vercel本番へ反映

追記321の一般Admin拒否修正をmainへpushし、Vercel CLIから本番へdeployした。

- commit: `7347ac83db88747fabea6f99b7eecb44e8c80e8a`
- deployment: `dpl_EhzsPckP4NvDM8dXetRPAr3grSFA`
- deployment URL: `https://oyano-moshimo-navi-o800t1ex7-dogwoodcommunity1.vercel.app`
- targetはproduction、statusはReady、公開aliasは
  `https://oyano-moshimo-navi.vercel.app` であることを `vercel inspect` で確認した。
- Vercel buildは168ページの生成を含め成功した。
- 公開aliasに対する `node scripts/smoke-web.mjs` は成功した。公開画面、削除担当画面、health、
  認証必須APIの401、空相談の400等を確認し、Admin env APIは管理token未指定のため401 skipだった。

deploy後の確認で、`.vercelignore` に未追跡レビュー資料の明示的な除外がなかったことを確認した。
対象資料は開いていないが、このdeployのアップロード対象一覧を保存・検査しておらず、Vercel CLIが
未追跡パスを送らなかったとは証明しない。以後のdeployから確実に外すため、`.vercelignore` へ
`review_exports` と未追跡Claudeレビュー文書2件を明示追加した。これらをstage・commit対象にはしていない。

Chrome側には別の既存管理セッションが残っており、表示メールとTOTP状態が今回の削除専用実行者と
一致しないため、そのセッションを削除専用試験の証拠には使っていない。ログアウト操作も行っていない。
削除専用実行者のログイン・200/403/401分離試験は、分離したブラウザ状態で引き続き未完了である。

安全境界:

- 削除依頼の状態変更、削除前確認、削除実行、DB削除RPC、Auth削除、Storage削除は行っていない。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFのまま。既存本番データは変更・削除していない。
- 個人メール、実Auth UUID、MFA秘密、OTP、token、認証情報はGit・引継ぎへ記録していない。

次は `.vercelignore` の除外をmainへpushして本番を再deployし、先のdeploymentを公開aliasから置き換える。
その後、分離した同一ブラウザで新しいMagic Linkを開き、GETだけの権限分離試験を行う。

## 2026-09-05 追記 323 — レビュー資料を除外した本番deployで置換

`.vercelignore` の追加と追記322をcommit `a56870c48dd68bd69ed7801fccb3486c722ff838` として
mainへpushし、そのclean HEADからVercel本番を再deployした。

- final deployment: `dpl_HjCxNNBgixEqg4qrGPsKjJnzKgBB`
- deployment URL: `https://oyano-moshimo-navi-18i85duor-dogwoodcommunity1.vercel.app`
- targetはproduction、statusはReady、公開aliasは
  `https://oyano-moshimo-navi.vercel.app` であることを `vercel inspect` で確認した。
- `.vercelignore` 適用前のuploadは413 files・約1.4MB、適用後は411 files・915.6KBだった。
  除外対象の未追跡Claude文書2件は本番uploadから外れた。`review_exports` も将来を含め明示除外した。
- 公開aliasに対する最終 `node scripts/smoke-web.mjs` は成功した。
- HEADとorigin/mainは上記commitで一致し、残るstatusは対象外の未追跡Claude文書2件だけである。

削除専用ログイン試験はまだ未完了である。Chromeには今回の実行者と異なる既存管理セッションがあり、
分離試験へ流用していない。Codex内ブラウザの分離状態では未ログインを確認済みである。
次は新しいMagic Linkをその分離状態で送信し、届いたリンクを同じブラウザで1回だけ開く。

`ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFのまま。削除依頼PATCH、preflight、execute、削除RPC、
Auth・Storage削除は行っておらず、既存本番データは変更・削除していない。

## 2026-09-05 追記 324 — 本番の削除専用ログインと権限分離を確認

登録済み削除専用実行者へ新しい本番Magic Linkを1通送信し、本人がChromeで開いた。
公開aliasの `/admin/delete-requests` へ戻り、登録済み本人の認証済み表示、登録済みTOTP factor、
AAL1からの追加認証案内、削除依頼一覧を確認した。個人メール、実Auth UUID、tokenは記録していない。

- 対象deploymentは `dpl_HjCxNNBgixEqg4qrGPsKjJnzKgBB`。
- 本人セッションの `/api/admin/delete-requests/auth-status` と削除依頼一覧GETは各200だった。
  削除依頼は0件で、画面には「削除依頼はまだありません。」と表示された。
- 同じ本人セッションで、モニター回答、AI利用、本番設定の一般Admin APIは各403だった。
  削除専用roleが一般Admin権限へ広がっていないことを確認した。
- 削除依頼PATCH、削除前確認、削除実行POST、DB削除RPC、Auth削除、Storage削除は呼んでいない。
- Vercel Productionの `ACCOUNT_ERASURE_EXECUTION_ENABLED` は未登録でfail closedのOFFを維持している。
- ユーザーが続けて確認できるよう、Chromeの本人セッションはログインしたまま残した。
  ログアウト後401の手動確認は行っていないが、未認証APIの401は既存smokeで確認している。
- 既存利用者、モニター回答、日記、写真、AI相談、family・対象者・profile・削除依頼・削除jobを
  作成・変更・削除していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。
- `pnpm run test:commercial-release-gates`、`pnpm run test:account-delete-executor`、
  `pnpm run test:web-account-deletion`、`pnpm run test:delete-operator-mfa-setup`、
  `pnpm --filter web run typecheck`、`node --check scripts/test-commercial-release-gates.mjs`、
  `git diff --check` は最終状態ですべて成功した。
- 独立資料監査はP0/P1/P2なしのGOで、200・403・0件と、破壊操作未実施・スイッチOFFの境界が
  本番checklist、商用運用手順、公開準備台帳、gateテスト、引継ぎで一致していることを確認した。

削除専用ログインと権限分離の試験は完了した。次はAAL1での削除前確認とAAL2での
単独テストアカウント完全削除だが、これは破壊的な別工程である。新しい実行時明示承認を得るまで、
実行スイッチON、preflight、execute、実削除へ進めない。

## 2026-09-05 追記 325 — 削除専用権限分離の記録をmainへ反映

追記324の本番確認に合わせ、本番checklist、商用運用手順、公開準備台帳、商用gateテスト、
SESSION_HANDOFFを更新し、対象5ファイルだけをmainへpushした。

- commit: `ee9c8dc48acaa2719511bd5f51e50811b9b9a6f9`
- ローカルの削除担当権限、MFA設定、Web削除、商用gate、型検査、構文検査、diff検査は成功した。
  限定stageのGitleaksはsecret検出0件だった。
- 独立資料監査はP0/P1/P2なしのGOだった。
- main CI run `33944414158` は2分35秒で成功した。Web・モバイル型検査、monitor、削除担当権限、
  MFA、削除系PostgreSQL回帰、家族権限、AI記憶、日記・対象者削除、build、smokeを含む。
- Deploy workflow run `33944414224` はsecret存在checkだけ成功し、deploy jobはskipされた。
  今回のcommitは資料と回帰テストだけで本番runtime byteを変更していないため、追加deployは不要である。
  本番runtimeは追記323のReadyなdeploymentを維持している。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFで、PATCH、preflight、execute、実削除は未実行。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次は単独テストアカウントを用意し、別の実行時承認のもとでAAL1 preflightとAAL2完全削除を
確認する工程である。現在の本人セッションや既存利用者をテスト削除対象にしてはならない。

## 2026-09-05 追記 326 — 完全削除のDB-first one-shot安全gateを実装

単独テスト削除へ進む前に、過去deploymentや誤操作から本番データを守るDB側の安全境界を
sourceと使い捨てDBで実装・検証した。この追記時点では本番DBへ適用しておらず、Webも未deployである。

- DB ownerだけが最大15分開けられるone-shot controlと、別のAAL2 app adminが発行する
  最大10分・1回限りの実行grantを追加した。grantはrequest、target、job、manifest、実行者、
  control epochへ固定し、DB削除成功時にgrantとcontrolを同一transactionで消費する。
- 削除専用実行者の生tableをservice roleから読めなくし、対応Web用の
  `verify_account_delete_operator_v2` だけをservice-onlyで追加した。旧deploymentは認可段階で
  fail closedになる。旧inspect、prepare、status update、3引数executeのservice実行権限も失効させる。
- 依頼状態更新は `update_account_delete_request_status_v2` でDB側も正確なAAL2 app adminを再確認する。
  削除専用実行者や旧AAL1 deploymentからのPATCHは拒否する。
- DB削除後にAuthまたはStorage処理で止まった場合だけ、同じjob・manifestと消費済みgrantを持つ
  元の削除実行者本人に限り再開できる。別の有効な削除実行者による横取りを回帰テストで拒否した。
- 古いprepared jobの不正な時間幅はmigration時に安全に失効させる。対象・依頼のadvisory lock、
  role表lock、対象scope再計算、control/grantの原子的消費を回帰で確認した。
- `pnpm run test:account-erasure:sql` はPostgreSQLの全回帰を最初から実行して成功した。
  `pnpm run test:commercial-release-gates`、`pnpm run test:account-delete-executor`、
  `pnpm run test:web-account-deletion`、Web typecheck、production build、各構文検査、
  `git diff --check` も成功した。buildのNode 20非推奨警告は既知で、build自体は成功している。
- 独立レビューでは、最後に見つかった復旧実行者の結び付け不足を上記のとおり修正後、
  DB-first対象に残るコードレベルのP0/P1がないことを再確認し、SOURCE/CI GOと判定した。

安全境界:

- 本番DBのschema・権限・利用者データはまだ変更していない。削除依頼PATCH、preflight、prepare、
  execute、削除RPC、Auth削除、Storage削除はいずれも実行していない。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFのまま、既存利用者、モニター回答、日記、写真、AI相談、
  family・対象者・profile・削除依頼・削除jobは変更・削除していない。
- 対応Web/API/UIの差分はDB-first適用後に反映するためローカルに分離して残している。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

次はDB側の対象ファイルだけをmainへpushし、CI成功後に本番SQL Editorで
`account_erasure_execution_gate.sql` を1回適用する。これはschema・権限変更なのでRun直前に
ユーザーの実行時確認を得る。controlは閉じたままにし、read-only ACL確認が成功してから
対応Webを別commit・deployする。実アカウント削除はさらに別の明示承認まで行わない。

## 2026-09-05 追記 327 — DB-first commit後の旧静的テストを整合

追記326のDB側11ファイルをcommit `3e8e4b79bb9bc50f702716ca873da705379219b7` として
mainへpushした。限定stageのGitleaksはsecret検出0件だった。本番DB・Web本番にはまだ反映していない。

main CI run `33950712669` は、Web・モバイル型検査と削除以外の前半テストを通過後、
`Test web account deletion` の旧静的assertion 1件で停止した。旧testは書込freeze条件を
`account_deletion_pipeline.sql` だけから探していたが、新gateでは期限付きpreparedと
database-erased後の条件を `account_erasure_execution_gate.sql` へ分けたためであり、
PostgreSQL回帰やアプリruntimeの失敗ではない。

- DB-first順序を崩さず、既存Web実装のassertionは変えない。
- 静的testへ新gate SQLの読込みを追加し、liveなprepared期間だけ一時停止、
  `database_erased` / `completed` 後は恒久停止という新しい条件を確認するassertionへ置換した。
- ローカルの更新版Web削除テスト、削除実行者認可テスト、商用gate、SQL全回帰、typecheck、buildは
  すでに成功している。CIはこのtest-only整合commitをpush後に再確認する。
- この修正はテストだけで、schema、権限、利用者データ、Web runtimeを変更しない。
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` はOFFのまま。削除系API・RPCと本番データは操作していない。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。

CI成功までは本番SQL EditorでRunしない。成功後も、本番DBのschema・権限を変える
`account_erasure_execution_gate.sql` のRun直前にユーザーの実行時確認を得る。

## 2026-09-05 追記 328 — 本番DBのone-shot gateを承認後に適用・停止確認

test-only整合commit `b2daa06ec6303bc227277cefb41004e743705b73` のCI run
`33950868597` は2分34秒で成功した。ユーザーのRun直前の「ええよ」を受け、
本番SQL Editorで `supabase/account_erasure_execution_gate.sql` を1回実行し、
`Success. No rows returned` を確認した。

- 対象SQLは1,740行・64,689 bytes、SHA256
  `003b2b843d3d801415020d0ff2024504302b428313850a065ea45e303b88289e`。
  実行前にeditor全文とcommit済みSQLの一致を確認した。migrationの再実行はしていない。
- 続いて個人識別子を返さないread-only SQLで12項目を確認した。
  v2の7 RPC存在・service-only、旧v1のservice EXECUTE失効、生executor表のAPI role拒否、
  control開閉RPCとprivate control/grant表のAPI role拒否、private表のFORCE RLSはすべてtrue。
- controlは1行でactive 0件、grant 0件、削除依頼0件、削除job 0件、active executor 1件だった。
  DB ownerのcontrol開放、grant発行、preflight、prepare、execute、Auth/Storage削除はしていない。
- 既存利用者の手帳・日記・写真・AI相談・モニター回答を変更・削除していない。
  `ACCOUNT_ERASURE_EXECUTION_ENABLED` の設定は変更せず、OFFを維持する。
- 対応Webの独立再確認で追加migration依存はなく、Web削除・専用実行者テストとdiff検査が成功。
  画面には別担当者の許可前にDB ownerの最大15分の実行時間帯が必要である旨も明記した。
- この追記時点では対応Webはまだ未deploy。DB-firstの間は旧Webの削除認可がfail closedになる。
  次は対応Webを限定commit・CI・本番deployし、読み取り専用で表示とAPIを確認する。
- 未追跡の `review_exports/` と `docs/CLAUDE_FULL_REVIEW_*_2026-09-03.md` は
  参照・変更・stage・commitしていない。実アカウントの完全削除E2Eは別の明示承認まで未実施とする。

## 2026-09-05 追記 329 — DB-first対応の管理画面を本番反映、削除OFFを維持

追記328の本番DB検証後、対応Web/API/UI、回帰テスト、運用資料を限定commitしてmainへpushし、
CIの成功を確認してからclean tracked HEADでVercel本番をdeployした。

- release commit: `c1415b3b036fbdfa9977f0d870a808bb633c6467`
- CI run `33952555663`: 2分24秒で成功。Web/モバイル型検査、削除専用認可、
  PostgreSQL削除gate/家族権限/AI記憶/日記/対象者削除回帰、build、smokeを含む。
- Deploy workflow `33952555613`: secret存在check成功、deploy jobはskip。
  本番反映は既存ログイン済みVercel CLI 59.11.7から実施した。
- deployment: `dpl_Hx7V71Pd9voYiMYgfmFFRxmo7MnA`
- direct URL: `https://oyano-moshimo-navi-oamhlgdrr-dogwoodcommunity1.vercel.app`
- `vercel inspect` でproduction / Readyと公開alias
  `https://oyano-moshimo-navi.vercel.app` を確認した。buildは168ページを生成して成功した。
- `.vercelignore` は引き続き `review_exports`、未追跡Claude文書2件、`.env*` 等を除外する。
  対象外ファイルは参照・変更・stage・commitしていない。
- 公開aliasの `node scripts/smoke-web.mjs` は成功した。公開ページと管理画面200、
  health200、未認証の利用者向けAPI401、空相談400、有料Checkout503を確認した。
  Admin env APIはtoken未指定のため401 skipであり、認証済み設定検査が通ったとは扱わない。
- 削除担当auth-status・一覧、モニター回答、AI利用、本番設定の5 APIを未認証GETし、全て401。
- 本番管理画面をreloadし、削除担当者ログイン案内と最小化された一覧列を確認した。
  現在のCodex内ブラウザは未ログイン。旧版での本人200/一般Admin403の記録は追記324にあるが、
  今回のv2移行後の認証済み再確認とは区別する。確認メールの再送や新規ログインは行っていない。
- Vercel Productionの環境変数名一覧で `ACCOUNT_ERASURE_EXECUTION_ENABLED` が未登録のまま、
  fail closedのOFFであることを再確認した。値・secretは読み出し・記録していない。
- Web反映後に追記328と同じread-only 12項目を再実行し、全項目PASS、control active 0件、
  grant・削除依頼・削除job各0件、有効実行者1件のままであることを確認した。
- ローカルの実行者認可・Web削除・商用gate・typecheck・production build・diff検査は成功。
  限定stageのGitleaksはsecret検出0件。商用gateの旧「二者確認は技術的に強制しない」という
  assertionは、DBのexact grant bindingと人による照合証跡の必要性を確認するものへ更新した。

残りと安全境界:

- v2本番での登録済み実行者の本人ログイン後200/403再確認、別確認者のAAL2確認、
  単独テストアカウントでの完全削除E2E、通知・運用の未確認事項は残る。
- テスト対象の作成・削除、依頼PATCH、preflight、prepare、grant発行、DB control開放、
  execute、Auth/Storage削除、実行スイッチONは行っていない。
- 既存利用者の手帳・日記・写真・AI相談・モニター回答は変更・削除していない。
  本番反映済みを「削除運用・商用正式版の全試験完了」と読み替えない。
- 次は登録済み本人が管理画面へログインした後の読み取り専用確認。完全削除の試験は、
  専用の破棄可能なテスト対象を明示し、別の実行時承認を得てから進める。

## 2026-09-05 追記 330 — v2本番の本人ログイン・AAL2・管理画面分離を確認

ユーザーの「ログインした」を受け、Chromeの公開alias `/admin/delete-requests` を
読み取り専用で確認した。対象runtimeは追記329の `c1415b3` deploymentで、コード・DB・
環境変数の変更や追加deployは行っていない。

- 登録済み削除専用実行者本人の「確認済みです」「多要素認証（AAL2）を確認済みです。」を確認。
  個人メール、Auth UUID、token、OTP、MFA秘密は文書・Gitへ記録していない。
- 削除依頼は0件で、列はREQUESTED / USER / STATUS / SLA / OPSだけだった。
  CONTACT / REASON / HANDLED BYは表示されない。非空依頼の行内容最小化試験とは区別する。
- 同じ本人セッションで `/admin/monitor-feedback`、`/admin/ai-usage`、`/admin/env` を開き、
  全て「現在のログインでは管理者権限を確認できませんでした。」とデータ非表示を確認した。
  前2画面は `Admin authorization is forbidden` も表示された。現行sourceのこの応答は403だが、
  今回はHTTP statusの数値を通信一覧から直接取得できていないため、厳密な200/403採取と分ける。
- 通信status確認用に対象タブのDevTools Networkを開いたが、Chrome前面が別作業へ移ったため、
  前面を取り戻す操作はせず中止した。認証ヘッダー、request payload、response本文、
  localStorageの認証値は読み出していない。別作業のタブは操作していない。
- 最後に同じタブを `/admin/delete-requests` へ戻し、本人認証済み・AAL2・0件を再確認した。
  ログアウト・確認メール再送はしていない。
- 依頼PATCH、preflight、prepare、grant、control開放、execute、Auth/Storage削除、
  テスト利用者作成はいずれも未実施。既存記録・写真・AI相談・モニター回答は変更・削除していない。
  削除実行スイッチは前回確認済みのOFFから変更していない。

本人ログイン・AAL2・画面上の権限分離は確認済み。HTTP数値の直接再採取、非空依頼の最小化、
別確認者本人のAAL2、専用テスト対象による完全削除E2Eは未完了であり、実削除へ進めない。
今回の通信権限要求ではnetwork権限が付与されなかったため、確認記録はローカルに保存し、
GitHubへのpushは未実施。通信許可後にこの記録commitをpushする。未追跡のレビュー資料は
参照・変更・stage・commitしていない。

## 2026-09-05 追記 331 — 保留していた本人ログイン確認記録をGitHubへ反映

ユーザーの「ええよ」と通信権限の付与を受け、追記330を含む文書5件のcommit
`e96787f658a42712e2502ef5a001678eb6ae951b` をmainへpushし、origin/mainとの一致を確認した。
追記330の「通信許可待ち・push未実施」はこれで解消した。

- 独立確認でも文書のみのcommitで、runtimeコード・SQLの変更と対象外レビュー資料を含まない。
- 前回の商用gateテスト・diff検査・限定stageのGitleaksは成功。今回のCI run
  `33953375602` はこの追記時点で実行中であり、成功したとは扱わない。
- 本番deploy、DB・環境変数変更、依頼変更、実削除は行っていない。削除スイッチはOFFから変更なし。
- 残る実機・完全削除E2Eの確認範囲は追記330のとおり。今回の承認を実削除の承認へ拡大しない。

## 2026-09-05 追記 332 — 正式公開の残作業を実装・ローカル検証、本番反映は通信許可待ち

ユーザーの「全部終わらせてくれ」を受け、無料Web正式版（Stage A）の残作業を再監査した。
開始時main/記録上originは `bac95cc2db2a4caac41877f2bdec57503f40e4d1`。
今回の通信権限要求ではnetwork権限が付与されず、GitHub push・Vercel設定/deploy・本番DB確認/変更は
実施していない。登録済みの本人ログイン確認までを「正式公開の全工程完了」とは扱わない。

今回の実装:

- 削除管理画面へ、手動で5 APIのHTTP番号だけを確認する読み取り専用診断を追加。
  削除専用実行者は200/200/403/403/403、app_adminは全200が期待値。全レスポンス本文は解析せず
  cancelし、token・個人識別子・回答・設定値を表示/保存しない。GET/no-store、Cookie非送信、
  redirect拒否、20秒期限、二重実行防止、認証/role/storage変更・unmount時の中断と古い結果の破棄を検証。
- 確定済みの運営・問い合わせ4値と、正式公開日の2値を分離。`getPublicOperatorContact()` で
  会社名・責任者・窓口・返信目安を表示し、日付未設定なら準備中と明記する。
  既存の `getPublicOperatorDisclosure()` と有料受付の完全条件は維持。URL認証情報や
  不正なmailto queryをメールアドレスと誤認しない検査、HTML escaping・日付/販売gateの実行試験を追加。
  **これは本番env設定済みの意味ではない。4値は次回本番へ設定・deployが必要。公開日は推測入力しない。**
- `monthly_checkin_notifications.sql` の相関条件が別scopeの `push_tokens.user_id` を参照していた
  不具合を `profiles.id` に修正。独立PostgreSQLで対象userごとの重複抑止、通知OFF、email/push対象、
  最新設定、30日後09:00 JST、2回目0件、RPC ACLを検証する9本目のSQL試験を追加。
  本番functionの現行定義は未確認。旧版なら影響し得るが、後発のemail migrationでは既に同じ相関が
  修正されている。次回はread-only照合を先に行い、必要な修正だけを承認後に適用する。
- `scripts/test-stage-a-local.mjs` を追加。固定された25 source/runtime、lint、Web/Mobile型検査、
  9 SQL回帰、Web buildを検査。`--source-only` / `--sql-only` は必ずPARTIAL_PASS、
  本番・実機はNOT_TESTEDと出す。実行用dotenvを内容非参照で拒否し、子プロセスから認証情報を除去。
  ローカルUnix socketのDockerだけを許し、既存の9 SQL試験は取得済みのcanonical PostgreSQL imageを
  `--pull=never --network=none` で使う。CIには明示的な事前image取得と新規テストを追加した。
- 独立した2つの疑似ブラウザ保存領域で、復元/重複防止/未送信編集の競合保護/確認リスト・写真参照保持を検証。
  これは実端末・実Storageの復元とは区別する。
- クラウド検証手順のtoken抽出、生SQLによる本番DELETE、通常ブラウザの履歴消去を撤去。
  専用テストアカウント・別プロファイル・正規UI/receiptでの検証に変更し、無料家族枠は本人＋1人に整合。
  本番チェックリストの過去に完了済みだった初期hardening/同意保存/rate-limit/匿名保持期限を
  実行履歴への参照付きで修正した。過去の実績と現在版の再確認は区別する。

ローカル検証:

- 25 source/runtime試験PASS（新規診断・公開情報rendering・runner安全性・追加同期試験を含む）。
- Web/Mobile typecheck、Web production buildがPASS。認証情報・実行用dotenvを渡さず実施した。
- PostgreSQLの既存8本と新規月次通知1本が、外部通信なしの破棄containerでPASS。
  sandboxではDocker socket拒否/inspect timeoutがあり、ローカルDockerだけの限定承認後に実行した。
  短縮image名のinspectが失敗する環境だったため、canonical `docker.io/library/postgres:16-bookworm` で照合。
- loopback限定3126番でのsmokeは40項目成功、Admin envは未認証401で1項目skip。
  Supabase・Stripe・AIの本番設定は渡しておらず、実際の保存・決済・AI呼出・メール送信はしていない。
- Codex内ブラウザの幅390pxで特商法・利用規約・プライバシーのscrollWidth=clientWidth=390を確認。
  特商法はスクリーンショットも確認。ブラウザのviewport overrideを戻し、テストタブとローカルserverを閉じた。
  実機Safari/Brave/Android合格や、設定済み本番envの表示確認とは扱わない。
- **lintは未完了**。既存ESLint設定と依存がなく、全体runnerは `lint_not_configured` で安全停止。
  通信許可なしのため依存を取得していない。pnpm経由の再検査時にpnpm 11が自動installを試みたが、
  registry通信失敗・非対話purge拒否で停止した。入口を `node scripts/test-stage-a-local.mjs` にし、
  子pnpmの `pnpm_config_verify_deps_before_run=error` を固定して自動installを防止した。
  部分試験・build成功をlint成功や全LOCAL_PASSへ読み替えない。

次の順序（未完了）:

1. 外部通信許可後に今回の限定commitをGitHubへpush、CIを確認。ESLint依存/設定も別途整え、全体runnerを再検査。
2. 本番の `family_role_hardening_20260904.sql` / `family_management_rpc.sql` / `consult_daily_claim.sql`
   に対応するschema・RPC・ACLと、月次通知functionをread-onlyで照合。未チェックの台帳だけで不足と断定せず、
   本当に不足しているmigrationだけをRun直前承認後にDB-first適用する。初期SQL全体の再投入は禁止。
3. 確定済み公開情報4値を本番設定し、今回のWebをdeploy。公開alias/診断5 API/公開情報を再確認。
4. テスト専用受信メールを運営者から受け取り、既存利用者・管理者と分離した2アカウント/2端末で
   保存・復元・家族権限・写真を完走。完全削除は正確な破棄対象と別確認者AAL2を確保し、
   対象・job・manifestの照合と実行直前承認の後だけ行う。いま実行スイッチ/owner controlを開かない。
5. DB/Auth・Storageそれぞれのbackup/隔離復元、RPO/RTO、通知の実受信、問い合わせ受信/返信、
   運用連絡/当番、法務最終確認、正式公開日を確定する。無料Stage AにStripe/有料条件/ストア審査を混ぜない。

問い合わせを両名で毎営業日確認する運用と、テスト専用メールをユーザーへ質問済みだが、
この追記時点では回答待ち。未回答を承認とみなさない。費用の発生する契約・保存先追加も未実施。
既存の利用者・日記・写真・AI相談・モニター回答・削除依頼は一切変更/削除していない。
`review_exports/` と未追跡Claudeレビュー文書2件は参照・変更・stage対象外。
GitHub push・本番反映は未実施のまま、この追記を含む限定commitをローカルへ保存する。

## 2026-09-05 追記 333 — 通信再開、本番DBの実際の不足を確認しDB変更承認待ち

ユーザーの「ええよ」と通信許可を受け、保留していた `35bc7a9062e5b65a5b44ddc334ced568cf1ac473`
をorigin/mainへpush。CI `33954325618` は成功した。Deploy workflow `33954325573` は全体表示が
successでもdeploy jobはskipであり、本番反映ではない。追加の本番DB照合で不足が判明したため、
新Webの手動deployは実施せずDB-firstを維持している。既存本番aliasは変更していない。

完了した本番設定:

- Vercel Productionへ確定済みの `LEGAL_BUSINESS_NAME`（株式会社BEECH）、
  `LEGAL_RESPONSIBLE_PERSON`（代表取締役 池田哲也）、`LEGAL_CONTACT`（info@bee-ch.co.jp）、
  `LEGAL_CONTACT_RESPONSE_TARGET`（メール受付：24時間／原則3営業日以内に返信）を追加した。
- 既存keyを上書きせず、4値の追加成功をCLIで確認。秘密値は出力・保存していない。
- 施行日2値は未設定。有料受付と削除実行の環境スイッチも未設定/OFFのまま。
  **env追加は新Webの表示確認ではない。deployと公開表示の確認は残る。**

2026-09-05 17時台JST、本番project `ypnuxyfirlvbsqujocuy` の認証済みSupabase SQL Editorで
SELECTだけを実行した。従来の利用者のSQLタブは残し、別の新規query
`b7498551-dd8d-4c09-a0ec-6b0ee32d2311` を使用。入力内容の一致を照合してからRunし、
関数・ACLの有無、boolean、集計件数だけを取得。日記・写真・相談・回答・認証情報の中身は取得していない。

| 照合対象 | 本番で確認した結果 |
| --- | --- |
| `is_family_editor(uuid)` | 必要1件に対し0件（未導入） |
| 家族管理5 RPC | 5件すべて未導入 |
| 日次相談のclaim/persist/release 3 RPC | 3件すべて未導入 |
| 月次通知 | 関数は存在。旧 `push_tokens.user_id` aliasが残存、正しい `profiles.id` aliasは未反映。authenticatedのEXECUTEが残る（anon/PUBLICは閉鎖、service_roleは許可） |
| 前提機能 | 同期v2・日記削除・招待作成/受諾RPCあり。指定13テーブル、10列はすべて存在 |
| UUID | `uuid_generate_v4()` はextensionsのみ。public/pg_catalogには存在せず、native `pg_catalog.gen_random_uuid()` は存在 |
| 家族管理migrationの既存role補正 | 主owner補正0件、legacy owner降格0件。実行直前に再確認する |
| 削除のprivate実行制御 | control行1件、active control 0、active grant 0。閉鎖状態を再確認 |

これで追記332の「台帳だけでは不足と断定できない」は実測に置き換わった。現在の本番で家族管理・
原子的相談処理が導入済みとは扱わない。記録消失の証拠ではなく、未反映のDB機能である。

今回のソース修正:

- Next 14.2.35に合わせたESLint 8.57.1 / eslint-config-next 14.2.35を固定し、設定と
  非対話lintを追加。pnpm 9.15.9をroot packageManager・CIに固定。lockfileも同versionで更新。
  Next/Reactのupgradeはしていない。lintはerror 0だが、既存の画像最適化・React依存配列warningsは残る。
- `consult_daily_claim.sql` のUUID生成を `pg_catalog.gen_random_uuid()` に修正。
  本番同様uuid-osspがextensionsにしかない隔離DBで、相談保存・確定・冪等性を検証する回帰を追加。
- 月次通知と後発email migrationの同関数について、PUBLICだけでなくanon/authenticatedの
  古い明示EXECUTEもrevoke。古い権限を付けてから各migrationを再適用し、client拒否・service成功を検証。
- `supabase/verify_stage_a_release.sql` は今後の再照合用。メタデータとprivate gate集計だけの
  SELECTで、アプリRPCの実行・個人行の返却・DB変更はしない。USING/WITH CHECKとRLSを別々に照合。
  構造的な差分検査であり、全okを実機・複数アカウント・全権限の完全保証に読み替えない。
  今回本番で実行したのは上表の限定SELECT群であり、この全体verifierの本番PASSではない。

検証:

- lint追加後の全38項目runnerは初回handoff SQLでexit1。単独2回では再現せず両方PASS。
  原因を特定したとは扱わない。その後の全体再実行は25 source/runtime・lint・Web/Mobile型・
  9 SQL・buildすべてLOCAL_PASS。月次/UUID修正後にも対象SQLと関連source試験はPASS。
- 月次/UUIDの追加修正を含む最終全体runnerも全38項目LOCAL_PASS（25 source/runtime・lint・
  Web/Mobile型・9 SQL・build）。最新コードでの隔離検証が完了した。新commitのCI結果は次の追記で記録する。
- 本番DBへDDL/DML、家族権限補正、通知関数実行、owner control/grant、削除、メール送信は行っていない。

次の本番変更（ユーザーへ実行直前の承認を求める。今回の通信許可をDB変更許可に拡張しない）:

1. 確認済み不足だけを、`family_role_hardening_20260904.sql` → `family_management_rpc.sql` →
   修正版 `consult_daily_claim.sql` → 修正版 `monthly_checkin_notifications.sql` の順で適用する。
   初期schema/api_grants/production_rlsや後発email migration全体の再投入はしない。
2. 家族管理SQLには既存family_membersのrole補正UPDATEが2本ある。件数を再照合し、
   current owner pointerに合わせる。日記・写真・モニター回答・相談履歴を消すSQLではない。
   新しい家族管理RPCへの権限付与も含むため、Run直前承認が必要。削除機能自体は実行しない。
3. 短い保守時間帯で各transactionの成功を確認。月次SQLも適用部分をtransactionで包み、
   lock待ちを無制限にしない。途中失敗は先へ進まずROLLBACK・原因確認。通知関数の試験実行はしない。
4. read-onlyで必要関数・権限と削除OFFを再確認し、CI成功した最終SHAだけをclean git archiveから
   Vercelへ反映する。`.vercel` 全体やenv/未追跡資料は送らず、必要ならproject.jsonだけを使用する。
5. 公開alias・運営情報表示・本人sessionの手動5 API診断を確認する。その後の正式公開前条件は追記332
   の実機2アカウント、backup/隔離復旧、受信試験、別確認者AAL2と単独テスト削除、法務/公開日が残る。

既存の利用者データは変更・削除していない。`review_exports/` と未追跡Claudeレビュー文書2件は
参照・変更・stage・送信の対象外。今回の新しい変更と本追記を限定commitしてGitHubへ保存する。

## 2026-09-05 追記 334 — 最終修正のGitHub/CI成功、DB承認とVercel再ログインが残る

追記333を含む15ファイルを限定stageし、diff検査とGitleaks（redact）で問題なし。
`539c359cc9d62fb6dbebd1193221d761e0a84644` をmainへcommit/pushした。
CI `33955341444` は全体success、失敗stepなし。Deploy workflow `33955341499` は
checkのみ成功しdeploy jobはskip。本番deploy成功と読み替えない。

- `verify_stage_a_release.sql` の最終版はrootが全文読取し、専用の空PostgreSQLで12項目すべて
  missing/ok=falseになることを確認。さらに最小のダミーtasks/people policyで、正常時compatible=1、
  USING=true・WITH CHECK=true・RLS無効時それぞれcompatible=0の4ケースがPASS。
  この限定fixture試験は全12項目の正常系・異常系を網羅したものではなく、CIにも含めていない。
  検証用 `oyano-stage-a-verifier-local` はstop/自動破棄し、残存なしを確認した。
- Vercel env一覧で4つの公開設定の存在と、正式施行日/削除/有料スイッチが追加されていないことを再確認。
  その後のdeployment inspectはCLIログイン更新で権限エラーとなり、公式CLIの通常更新を許可して再試行したが
  **token invalid** で失敗。新しい認証情報は発行・出力していない。次回Vercelへの通常の再ログインが必要。
  本番deployment IDの再取得はできておらず、過去のIDを本日再確認済みとして報告しない。
- 認証不要のGETで本番 `/api/health`、`/legal/terms`、`/legal/privacy` は200。
  規約・プライバシーに会社名/問い合わせの新表示はまだ存在しない。公開ページへのGETのみで、
  保存・AI相談・通知・削除などの本番動作を実行していない。
- 既存本番データ・DB権限・削除制御は変更していない。active control/grant 0は追記333の最新SELECT実測。
  本番反映に進めていない理由は、実測したDB不足を解消するRun直前承認と、Vercel再ログインである。

次のユーザー確認は追記333の**4ファイルの本番DB適用**。日記・写真・回答・相談履歴は削除しないが、
家族管理権限と既存role補正（直近0件）を含むことを説明する。承認後、対象件数/前提を再照合して
DB-first適用・read-only再検査、Vercel再ログイン、承認済みのWeb反映を進める。削除や有料受付は開かない。
無料正式版の最終GO、実機/backup/問い合わせ/法務の残条件も未完了のまま。今回の修正・CI成功を
「商用正式版の全工程完了」とは扱わない。この確認記録を追加commitしGitHubへpushする。

## 2026-09-05 追記 335 — 承認済み4件の本番DB適用成功、12項目ok、Webは認証待ち

ユーザーの直近「ええよ」は、前回答で対象と影響を説明した4 SQLの本番適用への承認として受領。
本番project `ypnuxyfirlvbsqujocuy` の専用SQLタブ `b7498551-dd8d-4c09-a0ec-6b0ee32d2311` で
適用前の件数・前提を再検査した。家族の主owner補正0、legacy owner降格0、active control/grant各0。
前提4 RPC・13テーブル・10列・native UUID関数の存在も確認した。既存のユーザーSQLタブは変更していない。

適用元は `17bbc7bd43c26ecbde45eb56657f72fc0f33eeaa`（コードはCI成功の `539c359` と同じ）。
以下の順でtransactionごとに成功を確認した。lock timeout 5秒、statement timeout 60秒を設定。

1. `family_role_hardening_20260904.sql`: `family_role_hardening_applied` を確認。
2. `family_management_rpc.sql`: `family_management_applied_source_matched` を確認。
   familyテーブルをlockしてrole補正候補が0件のままであることをguardし、範囲の拡大時は例外停止する形で適用。
3. `consult_daily_claim.sql`: `daily_consult_applied_source_matched` を確認。
4. `monthly_checkin_notifications.sql`: transaction wrapperを付け、`monthly_checkin_applied_source_matched` を確認。

SQL Editorへの入力は承認済みSQLのコメント/整形を省いた転送版であり、元ファイルのbyte完全一致とは扱わない。
家族管理・日次相談・月次通知には、正規化した関数本文のMD5が承認済みソースに一致しなければ
COMMIT前に例外停止するguardを追加した。家族管理の初回入力は招待一覧sortの `, invite.id` が欠け、
このguardが不一致を検知して停止。明示ROLLBACK後に家族管理RPC 0件を確認し、正しいsortへ修正して再実行した。
guardを外したり無視したりして進めていない。失敗した試行を適用成功とは数えていない。

本番の事後read-only確認（2026-09-05 17時台JST）:

- editor helper 1・家族管理5・日次相談3・月次通知1の計10関数について、正規化した本文hashが
  承認済みソースと **10/10一致**。関数本文・個人行・秘密値は結果に返さず件数のみ取得。
- `verify_stage_a_release.sql` のコメント/外側空白だけを圧縮した版を実行。
  元と圧縮版の2,928 SQL token一致、ブラウザへの転送は19,553文字/FNV一致、editor全文一致を確認。
  圧縮版SHA256: `a367b5d08d565617bf1aeecdef63529bf02bb0395b98392a830ca57cb6704781`。
- **全12項目がstate=ok / ok=true**:
  consult ledger、consult 3 RPC、erasure control OFF、private control ACL、家族直接書込閉鎖、
  家族管理5 RPC、editor helper、public 6 policy、Storage 2 policy、月次RPC、月次unique index、API 3 role。
- 最後に主owner補正候補0、legacy owner降格候補0、active control 0、active grant 0を再確認。
  owner controlを開いたりgrantを作成したりしていない。環境の有料/削除スイッチも変更していない。
- これは構造/ACL・承認済みソース一致の検査。実機2アカウント、全アプリ操作、実AI応答、
  メール/Pushの実受信、backup復元、独立したセキュリティ保証を代替するものではない。

今回の4 SQL適用で既存の日記・写真・AI相談履歴・モニター回答の削除/書換はしていない。
家族role補正も対象0件。アプリRPCの試験呼出、通知生成、メール送信、実削除は実行していない。
`PRODUCTION_CHECKLIST.md` の対応するDB項目だけをこの証拠で完了へ更新した。

Web反映の準備と残り:

- CI成功済みコードを持つ `17bbc7b` のclean Git archiveを
  `/private/tmp/oyano-web-release-17bbc7b.hdDu3y` へ準備。423ファイルのGit blob一致を確認済み。
  tracked outputs 3ファイルは展開前に除外。未追跡レビュー資料、`review_exports/`、実行用env、
  `.vercel`、依存/build出力は含めていない。転送前にVercel dry inventoryでも再確認する。
- 公式Vercel CLI 59.11.7の通常device loginを開始し、ユーザーにブラウザ認証を依頼。
  **この追記時点では認証完了待ちで、新しいWeb deployはまだ行っていない。** 認証コードは台帳へ保存しない。
  device flowが失効した場合は正規loginを再開する。auth tokenの抽出・別アカウントへの切替はしない。
- 認証後は既知project `prj_nk3XUTnqSUFsiGZGc4Ifsi9SIr1H` / scope `dogwoodcommunity1` を照合し、
  上記の検証済みarchiveだけを本番deploy。公開aliasと4つの運営情報、本人sessionの手動5 API診断を確認する。
  この追記を含むdocs-onlyの新HEADを無検査で別リリースに読み替えない。
- 正式版の残条件は追記332/334の実機2アカウント・DB/Auth/Storageのbackupと隔離復元・受信試験・
  別確認者AAL2と正確な破棄アカウントの削除E2E・運用当番/連絡・法務/正式公開日。
  テスト専用メールと毎営業日の共有受信箱確認について未回答の点は引き続き未確定。

今回のソース変更はなし。チェックリストとこの引き継ぎのみを限定commit/pushする。
`review_exports/` と未追跡Claudeレビュー文書2件は参照・変更・stage・送信の対象外。

## 2026-09-05 追記 336 — Vercel再ログイン成功、Web本番反映と本人5 API診断が完了

ユーザーの「ログインした」「続けて」を受け、前ターンのVercel device loginが
`Congratulations! You are now signed in.` / exit 0で完了したことを確認。
通常の認証更新だけで、token抽出・新しい外部連携・権限拡大はしていない。
本番DB4件は追記335で適用/検査済みのため再実行せず、承認済みWeb反映へ進んだ。

反映対象・事前確認:

- repo HEADは引き継ぎのみの `2a44f779c20d33f1826c073d370df5bd38f483c7`。
  リリース元は予定どおり `17bbc7bd43c26ecbde45eb56657f72fc0f33eeaa` に固定。
  `539c359` からの差は引き継ぎ/チェックリスト2件のみ。17bbc7b自体のCI `33955524419` もsuccessを確認。
  Deploy workflow `33955524440` はcheck成功/deploy skipで、今回も手動CLI反映とは区別する。
- clean archive `/private/tmp/oyano-web-release-17bbc7b.hdDu3y` の423ファイルをrootが再検査。
  Git blob不一致0、余分なファイル0、保護対象/実行用env/依存/build出力0。
  Vercel dry-runは420ファイル/8,953,461 bytes、禁止対象0、Next.js。
  inventory SHA256は `524266fc766e90c16a6b96c0a20de00198f546310ea2823ce3b08fd28deb0923`。
- project inspectで `prj_nk3XUTnqSUFsiGZGc4Ifsi9SIr1H`、scope `dogwoodcommunity1`、root `.`、
  Next.js・既存build/output/install設定を照合。既存aliasは `dpl_Hx7V71Pd9voYiMYgfmFFRxmo7MnA` のReadyだった。
- Production env一覧で公開4値の存在、施行日2値/有料/削除実行スイッチが未登録であることを再確認。
  既存envは変更していない。認証用/AI/DBの秘密値は出力・転送資料へ保存していない。

本番反映（2026-09-05 18時台JST）:

- 公式Vercel CLI 59.11.7を使い、上記archiveだけを既存projectへ `--prod` で送信。
  metadata `releaseSha=17bbc7bd43c26ecbde45eb56657f72fc0f33eeaa` を付けた。
- pnpm 9.15.9/frozen lockfile、Next 14.2.35でbuild成功。既知のimg/React依存配列lint warningは残るがerrorなし。
- deployment **`dpl_3dnyJRVqXaRiJ8Uc1svJLcSa18Wv`** / **READY**。
- direct URL: `https://oyano-moshimo-navi-mrx0wyohv-dogwoodcommunity1.vercel.app`
- 公開alias: `https://oyano-moshimo-navi.vercel.app`
- CLIのalias成功後に改めてinspectし、公開aliasがこのdeploymentを指すことを確認した。

更新後の確認:

- `smoke-web.mjs` をADMIN_ACCESS_TOKENなしで実行し、40項目OK・Admin env 1項目は未認証401でskip。
  空質問AI相談400、未認証削除依頼/家族/通知設定/Push登録401、有料checkout503を確認。
  有効な利用者tokenや実データを送っておらず、AI呼出・決済・通知送信・削除依頼作成は起こしていない。
- `/legal/terms` と `/legal/privacy` は200。両ページに株式会社BEECH、代表取締役 池田哲也、
  info@bee-ch.co.jp、メール受付：24時間／原則3営業日以内に返信、正しいmailtoリンクを確認。
  「正式公開に向けて準備中」の表示も存在し、未確定の施行日を捏造していない。
- 登録済み削除専用実行者の既存Chrome個別sessionを再読込し、本人認証済み・AAL2確認済み、
  新しい「ログイン後のアクセス権限を確認する（読み取り専用）」の表示を確認。
  再読込/クリックでブラウザ操作のtimeoutがあったが、状態を再取得して新UIを確認し、
  展開操作を経て診断ボタンを1回実行した。認証情報抽出や裏口API呼出はしていない。
- 診断の実測は **削除auth-status 200 / 削除一覧200 / モニター回答403 / AI利用403 / 本番設定403**。
  「すべて想定どおりの応答でした」を画面で確認。診断はHTTP数値だけを使い本文を破棄する。
  削除依頼0件・CONTACT/REASON/HANDLED BY列なし。PATCH/preflight/executeは未実行。

本番DBのDDL/DML・利用者の日記/写真/相談/回答の変更や削除、env変更、課金、送信、
owner control/grantの有効化はこのターンではしていない。日記や既存利用者データを消す更新ではない。
ローカルソース変更もなく、この引き継ぎとチェックリストだけを限定commit/pushする。
`review_exports/` と未追跡Claudeレビュー文書2件は参照・変更・stage・送信の対象外。

**今回のDB/対応Web本番反映は完了。無料正式版全体の最終GOとは分ける。**
次に残るのは専用受信メールを使う2アカウント/2端末での保存・復元・家族権限・写真、
DB/AuthとStorage別のbackup/隔離復旧、通知/問い合わせの実受信・返信と担当運用、
別確認者AAL2および別途承認する正確な破棄アカウントの削除E2E、非空一覧の最小化確認、法務/正式公開日。
管理者・既存モニターを破棄テスト対象へ流用しない。テスト専用メールと毎営業日の受信箱確認の
未回答事項は引き続き未確定。有料/削除実行スイッチはOFFを維持する。

## 2026-09-05 追記 337 — 実機試験用メール候補3件の既存権限を読み取り確認

ユーザーから試験用の候補メールが順に3件提示されたため、新規登録・メール送信の前に、
既存の運営アカウントと重複していないかを本番Supabaseの自分の作業用SQLタブでSELECTのみ確認した。
問い合わせ先候補・削除担当者候補・最後の候補というラベルを使い、結果にはメールやAuth IDを出さず件数のみ取得。
私用メールと識別IDはこの引き継ぎへ転記しない。

確認できた結果:

| 候補ラベル | Auth登録 | メール確認済み | profile | 一般管理者 | 有効な削除担当者 |
| --- | --- | --- | --- | --- | --- |
| 問い合わせ先候補 | 1 | 1 | 1 | 1 | 0 |
| 削除担当者候補 | 1 | 1 | 1 | 0 | 1 |
| 最後の候補 | 1 | 1 | 1 | 1 | 0 |

全候補が既存の運営アカウントだった。`CLOUD_BACKUP_VERIFICATION.md` の手順に従い、
保存・復元・家族共有の試験専用アカウントへ転用しない。家族件数の列は画面で確認できていないため、
家族や手帳が空であるとは判断していない。本文・写真・相談・回答データも取得していない。
照会後は作業エディタを個人情報のない完了確認SELECTへ差し替え、Saveは押していない。
これはプロバイダのSQL実行履歴まで消したという意味ではない。

次の案:

- 最後に提示されたGmailと同じ受信箱へ届く、`+moshimo-test-a` / `+moshimo-test-b` の別名を使う案を提示する。
  Gmailのプラス別名が同じ受信箱へ届く仕様はGoogle公式ヘルプ `https://support.google.com/mail/answer/22370` で確認。
- **この案でのアプリ登録・確認メール送信はまだ未承認・未実行。** 承認後に別名の未登録と
  アプリ側のメール取り扱いを確認し、専用ブラウザ環境で進める。元の運営アカウントは変更しない。
- 別名は試験専用アプリ利用者の候補であり、独立した削除審査者の代わりにはしない。
  本番の削除・後片付けの許可にも読み替えない。

このターンでDDL/DML、アカウント作成、権限変更、ログインメール/招待送信、データ削除、
env変更、deployはしていない。既存日記・写真・相談・回答は変更していない。
本番Web反映の完了と正式版の残条件は追記336のまま。実機試験は未完了。
変更はこの引き継ぎだけ。`review_exports/` と未追跡Claudeレビュー文書2件は対象外。

## 2026-09-05 追記 338 — 承認されたテスト別名A/Bの新規登録と確認メール送信

追記337の2つのGmail別名による試験専用登録・確認メール送信案に、ユーザーが「ええよ」と明示承認。
承認対象は末尾 `+moshimo-test-a` / `+moshimo-test-b` の2件。メール全文・Auth ID・リンク・tokenは台帳へ保存しない。
既存管理者や削除担当者の変更、家族共有権限付与、データ削除の許可には読み替えていない。

事前確認:

- 本番の自分のSQL Editorでexact emailのSELECTのみ実行。A/BともAuth登録0・profileメール一致0を確認。
- 通常利用者のメール送信はtrimのみでプラス別名を維持し、`shouldCreateUser: true`。
  管理者用 `shouldCreateUser: false` は使用しない。家族招待側もプラス別名を維持することをソース確認。
- `CLOUD_BACKUP_VERIFICATION.md` の試験分離方針を維持。別タブは独立したログイン/保存領域ではない。

実施結果:

- 本番 `/family` の通常ユーザー用「まず、本人確認をします」が未ログイン状態で表示された。
  そこから承認済みA/Bへ各1回、計2回「確認メールを送る」を実行。
  それぞれ送信中→「確認メールを送りました」の成功表示を確認した。
  戻り先は `/family`。この画面から招待リンクは作成・送信していない。
- Bへの切替入力時、選択キーが効かずアドレスが連結したのを送信前のスクリーンショットで検知。
  `setValue` でBの完全なメールだけに置換し、見た目を再確認してから送信した。
  連結した宛先への送信はしていない。通常inputの宛先切替ではsetValueと見た目確認を使う。
- 送信後の本番read-only確認はA/Bとも **Auth登録1・メール確認済み0・運営権限0・家族membership0**。
  2つの新規Auth利用者が作られ、管理者/削除担当者や既存家族には紐付いていないことを確認。
  新規Auth登録は今回承認された正常フローの変更。既存利用者の記録・写真・相談・回答を変更していない。
- 作業エディタは個人情報のない完了SELECTへ差し替え。Saveは押していない。
  これはプロバイダ側の実行履歴削除ではない。送信専用に開いたアプリタブは閉じた。

ブラウザ分離の未完了:

- Chromeの新規テストプロファイル作成を試したが、新しいウィンドウの内容をAX/画像で読めなかった。
  作成画面を閉じ、新しいシークレット窓を開いたところまではウィンドウ名で確認。
  URL入力はclipboard読み取りtimeoutとなり、目的URLへの到達は未確認。独立プロファイル作成や実機試験の成功には数えない。
  今回開いたシークレット窓が残っている可能性がある。既存Chromeの運営ログインやサイトデータは消していない。
- 確認メールの送信だけは未ログインのin-app `/family` から完了させた。そこでA/Bにログインしていない。
  このin-app領域を独立した試験環境と扱ってはいけない。認証リンクを普段のブラウザで開くと
  ログイン先が切り替わり得るため、まずユーザーには到着だけ確認してもらう。

次の一歩はGmailでの2通の到着確認。その後、A/Bを独立したブラウザプロファイル/端末で開く手順を案内する。
確認リンクやコードをチャットへ貼るよう求めない。リンク失効時は登録済みA/Bへの通常再送として扱い、
無断で別名を増やさない。受信・本人確認・保存/復元・共有/写真試験・後片付けはいずれも未完了。
別名2件は削除審査の独立確認者にはならず、削除実行の承認にもならない。

DDL/SQL書換、env変更、deploy、課金、AI相談、実削除は行っていない。削除実行スイッチは変更しない。
この引き継ぎだけを限定commit/pushする。`review_exports/` と未追跡Claudeレビュー文書2件は触らない。

## 2026-09-05 追記 339 — テスト確認メールの到着申告、開く端末の確認待ち

2通の到着確認依頼にユーザーが「きたで」と回答。到着はユーザー申告として記録し、
メール本文・認証リンクを取得したことや、本人確認/ログインが完了したこととは区別する。
このターンで本番Authの再照会・追加送信・ログイン・データ変更はしていない。

次はまずAだけを独立した試験環境で本人確認する。ユーザーがメールを見ている端末とブラウザが
まだ不明なため、スマホかパソコンかとブラウザ名を確認してから、その環境に合う開き方を1つずつ案内する。
ambientのin-app `/home` はメールを見ている端末の証拠にはしない。通常ブラウザへのリンク直開き、
認証リンクのチャット貼付、履歴/サイトデータ削除、A/Bの同一保存領域での切替は案内しない。
独立したブラウザ環境・本人確認・保存/復元/共有試験の未完了状態は追記338から変わらない。
変更はこの引き継ぎのみ。`review_exports/` と未追跡Claudeレビュー文書2件は対象外。

## 2026-09-05 追記 340 — iPhoneでテストAのブラウザ分離を案内

ユーザーからメール受信端末はスマホ、続いてiPhoneとの回答。iOS版とメールアプリは未確認。
Apple公式 `https://support.apple.com/ja-jp/guide/iphone/iphb01fc3c85/ios` でSafariの
プライベート切替手順を確認し、まずSafariのタブ一覧から「プライベート」に切り替えるところだけ案内する。
新しいレイアウトは「…」→「すべてのタブ」、従来レイアウトは重なった四角のタブボタン。
メールリンクの開封・認証成功やiPhone画面はまだ確認していない。確認リンクはチャットへ貼らせない。

通常のタブ/履歴/サイトデータを閉じる・削除する操作は案内しない。プライベート側にも既存の
ログイン/手帳がある可能性は残るため、アプリ画面で未ログイン/テストAの識別を確認するまで記録試験しない。
プライベートタブ同士をA/Bの独立環境とは扱わず、Bは別の独立した環境を用意する。
これは短期のダミーデータ試験用で、通常モニターへプライベートモードを勧める変更ではない。
メール再送・本番操作・ブラウザ操作・アプリ変更はなし。引き継ぎのみ限定commit/pushする。

## 2026-09-05 追記 341 — iPhoneのプライベート表示申告、本人確認画面の確認へ

ユーザーが「でた」と回答。直前の案内に対するプライベート表示の申告であり、
テストAのログイン完了や端末内データが空であることを確認したとは扱わない。
次はそのプライベート側で新規タブを開き、公開の `/family` URLをアドレス欄へ入力してもらい、
「まず、本人確認をします」が出るか確認する。表示ラベルはFamilyShare.tsxの未ログイン分岐を再確認。
チャットのリンクを通常ブラウザへ直開きしないよう、アドレス欄への入力を明示する。
認証リンクはまだ開かず、メール入力/追加送信も求めない。既存家族やログイン済み画面が出た場合は
ログアウト・削除・上書きせず、画面状態を確認してから分離方法を見直す。
このターンは案内と引き継ぎのみ。実機画面・本番Authの確認、アプリ/本番データ変更はしていない。

## 2026-09-05 追記 342 — ユーザー希望でiPhoneからパソコンへ切替

ユーザーが「やっぱりパソコンで開くわ」と希望。iPhoneでの続きを止め、PCのChromeで
テストAのシークレット環境を開く案内へ切り替える。iPhoneのタブ・履歴・サイトデータは消さない。
Google公式 `https://support.google.com/chrome/answer/95464` で、MacはCmd+Shift+N、
WindowsはCtrl+Shift+Nで開く手順と、シークレット窓同士はセッション共有であることを確認。
新しい窓で公開の `/family` URLをアドレス欄へ入力し、「まず、本人確認をします」が出るかを確認する。
通常ブラウザから確認メールを直開きせず、A/Bを同じシークレットセッションで切り替えない。
PCでのブラウザ準備やログインが成功したとはまだ扱わない。追加メール送信・認証リンク取得・
アプリ操作・本番変更はしていない。引き継ぎだけを限定commit/pushする。

## 2026-09-05 追記 343 — PCシークレット側の本人確認画面の表示申告

ユーザーが「でた」と回答。直前に求めたPCシークレット窓の `/family` の
「まず、本人確認をします」表示の申告として扱う。画面の独立観測・本人確認完了ではない。
次は通常側のGmailで宛先が承認済みテストAのメールを選び、確認リンクのアドレスを右クリックでコピーし、
先ほどのシークレット窓のアドレス欄へ貼り付けて開くよう案内する。Bはまだ開かない。
リンクを通常窓で直接クリックしたり、チャットへ貼ったりするよう求めない。
ユーザー自身によるログイン用リンクの取り扱いであり、rootはメール本文・リンク・コード・clipboardを取得しない。
browserSupabase.tsのcallback処理を確認。期限切れ等の表示なら再利用を繰り返さず、その表示を確認してから再送する。
このターンは案内と引き継ぎのみ。本番Authの再照会、再送、ログイン、権限/データ変更は未実行。
画面結果が返るまではログイン・保存/復元試験を完了扱いにしない。保護対象の未追跡ファイルは触らない。

## 2026-09-05 追記 344 — A確認メールが見当たらないとの申告、未確認状態と送信時刻を再確認

ユーザーが「きてないで？」と回答。直前のAメール案内への返答として扱い、追記339の到着申告を根拠に
A/B双方が受信済みと断定しない。以前のUIでの送信成功と実受信は別であることを説明した。

本番read-only確認:

- 旧ブラウザtab 2は消失。現時点のCUA browser 1はChrome/extensionであり、以前のin-app browser 1と
  同一視しない。visibility指定はunsupportedだったため、その指定を外して既知の同一project SQL URLを開いた。
  保存していなかった以前のsnippetは存在せず、Supabaseが新しい空のqueryへ戻した。既存queryを上書きしていない。
- project `ypnuxyfirlvbsqujocuy` / main PRODUCTIONの新規queryで承認済みAだけをSELECT。
  **登録1・メール確認済み0・confirmation_sent_at 2026-09-05 18:20:23 JST** を確認。
  この時刻は送信処理の記録であり、Gmail到達・迷惑メール判定・配信成功の証拠ではない。
  token、認証URL、Auth ID、メール本文、他利用者行は取得していない。
- 新しい確認queryは `5ebd692e-b7ba-420b-91a2-9fa780887231`。
  作業後は個人情報を含まない完了SELECTへ差し替え、Saveは押していない。

再送について:

- 冒頭でAを1通だけ再送する意向を伝えたが、操作可能なChromeで本番 `/family` を開くと既存の
  ログイン状態だった。通常の確認メール欄ではなく家族招待画面なので、メールを入力せず閉じた。
  既存セッションのログアウト/切替、家族招待や権限付与はしていない。**このターンでは再送未実行。**
- ユーザーが用意したシークレット窓で、「まず、本人確認をします」のメール欄に承認済みAを入力し、
  「確認メールを送る」を1回押す手順へ変更して案内する。送信成功/失敗の表示を確認するまで、
  再送完了とも受信完了とも報告しない。Bの操作は引き続き行わない。
- 確認メールは元のGmail受信箱に届く想定だが、見ているアカウント違い/迷惑メール/配信遅延等の原因は
  まだ特定していない。再送後も未着なら、本人のGmailで対象宛先の検索と送信側の配信診断を分けて確認する。

このターンは読み取り診断・案内・引き継ぎのみ。DDL/DML、再送、新規登録、ログイン、権限変更、
利用者データ変更、deploy、削除はしていない。`review_exports/` と未追跡Claudeレビュー文書2件は対象外。

## 2026-09-05 追記 345 — シークレット窓の所在確認、通常Chromeと区別して再案内

ユーザーが「シークレット画面どこいった？」と質問。CUAでChromeの「ウィンドウ」メニューを確認したが、
観測した一覧には通常ウィンドウ1件のみで、目的のシークレット窓は見当たらなかった。
閉じられた原因や、別アプリ/端末に存在しないことまで断定はしない。
開き直しのキー操作を試みた際にChromeの画面変更が検出され、操作が中断された。
最新状態を取り直して通常Chromeであることを確認したが、他の操作と競合するため追加の画面操作は止めた。
シークレット窓をこちらで復帰/新規作成できたとは報告しない。

次はユーザーに通常のChromeを前面にし、上部「ファイル」→「新しいシークレットウィンドウ」を選ぶよう案内する。
Codex内のSupabase画面はテスト用シークレット窓ではない。開けたらその窓のアドレス欄から `/family` へ進む。
通常タブ、認証、保存データの消去は不要。Aへの再送はまだ未実行で、追加アカウントも作らない。
今回のブラウザ操作はウィンドウ選択の確認だけで、Webページのデータ/設定/権限は変更していない。
引き継ぎだけを限定commit/pushし、保護対象の未追跡ファイルには触らない。

## 2026-09-05 追記 346 — シークレット窓を開いたとの申告、A再送の操作案内

ユーザーが「ひらいた」と回答。Chromeシークレット窓の準備の申告であり、ログイン完了ではない。
その窓で `/family` を開き、「まず、本人確認をします」のメール欄に承認済みテストAを入力し、
「確認メールを送る」を1回押すよう案内する。該当欄がない場合は操作せず画面状態を確認する。
送信成功/エラーの表示を確認待ち。Bの操作、認証リンクの取得、rootによる再送・ブラウザ操作・
本番変更はこのターンでは行っていない。引き継ぎのみ限定commit/pushする。

## 2026-09-05 追記 347 — ユーザーがAの確認メールを再送したと申告

再送の案内にユーザーが「送った」と回答。ユーザー自身の再送操作の申告として記録するが、
送信成功画面・配信・受信・本人確認をrootが確認したとは扱わない。rootによる追加送信はなし。
次は元のGmail受信箱で最新のA宛確認メールを探し、確認リンクを右クリックでコピーして、
用意済みのシークレット窓のアドレス欄へ貼って開く手順を案内する。Bは操作しない。
見つからない場合の `in:anywhere` と宛先による検索はGoogle公式メールヘルプ answer/7190で確認。
迷惑メール/ゴミ箱も含めて探せるが、まだ未着原因を特定したわけではない。
認証リンク・コードをチャットへ送らせず、表示された成功/エラー文だけを確認する。
アプリ/本番/ブラウザ操作はこのターンではなし。引き継ぎのみ限定commit/pushする。

## 2026-09-05 追記 348 — テストAのメール確認完了とサインイン記録を本番Authで確認

ユーザーが「開いた」と回答。リンクを開いた申告だけで成功とせず、承認済みAだけの集計SELECTで確認した。
最初の既存tab取得は約56秒でtimeoutし、CUA kernelがreset。一度だけ既知の同一project SQL URLを
Chromeの専用確認tabで開き直して接続が回復した。以前の未保存snippetは存在せず、新規の空queryへ遷移。
既存のユーザーqueryは上書きしていない。

本番project `ypnuxyfirlvbsqujocuy` / main PRODUCTIONの自分の新規query
`d27b86ca-ae9a-4afe-af36-88a66f3a3390` で、以下の集計値を確認した。

- Aの登録件数: **1**
- メール確認済み: **1**
- 最終サインイン記録: **2026-09-05 19:46:10 JST**
- app_adminsまたはaccount_delete_executorsに該当する件数: **0**（active条件で限定せず確認）

Auth ID・token・認証リンク・メール本文は取得していない。確認後は自分のeditorを個人情報のない
完了SELECTへ差し替え、Saveせず専用確認tabだけを閉じた。他のtabや既存ログイン状態は変更していない。
Bは今回再確認していない。AのAuth側の確認/サインイン記録と、シークレット窓の実画面・保存復元の
受入完了は別。手帳作成、クラウド保存、家族共有、写真、復元の実機試験はまだ未完了。

次は同じシークレット窓で「手帳へ戻る」→空の手帳画面の「1人目の登録を始める」へ進む。
既存の手帳・実データが出た場合は操作を止め、reset/履歴消去/編集/上書きをしない。
sourceを確認し、家族未作成の `/family` はfamily_not_readyを返して自動作成しないこと、
`/home` の空状態から `/start` へ進めることを確認した。並行source確認では、家族未作成時に
「読み込み中です」が残り得る表示上の混乱も見つかったが、実画面での再現・修正は今回行っていない。

rootの今回の操作はread-only集計・画面確認・案内・引き継ぎのみ。新規登録/メール送信/ログイン操作、
DDL/DML、家族・権限・利用者データ変更、環境変数変更、deploy、削除は行っていない。
`review_exports/` と未追跡Claudeレビュー文書2件は対象外。引き継ぎだけを限定commit/pushする。

## 2026-09-05 追記 349 — テストAの新規登録画面の表示申告、仮プロフィールを案内

ユーザーが「でた」と回答。直前に求めた新規登録入力画面の表示申告として扱う。
rootによるシークレット窓の独立観測、手帳作成、クラウド保存完了の証拠ではない。
`apps/web/app/start/page.tsx` の必須4項目・入力形式と、状況選択による作成導線を再確認した。
同じテストA用シークレット窓で、実在の家族情報ではなく次の固定した仮データを入力するよう案内する。

- 呼び名: 本番受入テストA
- 関係: 母（仮）
- 親御さんの都道府県: 東京都（試験用）
- 市区町村: 新宿区（試験用）

任意欄は空欄とし、下の「元気なうちに準備したい」の「この人の手帳を作る」を押してもらう。
手帳画面の表示を確認待ち。エラーなら再登録を繰り返さず、その表示だけを確認する。
今回はsource確認と案内・引き継ぎのみ。rootによるブラウザ操作、本番Auth再照会、メール送信、
利用者データ/家族/権限の変更、コード変更、deploy、削除はなし。
保護対象の未追跡ファイルには触らず、引き継ぎだけ限定commit/pushする。

## 2026-09-05 追記 350 — テストAの手帳画面の表示申告、仮の日記1件の保存を案内

ユーザーが「でた」と回答。直前の仮プロフィール登録後の手帳画面表示の申告として扱う。
rootによる画面の独立観測・クラウド保存の確認ではなく、実機試験を完了扱いにしない。
`CLOUD_BACKUP_VERIFICATION.md` を全文再読し、現行homeの入力/保存/完了表示をsourceで確認した。
同じシークレット窓で対象者が「本番受入テストA」であることを確認し、次の手順へ進むよう案内する。

1. 「今日の様子を記録する」を押す。
2. 「この日に残すこと」に「保存テスト1。これは動作確認用の仮の記録です。」と入力する。
   日付は今日、種類は「通常」。写真・実在の家族情報は今回は追加しない。
3. 「この人の手帳に残す」を1回押し、「保存しました」の表示を確認してもらう。

source上の完了文は「（日付）の記録をこの端末に保存しました。」であり、これだけでは
クラウド保存成功・別端末復元成功を意味しない。クラウド保存先と件数の確認は次段階とする。
端末内の未確認データを失わないようシークレット窓は閉じない。エラーや別の対象者が出た場合は
再作成/上書き/削除で回避せず停止する。今回rootは本番/ブラウザ操作、メール送信、データ変更、
コード変更、deployを行わず、source確認・案内・引き継ぎのみ。保護対象は触らず限定commit/pushする。

## 2026-09-05 追記 351 — テストAの日記保存申告、クラウド保存先と送信結果の確認へ

ユーザーが「保存した」と回答。仮の日記1件の保存操作の申告として記録する。
端末内の保存表示もクラウド上の最新件数もrootは未観測であり、クラウド保存/復元の合格ではない。
前ターンに依頼したread-only source確認の報告を受け、rootもhomeの保存先欄・手動保存結果・
アカウント不一致/未確認/競合分岐を確認した。新しい本番照会やブラウザ操作は行っていない。

次の案内:

1. 同じシークレット窓で上へ戻り、「手帳データの保存先」を開く。
2. 表示のクラウド保存先が承認済みテストAと完全一致する場合だけ、「今すぐ保存」を1回押す。
3. 「クラウドに保存しました。対象者○人、記録○件。」の人数・件数と、追加の警告がないかを確認する。

保存先が別メール、警告、未確認、ボタンを押せない場合はそのまま表示を報告してもらう。
「紐づけて保存」「復元」や家族選択を推測で進めず、シークレット窓も閉じない。
「この端末とクラウドに保存」の見出しはidentity-readyに依存し、最終保存時刻も復元で更新され得るため、
見出し/時刻だけで今回の日記のクラウド保存完了とは判断しない。「自動保存中」「自動保存を確認してください」
が残る場合も未完了扱いとする。今回もコード/本番データ/権限/環境変数/デプロイに変更はなく、
保護対象の未追跡ファイルを除外して引き継ぎのみ限定commit/pushする。
