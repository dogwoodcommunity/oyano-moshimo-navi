# Expo/EASログイン復旧メモ

2026-07-07時点で、Expoアカウント作成とEAS CLIログインは完了。

```bash
pnpm dlx eas-cli whoami
```

結果:

```txt
oyanomosimonavi
info@bee-ch.co.jp
```

## アカウント

- Expo公式: `https://expo.dev`
- Username: `oyanomosimonavi`
- Email: `info@bee-ch.co.jp`
- Project: `@oyanomosimonavi/oyano-moshimo-navi`
- Project ID: `8ed038b0-28d1-42e1-8ef6-e7e2098c11d3`

## ログアウトしていた場合

```bash
pnpm run eas:login
pnpm run eas:whoami
```

## Project IDを入れ直す場合

```bash
pnpm run eas:mobile:set-project-id 8ed038b0-28d1-42e1-8ef6-e7e2098c11d3
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

## 2026-07-07のbuild状況

- EAS preview environmentに公開envを設定済み。
- Android preview build初回 `c0a85205-81bd-4a26-a8e8-98cf0541b9ea` はGradleで失敗。
- 原因: `@react-native/gradle-plugin` がpnpm/monorepo構成でGradleから直接解決できず、`android/null` を参照した。
- 対応: `apps/mobile/package.json` に `@react-native/gradle-plugin@0.74.87` を明示依存として追加。
- Android preview build 2回目 `29f6229b-cce3-40bb-8e00-00b9972ecd6f` はJS bundleで失敗。
- 原因: Expo Router entry未設定と、pnpm/monorepo構成で `expo-asset` / `@babel/runtime` が直接解決できなかったこと。
- 対応: `main: "expo-router/entry"`、`expo-asset@10.0.10`、`@babel/runtime` を追加。
- Android preview build 3回目 `e2ea70af-9b0c-425d-b289-70459ffb16f0` はJS bundleで失敗。
- 原因: pnpm/monorepo構成で `@react-native/assets-registry/registry.js` が直接解決できなかったこと。
- 対応: `@react-native/assets-registry@0.74.87` をmobile dependenciesに追加。ローカルAndroid exportはOK。
- ローカル確認: `expo export --platform android` OK。
