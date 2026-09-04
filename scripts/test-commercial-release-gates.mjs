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

const legalKeys = [
  "LEGAL_BUSINESS_NAME",
  "LEGAL_RESPONSIBLE_PERSON",
  "LEGAL_ADDRESS",
  "LEGAL_PHONE",
  "LEGAL_PHONE_HOURS",
  "LEGAL_CONTACT",
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
assert.ok(readiness.includes("legalContactHref"), "published contact destinations must reject unsafe URL schemes");
assert.ok(privacy.includes("operator.privacyEffectiveDate"), "privacy policy must publish its configured effective date");
assert.ok(terms.includes("operator.termsEffectiveDate"), "terms must publish their configured effective date");
for (const page of [privacy, terms]) {
  assert.ok(page.includes("operator.operatorName"), "formal free Web legal pages must publish the configured operator");
  assert.ok(page.includes("operator.contact"), "formal free Web legal pages must publish the configured contact");
}
assert.ok(layout.includes('href="/legal/privacy#contact"'), "the public footer must provide a direct contact route");
for (const page of [tokushoho, privacy, terms]) {
  assert.ok(page.includes("contactHref ? <a href={contactHref}"), "configured contacts must be actionable when they are safe URLs or email addresses");
}
assert.match(plusCheckout, /family\.owner_user_id !== context\.userId/, "Plus checkout must require the current family owner on the server");

console.log("commercial release gate tests passed");
