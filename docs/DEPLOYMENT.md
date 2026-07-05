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

Vercel Cronから `/api/cron/send-due-notifications` を30分ごとに実行する。`CRON_SECRET` を設定する場合、手動確認では以下のように叩く。

```bash
curl "https://<web-domain>/api/cron/send-due-notifications?cronToken=<CRON_SECRET>"
```

公開後の確認:

```bash
curl "https://<web-domain>/api/health"
```

Admin env確認:

- `/admin/env`
- `ADMIN_ACCESS_TOKEN` 設定時はブラウザlocalStorageに `oyano_admin_token` を入れて確認する。

## Mobile: EAS

Expoアカウント接続後に以下を使う。

```bash
cd apps/mobile
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

必要な環境変数:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_APP_SCHEME=oyanomoshimo
EXPO_PUBLIC_WEB_BASE_URL=
```

## GitHub後回し時の注意

GitHub repoがまだない場合でも、ローカルgit commitは残っている。repo作成後にremoteを追加してpushする。

```bash
git remote add origin <repo-url>
git push -u origin main
```
