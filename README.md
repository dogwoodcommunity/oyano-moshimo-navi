# 親のもしもナビ v0.3

Web入口 + Expo継続アプリの二段構えMVPです。

## 構成

- `apps/web`: Next.js入口、結果、管理画面、Web決済前提の発動サポート
- `apps/mobile`: Expo継続アプリ、ログイン、ダッシュボード、対象者、タスク、通知
- `packages/shared`: ステータス、診断ロジック、タスクテンプレート
- `supabase/schema.sql`: Web/App共通DBスキーマ

## 起動

```bash
pnpm install
pnpm run doctor:local
pnpm run dev:web
pnpm run dev:mobile
```

Supabaseを使う場合は各アプリに以下を設定してください。

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

未設定の場合も、WebはブラウザlocalStorage、Mobileはデモデータで主要導線を確認できます。

ローカルでの確認手順は `docs/LOCAL_DEVELOPMENT.md` を参照してください。
