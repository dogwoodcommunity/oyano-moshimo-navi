# Privacy and App Review Guardrails

親のもしもナビ v0.3 は、親の入院、認知症、危篤、死亡など、要配慮個人情報に該当し得る情報を扱う前提で設計する。
この文書はリリース前の実装・審査・法務確認のためのガードレールであり、正式な法的助言ではない。

## リリース前ブロッカー

- プライバシーポリシーに要配慮情報の取扱い、本人または家族による同意、利用目的、第三者提供、削除依頼、データ保管場所を明記する。
- 状況整理チェックとアプリログイン前に、親本人の情報を必要最小限で入力する旨を表示する。
- App Store Connectに提出するPrivacy Policy URLを本番URLで確定する。
- Supabase本番Projectのリージョン、暗号化、RLS、Storage権限、service role keyの管理方針を記録する。
- アカウント削除または削除依頼の導線をアプリ内に用意する。

## 本人同意の考え方

- 登録者は子世代でも、情報の本人は親であることが多い。
- 本人の意思確認が可能な場合は、サービスの目的と家族内共有範囲を説明したうえで登録する。
- 本人の意思確認が困難な場合は、生活支援、医療・介護・死後手続きの整理に必要な最小限の情報に限定する。
- 暗証番号、パスワード、マイナンバー画像、健康保険証や通帳の全面コピーは保存対象にしない。

## 実装済みの同意記録

- Web診断送信時に、要配慮情報に該当し得ることの理解と、必要最小限の入力に関する同意を必須にする。
- 同意文言は `SENSITIVE_INFO_CONSENT_VERSION` でバージョン管理する。
- `cases` に `consent_to_sensitive_info`、`sensitive_info_consent_version`、`sensitive_info_consented_at` を保存する。
- `consent_logs` に同意種別、同意文言、User-Agent、IPを保存する。
- 本番既存DBには `supabase/sensitive_info_consent_hardening.sql` を投入する。

## 実家写真の安全管理

- 実家写真アップロードURLは、Bearer認証と家族メンバー確認後に発行する。
- 直接Storageへ広くアップロードできるpolicyは使わず、既存DBでは `supabase/home_photo_security_hardening.sql` で広いinsert policyを削除する。
- アプリ内では、表札、住所、鍵番号、郵便物、車のナンバー、空き家と分かる外観写真を避けるよう表示する。
- 位置情報つき写真は、端末側で位置情報を削除してから保存するよう案内する。

## App Store審査方針

- アプリ内では発動サポートパックの購入導線を出さない。
- アプリ内では「Webで申し込めます」「外部決済」「Stripe」など、購入場所を示す文言を出さない。
- アプリ内は申込済み、確認中、レビュー中、完了などの状態表示に留める。
- Family Plusなどの継続課金は、初期版では状態表示に留め、IAPを実装する場合は価格、特典、解約導線をApp Store側の要件と同期する。

## 参照した一次情報

- 個人情報保護委員会: 法令・ガイドライン等
  https://www.ppc.go.jp/personalinfo/legal/
- Apple: App Review Guidelines
  https://developer.apple.com/app-store/review/guidelines/
