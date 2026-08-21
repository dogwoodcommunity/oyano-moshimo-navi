# App内課金（IAP）の判断メモ

本体がアプリになったため、Plusをどこで売るかを決める必要がある。
これはコードより先に、事業と規約の判断が要る話なので、選択肢と条件を先に整理する。

## 前提: Appleの規約

iOSアプリの中で、アプリ内で使える機能（デジタルコンテンツ）のサブスクリプションを売る場合、
原則としてApp内課金（IAP）を使う必要がある。StripeなどのWeb決済をアプリ内から使うことはできない。

手数料は原則30%、Small Business Program（年間売上100万ドル未満）に登録すれば15%。
初年度から15%になるので、この規模なら実質15%と考えてよい。

「Webで契約してアプリで解放する」形自体は禁止されていない。禁止されているのは、
アプリの中からWeb決済へ誘導すること。アプリ内に「Webで契約できます」というリンクや
案内を置くと、審査で落ちる可能性がある（米国など一部地域では外部リンクの許可制度があるが、
日本のApp Storeでは条件が異なるため、当面は「アプリ内では触れない」のが安全）。

Google Playも同様の考え方だが、Appleより運用は緩い。

## 選択肢

### A. Webのみで売る（今の実装）

- 実装済み。`/plans` の `#plus` から Stripe の継続課金へ進む。
- 手数料は Stripe の 3.6% 程度のみ。
- アプリ内からは一切案内しない。利用者は自分でWebを開く必要がある。
- **弱点**: アプリが本体なのに、課金の入口がアプリの外にある。転換率は確実に落ちる。

### B. RevenueCat を入れる（推奨）

- iOS/Android のIAPを1つのAPIで扱える。サーバー側のレシート検証を自前で持たなくてよい。
- Webhookで `families.plan` を切り替えられる。**この受け口は実装済み**（`/api/revenuecat/webhook`）。
- 料金は月間追跡売上 $2,500 まで無料、超過分に対して従量。初期は実質無料。
- Appleの手数料15%は別途かかる。
- **必要な作業**:
  1. App Store Connect でサブスクリプション商品を作る（審査あり）
  2. RevenueCat のアカウントを作り、商品を紐付ける
  3. `react-native-purchases` をアプリに入れる（Expoの場合は development build が必要。Expo Goでは動かない）
  4. ログイン後に `Purchases.logIn(supabaseUserId)` を呼ぶ。これが webhook の `app_user_id` になる
  5. RevenueCat の Webhook に `https://<web-domain>/api/revenuecat/webhook` と `REVENUECAT_WEBHOOK_SECRET` を設定

### C. expo-in-app-purchases

- Expo公式だったが、現在は非推奨。新規採用は避ける。

## 実装済みの部分

課金の経路が増えても、**最終的にPlusかどうかを決めるのは `families.plan` の1か所**に保っている。

| 経路 | 受け口 | 状態 |
| --- | --- | --- |
| Web（Stripe） | `/api/stripe/webhook` | 実装済み。price ID未設定なら受付を開かない |
| iOS / Android（RevenueCat） | `/api/revenuecat/webhook` | 受け口は実装済み。アプリ側のSDKは未導入 |

RevenueCatのWebhookは、解約と期限切れを分けて扱う。解約直後はまだ期限まで使えるため、
`CANCELLATION` では失効させず、`EXPIRATION` または期限到来で `free` に戻す。

## 判断が必要なこと

1. **そもそも今Plusを売るか。** レビューで書いたとおり、「危機モードを開いた人が7日以内に2件目を書いた割合」が出る前に価格を決めると、売るものが決まる前に値段を決めることになる。`/admin/funnel` の数字を見てから決めるのが順当。
2. **売ると決めたら、B（RevenueCat）を入れるか。** 入れる場合、Expo Go では動かないため development build への移行が必要になる。
3. **価格。** `NEXT_PUBLIC_PLUS_PRICE_LABEL` と `STRIPE_PLUS_PRICE_ID`、App Store Connect の3か所で揃える必要がある。

## いま触ってはいけないこと

- アプリ内に「Webで契約できます」という案内を置くこと。審査で落ちる可能性がある。
  現在の `PlusUpgrade` の注意書きはWeb側の画面にのみ表示しており、アプリ側には入れていない。
