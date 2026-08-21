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

### 本番へ反映する3つの方法

1. **VercelのGit連携（推奨）**
   Vercelでrepoをimportしてあれば、`main` への push で自動的にproduction deployが走る。
   通常はこれだけでよい。反映されない場合は、Vercel > Project > Settings > Git で連携先ブランチを確認する。

2. **手動のGitHub Actions**
   `.github/workflows/deploy-vercel.yml` を Actions タブから手動実行する（pushでは動かない）。
   先に次のリポジトリシークレットを設定する。

   | Secret | 取得元 |
   | --- | --- |
   | `VERCEL_TOKEN` | https://vercel.com/account/tokens |
   | `VERCEL_ORG_ID` | `.vercel/project.json` の `orgId`、または Vercel の Settings |
   | `VERCEL_PROJECT_ID` | `.vercel/project.json` の `projectId` |

   デプロイ後に `scripts/smoke-web.mjs` が自動で走る。

3. **ローカルのVercel CLI**

   ```bash
   npx vercel login
   npx vercel --prod --yes
   ```

   `Not authorized` が出る場合はログインが切れている。`VERCEL_TOKEN` を環境変数に置いて
   `npx vercel --prod --yes --token=$VERCEL_TOKEN` でも通る。

反映が古いまま見える場合は、PWAのService Workerキャッシュが残っている可能性がある。
`apps/web/public/sw.js` の `CACHE_VERSION` を上げてから再デプロイする。

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
