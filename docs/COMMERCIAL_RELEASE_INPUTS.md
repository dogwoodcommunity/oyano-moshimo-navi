# 正式公開に必要な確定情報

最終更新: 2026-09-04
対象: 親のもしもナビ 無料Web正式版（Stage A）と、将来の有料受付（Stage B）

## 使い方

この文書は、コードから推測できない正式情報を、公開前に運営責任者と法務確認者が確定するための入力票である。
空欄や `要確定` を仮の値で埋めない。パスワード、API key、本人確認書類などの秘密情報は、この文書・Git・チャットへ記録しない。

## A. 無料Web正式版の公開前に必要

| 項目 | 確定値 | 完了根拠 |
| --- | --- | --- |
| サービス運営者の正式名称 | **株式会社BEECH** | 2026-09-04に運営者確認。公開前に登記情報等と最終照合 |
| 個人情報管理責任者の氏名または役職 | **代表取締役 池田哲也** | 2026-09-04に運営者確認。公開前に登記情報等と最終照合 |
| 利用者向け問い合わせ先 | **info@bee-ch.co.jp** | 2026-09-04に運営者確認。公開前に実際の受信・返信を確認 |
| 問い合わせ受付時間・一次返信目標 | **要確定** | 担当シフトを確認 |
| 利用規約の施行日 | **要確定** | 公開日と照合 |
| プライバシーポリシーの施行日 | **要確定** | 公開日と照合 |
| アカウント削除担当・代行者 | **要確定** | `COMMERCIAL_OPERATIONS_RUNBOOK.md` に記録 |
| 障害対応責任者・代行者 | **要確定** | 同上 |
| Supabase DB/Auth backup方式・保持期間 | **外部要確認** | 管理画面の設定と直近成功を記録 |
| Supabase Storage backup方式・保持期間 | **外部要確認** | object復元演習の結果を記録 |
| 実測RPO/RTO | **復旧演習後に確定** | 隔離環境の演習記録 |
| Vercel/Supabase/Cronの失敗通知先 | **外部要確認** | テスト通知の受信記録 |
| 生成AIへの送信範囲・委託先表示 | **法務確認待ち** | 現行画面と実装を照合 |
| 親本人以外が入力する要配慮情報の根拠 | **法務確認待ち** | 弁護士等の確認記録 |
| 利用規約・プライバシーの最終確認 | **未実施** | 確認者・日付・対象commitを記録 |

無料正式版で有料機能を提供しない間も、運営者、問い合わせ、保存・共有・AI・削除の説明は確定が必要である。

### 法務確認に使う一次資料

- [消費者庁「通信販売広告について」](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.html): 有料受付を開く前に、正式な事業者名、住所、電話番号、責任者、価格、支払・提供時期、解約・返金条件を実際の提供内容と照合する。
- [個人情報保護委員会「要配慮個人情報」FAQ](https://www.ppc.go.jp/all_faq_index/faq3-q2-4/): 病歴、身体状況、診療・介護関係記録を扱う同意、取得範囲、家族共有の根拠を確認する。
- [Anthropic「Commercial data and model training」](https://privacy.claude.com/en/articles/7996885-how-do-you-use-personal-data-in-model-training): API送信データの学習利用に関する表示と契約設定を照合する。
- [Anthropic「Commercial data retention」](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data): 標準保持期間と例外をプライバシー表示に反映する。

上記は実装時の確認元であり、法的助言の代替ではない。公開対象commit、実際の契約主体、利用している外部サービス設定を法務確認者が再照合する。

## B. 有料受付を開く前に追加で必要

以下はStage Aの公開条件ではない。すべて揃うまで `COMMERCIAL_SUPPORT_PACK_SALES_ENABLED` と
`COMMERCIAL_PLUS_SALES_ENABLED` は `false` のままにする。

| 環境変数 / 項目 | 確定する内容 | 状態 |
| --- | --- | --- |
| `LEGAL_BUSINESS_NAME` | 販売事業者の正式名称 | **株式会社BEECH（確定・本番環境への設定待ち）** |
| `LEGAL_RESPONSIBLE_PERSON` | 通信販売業務の責任者 | **代表取締役 池田哲也（確定・本番環境への設定待ち）** |
| `LEGAL_ADDRESS` | 特商法表示に用いる所在地 | **要確定** |
| `LEGAL_PHONE` | 特商法表示に用いる電話番号 | **要確定** |
| `LEGAL_PHONE_HOURS` | 電話受付時間 | **要確定** |
| `LEGAL_CONTACT` | 問い合わせメールまたはフォームURL | **info@bee-ch.co.jp（確定・本番環境への設定と受信確認待ち）** |
| `LEGAL_TERMS_EFFECTIVE_DATE` | 利用規約の施行日 | **要確定** |
| `LEGAL_PRIVACY_EFFECTIVE_DATE` | プライバシーポリシーの施行日 | **要確定** |
| `LEGAL_PRICE_DESCRIPTION` | 税込価格、課金周期、自動更新 | **要確定** |
| `LEGAL_SERVICE_DELIVERY` | 決済後の提供時期 | **要確定** |
| `LEGAL_CANCELLATION_POLICY` | 解約方法、更新停止時期、返金条件 | **要確定** |
| Stripe商品・Price・Webhook | test/liveを区別して設定 | **未設定扱い** |
| Billing Portalまたは自己解約導線 | 利用者自身で解約を完了できること | **未確認** |
| 決済・更新・失敗・解約・返金試験 | 本番相当環境で全経路を完走 | **未実施** |

## C. スマホアプリ公開前に追加で必要

| 項目 | 状態 |
| --- | --- |
| Apple Developer / Google Play Consoleの契約主体 | **要確定** |
| ストア表示名、説明、カテゴリ、年齢区分、サポートURL | **要確定** |
| iOS/Androidのプライバシー申告 | **実装確定後に作成** |
| Apple IAP / Google Play Billingの商品・税務・銀行設定 | **有料提供時のみ要確定** |
| TestFlight / 内部テストの担当者と端末 | **要確定** |
| アカウント削除、Magic Link、写真、通知の実機完走 | **未実施** |

## 公開判定の記録

- 対象commit: **要記入**
- 本番deployment ID: **承認・反映後に記入**
- Stage A判定: **NO-GO（上記未確定・未確認項目あり）**
- 判定者: **要指定**
- 判定日時: **要記入**
- 未完了項目と次回確認日: **要記入**
