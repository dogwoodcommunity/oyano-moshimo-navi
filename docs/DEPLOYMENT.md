# デプロイ手順

## Web: Vercel

GitHub repo作成後、Vercelでrepoをimportする。

推奨設定:

- Framework: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm --filter web run build`
- Output directory: `apps/web/.next`

必要な環境変数:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_ACCESS_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_SUPPORT_PACK_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
CRON_SECRET=
NEXT_PUBLIC_APP_SCHEME=oyanomoshimo
NEXT_PUBLIC_WEB_BASE_URL=
```

詳細は `docs/ENVIRONMENT_MATRIX.md` を参照。

Vercel Cronから `/api/cron/send-due-notifications` を実行する。HobbyプランではCron頻度に制限があるため、初期は1日1回で公開し、通知運用を始める段階でPro化または外部cronを検討する。`CRON_SECRET` を設定する場合、手動確認では以下のように叩く。

```bash
curl "https://<web-domain>/api/cron/send-due-notifications?cronToken=<CRON_SECRET>"
```

公開後の確認:

```bash
curl "https://<web-domain>/api/health"
```

主要ページ/APIの疎通確認:

```bash
node scripts/smoke-web.mjs "https://<web-domain>"
```

Admin env確認:

- `/admin/env`
- `ADMIN_ACCESS_TOKEN` 設定時は `/admin` または `/admin/env` のAdmin token欄に保存して確認する。

## Mobile: EAS

Expoアカウント接続後に以下を使う。ログイン情報が不明な場合は `docs/EXPO_ACCOUNT_RECOVERY.md` を先に確認する。

```bash
pnpm run eas:whoami
pnpm run eas:mobile:init
pnpm run eas:mobile:set-project-id -- <Expo Project ID>
pnpm run doctor:mobile-build
pnpm run eas:mobile:build:ios
pnpm run eas:mobile:build:android
```

必要な環境変数:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_APP_SCHEME=oyanomoshimo
EXPO_PUBLIC_WEB_BASE_URL=
EXPO_PUBLIC_EAS_PROJECT_ID=
```

詳細は `docs/ENVIRONMENT_MATRIX.md` を参照。

`SUPABASE_SERVICE_ROLE_KEY` はEAS/Expoには入れない。

## GitHub後回し時の注意

GitHub repoがまだない場合でも、ローカルgit commitは残っている。repo作成後にremoteを追加してpushする。

```bash
git remote add origin <repo-url>
git push -u origin main
```
