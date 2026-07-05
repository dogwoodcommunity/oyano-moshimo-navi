# Supabase テーブル設計 v0.3

## Core

- profiles: Supabase auth userのプロフィール
- families: 家族グループ
- family_members: 家族メンバーと権限
- people: 親/対象者
- person_status_events: 状態変更履歴

## Tasks

- task_templates: ステータス別タスクのマスター
- tasks: 実際に生成されたタスク
- task_comments: 家族内コメント

## Information Registry

- asset_categories: 銀行/保険/年金/不動産/葬儀/墓/重要書類/デジタル/実家など
- asset_items: 存在・保管場所・把握状況

## Timeline

- timeline_events: 入院、施設入居、死亡、葬儀後、書類発見、業者相談など

## Home/Jikka Module

- homes: 実家/不動産情報
- home_photos: 実家・家財写真
- home_diagnoses: 家じまい診断結果

## Web Diagnosis

- cases: Web入口診断ケース
- case_photos: Web診断時写真
- case_results: 診断結果

## Sharing/Notifications

- family_invites: 招待
- share_links: 家族共有リンク
- push_tokens: Expo push token
- notification_preferences: 通知設定
- scheduled_notifications: 通知予定

## Providers

- provider_categories: 業者/士業カテゴリ
- providers: 事業者/士業プロフィール
- provider_recommendations: 診断結果に応じた候補提示
- referrals: 送客履歴
- consent_logs: 同意履歴

## Payments/Support

- products: 商品定義
- purchases: 購入履歴
- subscriptions: 継続課金ステータス
- support_packs: 発動サポート案件
- support_reviews: 人力レビュー/レポート

## Admin/Audit

- admin_notes: 管理者メモ
- audit_logs: 重要操作ログ
