# ローカル開発手順

本番アカウント作成前でも、WebはlocalStorage、Expoはデモデータで主要導線を確認できる。

## 1. まず確認

```bash
node scripts/local-doctor.mjs
```

確認するもの:

- Web入口 `/start -> /diagnosis -> /result/[caseId]` の主要ファイル
- Expo継続アプリのdashboard/person/tasks
- Supabase SQL一式
- `.env.example`
- install済み依存

## 2. Webだけ起動

```bash
pnpm run dev:web
```

確認URL:

- `http://localhost:3000/start`
- `http://localhost:3000/diagnosis`
- `http://localhost:3000/admin`
- `http://localhost:3000/admin/env`

Supabase未設定でもWeb診断はブラウザlocalStorageに保存される。
`/admin` の「デモcaseを作成」から、診断フォーム入力なしで確認用caseも作成できる。

携帯から同じWi-Fiで見る場合:

```bash
pnpm run dev:web:lan
```

MacのIPを確認:

```bash
ifconfig | grep 'inet '
```

例:

```text
http://192.168.11.63:3000
```

3000番で古いサーバーが残っている場合は、どのプロセスが使っているか確認する。

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

## 3. Expoだけ起動

```bash
pnpm run dev:mobile
```

Supabase未設定時はデモログイン・デモデータで確認する。

## 4. Web smoke

Webをproduction build後に起動して疎通確認する。

```bash
pnpm --filter web run build
pnpm --filter web run start -- -p 3100
node scripts/smoke-web.mjs http://localhost:3100
```

## 5. Supabaseを後から足す場合

SQL Editorで以下の順に実行する。

1. `supabase/schema.sql`
2. `supabase/task_template_seed.sql`
3. `supabase/task_generation.sql`
4. `supabase/task_notification_generation.sql`
5. `supabase/product_seed.sql`
6. `supabase/indexes.sql`
7. `supabase/production_rls.sql`
8. `supabase/storage_setup.sql`
