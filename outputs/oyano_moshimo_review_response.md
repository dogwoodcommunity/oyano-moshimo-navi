# 外部設計レビューへの対応メモ

作成日: 2026年7月8日

## 結論

外部レビューのうち、以下は優先度高として採用する。

- 要配慮個人情報の同意設計
- service role / admin / cron APIの認可強化
- handoff tokenの短命化・一回限り化
- PMF前のネイティブ追加開発抑制

ただし、Expoアプリを即停止するのではなく、既存のExpo実装は検証用として維持し、今後の追加開発はWeb課金検証と家族テストを優先する。

## すぐ対応したもの

### 1. handoff token生成をcryptoベースへ変更

対象:

```txt
packages/shared/src/index.ts
```

変更前:

```txt
Math.random()
```

変更後:

```txt
globalThis.crypto.getRandomValues()
```

### 2. handoff tokenを短命・一回限りへ寄せた

対象:

```txt
apps/web/app/api/handoff/consume/route.ts
supabase/schema.sql
supabase/handoff_security_hardening.sql
```

変更内容:

- `case_results.app_handoff_consumed_at` を追加
- `created_at` が24時間以内のhandoffだけ受け付け
- `app_handoff_consumed_at is null` のhandoffだけ受け付け
- consume時に先に `app_handoff_consumed_at` を更新
- 二重consumeは409

注意:

既存本番DBには `supabase/handoff_security_hardening.sql` の投入が必要。

### 3. admin tokenをURL queryで受けないように変更

対象:

```txt
apps/web/lib/adminAuth.ts
```

変更内容:

- `?adminToken=` 受付を廃止
- `x-admin-token` headerのみ
- `crypto.timingSafeEqual` で比較

残課題:

静的 `ADMIN_ACCESS_TOKEN` はMVPとしては動くが、正式運用では管理者ごとの認証・監査ログ・ローテーションが必要。

### 4. cron tokenをURL queryで受けないように変更

対象:

```txt
apps/web/app/api/cron/send-due-notifications/route.ts
```

変更内容:

- `?cronToken=` 受付を廃止
- `Authorization: Bearer <CRON_SECRET>` のみ
- `crypto.timingSafeEqual` で比較

注意:

Vercel Cronなど、headerを付けられない実行環境を使う場合は、別の認証設計が必要。

## 追加対応したもの

### 5. 要配慮情報の同意記録をWeb診断に追加

対象:

```txt
apps/web/app/diagnosis/DiagnosisForm.tsx
apps/web/app/api/cases/[caseId]/diagnosis/route.ts
packages/shared/src/index.ts
supabase/schema.sql
supabase/sensitive_info_consent_hardening.sql
```

変更内容:

- Web診断送信時に、要配慮情報に該当し得ることの理解と、必要最小限の入力に関する同意を必須化
- API側でも `consentToSensitiveInfo` を必須チェック
- `cases` に `consent_to_sensitive_info`、`sensitive_info_consent_version`、`sensitive_info_consented_at` を保存
- `consent_logs` に同意種別、同意文言、IP、User-Agentを保存
- 同意文言を `SENSITIVE_INFO_CONSENT_VERSION` でバージョン管理

注意:

既存本番DBには `supabase/sensitive_info_consent_hardening.sql` の投入が必要。

残論点:

- 親本人が同意できない場合の法的整理
- 家族による代理入力の扱い
- 親本人への説明・通知
- 死亡後情報の扱い
- 家族間共有の同意

これらは弁護士レビューで最終確認する。

## まだ設計判断が必要なもの

### 1. オーナー死亡・アカウント承継

未設計。

論点:

- 家族代表が死亡・認知症・ログイン不能になった場合
- family ownerの移譲
- 複数ownerを許可するか
- 削除依頼と承継依頼の衝突

対応方針:

v0.3では未実装だが、v0.4候補として `family_members.role = owner` を複数許可するか検討する。

### 2. 実家写真の空き家特定リスク

未解決。

論点:

- EXIF/GPS除去
- 外観写真の注意
- 住所・鍵・ライフライン情報との組み合わせリスク
- storage URLの有効期限

対応方針:

写真アップロード前の注意文言と、サーバー側でのEXIF除去を検討する。

### 3. アカウント削除のSLA

未解決。

論点:

- 現状は削除依頼
- 要配慮情報の削除を手動放置できない
- 削除期限と監査ログ

対応方針:

削除依頼から何日以内に処理するかを運用・規約に明記し、将来的には自動削除ジョブを追加する。

## 事業・技術戦略への回答

外部レビューの「PMF前にWeb + Expo二重コードベースは重い」という指摘は妥当。

ただし現状はすでにExpo preview buildまで進んでいるため、方針は以下。

```txt
Expoを捨てるのではなく、追加機能を止める
Web診断 -> Stripe支払い意思 -> 家族3組テストを優先
Expoは既存機能の確認・家族ボード体験の検証に限定
```

次の優先順位:

1. 本番Supabaseへ未投入hardening SQLを投入
2. WebでStripe発動サポートパックを通す
3. 家族3組テスト
4. Magic Link / handoff / push tokenの実機確認
5. Expo追加機能は凍結

## レビュー継続時に見てほしいファイル

```txt
apps/web/app/api/handoff/consume/route.ts
packages/shared/src/index.ts
apps/web/lib/adminAuth.ts
apps/web/app/api/cron/send-due-notifications/route.ts
supabase/handoff_security_hardening.sql
supabase/sensitive_info_consent_hardening.sql
supabase/schema.sql
```
