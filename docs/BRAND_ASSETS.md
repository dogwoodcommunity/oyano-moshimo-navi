# ブランド資産メモ

最終更新: 2026-07-06

## 方針

「親のもしもナビ」は、派手なAI風ビジュアルではなく、家族で落ち着いて確認できる公共サービス寄りの印象に寄せる。

- 色: 深い緑を基調に、生成感の強いグラデーションは避ける
- 形: 書類、確認チェック、家族の丸を組み合わせる
- 用途: Web入口、Expoアプリ、通知、スプラッシュで同じ記号を使う
- 印象: 高齢の家族にも不安を与えない、シンプルで読みやすい

## 生成元

ブランド画像は `scripts/generate-brand-assets.mjs` で生成する。

外部画像素材やAI生成画像に依存せず、Node.jsの標準機能だけでPNGを書き出す。再生成する場合は次を実行する。

```sh
node scripts/generate-brand-assets.mjs
```

## 出力ファイル

Expo:

- `apps/mobile/assets/icon.png`
- `apps/mobile/assets/adaptive-icon.png`
- `apps/mobile/assets/splash.png`
- `apps/mobile/assets/notification-icon.png`

Web:

- `apps/web/public/brand/logo-mark.png`
- `apps/web/public/brand/apple-touch-icon.png`

## 接続箇所

- Expo: `apps/mobile/app.json`
- Web metadata: `apps/web/app/layout.tsx`
- Web header mark: `apps/web/app/globals.css`
