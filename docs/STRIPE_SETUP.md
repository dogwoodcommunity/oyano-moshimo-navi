# Stripe setup for 発動サポートパック

本番で発動サポートパックを受け付けるためのStripe設定手順。

## 1. 商品を作る

Stripe Dashboardで商品を作成する。

- Product name: `発動サポートパック`
- Price: `9,800 JPY`
- Billing: one-time
- Tax: 初期テストではStripe Tax未設定でもよい。正式販売前に税込/税抜表示を特商法表記と合わせる。

作成後、Price IDを控える。

- 例: `price_...`
- Vercel env: `STRIPE_SUPPORT_PACK_PRICE_ID`

## 2. Secret keyを用意する

Stripe DashboardのAPI keysからSecret keyを控える。

- Test mode: `sk_test_...`
- Live mode: `sk_live_...`
- Vercel env: `STRIPE_SECRET_KEY`

ローカルやGitHubには保存しない。

## 3. Webhookを作る

Stripe DashboardのWebhookでEndpointを追加する。

- Endpoint URL: `https://oyano-moshimo-navi.vercel.app/api/stripe/webhook`
- Event: `checkout.session.completed`

作成後、Signing secretを控える。

- 例: `whsec_...`
- Vercel env: `STRIPE_WEBHOOK_SECRET`

## 4. Vercel環境変数

Vercel Project Settings -> Environment Variables に以下をProductionへ設定する。

```txt
STRIPE_SECRET_KEY=
STRIPE_SUPPORT_PACK_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
```

設定後、Production redeployが必要。

## 5. 確認すること

1. `/result/{caseId}` から「内容を確認して申し込む」へ進む。
2. `/support-pack?caseId={caseId}` で「申し込み画面へ進む」を押す。
3. Stripe Checkoutが開く。
4. テストカードで支払う。
5. Supabase `purchases` にStripe購入が保存される。
6. Supabase `support_packs.status` が `paid` になる。
7. `/admin/support-packs` で支払い済みを確認できる。

## 注意

- Expoアプリ内には外部決済CTAを置かない。
- アプリ内では発動サポートパックの購入導線を匂わせず、申込済み/レビュー中などの状態表示に留める。
- 法律、税務、医療判断の断定は商品範囲に含めない。
- 正式販売前に特商法表記、プライバシーポリシー、税込表示を最終確認する。
