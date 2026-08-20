# ブランド資産メモ

最終更新: 2026-08-20

## 方針

「親のもしもナビ」は、採用案3c「見守り鳥」を正式ロゴとして使う。派手なAI風ビジュアルではなく、家族で落ち着いて確認できる公共サービス寄りの印象に寄せる。

- 色: 帽子 `#4A8FA6`、輪郭・目 `#33424A`、くちばし `#E8A15D`
- 形: 円、上半円、角丸矩形だけで構成した見守り鳥
- 用途: Web入口、Expoアプリ、通知、スプラッシュで同じ記号を使う
- 印象: 高齢の家族にも不安を与えない、シンプルで読みやすい

ロックアップはマーク、12px空き、テキスト2行で使う。24px未満はロックアップではなくマーク単体にする。

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
- `apps/web/public/brand/pwa-icon-192.png`
- `apps/web/public/brand/apple-touch-icon.png`
- `apps/web/public/brand/favicon-32.png`
- `apps/web/public/brand/favicon-16.png`
- `apps/web/public/brand/watch-bird-mark.svg`
- `apps/web/public/brand/app-icon.svg`

## 接続箇所

- Expo: `apps/mobile/app.json`
- Web metadata: `apps/web/app/layout.tsx`
- Web header mark: `apps/web/app/globals.css`
