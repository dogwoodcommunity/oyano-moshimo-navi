import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const readiness = read("apps/web/lib/commercialReadiness.ts");
const plans = read("apps/web/app/plans/page.tsx");
const upgrade = read("apps/web/components/PlusUpgrade.tsx");
const plusCheckout = read("apps/web/app/api/stripe/plus-checkout/route.ts");
const supportCheckout = read("apps/web/app/api/stripe/checkout/route.ts");
const supportPage = read("apps/web/app/support-pack/page.tsx");
const supportClient = read("apps/web/app/support-pack/SupportPackClient.tsx");
const tokushoho = read("apps/web/app/legal/tokushoho/page.tsx");
const privacy = read("apps/web/app/legal/privacy/page.tsx");
const terms = read("apps/web/app/legal/terms/page.tsx");
const layout = read("apps/web/app/layout.tsx");
const envExample = read("apps/web/.env.example");
const adminEnv = read("apps/web/app/api/admin/env-check/route.ts");
const releaseInputs = read("docs/COMMERCIAL_RELEASE_INPUTS.md");
const operationsRunbook = read("docs/COMMERCIAL_OPERATIONS_RUNBOOK.md");
const adminAuthPolicy = read("docs/ADMIN_AUTH_POLICY.md");
const productionChecklist = read("docs/PRODUCTION_CHECKLIST.md");

const legalKeys = [
  "LEGAL_BUSINESS_NAME",
  "LEGAL_RESPONSIBLE_PERSON",
  "LEGAL_ADDRESS",
  "LEGAL_PHONE",
  "LEGAL_PHONE_HOURS",
  "LEGAL_CONTACT",
  "LEGAL_CONTACT_RESPONSE_TARGET",
  "LEGAL_TERMS_EFFECTIVE_DATE",
  "LEGAL_PRIVACY_EFFECTIVE_DATE",
  "LEGAL_PRICE_DESCRIPTION",
  "LEGAL_SERVICE_DELIVERY",
  "LEGAL_CANCELLATION_POLICY"
];

const saleSwitches = [
  "COMMERCIAL_SUPPORT_PACK_SALES_ENABLED",
  "COMMERCIAL_PLUS_SALES_ENABLED"
];

for (const key of legalKeys) {
  assert.ok(readiness.includes(`"${key}"`), `commercial readiness must require ${key}`);
  assert.ok(envExample.includes(`${key}=`), `.env.example must document ${key}`);
  assert.ok(adminEnv.includes(`"${key}"`), `admin env check must report ${key}`);
}

for (const key of saleSwitches) {
  assert.ok(readiness.includes(`enabled("${key}")`), `commercial readiness must require explicit ${key}`);
  assert.ok(envExample.includes(`${key}=false`), `.env.example must keep ${key} closed by default`);
  assert.ok(adminEnv.includes(`"${key}"`), `admin env check must report ${key}`);
}

assert.ok(adminEnv.includes("configured: isConfigured(key)"), "admin env readiness must use the validated configuration check");
assert.ok(adminEnv.includes("isValidLegalEffectiveDate(current)"), "admin env readiness must reject invalid legal effective dates");

assert.ok(envExample.includes("LEGAL_BUSINESS_NAME=株式会社BEECH"), "the release configuration example must retain the confirmed operator name");
assert.ok(releaseInputs.includes("| サービス運営者の正式名称 | **株式会社BEECH** |"), "the release input ledger must retain the confirmed operator name");
assert.ok(envExample.includes("LEGAL_RESPONSIBLE_PERSON=代表取締役 池田哲也"), "the release configuration example must retain the confirmed responsible person");
assert.ok(releaseInputs.includes("| 個人情報管理責任者の氏名または役職 | **代表取締役 池田哲也** |"), "the release input ledger must retain the confirmed responsible person");
assert.ok(envExample.includes("LEGAL_CONTACT=info@bee-ch.co.jp"), "the release configuration example must retain the confirmed public contact");
assert.ok(releaseInputs.includes("| 利用者向け問い合わせ先 | **info@bee-ch.co.jp** |"), "the release input ledger must retain the confirmed public contact");
assert.ok(envExample.includes("LEGAL_CONTACT_RESPONSE_TARGET=メール受付：24時間／原則3営業日以内に返信"), "the release configuration example must retain the confirmed response target");
assert.ok(releaseInputs.includes("| 問い合わせ受付時間・一次返信目標 | **メール受付：24時間／原則3営業日以内に返信** |"), "the release input ledger must retain the confirmed response target");
assert.ok(envExample.includes("LEGAL_TERMS_EFFECTIVE_DATE=\n"), "the terms effective date must remain empty until the actual public release date is known");
assert.doesNotMatch(envExample, /LEGAL_TERMS_EFFECTIVE_DATE=(?:正式公開日と同日|要確定)/, "a policy label must never be accepted as the effective-date env value");
assert.ok(releaseInputs.includes("| 利用規約の施行日 | **正式公開日と同日** |"), "the release input ledger must retain the confirmed terms effective-date policy");
assert.ok(envExample.includes("LEGAL_PRIVACY_EFFECTIVE_DATE=\n"), "the privacy effective date must remain empty until the actual public release date is known");
assert.doesNotMatch(envExample, /LEGAL_PRIVACY_EFFECTIVE_DATE=(?:正式公開日と同日|要確定)/, "a policy label must never be accepted as the privacy effective-date env value");
assert.ok(releaseInputs.includes("| プライバシーポリシーの施行日 | **正式公開日と同日** |"), "the release input ledger must retain the confirmed privacy effective-date policy");
assert.ok(releaseInputs.includes("| アカウント削除担当・代行者 | **主担当：代表取締役 池田哲也／代行者：システム責任者 池田知也** |"), "the release input ledger must retain both confirmed account-deletion assignees and the delegate title");
assert.ok(releaseInputs.includes("| アカウント完全削除の実行予定者 | **システム責任者 池田知也（指名方針のみ）** |"), "the release input ledger must retain the intended deletion executor without claiming authorization");
assert.ok(operationsRunbook.includes("| Supabase・個人情報削除担当 | **代表取締役 池田哲也**"), "the operations runbook must retain the confirmed account-deletion owner");
assert.ok(operationsRunbook.includes("| アカウント完全削除の実行予定者 | **システム責任者 池田知也**（指名方針のみ。本人用個別Supabase Authの招待受諾・メール確認済み。TOTP・正確なuser ID照合・`account_delete_executors` 登録は未実施）"), "the runbook must distinguish confirmed identity email from pending MFA and authorization");
assert.ok(releaseInputs.includes("主担当不在時に削除依頼の受付・本人確認・実行担当への引継ぎを代行。本番削除は登録済み削除実行者と別確認者の二者で実施"), "the release input ledger must retain the confirmed account-deletion delegate scope");
assert.ok(releaseInputs.includes("メールによる削除依頼は `info@bee-ch.co.jp` の共有受信箱で受けて両名へ通知する方針"), "the release input ledger must retain the confirmed email account-deletion inbox policy");
assert.ok(releaseInputs.includes("アプリ内依頼は `/admin/delete-requests` のDBキューへ入り、現行実装では自動メール通知しない"), "the release input ledger must distinguish in-app deletion requests from email intake");
assert.ok(operationsRunbook.includes("受付経路は主担当と同じ。実際の権限・通知設定・2経路の試験は要確認"), "the operations runbook must retain the account-deletion delegate title and scope without claiming unverified routing");
assert.ok(operationsRunbook.includes("現行実装は、このDBキューへの保存時に自動メール通知を行わない"), "the runbook must not claim that in-app deletion requests currently generate email");
assert.ok(operationsRunbook.includes("共有パスワードを使わず、個別アカウントへの委任または追跡可能な転送を使う"), "shared inbox access must be individually attributable");
assert.ok(operationsRunbook.includes("共有受信箱のパスワード、MFA、復旧コードはGitや一般チャットへ記録しない"), "shared inbox credentials and recovery material must remain out of tracked documentation and general chat");
assert.ok(operationsRunbook.includes("身分証画像、パスワード、Magic Link、access tokenは受け取らない"), "identity verification must not collect authentication secrets or identity documents");
assert.ok(operationsRunbook.includes("削除実行の正式運用を開始しない"), "account deletion must remain operationally closed until delegate and dual control are assigned");
assert.ok(adminAuthPolicy.includes("指名しただけではAdmin権限を付与しない"), "an operational assignment must not grant app-admin authorization");
assert.ok(adminAuthPolicy.includes("現行の `app_admin` は削除専用roleではなく、全Admin APIに共通する管理者権限"), "the policy must retain that app_admin is broader than deletion execution");
assert.ok(adminAuthPolicy.includes("削除実行予定者の指名だけでは、Supabase Authユーザー、MFA、`account_delete_executors` 行、Vercel・Supabase等の本番権限を作成・付与しない"), "the intended executor assignment must not create production identity or authorization");
assert.ok(adminAuthPolicy.includes("削除専用roleは `account_delete_executors` で管理し、有効化済み・未失効の個別ユーザーだけを受け付ける"), "the policy must document the active and unrevoked deletion-only allowlist");
assert.ok(adminAuthPolicy.includes("一般Admin APIへは権限を広げない"), "the deletion-only role must not widen general Admin access");
assert.ok(adminAuthPolicy.includes("実削除は登録済みTOTPで追加認証したAAL2を必須"), "account erasure must require verified MFA step-up");
assert.ok(adminAuthPolicy.includes("本人だけが `/admin/delete-requests/setup` を開き"), "the policy must document the operator-only setup route");
assert.ok(adminAuthPolicy.includes("verified TOTPが1件でも、現在のセッションがAAL2になるまで設定完了と扱わない"), "existing MFA enrollment alone must not count as current possession");
assert.ok(adminAuthPolicy.includes("この画面から新規ユーザー、`profiles`、家族、対象者、削除専用roleを作らない"), "MFA setup must remain separate from profile and role creation");
assert.ok(adminAuthPolicy.includes("削除依頼の一覧・状態変更・事前確認・実行では一切受け付けない"), "the static emergency token must not enter any deletion surface");
assert.ok(productionChecklist.includes("[x] アカウント完全削除の実行予定者を `システム責任者 池田知也` とする方針を確定（指名のみ、権限未付与）"), "the checklist must distinguish executor assignment from authorization");
assert.ok(productionChecklist.includes("[x] 一般Admin APIへ広がらない削除専用role、Bearer限定認証、実削除時AAL2、原子的な状態更新・監査を実装・ローカル検証"), "the checklist must record the locally verified least-privilege implementation");
assert.ok(productionChecklist.includes("[x] 本番へ削除専用roleと更新済み削除pipelineをmigration"), "the checklist must record the verified production migration");
assert.ok(productionChecklist.includes("[ ] `/admin/delete-requests/setup` でverified TOTPと現在のAAL2を確認"), "operator MFA and current possession must remain pending");
assert.ok(productionChecklist.includes("[ ] 上記確認後に `account_delete_executors` へ有効登録"), "the named operator must remain unregistered until external checks pass");
assert.ok(productionChecklist.includes("[ ] 削除実行者とは別の確認者を指名"), "a separate deletion verifier must remain pending");
assert.ok(envExample.includes("ACCOUNT_ERASURE_EXECUTION_ENABLED=false"), "the destructive account-erasure execution switch must remain disabled by default");
assert.ok(productionChecklist.includes("`ACCOUNT_ERASURE_EXECUTION_ENABLED=false` を維持する"), "production account erasure must remain disabled until its external prerequisites pass");
assert.ok(productionChecklist.includes("`ACCOUNT_ERASURE_EXECUTION_ENABLED=true` を承認"), "the destructive execution switch must remain behind production migration and end-to-end checks");
assert.ok(operationsRunbook.includes("二者確認は運用手順であり、実行APIが技術的に二人の承認を強制するものではない"), "the release gate must retain the limitation that dual control is operational rather than API-enforced");
assert.ok(releaseInputs.includes("| 障害対応責任者・代行者 | **主責任者：代表取締役 池田哲也／代行者：システム責任者 池田知也** |"), "the release input ledger must retain both confirmed incident-response assignees and titles");
assert.ok(operationsRunbook.includes("| 障害対応主責任者 / Incident Commander | **代表取締役 池田哲也**（内部連絡手段は要指定。指定後は制限付き運用台帳に記録） | **システム責任者 池田知也**（責任範囲：主責任者不在時の連絡・初動判断の代行。本番操作は別途権限を持つ担当者が実施。内部連絡手段は要指定） |"), "the operations runbook must retain both assignees, titles, and confirmed delegate scope without inventing contact details");
assert.doesNotMatch(envExample, /LEGAL_RESPONSIBLE_PERSON=システム責任者 池田知也/, "the system title must not replace the confirmed public legal responsible person");
assert.ok(releaseInputs.includes("本番操作は別途権限を持つ担当者が実施"), "the release ledger must keep incident delegation separate from production execution authorization");
assert.ok(operationsRunbook.includes("これは全般的な運用責任者の指名や、Vercel・Supabase・GitHub・Resend・DNS等の実行権限付与を意味しない"), "the incident assignment must not imply broader operations ownership or service authorization");
assert.ok(operationsRunbook.includes("障害対応の正式運用を開始しない"), "incident response must remain operationally closed until delegate, contacts, alerts, on-call, and access are assigned");
assert.ok(operationsRunbook.includes("初動判断」は、暫定的なSEV分類、変更停止・証拠保全の依頼、権限を持つ担当者の招集まで"), "the delegate's initial-decision scope must remain bounded");
assert.ok(operationsRunbook.includes("主責任者不在時に代行者が最終承認できる範囲は未確定"), "delegate scope must not silently grant final approval authority");
assert.ok(operationsRunbook.includes("Incident Commanderの承認権限と、実際にVercelのrollback、SupabaseのDB操作、secret rotation等を実行できるサービス権限は別に管理する"), "incident approval and execution authorization must remain separated");

assert.ok(plans.includes("<PlusUpgrade salesReady={salesReady} />"), "the plans page must pass server-side sale readiness to the client");
assert.ok(plans.includes('plan.name === "Family Plus" && !salesReady'), "closed Plus sales must not render an actionable plan link");
assert.ok(plans.includes('aria-disabled="true"'), "closed Plus sales must be exposed as unavailable to assistive technology");
assert.ok(upgrade.includes("現在は受付準備中です"), "closed Plus sales must be explained before asking for sign-in");
assert.ok(supportPage.includes("<SupportPackClient salesReady={salesReady} />"), "support-pack readiness must come from the server");
assert.ok(supportClient.includes("現在は受付準備中です"), "closed support-pack sales must hide its application form");

const plusReadinessIndex = plusCheckout.indexOf("if (!plusSalesReady())");
const plusRateLimitIndex = plusCheckout.indexOf("const limited = await checkPublicRateLimit");
assert.ok(plusReadinessIndex >= 0 && plusReadinessIndex < plusRateLimitIndex, "closed Plus checkout must stop before rate-limit or database side effects");

const supportReadinessIndex = supportCheckout.indexOf("if (!supportPackSalesReady())");
const supportRateLimitIndex = supportCheckout.indexOf("const rateLimited = await checkPublicRateLimit");
assert.ok(supportReadinessIndex >= 0 && supportReadinessIndex < supportRateLimitIndex, "closed support-pack checkout must stop before rate-limit or database side effects");

assert.doesNotMatch(tokushoho, /\[正式名称を要確定\]|\[代表者または通信販売業務責任者を要確定\]|\[事業者住所を要確定\]/, "public legal page must not expose draft placeholders");
assert.ok(tokushoho.includes("有料サービスは受付準備中です"), "the legal page must clearly disclose when sales are closed");
assert.ok(tokushoho.includes("disclosure.cancellationPolicy"), "open sales must publish cancellation and refund terms");
assert.ok(readiness.includes("getPublicOperatorDisclosure()"), "paid sales must also require the free Web legal identity and effective dates");
assert.ok(readiness.includes("isValidLegalEffectiveDate(current)"), "public legal readiness must require real effective dates instead of non-empty placeholders");
assert.ok(readiness.includes("legalContactHref"), "published contact destinations must reject unsafe URL schemes");
assert.ok(privacy.includes("operator.privacyEffectiveDate"), "privacy policy must publish its configured effective date");
assert.ok(terms.includes("operator.termsEffectiveDate"), "terms must publish their configured effective date");
assert.ok(tokushoho.includes("disclosure.contactResponseTarget"), "commercial disclosure must publish the configured response target");
for (const page of [privacy, terms]) {
  assert.ok(page.includes("operator.operatorName"), "formal free Web legal pages must publish the configured operator");
  assert.ok(page.includes("operator.contact"), "formal free Web legal pages must publish the configured contact");
  assert.ok(page.includes("operator.contactResponseTarget"), "formal free Web legal pages must publish the configured response target");
}
assert.ok(layout.includes('href="/legal/privacy#contact"'), "the public footer must provide a direct contact route");
for (const page of [tokushoho, privacy, terms]) {
  assert.ok(page.includes("contactHref ? <a href={contactHref}"), "configured contacts must be actionable when they are safe URLs or email addresses");
}
assert.match(plusCheckout, /family\.owner_user_id !== context\.userId/, "Plus checkout must require the current family owner on the server");

console.log("commercial release gate tests passed");
