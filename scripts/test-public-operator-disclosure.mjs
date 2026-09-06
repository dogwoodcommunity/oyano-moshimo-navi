import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRequire = createRequire(path.join(root, "apps/web/package.json"));
const ts = webRequire("typescript");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const React = webRequire("react");
const env = {}; // Never read or change real production/environment settings.
function load(relative, imports) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relative), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, process: { env }, URL, Date,
    require: (name) => {
      if (name === "react/jsx-runtime") return webRequire(name);
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected module: ${name}`);
    }
  });
  return module.exports;
}
const readiness = load("apps/web/lib/commercialReadiness.ts", { "server-only": {} });
const imports = {
  "@/lib/commercialReadiness": readiness,
  "@oyano/shared": { SENSITIVE_INFO_CONSENT_TEXT: "Test consent", SENSITIVE_INFO_CONSENT_VERSION: "test" }
};
const pages = ["terms", "privacy"].map((name) => load(`apps/web/app/legal/${name}/page.tsx`, imports).default);
const renderPages = () => pages.map((Page) => renderToStaticMarkup(React.createElement(Page)));
const contact = {
  LEGAL_BUSINESS_NAME: "試験運営者",
  LEGAL_RESPONSIBLE_PERSON: "試験責任者",
  LEGAL_CONTACT: "support@example.test",
  LEGAL_CONTACT_RESPONSE_TARGET: "試験返信目安"
};
function reset(values = {}) {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, values);
}

assert.equal(readiness.getPublicOperatorContact(), null);
assert.equal(readiness.getPublicOperatorDisclosure(), null);
assert.equal(readiness.plusSalesReady(), false);
assert.equal(readiness.supportPackSalesReady(), false);
for (const html of renderPages()) assert.doesNotMatch(html, /href="mailto:/);

reset(contact);
assert.equal(readiness.getPublicOperatorContact().contact, contact.LEGAL_CONTACT);
assert.equal(readiness.getPublicOperatorDisclosure(), null);
assert.deepEqual(Array.from(readiness.missingFreeWebLegalKeys()), ["LEGAL_TERMS_EFFECTIVE_DATE", "LEGAL_PRIVACY_EFFECTIVE_DATE"]);
for (const html of renderPages()) {
  assert.match(html, /試験運営者/);
  assert.match(html, /試験責任者/);
  assert.match(html, /href="mailto:support@example.test"/);
  assert.match(html, /試験返信目安/);
  assert.match(html, /正式公開に向けて準備中/);
  assert.doesNotMatch(html, /施行日:/);
}
for (const key of Object.keys(contact)) {
  reset({ ...contact, [key]: "  " });
  assert.equal(readiness.getPublicOperatorContact(), null, `incomplete operator: ${key}`);
}

for (const input of ["javascript:alert(1)", "data:text/html,test", "file:///tmp/test", "not-an-address", "https://user:pass@example.test", "https://user@example.test", "info@example.test?subject=test", "info@example.test#test", "https://example.test/\nspoof"]) {
  assert.equal(readiness.legalContactHref(input), null, `unsafe contact: ${input}`);
  reset({ ...contact, LEGAL_CONTACT: input });
  assert.equal(readiness.getPublicOperatorContact(), null);
  assert.ok(readiness.missingFreeWebLegalKeys().includes("LEGAL_CONTACT"));
}
assert.equal(readiness.legalContactHref(" https://example.test/help "), "https://example.test/help");
assert.equal(readiness.isValidLegalEffectiveDate("2028年2月29日"), true);
for (const input of ["2026年2月29日", "2026年4月31日", "正式公開日", "2026-09-05", ""]) {
  assert.equal(readiness.isValidLegalEffectiveDate(input), false);
}

// Even fully configured payment providers cannot bypass missing/invalid dates.
const payment = {
  ...contact,
  LEGAL_ADDRESS: "試験所在地", LEGAL_PHONE: "試験電話", LEGAL_PHONE_HOURS: "試験時間",
  LEGAL_PRICE_DESCRIPTION: "試験価格", LEGAL_SERVICE_DELIVERY: "試験提供時期", LEGAL_CANCELLATION_POLICY: "試験解約方針",
  COMMERCIAL_PLUS_SALES_ENABLED: "true", COMMERCIAL_SUPPORT_PACK_SALES_ENABLED: "true",
  STRIPE_SECRET_KEY: "test-only", STRIPE_PLUS_PRICE_ID: "test-only", STRIPE_SUPPORT_PACK_PRICE_ID: "test-only",
  STRIPE_WEBHOOK_SECRET: "test-only", NEXT_PUBLIC_PLUS_PRICE_LABEL: "test-only"
};
reset(payment);
assert.equal(readiness.plusSalesReady(), false);
assert.equal(readiness.supportPackSalesReady(), false);
env.LEGAL_TERMS_EFFECTIVE_DATE = "2028年2月29日";
env.LEGAL_PRIVACY_EFFECTIVE_DATE = "2026年2月29日";
assert.equal(readiness.getPublicOperatorDisclosure(), null);
assert.equal(readiness.plusSalesReady(), false);
env.LEGAL_PRIVACY_EFFECTIVE_DATE = "2028年2月29日";
assert.equal(readiness.plusSalesReady(), true);
assert.equal(readiness.supportPackSalesReady(), true);
assert.equal(readiness.missingFreeWebLegalKeys().length, 0);
for (const html of renderPages()) {
  assert.match(html, /施行日: 2028年2月29日/);
  assert.doesNotMatch(html, /正式公開に向けて準備中/);
}
env.COMMERCIAL_PLUS_SALES_ENABLED = "false";
env.COMMERCIAL_SUPPORT_PACK_SALES_ENABLED = "false";
assert.equal(readiness.plusSalesReady(), false);
assert.equal(readiness.supportPackSalesReady(), false);

reset({ ...contact, LEGAL_BUSINESS_NAME: "<script>test</script>" });
for (const html of renderPages()) {
  assert.match(html, /&lt;script&gt;test&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>test<\/script>/);
}

// Render the actual privacy page: prohibited input is not automatic rejection,
// and declining to make professional judgments must not prohibit recording them.
const privacyHtml = renderPages()[1];
assert.match(privacyHtml, /<h2>入力・保存を禁止する情報<\/h2>/);
assert.doesNotMatch(privacyHtml, /<h2>保存しない情報<\/h2>|保存禁止の情報は預かりません|詳細住所は取得しません/);
assert.match(privacyHtml, /居住地域の入力欄では、番地、丁目、建物名などの詳細住所を求めません/);
assert.match(privacyHtml, /自由記述や写真の内容を自動で判別し、保存を防ぐ仕組みではありません/);
assert.match(privacyHtml, /端末内の手帳や、クラウド保存を利用した場合はクラウドにも残る可能性/);
const prohibitedList = privacyHtml.match(/<h2>入力・保存を禁止する情報<\/h2>\s*<ul[^>]*>([\s\S]*?)<\/ul>/)?.[1];
assert.ok(prohibitedList);
assert.match(prohibitedList, /銀行暗証番号|マイナンバー画像/);
assert.doesNotMatch(prohibitedList, /法律|税務|医療|判断/);
assert.match(privacyHtml, /<h2>本サービスが行わない判断<\/h2>/);
assert.match(privacyHtml, /医師などの専門家から伝えられた内容を手帳に記録することを禁止する趣旨ではありません/);
assert.match(privacyHtml, /一定の形式に一致するものを、送信前に自動で伏せます/);
assert.match(privacyHtml, /全角数字や異なる区切り方など、形式によっては検出できません/);
assert.match(privacyHtml, /すべての機密情報の送信を防ぐものではなく、元の手帳記録を書き換える処理でもありません/);

// Use actual shared display constants and the pure redactor, with no API calls.
const sharedConsult = load("packages/shared/src/consult.ts", {});
const maskedFields = sharedConsult.CONSULT_WITHHELD_FIELDS.filter((field) => field.includes("自動で伏せ"));
assert.equal(maskedFields.length, 2);
for (const field of maskedFields) {
  assert.match(field, /一定の形式/);
  assert.match(field, /検出できない/);
  assert.doesNotMatch(field, /（自動で伏せます）/);
}
assert.ok(maskedFields.some((field) => field.includes("送信される可能性")));
assert.ok(maskedFields.some((field) => field.includes("全角数字")));
for (const relative of ["apps/web/components/ConsultPanel.tsx", "apps/mobile/app/consult.tsx"]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  assert.match(source, /送信から除く情報・伏せ字の対象/);
  assert.doesNotMatch(source, />送らないもの</);
}
const { redactSensitive } = load("apps/web/lib/consult.ts", { "@oyano/shared": sharedConsult });
assert.equal(redactSensitive("09000000000"), "［伏字］");
assert.equal(redactSensitive("test@example.test"), "［伏字］");
assert.equal(redactSensitive("医師から水分を取るようにと言われた。"), "医師から水分を取るようにと言われた。");

console.log("public operator contact, rendering, privacy data boundaries and formal release gate tests passed");
