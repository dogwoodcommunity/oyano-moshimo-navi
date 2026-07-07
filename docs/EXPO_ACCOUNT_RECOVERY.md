# Expo/EASログイン復旧メモ

2026-07-07時点で、EAS CLIは利用可能だがExpoには未ログイン。

```bash
pnpm dlx eas-cli whoami
```

結果:

```txt
Not logged in
```

## まず確認すること

- Expo公式: `https://expo.dev`
- 既存アカウントがある場合は、メールアドレスでログインまたはパスワード再設定。
- 分からない場合は、`dogwoodcommunity` または `BEECH` 管理用の新規Expoアカウントを作成する。

## 新規作成する場合のおすすめ

- 個人メールではなく、事業で継続管理できるメールを使う。
- 例: `info@...`、`admin@...`、または組織管理のGoogleアカウント。
- Apple Developer / Google Play Console と同じ管理者がアクセスできる状態にする。

## ログイン後にやること

```bash
pnpm run eas:whoami
pnpm run eas:mobile:init
```

`eas init` 後に表示されるExpo Project IDを、次のコマンドでローカルenvへ反映する。

```bash
pnpm run eas:mobile:set-project-id -- <Expo Project ID>
```

その後、確認する。

```bash
pnpm run doctor:mobile-build
```

## preview build

```bash
pnpm run eas:mobile:build:ios
pnpm run eas:mobile:build:android
```

## 注意

- `SUPABASE_SERVICE_ROLE_KEY` はExpo/EAS環境変数に入れない。
- Expoに入れるのはpublishableな値だけ:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_WEB_BASE_URL`
  - `EXPO_PUBLIC_APP_SCHEME`
  - `EXPO_PUBLIC_EAS_PROJECT_ID`
- アプリ内にはWeb決済やStripeへの誘導文言を入れない。
