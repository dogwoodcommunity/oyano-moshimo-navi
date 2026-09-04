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
assert.ok(releaseInputs.includes("| アカウント削除担当・代行者 | **主担当：代表取締役 池田哲也／代行者：池田知也** |"), "the release input ledger must retain both confirmed account-deletion assignees");
assert.ok(operationsRunbook.includes("| Supabase・個人情報削除担当 | **代表取締役 池田哲也**"), "the operations runbook must retain the confirmed account-deletion owner");
assert.ok(operationsRunbook.includes("| **池田知也**（役職・連絡手段は要指定。指定後は制限付き運用台帳に記録） |"), "the operations runbook must retain the confirmed delegate without inventing role or contact details");
assert.ok(operationsRunbook.includes("削除実行の正式運用を開始しない"), "account deletion must remain operationally closed until delegate and dual control are assigned");
assert.ok(adminAuthPolicy.includes("指名しただけではAdmin権限を付与しない"), "an operational assignment must not grant app-admin authorization");
assert.ok(releaseInputs.includes("| 障害対応責任者・代行者 | **主責任者：代表取締役 池田哲也／代行者：要確定** |"), "the release input ledger must retain the confirmed incident owner without inventing a delegate");
assert.ok(operationsRunbook.includes("| 障害対応主責任者 / Incident Commander | **代表取締役 池田哲也**"), "the operations runbook must retain the confirmed incident owner");
assert.ok(operationsRunbook.includes("これは全般的な運用責任者の指名や、Vercel・Supabase・GitHub・Resend・DNS等の実行権限付与を意味しない"), "the incident assignment must not imply broader operations ownership or service authorization");
assert.ok(operationsRunbook.includes("障害対応の正式運用を開始しない"), "incident response must remain operationally closed until delegate, contacts, alerts, on-call, and access are assigned");
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
