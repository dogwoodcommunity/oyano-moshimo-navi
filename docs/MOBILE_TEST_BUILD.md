# Expo app test build checklist

家族3組テスト前に、Expoアプリを実機で確認するためのチェックリスト。

## 現在のアプリ定義

- App name: `親のもしもナビ`
- Slug: `oyano-moshimo-navi`
- Scheme: `oyanomoshimo`
- iOS bundle identifier: `jp.beech.oyanomoshimo`
- Android package: `jp.beech.oyanomoshimo`
- Version: `0.3.0`

## EAS Build前に必要な環境変数

Expo/EAS側に以下を設定する。

```txt
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_WEB_BASE_URL=https://oyano-moshimo-navi.vercel.app
EXPO_PUBLIC_APP_SCHEME=oyanomoshimo
EXPO_PUBLIC_EAS_PROJECT_ID=
```

`EXPO_PUBLIC_EAS_PROJECT_ID` はExpo Push通知で使う。Expo Project作成後に入れる。

## テストビルドで見ること

1. メールログイン画面で、要配慮情報の注意が読める。
2. Web診断の引き継ぎリンクからアプリを開ける。
3. Dashboardに「今日・期限超過」「7日以内」「担当未定」が出る。
4. Tasksで担当者を変更できる。
5. Familyで2名まで招待リンクを作れる。
6. Notificationsで端末通知を有効化できる。
7. Settingsからプライバシーポリシーを開ける。
8. アプリ内に外部決済CTAや「Webで申し込む」文言が出ていない。

## まだ本番前に詰めること

- App icon / splash image
- Apple Developer / Google Play Consoleの登録
- TestFlightまたはinternal distributionの配布経路
- アカウント削除導線の正式文言と問い合わせ窓口
- プライバシーポリシーURL、特商法表記、事業者情報の正式化

## コマンド

ローカル確認:

```bash
pnpm --filter mobile run typecheck
```

EAS preview build:

```bash
pnpm --dir apps/mobile exec eas build --profile preview --platform ios
pnpm --dir apps/mobile exec eas build --profile preview --platform android
```

Apple/Googleのアカウント設定が必要になるため、実行は外部アカウント準備後に行う。
